import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";
import { getTelegramConfig, setTelegramConfig } from "../telegram/settings.js";
import { publishGiveawayToGroup, drawGiveawayWinner } from "../telegram/giveaway.js";

export async function telegramAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "telegram.manage");
  });

  app.get("/settings", async (request) => getTelegramConfig(request.clubId!));

  app.patch("/settings", async (request) => {
    const body = z
      .object({
        enabled: z.boolean().optional(),
        botToken: z.string().optional(),
        rubPerStar: z.number().positive().optional(),
        webhookUrl: z.string().optional(),
        groupChatId: z.string().optional(),
        loginConfirmEnabled: z.boolean().optional(),
        referralBonusRub: z.number().optional(),
        referralBonusPercent: z.number().optional(),
        loyaltyPointsPer100Rub: z.number().optional(),
      })
      .parse(request.body);
    await setTelegramConfig(body, request.clubId!);
    return getTelegramConfig(request.clubId!);
  });

  app.post("/players/:id/send-link-code", async (request) => {
    const { id } = request.params as { id: string };
    const player = await prisma.player.findUniqueOrThrow({ where: { id } });
    if (!player.phone) throw app.httpErrors.badRequest("У игрока нет телефона");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 15 * 60_000);
    await prisma.player.update({
      where: { id },
      data: { telegramLinkCode: code, telegramLinkExpires: expires },
    });
    await prisma.phoneLinkRequest.create({
      data: { playerId: id, phone: player.phone, code, expiresAt: expires },
    });
    return { code, expiresAt: expires, phone: player.phone };
  });

  app.get("/giveaways", async () => {
    return prisma.giveaway.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  });

  app.post("/giveaways", async (request) => {
    const body = z
      .object({
        title: z.string(),
        description: z.string().optional(),
        prizeText: z.string(),
        endsAt: z.string(),
      })
      .parse(request.body);
    return prisma.giveaway.create({
      data: {
        clubId: request.clubId!,
        title: body.title,
        description: body.description,
        prizeText: body.prizeText,
        endsAt: new Date(body.endsAt),
      },
    });
  });

  app.post("/giveaways/:id/publish", async (request) => {
    const { id } = request.params as { id: string };
    await publishGiveawayToGroup(id);
    return { ok: true };
  });

  app.post("/giveaways/:id/draw", async (request) => {
    const { id } = request.params as { id: string };
    return drawGiveawayWinner(id);
  });
}
