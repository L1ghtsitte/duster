import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { startPlayerSession } from "../services/session.js";

export async function stationQrRoutes(app: FastifyInstance): Promise<void> {
  app.post("/qr-login", async (request, reply) => {
    const body = z
      .object({
        token: z.string(),
        computerNumber: z.number().int().positive(),
      })
      .parse(request.body);

    const qr = await prisma.qrLoginToken.findUnique({ where: { token: body.token } });
    if (!qr || qr.usedAt || qr.expiresAt < new Date()) {
      return reply.unauthorized("QR expired");
    }

    const computer = await prisma.computer.findUnique({
      where: { number: body.computerNumber },
    });
    if (!computer) return reply.notFound("PC not found");

    const session = await startPlayerSession(qr.playerId, computer.id);
    await prisma.qrLoginToken.update({
      where: { id: qr.id },
      data: { usedAt: new Date(), computerId: computer.id },
    });

    const jwt = await reply.jwtSign(
      { sub: session.id, role: "station", playerId: qr.playerId, computerId: computer.id },
      { expiresIn: "24h" }
    );

    const player = await prisma.player.findUniqueOrThrow({ where: { id: qr.playerId } });
    return { token: jwt, session, player: { displayName: player.displayName, balance: player.balance } };
  });
}
