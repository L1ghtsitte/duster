import { useEffect, useState } from "react";
import { api } from "../api";

interface Product {
  id: string;
  name: string;
  price: number;
}
interface Package {
  id: string;
  name: string;
  price: number;
}
interface Player {
  id: string;
  displayName: string;
}

export function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [cart, setCart] = useState<{ productId: string; name: string; qty: number; price: number }[]>([]);
  const [lastSale, setLastSale] = useState<string>("");

  useEffect(() => {
    Promise.all([
      api<Product[]>("/admin/products"),
      api<Package[]>("/admin/packages"),
      api<Player[]>("/admin/players"),
    ]).then(([pr, pk, pl]) => {
      setProducts(pr.filter((p) => p));
      setPackages(pk);
      setPlayers(pl);
    });
  }, []);

  function addToCart(p: Product) {
    setCart((c) => {
      const ex = c.find((i) => i.productId === p.id);
      if (ex) return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, name: p.name, qty: 1, price: p.price }];
    });
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  async function checkout() {
    const sale = await api<{ id: string; total: number }>("/admin/sales", {
      method: "POST",
      body: JSON.stringify({
        playerId: playerId || undefined,
        payment: "cash",
        items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
      }),
    });
    setLastSale(`Продажа #${sale.id.slice(-6)} - ${sale.total} ₽`);
    setCart([]);
  }

  async function sellPackage(packageId: string) {
    const sale = await api<{ id: string; total: number }>("/admin/sales", {
      method: "POST",
      body: JSON.stringify({
        playerId: playerId || undefined,
        packageId,
        payment: "cash",
      }),
    });
    setLastSale(`Пакет #${sale.id.slice(-6)} - ${sale.total} ₽`);
  }

  return (
    <>
      <h2>Касса (POS)</h2>
      {lastSale && <p style={{ color: "var(--ok)" }}>{lastSale}</p>}
      <div className="card">
        <label>
          Игрок:{" "}
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">- без привязки -</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h3>Товары</h3>
          {products.map((p) => (
            <button key={p.id} type="button" className="secondary" style={{ margin: "0.25rem" }} onClick={() => addToCart(p)}>
              {p.name} - {p.price} ₽
            </button>
          ))}
        </div>
        <div className="card">
          <h3>Пакеты</h3>
          {packages.map((p) => (
            <button key={p.id} type="button" style={{ margin: "0.25rem", display: "block" }} onClick={() => sellPackage(p.id)}>
              {p.name} - {p.price} ₽
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Корзина - {total} ₽</h3>
        <ul>
          {cart.map((i) => (
            <li key={i.productId}>
              {i.name} × {i.qty}
            </li>
          ))}
        </ul>
        <button type="button" disabled={!cart.length} onClick={checkout}>
          Оформить продажу
        </button>
      </div>
    </>
  );
}
