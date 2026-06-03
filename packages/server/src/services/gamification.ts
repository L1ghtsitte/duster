import { prisma } from "../db.js";

const LEVEL_XP = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

export function levelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

export async function grantXp(playerId: string, amount: number, _reason: string): Promise<void> {
  const p = await prisma.player.update({
    where: { id: playerId },
    data: { xp: { increment: amount } },
  });
  const newLevel = levelFromXp(p.xp);
  if (newLevel > p.level) {
    await prisma.player.update({ where: { id: playerId }, data: { level: newLevel } });
  }
  const fresh = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (fresh.visitCount >= 5) await tryUnlock(playerId, "loyal_5");
  if (fresh.totalTopups >= 5000) await tryUnlock(playerId, "whale");
}

async function tryUnlock(playerId: string, code: string): Promise<void> {
  const ach = await prisma.achievement.findUnique({ where: { code } });
  if (!ach) return;
  const dup = await prisma.playerAchievement.findUnique({
    where: { playerId_achievementId: { playerId, achievementId: ach.id } },
  });
  if (dup) return;
  await prisma.playerAchievement.create({ data: { playerId, achievementId: ach.id } });
  await prisma.player.update({
    where: { id: playerId },
    data: { xp: { increment: ach.xpReward } },
  });
}
