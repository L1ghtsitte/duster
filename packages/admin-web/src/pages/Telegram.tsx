import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import { EntityIcon } from "../components/EntityIcon";

interface TgSettings {
  enabled: boolean;
  botToken: string;
  rubPerStar: number;
  webhookUrl: string;
  groupChatId: string;
  loginConfirmEnabled: boolean;
  referralBonusRub: number;
  referralBonusPercent: number;
  loyaltyPointsPer100Rub: number;
}

interface Giveaway {
  id: string;
  title: string;
  prizeText: string;
  status: string;
  endsAt: string;
}

export function TelegramPage() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<TgSettings | null>(null);
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [saved, setSaved] = useState(false);
  const [gTitle, setGTitle] = useState("");
  const [gPrize, setGPrize] = useState("");
  const [gEnds, setGEnds] = useState("");

  async function load() {
    setCfg(await api<TgSettings>("/admin/telegram/settings"));
    setGiveaways(await api<Giveaway[]>("/admin/telegram/giveaways"));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCfg(
      await api<TgSettings>("/admin/telegram/settings", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: fd.get("enabled") === "on",
          botToken: String(fd.get("botToken") ?? ""),
          rubPerStar: Number(fd.get("rubPerStar")),
          webhookUrl: String(fd.get("webhookUrl") ?? ""),
          groupChatId: String(fd.get("groupChatId") ?? ""),
          loginConfirmEnabled: fd.get("loginConfirm") === "on",
          referralBonusRub: Number(fd.get("referralBonusRub")),
          referralBonusPercent: Number(fd.get("referralBonusPercent")),
          loyaltyPointsPer100Rub: Number(fd.get("loyaltyPer100")),
        }),
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function createGiveaway(e: FormEvent) {
    e.preventDefault();
    await api("/admin/telegram/giveaways", {
      method: "POST",
      body: JSON.stringify({ title: gTitle, prizeText: gPrize, endsAt: gEnds }),
    });
    setGTitle("");
    setGPrize("");
    load();
  }

  if (!cfg) return <p>{t("common.loading")}</p>;

  return (
    <>
      <h2>
        <EntityIcon kind="telegram" /> {t("telegram.title")}
      </h2>
      <p style={{ color: "var(--muted)" }}>{t("telegram.hint")}</p>
      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={save}>
          <p>
            <label>
              <input name="enabled" type="checkbox" defaultChecked={cfg.enabled} /> {t("telegram.enabled")}
            </label>
          </p>
          <p>
            <label>{t("telegram.token")}</label>
            <input name="botToken" defaultValue={cfg.botToken} style={{ width: "100%" }} />
          </p>
          <p>
            <label>{t("telegram.rubPerStar")}</label>
            <input name="rubPerStar" type="number" step="0.01" defaultValue={cfg.rubPerStar} style={{ width: "100%" }} />
          </p>
          <p>
            <label>{t("telegram.groupChatId")}</label>
            <input name="groupChatId" defaultValue={cfg.groupChatId} style={{ width: "100%" }} placeholder="-100..." />
          </p>
          <p>
            <label>
              <input name="loginConfirm" type="checkbox" defaultChecked={cfg.loginConfirmEnabled} />{" "}
              {t("telegram.loginConfirm")}
            </label>
          </p>
          <p>
            <label>{t("telegram.referralRub")}</label>
            <input name="referralBonusRub" type="number" defaultValue={cfg.referralBonusRub} style={{ width: "100%" }} />
          </p>
          <p>
            <label>{t("telegram.referralPercent")}</label>
            <input
              name="referralBonusPercent"
              type="number"
              defaultValue={cfg.referralBonusPercent}
              style={{ width: "100%" }}
            />
          </p>
          <p>
            <label>{t("telegram.loyaltyPer100")}</label>
            <input
              name="loyaltyPer100"
              type="number"
              defaultValue={cfg.loyaltyPointsPer100Rub}
              style={{ width: "100%" }}
            />
          </p>
          <button type="submit">{t("common.save")}</button>
          {saved && <span style={{ marginLeft: 12, color: "var(--ok)" }}>✓</span>}
        </form>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          <EntityIcon kind="giveaway" /> {t("telegram.giveaways")}
        </h3>
        <form onSubmit={createGiveaway} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input placeholder={t("telegram.gTitle")} value={gTitle} onChange={(e) => setGTitle(e.target.value)} required />
          <input placeholder={t("telegram.gPrize")} value={gPrize} onChange={(e) => setGPrize(e.target.value)} required />
          <input type="datetime-local" value={gEnds} onChange={(e) => setGEnds(e.target.value)} required />
          <button type="submit">{t("common.add")}</button>
        </form>
        <table>
          <tbody>
            {giveaways.map((g) => (
              <tr key={g.id}>
                <td>{g.title}</td>
                <td>{g.prizeText}</td>
                <td>{g.status}</td>
                <td>
                  {g.status === "draft" && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => api(`/admin/telegram/giveaways/${g.id}/publish`, { method: "POST" }).then(load)}
                    >
                      {t("telegram.publish")}
                    </button>
                  )}
                  {g.status === "active" && (
                    <button
                      type="button"
                      onClick={() => api(`/admin/telegram/giveaways/${g.id}/draw`, { method: "POST" }).then(load)}
                    >
                      {t("telegram.draw")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
