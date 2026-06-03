import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../db.js";
import { config } from "../config.js";

const i18nRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../i18n/locales"
);

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true, service: "duster-server", version: "0.6.0" }));

  app.get("/players/:id/avatar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.player.findUnique({ where: { id } });
    if (!player) return reply.notFound();
    const { getAvatarUrl } = await import("../telegram/avatar.js");
    const url = await getAvatarUrl(player.telegramAvatarFileId);
    if (url) return reply.redirect(url);
    return reply.send({ fallback: true, color: player.avatarColor ?? "#3d8bfd" });
  });

  app.get("/config", async () => ({
    serverName: "Duster",
    wsPath: "/ws",
    port: config.port,
  }));

  app.get("/i18n/:lang", async (request, reply) => {
    const lang = (request.params as { lang: string }).lang;
    if (!["ru", "en", "zh"].includes(lang)) return reply.notFound();
    try {
      const raw = await fs.readFile(path.join(i18nRoot, `${lang}.json`), "utf-8");
      return JSON.parse(raw);
    } catch {
      return reply.notFound();
    }
  });

  app.get("/anticheat-patterns", async (request) => {
    const token = (request.query as { agentToken?: string }).agentToken;
    if (!token) return [];
    const pc = await prisma.computer.findUnique({ where: { agentToken: token } });
    if (!pc) return [];
    return prisma.blockedProcess.findMany({
      where: { clubId: pc.clubId, active: true },
      select: { namePattern: true, action: true, screenshot: true },
    });
  });

  app.get("/station/:number", async (request, reply) => {
    const number = Number((request.params as { number: string }).number);
    const pc = await prisma.computer.findUnique({ where: { number } });
    if (!pc) return reply.notFound();
    const now = new Date();
    const reservation = await prisma.reservation.findFirst({
      where: {
        computerId: pc.id,
        status: "confirmed",
        startAt: { lte: now },
        endAt: { gt: now },
      },
    });
    return {
      id: pc.id,
      name: pc.name,
      number: pc.number,
      status: pc.status,
      zone: pc.zone,
      shellMode: pc.shellMode,
      reserved: !!reservation,
      reservationTitle: reservation?.title,
    };
  });
}
