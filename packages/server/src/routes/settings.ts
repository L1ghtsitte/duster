import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { calculateTopupBonus } from "../services/topup.js";

import { loadAdminContext } from "../admin-guard.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "settings.bonus");
  });

  app.get("/topup-tiers", async () => {
    return prisma.topupBonusTier.findMany({ orderBy: { sortOrder: "asc" } });
  });

  app.post("/topup-tiers", async (request) => {
    await app.assertPerm(request, "settings.bonus");
    const body = z
      .object({
        minAmount: z.number().min(0),
        bonusPercent: z.number().min(0).max(100),
        label: z.string().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(request.body);
    return prisma.topupBonusTier.create({ data: body });
  });

  app.patch("/topup-tiers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        minAmount: z.number().optional(),
        bonusPercent: z.number().optional(),
        label: z.string().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(request.body);
    return prisma.topupBonusTier.update({ where: { id }, data: body });
  });

  app.delete("/topup-tiers/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.topupBonusTier.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/topup-preview", async (request) => {
    const body = z
      .object({
        playerId: z.string(),
        amount: z.number().positive(),
        bonusPercentOverride: z.number().optional(),
      })
      .parse(request.body);
    return calculateTopupBonus(body.playerId, body.amount, {
      bonusPercentOverride: body.bonusPercentOverride,
    });
  });
}
