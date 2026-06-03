import { prisma } from "../db.js";
import { getDefaultClubId } from "../infra/default-club.js";

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  rubPerStar: number;
  webhookUrl: string;
  groupChatId: string;
  loginConfirmEnabled: boolean;
  referralBonusRub: number;
  referralBonusPercent: number;
  loyaltyPointsPer100Rub: number;
  useWebhook: boolean;
}

const KEYS = {
  enabled: "telegram_enabled",
  botToken: "telegram_bot_token",
  rubPerStar: "telegram_rub_per_star",
  webhookUrl: "telegram_webhook_url",
  groupChatId: "telegram_group_chat_id",
  loginConfirm: "telegram_login_confirm",
  referralBonusRub: "telegram_referral_bonus_rub",
  referralBonusPercent: "telegram_referral_bonus_percent",
  loyaltyPer100: "telegram_loyalty_per_100rub",
  useWebhook: "telegram_use_webhook",
} as const;

export async function getTelegramConfig(clubId?: string): Promise<TelegramConfig> {
  const cid = clubId ?? (await getDefaultClubId());
  const rows = await prisma.setting.findMany({
    where: { clubId: cid, key: { in: Object.values(KEYS) } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map[KEYS.enabled] === "true",
    botToken: map[KEYS.botToken] ?? "",
    rubPerStar: Number(map[KEYS.rubPerStar] ?? 1.65),
    webhookUrl: map[KEYS.webhookUrl] ?? "",
    groupChatId: map[KEYS.groupChatId] ?? "",
    loginConfirmEnabled: map[KEYS.loginConfirm] !== "false",
    referralBonusRub: Number(map[KEYS.referralBonusRub] ?? 100),
    referralBonusPercent: Number(map[KEYS.referralBonusPercent] ?? 5),
    loyaltyPointsPer100Rub: Number(map[KEYS.loyaltyPer100] ?? 10),
    useWebhook: map[KEYS.useWebhook] === "true",
  };
}

export async function setTelegramConfig(
  partial: Partial<TelegramConfig>,
  clubId?: string
): Promise<void> {
  const cid = clubId ?? (await getDefaultClubId());
  const upsert = async (key: string, value: string) => {
    await prisma.setting.upsert({
      where: { clubId_key: { clubId: cid, key } },
      update: { value },
      create: { clubId: cid, key, value },
    });
  };
  if (partial.enabled != null) await upsert(KEYS.enabled, String(partial.enabled));
  if (partial.botToken != null) await upsert(KEYS.botToken, partial.botToken);
  if (partial.rubPerStar != null) await upsert(KEYS.rubPerStar, String(partial.rubPerStar));
  if (partial.webhookUrl != null) await upsert(KEYS.webhookUrl, partial.webhookUrl);
  if (partial.groupChatId != null) await upsert(KEYS.groupChatId, partial.groupChatId);
  if (partial.loginConfirmEnabled != null)
    await upsert(KEYS.loginConfirm, String(partial.loginConfirmEnabled));
  if (partial.referralBonusRub != null)
    await upsert(KEYS.referralBonusRub, String(partial.referralBonusRub));
  if (partial.referralBonusPercent != null)
    await upsert(KEYS.referralBonusPercent, String(partial.referralBonusPercent));
  if (partial.loyaltyPointsPer100Rub != null)
    await upsert(KEYS.loyaltyPer100, String(partial.loyaltyPointsPer100Rub));
  if (partial.useWebhook != null) await upsert(KEYS.useWebhook, String(partial.useWebhook));
}

export function starsToRub(stars: number, rubPerStar: number): number {
  return Math.round(stars * rubPerStar * 100) / 100;
}
