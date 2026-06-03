import { useEffect, useState } from "react";
import { api, connectAdminWs } from "../api";

interface Session {
  id: string;
  player: { displayName: string };
  computer: { name: string; number: number };
}

export function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pcCount, setPcCount] = useState(0);
  const [online, setOnline] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);

  async function load() {
    const [s, pcs, shift] = await Promise.all([
      api<Session[]>("/admin/sessions/active"),
      api<{ status: string; agentOnline?: boolean }[]>("/admin/computers"),
      api<{ id: string } | null>("/admin/shifts/current").catch(() => null),
    ]);
    setShiftOpen(!!shift);
    setSessions(s);
    setPcCount(pcs.length);
    setOnline(pcs.filter((p) => p.status !== "offline").length);
  }

  useEffect(() => {
    load();
    const ws = connectAdminWs((msg) => {
      if ((msg as { type?: string }).type === "computers_updated") load();
    });
    return () => ws.close();
  }, []);

  return (
    <>
      <h2>Обзор клуба</h2>
      {!shiftOpen && (
        <p style={{ color: "var(--warn)" }}>
          Смена не открыта - откройте в разделе «Смены» для учёта продаж и PDF-отчёта.
        </p>
      )}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "var(--muted)" }}>Компьютеров</div>
          <div style={{ fontSize: "2rem" }}>{pcCount}</div>
        </div>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "var(--muted)" }}>Онлайн</div>
          <div style={{ fontSize: "2rem" }}>{online}</div>
        </div>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "var(--muted)" }}>Активных сессий</div>
          <div style={{ fontSize: "2rem" }}>{sessions.length}</div>
        </div>
      </div>
      <div className="card">
        <h3>Активные сессии</h3>
        {sessions.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Нет активных сессий</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Игрок</th>
                <th>ПК</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.player.displayName}</td>
                  <td>
                    {s.computer.name} (#{s.computer.number})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
