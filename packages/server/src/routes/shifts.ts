import type { FastifyInstance } from "fastify";
import { z } from "zod";
import fs from "node:fs";
import { prisma } from "../db.js";
import {
  buildShiftSnapshot,
  closeShift,
  getOpenShift,
} from "../services/shift.js";
import { auditLog } from "../services/audit.js";

import { loadAdminContext } from "../admin-guard.js";

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "shifts.view");
  });

  app.get("/current", async (request) => {
    return getOpenShift(request.user.sub);
  });

  app.get("/", async () => {
    return prisma.shift.findMany({
      orderBy: { openedAt: "desc" },
      take: 100,
      include: { admin: { select: { displayName: true, login: true } } },
    });
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { admin: { select: { displayName: true, login: true } } },
    });
    if (!shift) return reply.notFound();
    const snapshot = shift.snapshotJson
      ? JSON.parse(shift.snapshotJson)
      : await buildShiftSnapshot(id);
    return { shift, snapshot };
  });

  app.post("/open", async (request, reply) => {
    await app.assertPerm(request, "shifts.manage");
    const body = z
      .object({ openingCash: z.number().min(0).default(0), notes: z.string().optional() })
      .parse(request.body ?? {});

    const existing = await getOpenShift(request.user.sub);
    if (existing) return reply.conflict("Смена уже открыта");

    const shift = await prisma.shift.create({
      data: {
        adminId: request.user.sub,
        openingCash: body.openingCash,
        notes: body.notes,
        status: "open",
      },
    });
    await auditLog({
      adminId: request.user.sub,
      action: "shift.open",
      entity: "shift",
      entityId: shift.id,
      details: { openingCash: body.openingCash },
    });
    return shift;
  });

  app.post("/:id/close", async (request, reply) => {
    await app.assertPerm(request, "shifts.manage");
    const { id } = request.params as { id: string };
    const body = z
      .object({
        closingCash: z.number().min(0),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) return reply.notFound();
    if (shift.adminId !== request.user.sub && !request.adminPerms?.isSuperAdmin) {
      return reply.forbidden("Only own shift or super admin");
    }
    if (shift.status !== "open") return reply.badRequest("Смена уже закрыта");

    const result = await closeShift(id, body.closingCash, body.notes);
    return result;
  });

  app.get("/:id/pdf", async (request, reply) => {
    const { id } = request.params as { id: string };
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift?.reportPdfPath || !fs.existsSync(shift.reportPdfPath)) {
      return reply.notFound("PDF не найден");
    }
    const buf = fs.readFileSync(shift.reportPdfPath);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="shift-${id}.pdf"`)
      .send(buf);
  });

  app.get("/:id/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift?.exportPath || !fs.existsSync(shift.exportPath)) {
      return reply.notFound("Файл смены не найден");
    }
    const buf = fs.readFileSync(shift.exportPath);
    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="shift-${id}.dshift.json"`)
      .send(buf);
  });

  app.post("/import", async (request, reply) => {
    const body = z.object({ snapshot: z.record(z.unknown()) }).parse(request.body);
    return { ok: true, imported: body.snapshot, message: "Просмотр в админке → Смены" };
  });
}
