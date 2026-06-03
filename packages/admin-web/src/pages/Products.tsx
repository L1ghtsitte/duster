import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { PermGate } from "../perm";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  price: number;
  cost: number;
  stock: number;
  active: boolean;
}

export function ProductsPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const [list, setList] = useState<Product[]>([]);
  const [edit, setEdit] = useState<Product | null>(null);

  async function load() {
    setList(await api<Product[]>("/admin/products"));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        price: Number(fd.get("price")),
        stock: Number(fd.get("stock")),
        cost: Number(fd.get("cost") || 0),
        category: fd.get("category") || "snack",
        sku: fd.get("sku") || undefined,
      }),
    });
    e.currentTarget.reset();
    load();
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    await api(`/admin/products/${edit.id}`, {
      method: "PATCH",
      body: JSON.stringify(edit),
    });
    setEdit(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm(t("common.delete") + "?")) return;
    await api(`/admin/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <h2>{t("products.title")}</h2>
      <PermGate perm="products.edit">
        <div className="card">
          <form onSubmit={add}>
            <input name="name" placeholder={t("products.title")} required />
            <input name="sku" placeholder="SKU" />
            <input name="category" placeholder="category" defaultValue="snack" />
            <input name="price" type="number" placeholder="price" required />
            <input name="cost" type="number" placeholder="cost" />
            <input name="stock" type="number" placeholder="stock" defaultValue={10} />
            <button type="submit">{t("common.add")}</button>
          </form>
        </div>
      </PermGate>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t("products.title")}</th>
              <th>SKU</th>
              <th>₽</th>
              <th>Stock</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.price}</td>
                <td>{p.stock}</td>
                <td>
                  {can("products.edit") && (
                    <>
                      <button type="button" className="secondary" onClick={() => setEdit({ ...p })}>
                        {t("common.edit")}
                      </button>
                      <button type="button" className="danger" onClick={() => remove(p.id)}>
                        {t("common.delete")}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="card">
          <h3>{t("products.edit")}</h3>
          <form onSubmit={saveEdit}>
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              style={{ width: "100%" }}
            />
            <input
              value={edit.sku ?? ""}
              onChange={(e) => setEdit({ ...edit, sku: e.target.value })}
            />
            <input
              type="number"
              value={edit.price}
              onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })}
            />
            <input
              type="number"
              value={edit.cost}
              onChange={(e) => setEdit({ ...edit, cost: Number(e.target.value) })}
            />
            <input
              type="number"
              value={edit.stock}
              onChange={(e) => setEdit({ ...edit, stock: Number(e.target.value) })}
            />
            <label>
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />{" "}
              active
            </label>
            <button type="submit">{t("common.save")}</button>
            <button type="button" className="secondary" onClick={() => setEdit(null)}>
              {t("common.cancel")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
