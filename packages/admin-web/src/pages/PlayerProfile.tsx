import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

interface PlayerFull {
  id: string;
  username: string;
  displayName: string;
  group: string;
  balance: number;
  bonusBalance: number;
  prepaidMinutes: number;
  unlimitedTime: boolean;
  customBonusPercent: number | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
  tags: string | null;
  totalTopups: number;
  totalSpent: number;
  visitCount: number;
  lastVisitAt: string | null;
  active: boolean;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    bonusAmount: number;
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    startedAt: string;
    status: string;
    computer: { name: string };
  }>;
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerFull | null>(null);
  const [topupAmount, setTopupAmount] = useState(1000);
  const [preview, setPreview] = useState<{
    bonusPercent: number;
    bonusAmount: number;
    totalCredit: number;
  } | null>(null);
  const [grantMinutes, setGrantMinutes] = useState(60);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setPlayer(await api<PlayerFull>(`/admin/players/${id}`));
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!id || !topupAmount) return;
    api<{ bonusPercent: number; bonusAmount: number; totalCredit: number }>(
      `/admin/players/${id}/topup-preview?amount=${topupAmount}`
    ).then(setPreview);
  }, [id, topupAmount]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    const fd = new FormData(e.currentTarget);
    await api(`/admin/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: fd.get("displayName"),
        group: fd.get("group"),
        email: fd.get("email") || null,
        phone: fd.get("phone") || null,
        notes: fd.get("notes") || null,
        unlimitedTime: fd.get("unlimitedTime") === "on",
        customBonusPercent: fd.get("customBonusPercent")
          ? Number(fd.get("customBonusPercent"))
          : null,
        pin: fd.get("pin") || undefined,
      }),
    });
    load();
  }

  async function doTopup() {
    if (!id) return;
    await api(`/admin/players/${id}/topup`, {
      method: "POST",
      body: JSON.stringify({ amount: topupAmount, grantMinutes: 0 }),
    });
    load();
  }

  async function grantMin() {
    if (!id) return;
    await api(`/admin/players/${id}/grant-minutes`, {
      method: "POST",
      body: JSON.stringify({ minutes: grantMinutes }),
    });
    load();
  }

  async function createQr() {
    if (!id) return;
    const r = await api<{ token: string; url: string }>(`/admin/players/${id}/qr-token`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setQrToken(r.token);
  }

  async function sendTgCode() {
    if (!id) return;
    const r = await api<{ code: string; phone: string }>(`/admin/telegram/players/${id}/send-link-code`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setLinkCode(`${r.code} (${r.phone})`);
  }

  if (!player) return <p>Загрузка…</p>;

  return (
    <>
      <p>
        <Link to="/players">← Игроки</Link>
      </p>
      <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src={`/api/public/players/${player.id}/avatar`}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: "50%", objectFit: "cover", background: player.avatarColor ?? "#3d8bfd" }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/models/player.svg";
          }}
        />
        {player.displayName}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <form onSubmit={saveProfile}>
            <p>
              <input name="displayName" defaultValue={player.displayName} style={{ width: "100%" }} />
            </p>
            <p>
              <select name="group" defaultValue={player.group}>
                <option value="standard">Стандарт</option>
                <option value="vip">VIP</option>
                <option value="staff">Персонал</option>
                <option value="guest">Гость</option>
              </select>
            </p>
            <p>
              <input name="email" placeholder="Email" defaultValue={player.email ?? ""} style={{ width: "100%" }} />
            </p>
            <p>
              <input name="phone" placeholder="Телефон" defaultValue={player.phone ?? ""} style={{ width: "100%" }} />
            </p>
            <p>
              <input name="pin" placeholder="PIN" defaultValue="" style={{ width: "100%" }} />
            </p>
            <p>
              <label>
                <input name="unlimitedTime" type="checkbox" defaultChecked={player.unlimitedTime} /> Безлимитное время
              </label>
            </p>
            <p>
              Персональный бонус %:{" "}
              <input
                name="customBonusPercent"
                type="number"
                defaultValue={player.customBonusPercent ?? ""}
                placeholder="авто по уровням"
              />
            </p>
            <p>
              <textarea
                name="notes"
                rows={3}
                defaultValue={player.notes ?? ""}
                style={{ width: "100%", background: "var(--bg)", color: "var(--text)" }}
              />
            </p>
            <button type="submit">Сохранить профиль</button>
          </form>
        </div>
        <div className="card">
          <h3>Баланс и время</h3>
          <p>
            Баланс: <strong>{player.balance.toFixed(0)} ₽</strong>
          </p>
          <p>Минут на счёте: {player.prepaidMinutes}</p>
          <p>
            Визитов: {player.visitCount} · пополнено {player.totalTopups} ₽ · потрачено {player.totalSpent} ₽
          </p>
          <hr />
          <h4>Пополнение</h4>
          <input type="number" value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))} />
          {preview && (
            <p style={{ color: "var(--ok)" }}>
              +{preview.bonusPercent}% бонус = {preview.bonusAmount} ₽ → на счёт {preview.totalCredit} ₽
            </p>
          )}
          <button type="button" onClick={doTopup}>
            Пополнить
          </button>
          <h4>Начислить минуты</h4>
          <input type="number" value={grantMinutes} onChange={(e) => setGrantMinutes(Number(e.target.value))} />
          <button type="button" className="secondary" onClick={grantMin}>
            Начислить
          </button>
          <hr />
          <h4>QR-вход</h4>
          <button type="button" className="secondary" onClick={createQr}>
            Создать QR-токен
          </button>
          {qrToken && (
            <p style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>
              Токен: <code>{qrToken}</code>
              <br />
              На станции: режим QR → вставить токен
            </p>
          )}
          <h4>Telegram</h4>
          <button type="button" className="secondary" onClick={sendTgCode}>
            Код привязки для бота
          </button>
          {linkCode && <p style={{ color: "var(--ok)" }}>Код: {linkCode}</p>}
        </div>
      </div>
      <div className="card">
        <h3>История пополнений</h3>
        <table>
          <tbody>
            {player.transactions.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.createdAt).toLocaleString("ru-RU")}</td>
                <td>
                  {t.amount} ₽ + {t.bonusAmount} бонус
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
