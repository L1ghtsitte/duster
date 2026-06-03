import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "analytics.view");
  });

  app.get("/overview", async () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [players, sales24h, salesWeek, sessionsActive, computers] = await Promise.all([
      prisma.player.count({ where: { active: true } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: dayAgo } }, _sum: { total: true } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: weekAgo } }, _sum: { total: true } }),
      prisma.session.count({ where: { status: "active" } }),
      prisma.computer.findMany({ select: { id: true, status: true, zone: true, number: true } }),
    ]);

    const topPlayers = await prisma.player.findMany({
      orderBy: { totalSpent: "desc" },
      take: 5,
      select: { displayName: true, totalSpent: true, visitCount: true, level: true },
    });

    const sessionsWeek = await prisma.session.findMany({
      where: { startedAt: { gte: weekAgo } },
      select: { startedAt: true },
    });
    const hourlyLoad = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: sessionsWeek.filter((s) => new Date(s.startedAt).getHours() === h).length,
    }));

    return {
      players,
      revenue24h: sales24h._sum.total ?? 0,
      revenueWeek: salesWeek._sum.total ?? 0,
      sessionsActive,
      computers,
      topPlayers,
      hourlyLoad,
    };
  });
}
