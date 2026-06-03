import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import { PcIcon } from "../components/PcIcon";
import { Link } from "react-router-dom";

interface MapPc {
  id: string;
  name: string;
  number: number;
  zone: string;
  status: string;
  mapX: number;
  mapY: number;
  mapStatus: string;
  reserved: boolean;
}

export function ClubMapPage() {
  const { t } = useI18n();
  const [pcs, setPcs] = useState<MapPc[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  async function load() {
    setPcs(await api<MapPc[]>("/admin/club-map"));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  async function savePos(id: string, mapX: number, mapY: number) {
    await api(`/admin/club-map/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ mapX, mapY }),
    });
  }

  const color = (s: string) =>
    s === "free" ? "#3ecf8e" : s === "busy" ? "#f56565" : s === "reserved" ? "#9b59b6" : "#555";

  return (
    <>
      <h2>{t("nav.computers")} - Map</h2>
      <p style={{ color: "var(--muted)" }}>
        <span style={{ color: "#3ecf8e" }}>■</span> free{" "}
        <span style={{ color: "#f56565" }}>■</span> busy{" "}
        <span style={{ color: "#9b59b6" }}>■</span> reserved{" "}
        <span style={{ color: "#555" }}>■</span> offline - drag PCs to arrange
      </p>
      <div
        className="club-map"
        onMouseMove={(e) => {
          if (!dragId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const mapX = ((e.clientX - rect.left) / rect.width) * 100;
          const mapY = ((e.clientY - rect.top) / rect.height) * 100;
          setPcs((list) =>
            list.map((p) => (p.id === dragId ? { ...p, mapX, mapY } : p))
          );
        }}
        onMouseUp={() => {
          if (!dragId) return;
          const p = pcs.find((x) => x.id === dragId);
          if (p) savePos(p.id, p.mapX, p.mapY);
          setDragId(null);
        }}
      >
        {pcs.map((pc) => (
          <div
            key={pc.id}
            className="map-node"
            style={{
              left: `${pc.mapX}%`,
              top: `${pc.mapY}%`,
              borderColor: color(pc.mapStatus),
            }}
            onMouseDown={() => setDragId(pc.id)}
          >
            <PcIcon zone={pc.zone} status={pc.status} mapStatus={pc.mapStatus} size={40} />
            <div>{pc.name}</div>
            <Link to="/reservations">#{pc.number}</Link>
          </div>
        ))}
      </div>
    </>
  );
}
