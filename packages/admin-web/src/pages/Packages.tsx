import { useEffect, useState, FormEvent } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { PermGate } from "../perm";

interface Package {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minutes: number;
  balanceGrant: number;
  group: string | null;
  active: boolean;
}

export function PackagesPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const [list, setList] = useState<Package[]>([]);
  const [edit, setEdit] = useState<Package | null>(null);

  useEffect(() => {
    api<Package[]>("/admin/packages").then(setList);
  }, []);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/admin/packages", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        price: Number(fd.get("price")),
        minutes: Number(fd.get("minutes")),
        balanceGrant: Number(fd.get("balanceGrant")),
        description: fd.get("description") || undefined,
      }),
    });
    e.currentTarget.reset();
    api<Package[]>("/admin/packages").then(setList);
  }

  async function save() {
    if (!edit) return;
    await api(`/admin/packages/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) });
    setEdit(null);
    api<Package[]>("/admin/packages").then(setList);
  }

  async function remove(id: string) {
    if (!confirm(t("common.delete") + "?")) return;
    await api(`/admin/packages/${id}`, { method: "DELETE" });
    api<Package[]>("/admin/packages").then(setList);
  }

  return (
    <>
      <h2>{t("packages.title")}</h2>
      <PermGate perm="packages.edit">
        <div className="card">
          <form onSubmit={add}>
            <input name="name" required placeholder="name" />
            <input name="description" placeholder="desc" />
            <input name="price" type="number" required />
            <input name="minutes" type="number" defaultValue={60} />
            <input name="balanceGrant" type="number" defaultValue={0} />
            <button type="submit">{t("common.add")}</button>
          </form>
        </div>
      </PermGate>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>₽</th>
              <th>Min</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.price}</td>
                <td>{p.minutes}</td>
                <td>{p.balanceGrant}</td>
                <td>
                  {can("packages.edit") && (
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
          <h3>{t("packages.edit")}</h3>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <input
            type="number"
            value={edit.price}
            onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })}
          />
          <input
            type="number"
            value={edit.minutes}
            onChange={(e) => setEdit({ ...edit, minutes: Number(e.target.value) })}
          />
          <input
            type="number"
            value={edit.balanceGrant}
            onChange={(e) => setEdit({ ...edit, balanceGrant: Number(e.target.value) })}
          />
          <button type="button" onClick={save}>
            {t("common.save")}
          </button>
        </div>
      )}
    </>
  );
}
