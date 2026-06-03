import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

export function AnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<{
    revenue24h: number;
    revenueWeek: number;
    players: number;
    sessionsActive: number;
    topPlayers: { displayName: string; totalSpent: number; level: number }[];
    hourlyLoad: { hour: number; count: number }[];
  } | null>(null);

  useEffect(() => {
    api("/admin/analytics/overview").then(setData);
  }, []);

  if (!data) return <p>{t("common.loading")}</p>;

  const maxH = Math.max(...data.hourlyLoad.map((h) => h.count), 1);

  return (
    <>
      <h2>Analytics</h2>
      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-label">24h revenue</div>
          <div className="stat-value">{data.revenue24h.toFixed(0)} ₽</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Week revenue</div>
          <div className="stat-value">{data.revenueWeek.toFixed(0)} ₽</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t("nav.players")}</div>
          <div className="stat-value">{data.players}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">{t("dashboard.sessions")}</div>
          <div className="stat-value">{data.sessionsActive}</div>
        </div>
      </div>
      <div className="card">
        <h3>Load heatmap (week)</h3>
        <div className="heatmap">
          {data.hourlyLoad.map((h) => (
            <div
              key={h.hour}
              className="heat-bar"
              title={`${h.hour}:00 - ${h.count}`}
              style={{ height: `${(h.count / maxH) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Top players (LTV)</h3>
        <table>
          <tbody>
            {data.topPlayers.map((p) => (
              <tr key={p.displayName}>
                <td>{p.displayName}</td>
                <td>Lvl {p.level}</td>
                <td>{p.totalSpent} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
