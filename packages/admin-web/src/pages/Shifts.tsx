import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

interface ShiftRow {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  admin: { displayName: string };
}

interface ShiftDetail {
  shift: ShiftRow;
  snapshot: {
    totals: Record<string, number>;
    sales: unknown[];
    topups: unknown[];
  };
}

export function ShiftsPage() {
  const [list, setList] = useState<ShiftRow[]>([]);
  const [current, setCurrent] = useState<ShiftRow | null>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [importJson, setImportJson] = useState("");

  async function load() {
    const [all, open] = await Promise.all([
      api<ShiftRow[]>("/admin/shifts"),
      api<ShiftRow | null>("/admin/shifts/current"),
    ]);
    setList(all);
    setCurrent(open);
  }

  useEffect(() => {
    load();
  }, []);

  async function openShift(e: FormEvent) {
    e.preventDefault();
    await api("/admin/shifts/open", {
      method: "POST",
      body: JSON.stringify({ openingCash }),
    });
    load();
  }

  async function closeShift() {
    if (!current) return;
    await api(`/admin/shifts/${current.id}/close`, {
      method: "POST",
      body: JSON.stringify({ closingCash }),
    });
    load();
  }

  async function viewShift(id: string) {
    setDetail(await api<ShiftDetail>(`/admin/shifts/${id}`));
  }

  async function downloadPdf(id: string) {
    const token = localStorage.getItem("duster_token");
    const res = await fetch(`/api/admin/shifts/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift-${id}.pdf`;
    a.click();
  }

  async function downloadCsv(id: string) {
    const token = localStorage.getItem("duster_token");
    const res = await fetch(`/api/admin/shifts/${id}/export-xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift-${id}.csv`;
    a.click();
  }

  async function downloadExport(id: string) {
    const token = localStorage.getItem("duster_token");
    const res = await fetch(`/api/admin/shifts/${id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shift-${id}.dshift.json`;
    a.click();
  }

  function loadImported() {
    try {
      const snap = JSON.parse(importJson);
      setDetail({
        shift: {
          id: snap.shiftId ?? "import",
          status: "closed",
          openedAt: snap.openedAt,
          closedAt: snap.closedAt,
          openingCash: snap.openingCash,
          closingCash: snap.closingCash,
          admin: snap.admin,
        },
        snapshot: snap,
      });
    } catch {
      alert("Неверный JSON файла .dshift");
    }
  }

  return (
    <>
      <h2>Смены</h2>
      {!current ? (
        <div className="card">
          <h3>Открыть смену</h3>
          <form onSubmit={openShift}>
            <label>
              Касса на начало:{" "}
              <input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(Number(e.target.value))}
              />
            </label>
            <button type="submit">Открыть смену</button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ borderColor: "var(--ok)" }}>
          <h3>Смена открыта</h3>
          <p>
            С {new Date(current.openedAt).toLocaleString("ru-RU")} · касса {current.openingCash} ₽
          </p>
          <label>
            Касса на закрытие:{" "}
            <input
              type="number"
              value={closingCash}
              onChange={(e) => setClosingCash(Number(e.target.value))}
            />
          </label>
          <button type="button" className="danger" onClick={closeShift}>
            Закрыть смену (PDF + файл)
          </button>
        </div>
      )}

      <div className="card">
        <h3>Импорт файла смены (.dshift.json)</h3>
        <textarea
          rows={4}
          style={{ width: "100%", background: "var(--bg)", color: "var(--text)" }}
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder="Вставьте JSON или загрузите файл"
        />
        <input
          type="file"
          accept=".json,.dshift.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            f.text().then(setImportJson);
          }}
        />
        <button type="button" className="secondary" onClick={loadImported}>
          Просмотреть
        </button>
      </div>

      <div className="card">
        <h3>История</h3>
        <table>
          <thead>
            <tr>
              <th>Кассир</th>
              <th>Период</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.admin.displayName}</td>
                <td>
                  {new Date(s.openedAt).toLocaleString("ru-RU")}
                  {s.closedAt ? ` - ${new Date(s.closedAt).toLocaleString("ru-RU")}` : ""}
                </td>
                <td>{s.status}</td>
                <td>
                  <button type="button" className="secondary" onClick={() => viewShift(s.id)}>
                    Отчёт
                  </button>
                  {s.status === "closed" && (
                    <>
                      <button type="button" onClick={() => downloadPdf(s.id)}>
                        PDF
                      </button>
                      <button type="button" onClick={() => downloadExport(s.id)}>
                        .dshift
                      </button>
                      <button type="button" className="secondary" onClick={() => downloadCsv(s.id)}>
                        Excel/CSV
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card">
          <h3>Отчёт смены</h3>
          <pre style={{ fontSize: "0.8rem", overflow: "auto", maxHeight: 400 }}>
            {JSON.stringify(detail.snapshot, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
