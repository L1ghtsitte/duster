import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { getTelegramConfig } from "./settings.js";
import { applyTopup } from "../services/topup.js";

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function ensureReferralCode(playerId: string): Promise<string> {
  const p = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (p.referralCode) return p.referralCode;
  let code = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.player.findUnique({ where: { referralCode: code } });
    if (!clash) break;
    code = generateReferralCode();
  }
  await prisma.player.update({ where: { id: playerId }, data: { referralCode: code } });
  return code;
}

export async function applyReferralCode(
  newPlayerId: string,
  code: string
): Promise<{ ok: boolean; message: string }> {
  const cfg = await getTelegramConfig();
  const inviter = await prisma.player.findFirst({
    where: { referralCode: code.toUpperCase(), active: true },
  });
  if (!inviter) return { ok: false, message: "Код не найден" };
  if (inviter.id === newPlayerId) return { ok: false, message: "Нельзя использовать свой код" };

  const player = await prisma.player.findUniqueOrThrow({ where: { id: newPlayerId } });
  if (player.referredById) return { ok: false, message: "Реферал уже применён" };

  await prisma.player.update({
    where: { id: newPlayerId },
    data: { referredById: inviter.id },
  });

  const bonus = cfg.referralBonusRub;
  if (bonus > 0) {
    await applyTopup(newPlayerId, bonus, undefined, undefined, {
      skipBonus: true,
      note: `Реферал: ${code}`,
    });
    await applyTopup(inviter.id, bonus, undefined, undefined, {
      skipBonus: true,
      note: `Реферал пригласил: ${player.displayName}`,
    });
  }

  const pts = Math.floor(cfg.referralBonusPercent * 10);
  if (pts > 0) {
    await prisma.player.update({
      where: { id: newPlayerId },
      data: { loyaltyPoints: { increment: pts } },
    });
    await prisma.player.update({
      where: { id: inviter.id },
      data: { loyaltyPoints: { increment: pts } },
    });
  }

  return { ok: true, message: `Бонус ${bonus} ₽ начислен вам и пригласившему` };
}
