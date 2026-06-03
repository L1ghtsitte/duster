import { prisma } from "../db.js";

/** Цена за час с учётом динамических тарифов */
export async function getHourlyRate(zone: string, at = new Date()): Promise<number> {
  const dow = at.getDay();
  const hour = at.getHours();
  const rules = await prisma.tariffRule.findMany({
    where: { active: true },
    orderBy: { priority: "desc" },
  });
  for (const r of rules) {
    if (r.zone && r.zone !== zone) continue;
    if (r.dayOfWeek != null && r.dayOfWeek !== dow) continue;
    if (hour >= r.hourFrom && hour < r.hourTo) return r.pricePerHour;
  }
  const fallback = await prisma.setting.findUnique({ where: { key: "default_hourly_rate" } });
  return fallback ? Number(fallback.value) : 100;
}
