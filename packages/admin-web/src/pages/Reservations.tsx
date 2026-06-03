import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import { PcIcon } from "../components/PcIcon";
import { PermGate } from "../perm";

interface Reservation {
  id: string;
  title: string | null;
  startAt: string;
  endAt: string;
  status: string;
  computer: { id: string; name: string; number: number; zone: string };
  player: { displayName: string } | null;
}

interface Computer {
  id: string;
  name: string;
  number: number;
  zone: string;
  status: string;
}

interface Player {
  id: string;
  displayName: string;
}

export function ReservationsPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Reservation[]>([]);
  const [pcs, setPcs] = useState<Computer[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [computerId, setComputerId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  async function load() {
    const [r, c, p] = await Promise.all([
      api<Reservation[]>("/admin/reservations"),
      api<Computer[]>("/admin/computers"),
      api<Player[]>("/admin/players"),
    ]);
    setList(r);
    setPcs(c);
    setPlayers(p);
    if (c[0] && !computerId) setComputerId(c[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  async function book(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/reservations", {
        method: "POST",
        body: JSON.stringify({
          computerId,
          playerId: playerId || undefined,
          title: title || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        }),
      });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("reservations.conflict"));
    }
  }

  async function cancel(id: string) {
    await api(`/admin/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    });
    load();
  }

  return (
    <>
      <h2>{t("reservations.title")}</h2>
      <PermGate perm="reservations.edit">
        <div className="card">
          <h3>{t("reservations.new")}</h3>
          <form onSubmit={book}>
            <select value={computerId} onChange={(e) => setComputerId(e.target.value)}>
              {pcs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} #{c.number}
                </option>
              ))}
            </select>
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">- {t("reservations.player")} -</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>
              {t("reservations.from")}{" "}
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </label>
            <label>
              {t("reservations.to")}{" "}
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            </label>
            <button type="submit">{t("common.add")}</button>
          </form>
        </div>
      </PermGate>
      <div className="grid-pcs">
        {list
          .filter((r) => r.status !== "cancelled")
          .map((r) => (
            <div key={r.id} className="pc-tile">
              <PcIcon zone={r.computer.zone} status="reserved" />
              <strong>{r.computer.name}</strong>
              <div>{r.title ?? r.player?.displayName ?? "-"}</div>
              <div style={{ fontSize: "0.7rem" }}>
                {new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleString()}
              </div>
              <PermGate perm="reservations.edit">
                <button type="button" className="danger" onClick={() => cancel(r.id)}>
                  {t("common.cancel")}
                </button>
              </PermGate>
            </div>
          ))}
      </div>
    </>
  );
}
