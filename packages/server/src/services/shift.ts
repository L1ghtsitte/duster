import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { generateShiftPdf } from "./pdf.js";

export interface ShiftSnapshot {
  shiftId: string;
  admin: { id: string; login: string; displayName: string };
  openedAt: string;
  closedAt: string;
  openingCash: number;
  closingCash: number | null;
  notes: string | null;
  totals: {
    salesCount: number;
    salesTotal: number;
    cashTotal: number;
    cardTotal: number;
    topupsCount: number;
    topupsAmount: number;
    bonusGranted: number;
    sessionsStarted: number;
  };
  sales: Array<{
    id: string;
    total: number;
    payment: string;
    createdAt: string;
    playerName: string | null;
    items: string;
  }>;
  topups: Array<{
    id: string;
    amount: number;
    bonusAmount: number;
    playerName: string;
    createdAt: string;
  }>;
}

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(config.reportsDir, { recursive: true });
  await fs.mkdir(config.shiftsDir, { recursive: true });
  await fs.mkdir(config.screenshotsDir, { recursive: true });
}

export async function getOpenShift(adminId: string) {
  return prisma.shift.findFirst({
    where: { adminId, status: "open" },
    include: { admin: { select: { id: true, login: true, displayName: true } } },
  });
}

export async function buildShiftSnapshot(shiftId: string): Promise<ShiftSnapshot> {
  const shift = await prisma.shift.findUniqueOrThrow({
    where: { id: shiftId },
    include: { admin: true },
  });

  const end = shift.closedAt ?? new Date();
  const sales = await prisma.sale.findMany({
    where: {
      OR: [{ shiftId: shift.id }, { adminId: shift.adminId, shiftId: null }],
      createdAt: { gte: shift.openedAt, lte: end },
    },
    include: { player: true, items: true },
    orderBy: { createdAt: "asc" },
  });

  const topups = await prisma.balanceTransaction.findMany({
    where: {
      type: "topup",
      adminId: shift.adminId,
      createdAt: { gte: shift.openedAt, lte: end },
    },
    include: { player: true },
    orderBy: { createdAt: "asc" },
  });

  const sessionsStarted = await prisma.session.count({
    where: { startedAt: { gte: shift.openedAt, lte: end } },
  });

  let cashTotal = 0;
  let cardTotal = 0;
  for (const s of sales) {
    if (s.payment === "cash") cashTotal += s.total;
    else if (s.payment === "card") cardTotal += s.total;
  }

  const bonusGranted = topups.reduce((a, t) => a + t.bonusAmount, 0);
  const topupsAmount = topups.reduce((a, t) => a + t.amount, 0);

  return {
    shiftId: shift.id,
    admin: {
      id: shift.admin.id,
      login: shift.admin.login,
      displayName: shift.admin.displayName,
    },
    openedAt: shift.openedAt.toISOString(),
    closedAt: end.toISOString(),
    openingCash: shift.openingCash,
    closingCash: shift.closingCash,
    notes: shift.notes,
    totals: {
      salesCount: sales.length,
      salesTotal: sales.reduce((a, s) => a + s.total, 0),
      cashTotal,
      cardTotal,
      topupsCount: topups.length,
      topupsAmount,
      bonusGranted,
      sessionsStarted,
    },
    sales: sales.map((s) => ({
      id: s.id,
      total: s.total,
      payment: s.payment,
      createdAt: s.createdAt.toISOString(),
      playerName: s.player?.displayName ?? null,
      items: s.items.map((i) => `${i.name}×${i.qty}`).join(", ") || "пакет",
    })),
    topups: topups.map((t) => ({
      id: t.id,
      amount: t.amount,
      bonusAmount: t.bonusAmount,
      playerName: t.player.displayName,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function closeShift(
  shiftId: string,
  closingCash: number,
  notes?: string
): Promise<{ snapshot: ShiftSnapshot; pdfUrl: string; exportUrl: string }> {
  const shift = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: "closed",
      closedAt: new Date(),
      closingCash,
      notes,
    },
  });

  const snapshot = await buildShiftSnapshot(shift.id);
  const snapshotJson = JSON.stringify(snapshot, null, 2);

  const exportFilename = `shift-${shift.id}.dshift.json`;
  const exportPath = path.join(config.shiftsDir, exportFilename);
  await fs.writeFile(exportPath, snapshotJson, "utf-8");

  const pdfFilename = `shift-${shift.id}.pdf`;
  const pdfPath = path.join(config.reportsDir, pdfFilename);
  await generateShiftPdf(snapshot, pdfPath);

  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      snapshotJson,
      reportPdfPath: pdfPath,
      exportPath,
    },
  });

  return {
    snapshot,
    pdfUrl: `/api/admin/shifts/${shiftId}/pdf`,
    exportUrl: `/api/admin/shifts/${shiftId}/export`,
  };
}
