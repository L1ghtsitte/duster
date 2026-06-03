import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";

export async function featureRoutes(app: FastifyInstance): Promise<void> {
  // --- Anticheat ---
  app.get("/anticheat/processes", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "anticheat.manage");
    return prisma.blockedProcess.findMany({ orderBy: { namePattern: "asc" } });
  });

  app.post("/anticheat/processes", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "anticheat.manage");
    const body = z
      .object({
        namePattern: z.string(),
        action: z.enum(["kill", "alert"]).default("kill"),
        alertAdmin: z.boolean().optional(),
      })
      .parse(request.body);
    return prisma.blockedProcess.create({ data: body });
  });

  app.delete("/anticheat/processes/:id", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "anticheat.manage");
    await prisma.blockedProcess.delete({ where: { id: (request.params as { id: string }).id } });
    return { ok: true };
  });

  app.get("/anticheat/agent-list/:computerId", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "anticheat.manage");
    const { computerId } = request.params as { computerId: string };
    const { hub } = await import("../hub.js");
    hub.sendToAgent(computerId, { type: "list_processes" });
    return { ok: true, hint: "Poll WS for process_list event" };
  });

  // --- QR login ---
  app.post("/players/:id/qr-token", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "players.edit");
    const { id } = request.params as { id: string };
    const body = z.object({ computerId: z.string().optional() }).parse(request.body ?? {});
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await prisma.qrLoginToken.create({
      data: { playerId: id, token, computerId: body.computerId, expiresAt },
    });
    return { token, expiresAt, url: `/station/qr?token=${token}` };
  });

  // --- Calendar ---
  app.get("/reservations/calendar", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "reservations.view");
    const q = z
      .object({ from: z.string(), to: z.string() })
      .parse(request.query);
    return prisma.reservation.findMany({
      where: {
        status: { not: "cancelled" },
        startAt: { lt: new Date(q.to) },
        endAt: { gt: new Date(q.from) },
      },
      include: {
        computer: { select: { number: true, name: true } },
        player: { select: { displayName: true } },
      },
    });
  });

  // --- Excel export shift ---
  app.get("/shifts/:id/export-xlsx", async (request, reply) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "reports.export");
    const { id } = request.params as { id: string };
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { admin: true },
    });
    if (!shift?.snapshotJson) return reply.notFound();
    const snap = JSON.parse(shift.snapshotJson) as {
      sales: { createdAt: string; total: number; payment: string; playerName: string | null }[];
      topups: { createdAt: string; amount: number; bonusAmount: number; playerName: string }[];
    };
    const rows = [
      ["Duster Shift Export"],
      ["Shift", id],
      [],
      ["Sales"],
      ["Date", "Total", "Payment", "Player"],
      ...snap.sales.map((s) => [s.createdAt, String(s.total), s.payment, s.playerName ?? ""]),
      [],
      ["Topups"],
      ["Date", "Amount", "Bonus", "Player"],
      ...snap.topups.map((t) => [t.createdAt, String(t.amount), String(t.bonusAmount), t.playerName]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="shift-${id}.csv"`)
      .send(bom + csv);
  });
}
