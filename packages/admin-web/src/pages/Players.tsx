import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface Player {
  id: string;
  username: string;
  displayName: string;
  group: string;
  balance: number;
  active: boolean;
}

export function PlayersPage() {
  const [list, setList] = useState<Player[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [group, setGroup] = useState("standard");

  async function load() {
    setList(await api<Player[]>("/admin/players"));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api("/admin/players", {
      method: "POST",
      body: JSON.stringify({ username, displayName, group }),
    });
    setUsername("");
    setDisplayName("");
    load();
  }

  return (
    <>
      <h2>Игроки</h2>
      <div className="card">
        <form onSubmit={add}>
          <input
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            placeholder="Имя"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="standard">Стандарт</option>
            <option value="vip">VIP</option>
            <option value="staff">Персонал</option>
            <option value="guest">Гость</option>
          </select>
          <button type="submit">Добавить</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Группа</th>
              <th>Баланс</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.displayName} <span style={{ color: "var(--muted)" }}>({p.username})</span>
                </td>
                <td>{p.group}</td>
                <td>{p.balance.toFixed(0)} ₽</td>
                <td>
                  <Link to={`/players/${p.id}`}>Профиль</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
