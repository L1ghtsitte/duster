import { FormEvent, useEffect, useState } from "react";
import { api, connectAdminWs } from "../api";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { PcIcon } from "../components/PcIcon";
import { StreamModal } from "../components/StreamModal";

interface Computer {
  id: string;
  name: string;
  number: number;
  status: string;
  macAddress: string | null;
  ipAddress: string | null;
  zone: string;
  agentOnline?: boolean;
  agentToken: string;
}

export function ComputersPage() {
  const [list, setList] = useState<Computer[]>([]);
  const [name, setName] = useState("");
  const [number, setNumber] = useState(6);
  const [mac, setMac] = useState("");
  const [screenPc, setScreenPc] = useState<Computer | null>(null);
  const [screenImg, setScreenImg] = useState<string | null>(null);
  const [streamPc, setStreamPc] = useState<Computer | null>(null);
  const [editPc, setEditPc] = useState<Computer | null>(null);
  const { t } = useI18n();
  const { can } = useAuth();

  async function load() {
    setList(await api<Computer[]>("/admin/computers"));
  }

  useEffect(() => {
    load();
    const ws = connectAdminWs((msg) => {
      if ((msg as { type?: string }).type === "computers_updated") load();
    });
    return () => ws.close();
  }, []);

  async function addPc(e: FormEvent) {
    e.preventDefault();
    await api("/admin/computers", {
      method: "POST",
      body: JSON.stringify({ name, number, macAddress: mac || undefined }),
    });
    setName("");
    load();
  }

  async function cmd(id: string, command: string) {
    await api(`/admin/computers/${id}/command`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    load();
  }

  async function wake(id: string) {
    await api(`/admin/computers/${id}/wake`, { method: "POST" });
    load();
  }

  async function viewScreen(pc: Computer) {
    setScreenPc(pc);
    setScreenImg(null);
    const token = localStorage.getItem("duster_token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "watch_screen", payload: { computerId: pc.id } }));
      }, 300);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as { type?: string; dataBase64?: string };
      if (msg.type === "screenshot" && msg.dataBase64) {
        setScreenImg(`data:image/jpeg;base64,${msg.dataBase64}`);
      }
    };
    try {
      const shot = await api<{ dataBase64: string }>(`/admin/computers/${pc.id}/screenshot`);
      setScreenImg(`data:image/jpeg;base64,${shot.dataBase64}`);
    } catch {
      /* wait for ws */
    }
  }

  return (
    <>
      <h2>{t("computers.title")}</h2>
      <div className="card">
        <form onSubmit={addPc}>
          <input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            type="number"
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
            min={1}
          />
          <input placeholder="MAC (WoL)" value={mac} onChange={(e) => setMac(e.target.value)} />
          <button type="submit">Добавить ПК</button>
        </form>
      </div>
      <div className="grid-pcs">
        {list.map((pc) => (
          <div key={pc.id} className="pc-tile">
            <PcIcon zone={pc.zone} status={pc.status} />
            <strong>{pc.name}</strong>
            <div>#{pc.number}</div>
            <span className={`badge ${pc.status}`}>{pc.status}</span>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
              {pc.agentOnline ? t("computers.agentOnline") : t("computers.agentOffline")}
              {pc.ipAddress ? ` · ${pc.ipAddress}` : ""}
            </div>
            <div className="actions">
              <button type="button" onClick={() => cmd(pc.id, "unlock")}>
                Открыть
              </button>
              <button type="button" className="secondary" onClick={() => cmd(pc.id, "lock")}>
                Блок
              </button>
              <button type="button" className="danger" onClick={() => cmd(pc.id, "shutdown")}>
                Выкл
              </button>
              <button type="button" onClick={() => wake(pc.id)}>
                WoL
              </button>
              {can("computers.stream") && (
                <>
                  <button type="button" className="secondary" onClick={() => viewScreen(pc)}>
                    {t("computers.screen")}
                  </button>
                  <button type="button" onClick={() => setStreamPc(pc)}>
                    {t("computers.stream")}
                  </button>
                </>
              )}
              {can("computers.edit") && (
                <button type="button" className="secondary" onClick={() => setEditPc({ ...pc })}>
                  {t("common.edit")}
                </button>
              )}
            </div>
            <details style={{ marginTop: 8, fontSize: "0.7rem", textAlign: "left" }}>
              <summary>Токен агента</summary>
              <code style={{ wordBreak: "break-all" }}>{pc.agentToken}</code>
            </details>
          </div>
        ))}
      </div>
      {streamPc && (
        <StreamModal computerId={streamPc.id} name={streamPc.name} onClose={() => setStreamPc(null)} />
      )}
      {editPc && can("computers.edit") && (
        <div className="card">
          <h3>{t("computers.editTitle")}</h3>
          <input
            value={editPc.name}
            onChange={(e) => setEditPc({ ...editPc, name: e.target.value })}
          />
          <input
            value={editPc.macAddress ?? ""}
            onChange={(e) => setEditPc({ ...editPc, macAddress: e.target.value })}
          />
          <select value={editPc.zone} onChange={(e) => setEditPc({ ...editPc, zone: e.target.value })}>
            <option value="main">main</option>
            <option value="vip">vip</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              await api(`/admin/computers/${editPc.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  name: editPc.name,
                  macAddress: editPc.macAddress,
                  zone: editPc.zone,
                }),
              });
              setEditPc(null);
              load();
            }}
          >
            {t("common.save")}
          </button>
        </div>
      )}
      {screenPc && (
        <div className="card" style={{ position: "fixed", inset: "10%", zIndex: 100, overflow: "auto" }}>
          <h3>Экран: {screenPc.name}</h3>
          <button type="button" onClick={() => setScreenPc(null)}>
            Закрыть
          </button>
          {screenImg ? (
            <img src={screenImg} alt="screen" style={{ maxWidth: "100%", marginTop: 8 }} />
          ) : (
            <p>Запрос снимка… (нужен запущенный агент)</p>
          )}
        </div>
      )}
    </>
  );
}
