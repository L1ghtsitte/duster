import { InlineKeyboard } from "grammy";
import { prisma } from "../db.js";
import { getTelegramConfig } from "./settings.js";
import { getBot } from "./bot.js";

export async function publishGiveawayToGroup(giveawayId: string): Promise<void> {
  const g = await prisma.giveaway.findUniqueOrThrow({ where: { id: giveawayId } });
  const cfg = await getTelegramConfig();
  const bot = getBot();
  if (!bot || !cfg.groupChatId) throw new Error("Укажите ID группы Telegram в настройках");

  const kb = new InlineKeyboard().text("🎉 Участвовать", `giveaway_join:${g.id}`);
  const msg = await bot.api.sendMessage(cfg.groupChatId, {
    text:
      `🎁 **Розыгрыш: ${g.title}**\n\n` +
      `${g.description ?? ""}\n\n` +
      `Приз: ${g.prizeText}\n` +
      `До: ${g.endsAt.toLocaleString("ru-RU")}`,
    parse_mode: "Markdown",
    reply_markup: kb,
  });

  await prisma.giveaway.update({
    where: { id: g.id },
    data: {
      status: "active",
      groupChatId: cfg.groupChatId,
      messageId: String(msg.message_id),
    },
  });
}

export async function joinGiveaway(giveawayId: string, telegramUserId: number): Promise<string> {
  const g = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!g || g.status !== "active") return "Розыгрыш недоступен";
  if (g.endsAt < new Date()) return "Розыгрыш завершён";

  const player = await prisma.player.findFirst({
    where: { telegramUserId: String(telegramUserId) },
  });

  try {
    await prisma.giveawayEntry.create({
      data: {
        giveawayId,
        playerId: player?.id,
        telegramUserId: String(telegramUserId),
      },
    });
    return "✅ Вы участвуете в розыгрыше!";
  } catch {
    return "Вы уже участвуете";
  }
}

export async function drawGiveawayWinner(giveawayId: string): Promise<{ winnerId: string | null }> {
  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId } });
  if (entries.length === 0) {
    await prisma.giveaway.update({
      where: { id: giveawayId },
      data: { status: "drawn" },
    });
    return { winnerId: null };
  }
  const pick = entries[Math.floor(Math.random() * entries.length)];
  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: "drawn", winnerId: pick.playerId ?? pick.telegramUserId },
  });

  const cfg = await getTelegramConfig();
  const bot = getBot();
  if (bot && cfg.groupChatId) {
    const g = await prisma.giveaway.findUniqueOrThrow({ where: { id: giveawayId } });
    await bot.api.sendMessage(
      cfg.groupChatId,
      `🏆 Розыгрыш «${g.title}» завершён!\nПобедитель: ${pick.telegramUserId}`
    );
  }
  return { winnerId: pick.playerId ?? pick.telegramUserId };
}
