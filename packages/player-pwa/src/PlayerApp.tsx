import { useState } from "react";

export function PlayerApp() {
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  return (
    <div className="app">
      <header>
        <img src="/icon.svg" alt="" width={40} />
        <h1>Duster</h1>
      </header>
      <section className="card">
        <h2>Мой клуб</h2>
        <p>Баланс, бронь и QR - в Telegram или здесь (PWA v0.7)</p>
        <input
          placeholder="Телефон для привязки"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="button" onClick={() => setBalance(500)}>
          Демо: показать баланс
        </button>
        {balance != null && <p className="ok">💰 {balance} ₽</p>}
        <p className="hint">Полная интеграция API - в следующем релизе. Сейчас: @бот /link</p>
      </section>
    </div>
  );
}
