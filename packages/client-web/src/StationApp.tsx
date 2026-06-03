import { FormEvent, useEffect, useState } from "react";

function getStationNumber(): number {
  const q = new URLSearchParams(location.search).get("pc");
  if (q) return Number(q);
  const stored = localStorage.getItem("duster_pc_number");
  return stored ? Number(stored) : 1;
}

interface StationInfo {
  id: string;
  name: string;
  number: number;
  status: string;
}

interface LoginResult {
  token: string;
  session: { id: string; endsAt: string | null; isUnlimited: boolean };
  player: {
    displayName: string;
    group: string;
    balance: number;
    unlimitedTime: boolean;
    prepaidMinutes: number;
  };
}

export function StationApp() {
  const [pc, setPc] = useState<StationInfo | null>(null);
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useLogin, setUseLogin] = useState(false);
  const [useQr, setUseQr] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<LoginResult | null>(null);
  const [tgPending, setTgPending] = useState<string | null>(null);
  const [tgMessage, setTgMessage] = useState("");
  const pcNumber = getStationNumber();

  useEffect(() => {
    localStorage.setItem("duster_pc_number", String(pcNumber));
    fetch(`/api/station/${pcNumber}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPc)
      .catch(() => setError("Сервер недоступен"));

    const saved = localStorage.getItem("duster_station_token");
    if (saved) {
      fetch("/api/station/session", {
        headers: { Authorization: `Bearer ${saved}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((s) => {
          setSession({
            token: saved,
            session: { id: s.id, endsAt: s.endsAt, isUnlimited: s.isUnlimited },
            player: {
              displayName: s.player.displayName,
              group: s.player.group,
              balance: s.player.balance,
              unlimitedTime: s.player.unlimitedTime,
              prepaidMinutes: s.player.prepaidMinutes,
            },
          });
        })
        .catch(() => localStorage.removeItem("duster_station_token"));
    }
  }, [pcNumber]);

  useEffect(() => {
    if (!tgPending) return;
    const iv = setInterval(async () => {
      const res = await fetch(`/api/station/login/pending/${tgPending}`);
      const data = await res.json();
      if (data.status === "approved" && data.token) {
        localStorage.setItem("duster_station_token", data.token);
        setSession({
          token: data.token,
          session: data.session ?? { id: "", endsAt: null, isUnlimited: false },
          player: data.player,
        });
        setTgPending(null);
        setTgMessage("");
      } else if (data.status === "denied" || data.status === "expired") {
        setTgPending(null);
        setError(data.status === "denied" ? "Вход отклонён в Telegram" : "Время ожидания истекло");
        setTgMessage("");
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [tgPending]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const url = useQr ? "/api/station/qr-login" : "/api/station/login";
      const body = useQr
        ? { token: qrToken.trim(), computerNumber: pcNumber }
        : {
            computerNumber: pcNumber,
            pin: useLogin ? undefined : pin,
            username: useLogin ? username : undefined,
            password: useLogin ? password : undefined,
          };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Ошибка входа");

      if (data.pendingTelegram && data.approvalToken) {
        setTgPending(data.approvalToken);
        setTgMessage(data.message ?? "Подтвердите вход в Telegram");
        return;
      }

      localStorage.setItem("duster_station_token", data.token);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function onLogout() {
    const token = localStorage.getItem("duster_station_token");
    if (token) {
      await fetch("/api/station/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem("duster_station_token");
    setSession(null);
  }

  if (!pc && !error) {
    return <div className="station locked">Подключение…</div>;
  }

  if (session) {
    const ends = session.session.endsAt
      ? new Date(session.session.endsAt).toLocaleTimeString("ru-RU")
      : null;
    return (
      <div className="station">
        <h1>{pc?.name}</h1>
        <p>
          {session.player.displayName} · {session.player.group.toUpperCase()}
        </p>
        <p>Баланс: {session.player.balance.toFixed(0)} ₽</p>
        {session.session.isUnlimited ? (
          <p style={{ color: "#3ecf8e" }}>Безлимитное время</p>
        ) : ends ? (
          <p>До: {ends}</p>
        ) : (
          <p>Минут: {session.player.prepaidMinutes}</p>
        )}
        <button type="button" onClick={onLogout} style={{ marginTop: "1rem" }}>
          Завершить сессию
        </button>
      </div>
    );
  }

  return (
    <div className="station">
      <div className="locked">
        <h1>
          <img src="/models/pc.svg" alt="" width={32} style={{ verticalAlign: "middle" }} /> Duster
        </h1>
        <p className="pc-num">
          {pc?.name ?? "ПК"} · #{pcNumber}
        </p>
        {tgPending && (
          <p style={{ color: "#5b8def", padding: "0.5rem" }}>
            <img src="/models/telegram.svg" width={20} alt="" /> {tgMessage}
          </p>
        )}
        <p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setUseQr(false);
              setUseLogin(!useLogin);
            }}
          >
            {useLogin ? "PIN" : "Логин"}
          </button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setUseQr(!useQr);
              setUseLogin(false);
            }}
          >
            {useQr ? "Обычный" : "QR"}
          </button>
        </p>
        <form onSubmit={onLogin}>
          {useQr ? (
            <input
              placeholder="QR-токен"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              autoFocus
            />
          ) : useLogin ? (
            <>
              <input placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          ) : (
            <input
              type="password"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
          )}
          <button type="submit" disabled={!!tgPending}>
            {tgPending ? "Ждём Telegram…" : "Начать игру"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
