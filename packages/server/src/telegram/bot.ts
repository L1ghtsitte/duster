import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db.js";
import { getTelegramConfig, starsToRub } from "./settings.js";
import { applyTopup } from "../services/topup.js";
import { auditLog } from "../services/audit.js";
import { syncTelegramAvatar, getAvatarUrl } from "./avatar.js";
import { ensureReferralCode, applyReferralCode } from "./referral.js";
import { formatLoyaltyMessage } from "./loyalty.js";
import { resolveLoginApproval } from "./login-approval.js";
import { joinGiveaway } from "./giveaway.js";

let bot: Bot | null = null;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export async function startTelegramBot(): Promise<void> {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled || !cfg.botToken) {
    console.log("Telegram bot: disabled or no token");
    return;
  }

  bot = new Bot(cfg.botToken);

  bot.command("start", async (ctx) => {
    const arg = ctx.message.text.split(/\s+/)[1];
    if (arg?.startsWith("ref_")) {
      const code = arg.slice(4);
      const player = await playerByTg(ctx.from.id);
      if (player) {
        const r = await applyReferralCode(player.id, code);
        await ctx.reply(r.message);
      } else {
        await ctx.reply(`Реферальный код: ${code}\nСначала привяжите аккаунт: /link`);
      }
    }

    const kb = new InlineKeyboard()
      .text("💰 Баланс", "menu:balance")
      .text("🖥 ПК", "menu:pcs")
      .row()
      .text("🎁 Бонусы", "menu:bonus")
      .text("👤 Профиль", "menu:profile");
    await ctx.reply(
      "🎮 **Duster Club Bot**\n\n" +
        "/link - привязать аккаунт\n" +
        "/ref - реферальная программа\n" +
        "/topup - пополнение ⭐\n" +
        "/book - бронь ПК\n" +
        "/giveaway - активные розыгрыши",
      { parse_mode: "Markdown", reply_markup: kb }
    );
  });

  bot.command("link", async (ctx) => {
    await ctx.reply("Отправьте номер телефона (как в клубе), например: +79001234567");
  });

  bot.command("profile", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    await sendPlayerProfile(ctx.chat.id, player);
  });

  bot.command("ref", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    const parts = ctx.message.text.split(/\s+/);
    const code = parts[1];
    if (!code) {
      const my = await ensureReferralCode(player.id);
      return ctx.reply(
        `🔗 Ваш реферальный код: \`${my}\`\nДруг вводит: /ref ${my}`,
        { parse_mode: "Markdown" }
      );
    }
    const r = await applyReferralCode(player.id, code);
    await ctx.reply(r.message);
  });

  bot.command("bonus", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    await ctx.reply(formatLoyaltyMessage(player.loyaltyPoints));
  });

  bot.command("giveaway", async (ctx) => {
    const list = await prisma.giveaway.findMany({
      where: { status: "active", endsAt: { gt: new Date() } },
      take: 5,
    });
    if (list.length === 0) return ctx.reply("Сейчас нет активных розыгрышей");
    for (const g of list) {
      const kb = new InlineKeyboard().text("Участвовать", `giveaway_join:${g.id}`);
      await ctx.reply(`🎁 ${g.title}\nПриз: ${g.prizeText}`, { reply_markup: kb });
    }
  });

  bot.on("message:contact", async (ctx) => {
    await handlePhoneLink(ctx.from.id, ctx.message.contact.phone_number, ctx.reply.bind(ctx));
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    const digits = normalizePhone(text);
    if (digits.length >= 10) {
      await handlePhoneLink(ctx.from.id, text, ctx.reply.bind(ctx));
      return;
    }
    if (/^\d{6}$/.test(text)) {
      await verifyLinkCode(ctx.from.id, text, ctx.from.username, ctx.reply.bind(ctx));
    }
  });

  bot.command("balance", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    await sendPlayerProfile(ctx.chat.id, player, true);
  });

  bot.command("pcs", async (ctx) => {
    const pcs = await prisma.computer.findMany({ orderBy: { number: "asc" } });
    const now = new Date();
    const lines: string[] = [];
    for (const pc of pcs) {
      const reserved = await prisma.reservation.findFirst({
        where: {
          computerId: pc.id,
          status: "confirmed",
          startAt: { lte: now },
          endAt: { gt: now },
        },
      });
      const busy = pc.status === "in_use" || !!reserved;
      const icon = busy ? "🔴" : pc.status === "offline" ? "⚫" : "🟢";
      lines.push(`${icon} ${pc.name} (#${pc.number})`);
    }
    await ctx.reply(lines.join("\n") || "Нет ПК");
  });

  bot.command("book", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    const parts = ctx.message.text.split(/\s+/);
    const num = Number(parts[1]);
    const dateStr = parts[2];
    const timeStr = parts[3] ?? "12:00";
    if (!num || !dateStr) {
      return ctx.reply("Формат: /book <ПК> <дата> <время>\nПример: /book 3 2026-06-10 18:00");
    }
    const pc = await prisma.computer.findUnique({ where: { number: num } });
    if (!pc) return ctx.reply("ПК не найден");
    const startAt = new Date(`${dateStr}T${timeStr}:00`);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60_000);
    try {
      await prisma.reservation.create({
        data: { computerId: pc.id, playerId: player.id, title: "Telegram", startAt, endAt },
      });
      await ctx.reply(`✅ ${pc.name} с ${startAt.toLocaleString("ru-RU")}`);
    } catch {
      await ctx.reply("❌ Конфликт времени");
    }
  });

  bot.command("topup", async (ctx) => {
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.reply("Сначала /link");
    const cfg = await getTelegramConfig();
    const kb = new InlineKeyboard()
      .text("50⭐", "stars:50")
      .text("100⭐", "stars:100")
      .text("200⭐", "stars:200");
    await ctx.reply(`1⭐ = ${cfg.rubPerStar} ₽`, { reply_markup: kb });
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("login_ok:")) {
      const token = data.slice("login_ok:".length);
      const r = await resolveLoginApproval(token, true);
      await ctx.answerCallbackQuery({ text: r.status === "approved" ? "Вход разрешён" : "Ошибка" });
      await ctx.editMessageText("✅ Вход на ПК подтверждён");
      return;
    }
    if (data.startsWith("login_no:")) {
      const token = data.slice("login_no:".length);
      await resolveLoginApproval(token, false);
      await ctx.answerCallbackQuery({ text: "Вход отклонён" });
      await ctx.editMessageText("❌ Вход отменён");
      return;
    }

    if (data.startsWith("giveaway_join:")) {
      const id = data.slice("giveaway_join:".length);
      const msg = await joinGiveaway(id, ctx.from.id);
      await ctx.answerCallbackQuery({ text: msg.slice(0, 200) });
      return;
    }

    if (data === "menu:balance" || data === "menu:profile") {
      const player = await playerByTg(ctx.from.id);
      if (!player) return ctx.answerCallbackQuery({ text: "Сначала /link" });
      if (data === "menu:profile") await sendPlayerProfile(ctx.chat!.id, player);
      else
        await ctx.reply(
          `💰 ${player.balance.toFixed(0)} ₽ · ⏱ ${player.prepaidMinutes} мин · Lv.${player.level}`
        );
      await ctx.answerCallbackQuery();
      return;
    }
    if (data === "menu:pcs") {
      await ctx.answerCallbackQuery();
      await ctx.reply("Используйте /pcs");
      return;
    }
    if (data === "menu:bonus") {
      const player = await playerByTg(ctx.from.id);
      if (!player) return ctx.answerCallbackQuery({ text: "Сначала /link" });
      await ctx.reply(formatLoyaltyMessage(player.loyaltyPoints));
      await ctx.answerCallbackQuery();
      return;
    }

    if (!data.startsWith("stars:")) return;
    const stars = Number(data.split(":")[1]);
    const player = await playerByTg(ctx.from.id);
    if (!player) return ctx.answerCallbackQuery({ text: "Привяжите /link" });
    const cfg = await getTelegramConfig();
    const rub = starsToRub(stars, cfg.rubPerStar);
    try {
      await ctx.api.sendInvoice(ctx.chat!.id, {
        title: "Пополнение Duster",
        description: `${stars}⭐ → ${rub} ₽`,
        payload: `topup:${player.id}:${stars}`,
        currency: "XTR",
        prices: [{ label: "Stars", amount: stars }],
      });
      await ctx.answerCallbackQuery();
    } catch {
      await ctx.answerCallbackQuery({ text: "Нужен Stars в BotFather" });
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    const m = payload.match(/^topup:(.+):(\d+)$/);
    if (!m) return;
    const [, playerId, starsStr] = m;
    const stars = Number(starsStr);
    const cfg = await getTelegramConfig();
    const rub = starsToRub(stars, cfg.rubPerStar);
    await applyTopup(playerId, rub, undefined, undefined, {
      note: `Telegram Stars: ${stars}`,
    });
    await auditLog({ playerId, action: "telegram.stars_topup", details: { stars, rub } });
    await ctx.reply(`✅ Зачислено ${rub} ₽ (${stars}⭐)`);
  });

  if (cfg.useWebhook && process.env.DUSTER_PUBLIC_URL) {
    const url = `${process.env.DUSTER_PUBLIC_URL.replace(/\/$/, "")}/api/telegram/webhook`;
    await bot.api.setWebhook(url);
    console.log("Telegram webhook:", url);
  } else {
    await bot.start();
    console.log("Telegram bot polling started");
  }
}

async function sendPlayerProfile(
  chatId: number,
  player: {
    id: string;
    displayName: string;
    balance: number;
    prepaidMinutes: number;
    level: number;
    loyaltyPoints: number;
    referralCode: string | null;
    telegramAvatarFileId: string | null;
  },
  short = false
) {
  const b = getBot();
  if (!b) return;
  const code = player.referralCode ?? (await ensureReferralCode(player.id));
  const text =
    `👤 **${player.displayName}**\n` +
    `💰 ${player.balance.toFixed(0)} ₽ · ⏱ ${player.prepaidMinutes} мин\n` +
    `⭐ Ур. ${player.level} · 🎁 ${player.loyaltyPoints} баллов\n` +
    `🔗 Код: \`${code}\``;

  const url = await getAvatarUrl(player.telegramAvatarFileId);
  if (!short && url) {
    await b.api.sendPhoto(chatId, url, { caption: text, parse_mode: "Markdown" });
  } else {
    await b.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }
}

async function playerByTg(telegramUserId: number) {
  return prisma.player.findFirst({
    where: { telegramUserId: String(telegramUserId) },
  });
}

async function handlePhoneLink(
  tgId: number,
  phone: string,
  reply: (text: string) => Promise<unknown>
) {
  const norm = normalizePhone(phone);
  const player = await prisma.player.findFirst({
    where: { phone: { contains: norm.slice(-10) } },
  });
  if (!player) return reply("❌ Телефон не найден. Обратитесь в клуб.");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 15 * 60_000);
  await prisma.player.update({
    where: { id: player.id },
    data: { telegramLinkCode: code, telegramLinkExpires: expires },
  });
  await prisma.phoneLinkRequest.create({
    data: { playerId: player.id, phone: player.phone ?? phone, code, expiresAt: expires },
  });
  await reply(`Код для ${player.displayName}: ${code}\nВведите в чат за 15 мин.`);
}

async function verifyLinkCode(
  tgId: number,
  code: string,
  username: string | undefined,
  reply: (text: string) => Promise<unknown>
) {
  const player = await prisma.player.findFirst({
    where: { telegramLinkCode: code, telegramLinkExpires: { gt: new Date() } },
  });
  if (!player) return reply("❌ Неверный или просроченный код");
  await prisma.player.update({
    where: { id: player.id },
    data: {
      telegramUserId: String(tgId),
      telegramUsername: username ?? null,
      telegramLinkCode: null,
      telegramLinkExpires: null,
    },
  });
  await syncTelegramAvatar(tgId, player.id, username);
  await ensureReferralCode(player.id);
  await reply(`✅ Привязано! ${player.displayName}\n/profile - профиль с аватаром`);
}

export function getBot(): Bot | null {
  return bot;
}
