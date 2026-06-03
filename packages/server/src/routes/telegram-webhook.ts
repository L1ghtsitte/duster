import type { FastifyInstance } from "fastify";
import { getBot } from "../telegram/bot.js";

export async function telegramWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/telegram/webhook", async (request, reply) => {
    const bot = getBot();
    if (!bot) return reply.send({ ok: true });
    try {
      await bot.handleUpdate(request.body as Parameters<typeof bot.handleUpdate>[0]);
    } catch (e) {
      app.log.error(e);
    }
    return { ok: true };
  });
}
