import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Tier {
  id: string;
  minAmount: number;
  bonusPercent: number;
  label: string | null;
  active: boolean;
  sortOrder: number;
}

export function SettingsPage() {
  const { t } = useI18n();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [minAmount, setMinAmount] = useState(500);
  const [bonusPercent, setBonusPercent] = useState(5);
  const [label, setLabel] = useState("");

  async function load() {
    setTiers(await api<Tier[]>("/admin/settings/topup-tiers"));
  }

  useEffect(() => {
    load();
  }, []);

  async function addTier(e: FormEvent) {
    e.preventDefault();
    await api("/admin/settings/topup-tiers", {
      method: "POST",
      body: JSON.stringify({ minAmount, bonusPercent, label: label || undefined }),
    });
    load();
  }

  async function removeTier(id: string) {
    await api(`/admin/settings/topup-tiers/${id}`, { method: "DELETE" });
    load();
  }

  async function patchTier(id: string, data: Partial<Tier>) {
    await api(`/admin/settings/topup-tiers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    load();
  }

  return (
    <>
      <h2>{t("settings.title")}</h2>
      <p style={{ color: "var(--muted)" }}>
        При пополнении от суммы порога начисляется процент на баланс. У игрока можно задать персональный % или
        безлимит в профиле.
      </p>
      <div className="card">
        <form onSubmit={addTier}>
          <input
            type="number"
            placeholder="От суммы ₽"
            value={minAmount}
            onChange={(e) => setMinAmount(Number(e.target.value))}
          />
          <input
            type="number"
            placeholder="% бонуса"
            value={bonusPercent}
            onChange={(e) => setBonusPercent(Number(e.target.value))}
          />
          <input placeholder="Подпись" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="submit">Добавить уровень</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Порог</th>
              <th>Бонус %</th>
              <th>Подпись</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="number"
                    defaultValue={t.minAmount}
                    onBlur={(e) => patchTier(t.id, { minAmount: Number(e.target.value) })}
                    style={{ width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    defaultValue={t.bonusPercent}
                    onBlur={(e) => patchTier(t.id, { bonusPercent: Number(e.target.value) })}
                    style={{ width: 60 }}
                  />
                </td>
                <td>
                  <input
                    defaultValue={t.label ?? ""}
                    onBlur={(e) => patchTier(t.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <button type="button" className="danger" onClick={() => removeTier(t.id)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
