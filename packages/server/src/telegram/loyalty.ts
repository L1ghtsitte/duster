import { prisma } from "../db.js";
import { getTelegramConfig } from "./settings.js";

const TIERS = [
  { name: "Bronze", min: 0, bonusPercent: 0 },
  { name: "Silver", min: 100, bonusPercent: 3 },
  { name: "Gold", min: 500, bonusPercent: 7 },
  { name: "Platinum", min: 2000, bonusPercent: 12 },
];

export async function addLoyaltyFromTopup(playerId: string, rubAmount: number): Promise<void> {
  const cfg = await getTelegramConfig();
  const pts = Math.floor((rubAmount / 100) * cfg.loyaltyPointsPer100Rub);
  if (pts <= 0) return;
  await prisma.player.update({
    where: { id: playerId },
    data: { loyaltyPoints: { increment: pts } },
  });
}

export function getLoyaltyTier(points: number) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.min) tier = t;
  }
  return tier;
}

export function formatLoyaltyMessage(points: number): string {
  const tier = getLoyaltyTier(points);
  const next = TIERS.find((t) => t.min > points);
  let msg = `🎁 Бонусная программа\nБаллы: ${points}\nУровень: ${tier.name} (+${tier.bonusPercent}% к бонусам пополнения)`;
  if (next) msg += `\nДо ${next.name}: ${next.min - points} баллов`;
  return msg;
}
