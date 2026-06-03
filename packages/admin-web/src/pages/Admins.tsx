import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { PermGate } from "../perm";

interface AdminRow {
  id: string;
  login: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
  active: boolean;
}

export function AdminsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [list, setList] = useState<AdminRow[]>([]);
  const [allPerms, setAllPerms] = useState<string[]>([]);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editSuper, setEditSuper] = useState(false);

  async function load() {
    const [a, p] = await Promise.all([
      api<AdminRow[]>("/admin/admins"),
      api<{ all: string[] }>("/admin/admins/permissions"),
    ]);
    setList(a);
    setAllPerms(p.all);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    await api("/admin/admins", {
      method: "POST",
      body: JSON.stringify({ login, password, displayName, isSuperAdmin: false, permissions: [] }),
    });
    setLogin("");
    setPassword("");
    load();
  }

  function startEdit(a: AdminRow) {
    setEditId(a.id);
    setEditPerms([...a.permissions]);
    setEditSuper(a.isSuperAdmin);
    setDisplayName(a.displayName);
  }

  async function saveEdit() {
    if (!editId) return;
    await api(`/admin/admins/${editId}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName,
        isSuperAdmin: editSuper,
        permissions: editPerms,
      }),
    });
    setEditId(null);
    load();
  }

  function togglePerm(p: string) {
    setEditPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <>
      <h2>{t("admins.title")}</h2>
      <PermGate perm="admins.edit">
        <div className="card">
          <form onSubmit={add}>
            <input placeholder="login" value={login} onChange={(e) => setLogin(e.target.value)} required />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              placeholder={t("players.add")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <button type="submit">{t("admins.add")}</button>
          </form>
        </div>
      </PermGate>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Login</th>
              <th>Name</th>
              <th>{t("admins.super")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td>{a.login}</td>
                <td>{a.displayName}</td>
                <td>{a.isSuperAdmin ? t("common.yes") : a.permissions.length}</td>
                <td>
                  {user?.isSuperAdmin && a.id !== user.id && (
                    <button type="button" className="secondary" onClick={() => startEdit(a)}>
                      {t("common.edit")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editId && user?.isSuperAdmin && (
        <div className="card">
          <h3>{t("admins.permissions")}</h3>
          <label>
            <input type="checkbox" checked={editSuper} onChange={(e) => setEditSuper(e.target.checked)} />{" "}
            {t("admins.super")}
          </label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: "100%" }} />
          <div style={{ maxHeight: 200, overflow: "auto", marginTop: 8 }}>
            {allPerms.map((p) => (
              <label key={p} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  disabled={editSuper}
                  checked={editSuper || editPerms.includes(p)}
                  onChange={() => togglePerm(p)}
                />{" "}
                {p}
              </label>
            ))}
          </div>
          <button type="button" onClick={saveEdit}>
            {t("common.save")}
          </button>
          <button type="button" className="secondary" onClick={() => setEditId(null)}>
            {t("common.cancel")}
          </button>
        </div>
      )}
    </>
  );
}
