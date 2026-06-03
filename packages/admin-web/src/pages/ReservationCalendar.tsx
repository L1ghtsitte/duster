import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface CalRow {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  computer: { number: number; name: string };
  player: { displayName: string } | null;
}

export function ReservationCalendarPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<CalRow[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });

  async function load() {
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59").toISOString();
    setRows(
      await api<CalRow[]>(
        `/admin/reservations/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      )
    );
  }

  useEffect(() => {
    load();
  }, [from, to]);

  const byDay = new Map<string, CalRow[]>();
  for (const r of rows) {
    const day = r.startAt.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r);
  }
  const days = [...byDay.keys()].sort();

  return (
    <>
      <h2>{t("calendar.title")}</h2>
      <p>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /> -{" "}
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" onClick={load} style={{ marginLeft: 8 }}>
          {t("common.search")}
        </button>
      </p>
      {days.length === 0 && <p style={{ color: "var(--muted)" }}>{t("calendar.empty")}</p>}
      {days.map((day) => (
        <div key={day} className="card" style={{ marginBottom: "0.75rem" }}>
          <h3>{new Date(day + "T12:00:00").toLocaleDateString()}</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {byDay.get(day)!.map((r) => (
              <li key={r.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <img src="/models/reserved.svg" alt="" width={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
                <strong>#{r.computer.number}</strong> {r.computer.name} - {r.player?.displayName ?? "-"} ·{" "}
                {new Date(r.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                {new Date(r.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {r.title ? ` (${r.title})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
