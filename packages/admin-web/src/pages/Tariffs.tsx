import { useEffect, useState, FormEvent } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Tariff {
  id: string;
  name: string;
  zone: string | null;
  dayOfWeek: number | null;
  hourFrom: number;
  hourTo: number;
  pricePerHour: number;
  active: boolean;
}

export function TariffsPage() {
  const { t } = useI18n();
  const [list, setList] = useState<Tariff[]>([]);
  const [name, setName] = useState("Evening");
  const [price, setPrice] = useState(250);
  const [from, setFrom] = useState(18);
  const [to, setTo] = useState(24);

  function load() {
    api<Tariff[]>("/admin/tariffs").then(setList);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api("/admin/tariffs", {
      method: "POST",
      body: JSON.stringify({ name, pricePerHour: price, hourFrom: from, hourTo: to }),
    });
    load();
  }

  return (
    <>
      <h2>Dynamic pricing</h2>
      <div className="card">
        <form onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          <input type="number" value={from} onChange={(e) => setFrom(Number(e.target.value))} />
          <input type="number" value={to} onChange={(e) => setTo(Number(e.target.value))} />
          <button type="submit">{t("common.add")}</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Hours</th>
              <th>₽/h</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {r.hourFrom}:00 - {r.hourTo}:00
                </td>
                <td>{r.pricePerHour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
