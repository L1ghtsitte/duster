import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Row {
  id: string;
  action: string;
  entity: string | null;
  details: string | null;
  createdAt: string;
  admin: { displayName: string } | null;
}

export function AuditPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>("/admin/audit?limit=200").then(setRows);
  }, []);

  return (
    <>
      <h2>Audit log</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.admin?.displayName ?? "-"}</td>
                <td>{r.action}</td>
                <td style={{ fontSize: "0.8rem" }}>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
