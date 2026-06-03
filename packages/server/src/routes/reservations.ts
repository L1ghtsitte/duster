import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";

async function assertNoConflict(
  computerId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<void> {
  const conflict = await prisma.reservation.findFirst({
    where: {
      computerId,
      status: { not: "cancelled" },
      id: excludeId ? { not: excludeId } : undefined,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (conflict) throw new Error("RESERVATION_CONFLICT");

  const session = await prisma.session.findFirst({
    where: {
      computerId,
      status: "active",
      startedAt: { lt: endAt },
      OR: [{ endsAt: null }, { endsAt: { gt: startAt } }],
    },
  });
  if (session) throw new Error("SESSION_CONFLICT");
}

export async function reservationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "reservations.view");
  });

  app.get("/", async (request) => {
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        computerId: z.string().optional(),
      })
      .parse(request.query);

    const where: Record<string, unknown> = { status: { not: "cancelled" } };
    if (q.computerId) where.computerId = q.computerId;
    if (q.from || q.to) {
      where.startAt = { lte: q.to ? new Date(q.to) : undefined };
      where.endAt = { gte: q.from ? new Date(q.from) : undefined };
    }

    return prisma.reservation.findMany({
      where,
      include: {
        computer: { select: { id: true, name: true, number: true } },
        player: { select: { id: true, displayName: true } },
        admin: { select: { displayName: true } },
      },
      orderBy: { startAt: "asc" },
    });
  });

  app.post("/", async (request, reply) => {
    await app.assertPerm(request, "reservations.edit");
    const body = z
      .object({
        computerId: z.string(),
        playerId: z.string().optional(),
        title: z.string().optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (endAt <= startAt) return reply.badRequest("endAt must be after startAt");

    try {
      await assertNoConflict(body.computerId, startAt, endAt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return reply.conflict(msg === "SESSION_CONFLICT" ? "Active session on PC" : "PC reserved");
    }

    const res = await prisma.reservation.create({
      data: {
        computerId: body.computerId,
        playerId: body.playerId,
        adminId: request.user.sub,
        title: body.title,
        startAt,
        endAt,
        notes: body.notes,
      },
      include: { computer: true, player: true },
    });

    await prisma.computer.update({
      where: { id: body.computerId },
      data: { status: "reserved" },
    });

    return res;
  });

  app.patch("/:id", async (request, reply) => {
    await app.assertPerm(request, "reservations.edit");
    const { id } = request.params as { id: string };
    const body = z
      .object({
        computerId: z.string().optional(),
        playerId: z.string().nullable().optional(),
        title: z.string().optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        status: z.enum(["confirmed", "cancelled", "completed"]).optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const current = await prisma.reservation.findUniqueOrThrow({ where: { id } });
    const computerId = body.computerId ?? current.computerId;
    const startAt = body.startAt ? new Date(body.startAt) : current.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : current.endAt;

    if (body.status !== "cancelled") {
      try {
        await assertNoConflict(computerId, startAt, endAt, id);
      } catch {
        return reply.conflict("PC busy in this slot");
      }
    }

    return prisma.reservation.update({
      where: { id },
      data: {
        computerId: body.computerId,
        playerId: body.playerId,
        title: body.title,
        startAt: body.startAt ? startAt : undefined,
        endAt: body.endAt ? endAt : undefined,
        status: body.status,
        notes: body.notes,
      },
      include: { computer: true, player: true },
    });
  });

  app.delete("/:id", async (request) => {
    await app.assertPerm(request, "reservations.edit");
    const { id } = request.params as { id: string };
    const r = await prisma.reservation.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return r;
  });
}
