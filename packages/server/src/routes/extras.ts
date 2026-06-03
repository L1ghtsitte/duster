import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";
import { auditLog } from "../services/audit.js";
import { verifyOfflineSession } from "../services/offline-session.js";

export async function extrasRoutes(app: FastifyInstance): Promise<void> {
  // --- Audit ---
  app.get("/audit", { preHandler: pre(app, "audit.view") }, async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 100);
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { displayName: true, login: true } } },
    });
  });

  // --- Announcements ---
  app.get("/announcements/active", async () => {
    const now = new Date();
    return prisma.announcement.findMany({
      where: {
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  app.post("/announcements", { preHandler: pre(app, "announcements.send") }, async (request) => {
    const body = z
      .object({
        title: z.string(),
        body: z.string(),
        expiresAt: z.string().datetime().optional(),
      })
      .parse(request.body);
    const a = await prisma.announcement.create({
      data: {
        adminId: request.user.sub,
        title: body.title,
        body: body.body,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    await auditLog({
      adminId: request.user.sub,
      action: "announcement.send",
      entity: "announcement",
      entityId: a.id,
      details: { title: body.title },
    });
    return a;
  });

  // --- Tariffs ---
  app.get("/tariffs", { preHandler: pre(app, "settings.tariffs") }, async () => {
    return prisma.tariffRule.findMany({ orderBy: { priority: "desc" } });
  });

  app.post("/tariffs", { preHandler: pre(app, "settings.tariffs") }, async (request) => {
    const body = z
      .object({
        name: z.string(),
        zone: z.string().optional(),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
        hourFrom: z.number().int().min(0).max(23),
        hourTo: z.number().int().min(1).max(24),
        pricePerHour: z.number().positive(),
        priority: z.number().int().optional(),
      })
      .parse(request.body);
    return prisma.tariffRule.create({ data: body });
  });

  app.patch("/tariffs/:id", { preHandler: pre(app, "settings.tariffs") }, async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        pricePerHour: z.number().optional(),
        active: z.boolean().optional(),
        hourFrom: z.number().optional(),
        hourTo: z.number().optional(),
      })
      .parse(request.body);
    return prisma.tariffRule.update({ where: { id }, data: body });
  });

  app.delete("/tariffs/:id", { preHandler: pre(app, "settings.tariffs") }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.tariffRule.delete({ where: { id } });
    return { ok: true };
  });

  // --- PC Profiles ---
  app.get("/pc-profiles", { preHandler: pre(app, "computers.profiles") }, async () => {
    return prisma.pcProfile.findMany({ include: { _count: { select: { computers: true } } } });
  });

  app.post("/pc-profiles", { preHandler: pre(app, "computers.profiles") }, async (request) => {
    const body = z
      .object({
        name: z.string(),
        zone: z.string().optional(),
        brightness: z.number().optional(),
        mouseSpeed: z.number().optional(),
        blockUsbStorage: z.boolean().optional(),
        allowUsbCharge: z.boolean().optional(),
        cleanupOnLock: z.boolean().optional(),
      })
      .parse(request.body);
    return prisma.pcProfile.create({ data: body });
  });

  app.patch("/pc-profiles/:id", { preHandler: pre(app, "computers.profiles") }, async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        brightness: z.number().optional(),
        mouseSpeed: z.number().optional(),
        blockUsbStorage: z.boolean().optional(),
        allowUsbCharge: z.boolean().optional(),
        cleanupOnLock: z.boolean().optional(),
      })
      .parse(request.body);
    return prisma.pcProfile.update({ where: { id }, data: body });
  });

  app.post(
    "/pc-profiles/:id/apply/:computerId",
    { preHandler: pre(app, "computers.profiles") },
    async (request) => {
      const { id, computerId } = request.params as { id: string; computerId: string };
      const profile = await prisma.pcProfile.findUniqueOrThrow({ where: { id } });
      await prisma.computer.update({
        where: { id: computerId },
        data: {
          profileId: id,
          usbPolicy: JSON.stringify({
            blockStorage: profile.blockUsbStorage,
            allowCharge: profile.allowUsbCharge,
          }),
        },
      });
      return { ok: true };
    }
  );

  // --- Club map layout ---
  app.get("/club-map", async () => {
    const pcs = await prisma.computer.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        name: true,
        number: true,
        status: true,
        zone: true,
        mapX: true,
        mapY: true,
      },
    });
    const now = new Date();
    const reservations = await prisma.reservation.findMany({
      where: { status: "confirmed", startAt: { lte: now }, endAt: { gt: now } },
      select: { computerId: true },
    });
    const reservedSet = new Set(reservations.map((r) => r.computerId));
    return pcs.map((p) => ({
      ...p,
      reserved: reservedSet.has(p.id),
      mapStatus: reservedSet.has(p.id)
        ? "reserved"
        : p.status === "in_use"
          ? "busy"
          : p.status === "offline"
            ? "offline"
            : "free",
    }));
  });

  app.patch("/club-map/:id", { preHandler: pre(app, "computers.edit") }, async (request) => {
    const { id } = request.params as { id: string };
    const body = z.object({ mapX: z.number(), mapY: z.number() }).parse(request.body);
    return prisma.computer.update({ where: { id }, data: body });
  });

  // --- Peripherals ---
  app.get("/peripherals", { preHandler: pre(app, "hardware.view") }, async () => {
    return prisma.peripheral.findMany({
      include: { computer: { select: { name: true, number: true } } },
      orderBy: { lastSeenAt: "desc" },
    });
  });
}

function pre(app: FastifyInstance, perm: string) {
  return async (request: import("fastify").FastifyRequest) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, perm as import("@duster/shared/permissions.js").Permission);
  };
}

export async function agentExtrasRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/telemetry",
    {
      onRequest: [
        async (req) => {
          await req.jwtVerify();
          if (req.user.role !== "agent") throw req.server.httpErrors.forbidden();
        },
      ],
    },
    async (request) => {
      const body = z
        .object({
          cpuTemp: z.number().optional(),
          gpuTemp: z.number().optional(),
          cpuPercent: z.number().optional(),
          ramPercent: z.number().optional(),
          peripherals: z
            .array(z.object({ type: z.string(), name: z.string(), connected: z.boolean() }))
            .optional(),
        })
        .parse(request.body);
      const computerId = request.user.sub;
      await prisma.computer.update({
        where: { id: computerId },
        data: { lastTelemetry: JSON.stringify(body) },
      });
      if (body.peripherals?.length) {
        for (const p of body.peripherals) {
          const existing = await prisma.peripheral.findFirst({
            where: { computerId, type: p.type, name: p.name },
          });
          if (existing) {
            await prisma.peripheral.update({
              where: { id: existing.id },
              data: { connected: p.connected, lastSeenAt: new Date() },
            });
          } else {
            await prisma.peripheral.create({
              data: { computerId, type: p.type, name: p.name, connected: p.connected },
            });
          }
        }
      }
      return { ok: true };
    }
  );

  app.post("/offline/validate", async (request) => {
    const body = z.object({ offlineToken: z.string() }).parse(request.body);
    const payload = verifyOfflineSession(body.offlineToken);
    if (!payload) return { valid: false };
    if (payload.isUnlimited) return { valid: true, ...payload };
    if (!payload.endsAt) return { valid: true, ...payload };
    const valid = new Date(payload.endsAt).getTime() > Date.now();
    return { valid, ...payload, remainingMs: valid ? new Date(payload.endsAt).getTime() - Date.now() : 0 };
  });

  app.get("/updates/:component", async (request) => {
    const component = (request.params as { component: string }).component;
    const current = (request.query as { version?: string }).version;
    const latest = await prisma.agentRelease.findFirst({
      where: { component },
      orderBy: { createdAt: "desc" },
    });
    if (!latest || latest.version === current) {
      return { updateAvailable: false };
    }
    return {
      updateAvailable: true,
      version: latest.version,
      downloadUrl: latest.downloadUrl,
      checksum: latest.checksum,
      releaseNotes: latest.releaseNotes,
    };
  });
}
