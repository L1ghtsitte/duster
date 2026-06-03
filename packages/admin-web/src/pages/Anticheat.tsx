import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Blocked {
  id: string;
  namePattern: string;
  action: string;
  alertAdmin: boolean;
  active: boolean;
}

interface Computer {
  id: string;
  name: string;
  number: number;
}

export function AnticheatPage() {
  const { t } = useI18n();
  const [rules, setRules] = useState<Blocked[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [pcId, setPcId] = useState("");
  const [processes, setProcesses] = useState<{ pid: number; name: string; memoryMb: number }[]>([]);

  async function load() {
    const [r, pcs] = await Promise.all([
      api<Blocked[]>("/admin/anticheat/processes"),
      api<Computer[]>("/admin/computers"),
    ]);
    setRules(r);
    setComputers(pcs);
    if (!pcId && pcs[0]) setPcId(pcs[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("duster_token");
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as {
        type?: string;
        computerId?: string;
        processes?: { pid: number; name: string; memoryMb: number }[];
      };
      if (msg.type === "process_list" && msg.computerId === pcId && msg.processes) {
        setProcesses(msg.processes);
      }
    };
    return () => ws.close();
  }, [pcId]);

  async function addRule(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData((e.target as HTMLFormElement));
    await api("/admin/anticheat/processes", {
      method: "POST",
      body: JSON.stringify({
        namePattern: fd.get("namePattern"),
        action: fd.get("action"),
      }),
    });
    load();
    (e.target as HTMLFormElement).reset();
  }

  async function remove(id: string) {
    await api(`/admin/anticheat/processes/${id}`, { method: "DELETE" });
    load();
  }

  async function pollProcesses() {
    if (!pcId) return;
    await api(`/admin/anticheat/agent-list/${pcId}`);
  }

  return (
    <>
      <h2>{t("anticheat.title")}</h2>
      <div className="card">
        <h3>{t("anticheat.rules")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("anticheat.pattern")}</th>
              <th>{t("anticheat.action")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.namePattern}</td>
                <td>{r.action}</td>
                <td>
                  <button type="button" className="secondary" onClick={() => remove(r.id)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addRule} style={{ marginTop: "1rem", display: "flex", gap: 8 }}>
          <input name="namePattern" placeholder="cheatengine" required />
          <select name="action" defaultValue="kill">
            <option value="kill">kill</option>
            <option value="alert">alert</option>
          </select>
          <button type="submit">{t("common.add")}</button>
        </form>
      </div>
      <div className="card">
        <h3>{t("anticheat.processes")}</h3>
        <select value={pcId} onChange={(e) => setPcId(e.target.value)}>
          {computers.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.number} {c.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={pollProcesses} style={{ marginLeft: 8 }}>
          {t("anticheat.refresh")}
        </button>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>PID</th>
              <th>{t("anticheat.name")}</th>
              <th>RAM MB</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid}>
                <td>{p.pid}</td>
                <td>{p.name}</td>
                <td>{p.memoryMb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
