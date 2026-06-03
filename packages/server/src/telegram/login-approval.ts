import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { getTelegramConfig } from "./settings.js";
import { startPlayerSession } from "../services/session.js";
import { getBot } from "./bot.js";
import { InlineKeyboard } from "grammy";

export async function needsTelegramLoginConfirm(playerId: string): Promise<boolean> {
  const cfg = await getTelegramConfig();
  if (!cfg.loginConfirmEnabled || !cfg.enabled) return false;
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  return !!player?.telegramUserId;
}

export async function createLoginApproval(
  playerId: string,
  computerId: string
): Promise<{ approvalToken: string }> {
  const token = randomBytes(12).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await prisma.telegramLoginRequest.create({
    data: { playerId, computerId, token, expiresAt },
  });

  const [player, computer] = await Promise.all([
    prisma.player.findUniqueOrThrow({ where: { id: playerId } }),
    prisma.computer.findUniqueOrThrow({ where: { id: computerId } }),
  ]);

  const bot = getBot();
  if (bot && player.telegramUserId) {
    const kb = new InlineKeyboard()
      .text("✅ Войти", `login_ok:${token}`)
      .text("❌ Не входить", `login_no:${token}`);
    await bot.api.sendMessage(Number(player.telegramUserId), {
      text:
        `🔐 Запрос входа на ${computer.name} (#${computer.number})\n\n` +
        `Подтвердите, что это вы.`,
      reply_markup: kb,
    });
  }

  return { approvalToken: token };
}

export async function resolveLoginApproval(
  token: string,
  approved: boolean
): Promise<{ ok: boolean; status: string }> {
  const req = await prisma.telegramLoginRequest.findUnique({ where: { token } });
  if (!req || req.status !== "pending") return { ok: false, status: "expired" };
  if (req.expiresAt < new Date()) {
    await prisma.telegramLoginRequest.update({
      where: { id: req.id },
      data: { status: "expired" },
    });
    return { ok: false, status: "expired" };
  }

  if (!approved) {
    await prisma.telegramLoginRequest.update({
      where: { id: req.id },
      data: { status: "denied" },
    });
    return { ok: true, status: "denied" };
  }

  try {
    const session = await startPlayerSession(req.playerId, req.computerId);
    const jwt = await signStationJwt(session.id, req.playerId, req.computerId);
    await prisma.telegramLoginRequest.update({
      where: { id: req.id },
      data: { status: "approved", sessionId: session.id, sessionJwt: jwt },
    });
    return { ok: true, status: "approved" };
  } catch {
    await prisma.telegramLoginRequest.update({
      where: { id: req.id },
      data: { status: "denied" },
    });
    return { ok: false, status: "denied" };
  }
}

let jwtSigner: ((payload: object) => Promise<string>) | null = null;

export function setJwtSigner(fn: (payload: object) => Promise<string>): void {
  jwtSigner = fn;
}

async function signStationJwt(
  sessionId: string,
  playerId: string,
  computerId: string
): Promise<string> {
  if (!jwtSigner) throw new Error("JWT signer not configured");
  return jwtSigner({
    sub: sessionId,
    role: "station",
    playerId,
    computerId,
  });
}

export async function pollLoginApproval(token: string): Promise<{
  status: string;
  token?: string;
  session?: unknown;
  player?: unknown;
}> {
  const req = await prisma.telegramLoginRequest.findUnique({
    where: { token },
    include: { player: true },
  });
  if (!req) return { status: "not_found" };
  if (req.expiresAt < new Date() && req.status === "pending") {
    await prisma.telegramLoginRequest.update({
      where: { id: req.id },
      data: { status: "expired" },
    });
    return { status: "expired" };
  }
  if (req.status === "approved" && req.sessionJwt) {
    const active = req.sessionId
      ? await prisma.session.findUnique({ where: { id: req.sessionId } })
      : await prisma.session.findFirst({
          where: { playerId: req.playerId, status: "active" },
          orderBy: { startedAt: "desc" },
        });
    return {
      status: "approved",
      token: req.sessionJwt,
      session: active
        ? {
            id: active.id,
            endsAt: active.endsAt,
            isUnlimited: active.isUnlimited,
          }
        : undefined,
      player: {
        displayName: req.player.displayName,
        group: req.player.group,
        balance: req.player.balance,
        unlimitedTime: req.player.unlimitedTime,
        prepaidMinutes: req.player.prepaidMinutes,
      },
    };
  }
  return { status: req.status };
}
