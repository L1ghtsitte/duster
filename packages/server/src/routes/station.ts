import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { startPlayerSession, endSession } from "../services/session.js";
import {
  createLoginApproval,
  needsTelegramLoginConfirm,
  pollLoginApproval,
} from "../telegram/login-approval.js";

export async function stationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", async (request, reply) => {
    const body = z
      .object({
        computerNumber: z.number().int().positive(),
        pin: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      })
      .parse(request.body);

    const computer = await prisma.computer.findUnique({
      where: { number: body.computerNumber },
    });
    if (!computer) return reply.notFound("ПК не найден");

    let player = null;
    if (body.pin) {
      player = await prisma.player.findFirst({
        where: { pin: body.pin, active: true },
      });
    } else if (body.username && body.password) {
      const byName = await prisma.player.findUnique({ where: { username: body.username } });
      if (byName?.passwordHash && (await bcrypt.compare(body.password, byName.passwordHash))) {
        player = byName;
      }
    } else {
      return reply.badRequest("Укажите PIN или логин/пароль");
    }

    if (!player?.active) return reply.unauthorized("Неверные данные или аккаунт отключён");

    if (await needsTelegramLoginConfirm(player.id)) {
      const { approvalToken } = await createLoginApproval(player.id, computer.id);
      return {
        pendingTelegram: true,
        approvalToken,
        message: "Подтвердите вход в Telegram (кнопки Войти / Не входить)",
        computer: { id: computer.id, name: computer.name, number: computer.number },
        player: { displayName: player.displayName },
      };
    }

    try {
      const session = await startPlayerSession(player.id, computer.id);
      const token = await reply.jwtSign(
        {
          sub: session.id,
          role: "station",
          playerId: player.id,
          computerId: computer.id,
        },
        { expiresIn: "24h" }
      );

      return {
        token,
        session: {
          id: session.id,
          endsAt: session.endsAt,
          isUnlimited: session.isUnlimited,
        },
        player: {
          id: player.id,
          displayName: player.displayName,
          group: player.group,
          balance: player.balance,
          unlimitedTime: player.unlimitedTime,
          prepaidMinutes: player.prepaidMinutes,
        },
        computer: { id: computer.id, name: computer.name, number: computer.number },
      };
    } catch (e) {
      return reply.conflict(e instanceof Error ? e.message : "Не удалось начать сессию");
    }
  });

  app.get("/login/pending/:token", async (request) => {
    const { token } = request.params as { token: string };
    return pollLoginApproval(token);
  });

  app.post("/logout", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized();
    }
    if (request.user.role !== "station") return reply.forbidden();
    await endSession(request.user.sub);
    return { ok: true };
  });

  app.get("/session", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized();
    }
    if (request.user.role !== "station") return reply.forbidden();
    const session = await prisma.session.findUnique({
      where: { id: request.user.sub },
      include: { player: true, computer: true },
    });
    if (!session || session.status !== "active") return reply.notFound();
    return session;
  });
}
