import { prisma } from "../db.js";

export interface TopupCalcResult {
  amount: number;
  bonusPercent: number;
  bonusAmount: number;
  totalCredit: number;
  minutesAdded: number;
  tierLabel: string | null;
}

export async function calculateTopupBonus(
  playerId: string,
  amount: number,
  options?: { bonusPercentOverride?: number; grantMinutes?: number }
): Promise<TopupCalcResult> {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });

  let bonusPercent = 0;
  let tierLabel: string | null = null;

  if (options?.bonusPercentOverride != null) {
    bonusPercent = options.bonusPercentOverride;
  } else if (player.customBonusPercent != null) {
    bonusPercent = player.customBonusPercent;
    tierLabel = "Персональный %";
  } else {
    const tiers = await prisma.topupBonusTier.findMany({
      where: { active: true },
      orderBy: { minAmount: "desc" },
    });
    const tier = tiers.find((t) => amount >= t.minAmount);
    if (tier) {
      bonusPercent = tier.bonusPercent;
      tierLabel = tier.label ?? `от ${tier.minAmount}₽`;
    }
  }

  const bonusAmount = Math.round(amount * (bonusPercent / 100) * 100) / 100;
  const totalCredit = amount + bonusAmount;
  const minutesAdded = options?.grantMinutes ?? 0;

  return {
    amount,
    bonusPercent,
    bonusAmount,
    totalCredit,
    minutesAdded,
    tierLabel,
  };
}

export async function applyTopup(
  playerId: string,
  amount: number,
  adminId: string | undefined,
  shiftId: string | undefined,
  options?: {
    bonusPercentOverride?: number;
    grantMinutes?: number;
    note?: string;
    skipBonus?: boolean;
  }
): Promise<TopupCalcResult & { player: { balance: number; prepaidMinutes: number } }> {
  const calc = await calculateTopupBonus(playerId, amount, {
    bonusPercentOverride: options?.skipBonus ? 0 : options?.bonusPercentOverride,
    grantMinutes: options?.grantMinutes,
  });

  if (options?.skipBonus) {
    calc.bonusAmount = 0;
    calc.bonusPercent = 0;
    calc.totalCredit = amount;
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: {
      balance: { increment: calc.totalCredit },
      prepaidMinutes: { increment: calc.minutesAdded },
      totalTopups: { increment: amount },
      lastVisitAt: new Date(),
    },
  });

  const { addLoyaltyFromTopup } = await import("../telegram/loyalty.js");
  await addLoyaltyFromTopup(playerId, amount);

  await prisma.balanceTransaction.create({
    data: {
      playerId,
      adminId,
      shiftId,
      type: "topup",
      amount,
      bonusAmount: calc.bonusAmount,
      bonusPercent: calc.bonusPercent,
      balanceAfter: player.balance,
      minutesAdded: calc.minutesAdded,
      note: options?.note,
    },
  });

  return { ...calc, player: { balance: player.balance, prepaidMinutes: player.prepaidMinutes } };
}
