import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { ShiftSnapshot } from "./shift.js";

export function generateShiftPdf(snapshot: ShiftSnapshot, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18).text("Duster - отчёт по смене", { align: "center" });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Кассир: ${snapshot.admin.displayName} (${snapshot.admin.login})`);
    doc.text(`Открыта: ${formatDt(snapshot.openedAt)}`);
    doc.text(`Закрыта: ${formatDt(snapshot.closedAt)}`);
    doc.text(`Касса на открытие: ${snapshot.openingCash} ₽`);
    if (snapshot.closingCash != null) {
      doc.text(`Касса на закрытие: ${snapshot.closingCash} ₽`);
    }
    doc.moveDown();

    doc.fontSize(14).text("Итоги");
    const t = snapshot.totals;
    doc.fontSize(10);
    doc.text(`Продаж: ${t.salesCount} на сумму ${t.salesTotal.toFixed(2)} ₽ (наличные ${t.cashTotal}, карта ${t.cardTotal})`);
    doc.text(`Пополнений: ${t.topupsCount} на ${t.topupsAmount.toFixed(2)} ₽, бонусов начислено ${t.bonusGranted.toFixed(2)} ₽`);
    doc.text(`Сессий начато: ${t.sessionsStarted}`);
    doc.moveDown();

    if (snapshot.topups.length) {
      doc.fontSize(12).text("Пополнения");
      doc.fontSize(9);
      for (const u of snapshot.topups) {
        doc.text(
          `${formatDt(u.createdAt)} | ${u.playerName} | ${u.amount}₽ +бонус ${u.bonusAmount}₽`
        );
      }
      doc.moveDown();
    }

    if (snapshot.sales.length) {
      doc.fontSize(12).text("Продажи");
      doc.fontSize(9);
      for (const s of snapshot.sales) {
        doc.text(
          `${formatDt(s.createdAt)} | ${s.payment} | ${s.total}₽ | ${s.playerName ?? "-"} | ${s.items}`
        );
      }
    }

    if (snapshot.notes) {
      doc.moveDown();
      doc.fontSize(10).text(`Примечания: ${snapshot.notes}`);
    }

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}
