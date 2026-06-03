import { useEffect, useState, FormEvent } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Profile {
  id: string;
  name: string;
  blockUsbStorage: boolean;
  allowUsbCharge: boolean;
  cleanupOnLock: boolean;
  _count: { computers: number };
}

export function PcProfilesPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Profile[]>([]);
  const [name, setName] = useState("Standard");

  function load() {
    api<Profile[]>("/admin/pc-profiles").then(setList);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api("/admin/pc-profiles", {
      method: "POST",
      body: JSON.stringify({ name, blockUsbStorage: true, cleanupOnLock: true }),
    });
    load();
  }

  return (
    <>
      <h2>PC profiles</h2>
      <div className="card">
        <form onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">{t("common.add")}</button>
        </form>
      </div>
      <div className="card">
        {list.map((p) => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <strong>{p.name}</strong> - {p._count.computers} PCs
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              USB block: {p.blockUsbStorage ? "yes" : "no"} · Cleanup on lock:{" "}
              {p.cleanupOnLock ? "yes" : "no"}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
