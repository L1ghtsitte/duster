import { prisma } from "../db.js";
import { getBot } from "../telegram/bot.js";
import { getDefaultClubId } from "../infra/default-club.js";
import { getTelegramConfig } from "../telegram/settings.js";

const sent = new Set<string>();

function once(key: string): boolean {
  if (sent.has(key)) return false;
  sent.add(key);
  setTimeout(() => sent.delete(key), 60 * 60_000);
  return true;
}

export async function runNotificationSweep(): Promise<void> {
  const bot = getBot();
  if (!bot) return;
  const clubId = await getDefaultClubId();
  const cfg = await getTelegramConfig(clubId);
  if (!cfg.enabled) return;

  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60_000);
  const resSoon = new Date(now.getTime() + 10 * 60_000);

  const sessions = await prisma.session.findMany({
    where: { status: "active", endsAt: { lte: soon, gt: now } },
    include: { player: true, computer: true },
  });

  for (const s of sessions) {
    if (!s.player.telegramUserId || !s.endsAt) continue;
    const key = `sess15:${s.id}`;
    if (!once(key)) continue;
    await bot.api.sendMessage(
      Number(s.player.telegramUserId),
      `⏱ Осталось ~15 минут на ${s.computer.name}. Продлите время в боте /balance`
    );
  }

  const lowBalance = await prisma.player.findMany({
    where: { clubId, active: true, balance: { lt: 50, gt: 0 }, telegramUserId: { not: null } },
    take: 50,
  });
  for (const p of lowBalance) {
    const key = `lowbal:${p.id}`;
    if (!once(key)) continue;
    await bot.api.sendMessage(
      Number(p.telegramUserId!),
      `💰 Баланс менее 50 ₽ (${p.balance.toFixed(0)} ₽). Пополните: /topup`
    );
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      startAt: { lte: resSoon, gt: now },
      player: { telegramUserId: { not: null } },
    },
    include: { player: true, computer: true },
  });
  for (const r of reservations) {
    if (!r.player?.telegramUserId) continue;
    const key = `res:${r.id}`;
    if (!once(key)) continue;
    await bot.api.sendMessage(
      Number(r.player.telegramUserId),
      `📅 Бронь ${r.computer.name} через ~10 мин (${r.startAt.toLocaleString("ru-RU")})`
    );
  }
}
