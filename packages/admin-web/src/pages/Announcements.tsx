import { FormEvent, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n";

export function AnnouncementsPage() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState("");

  async function send(e: FormEvent) {
    e.preventDefault();
    await api("/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });
    setSent("OK");
    setTitle("");
    setBody("");
  }

  return (
    <>
      <h2>Announcements</h2>
      <p style={{ color: "var(--muted)" }}>Push to all stations via agent message (poll on shell)</p>
      <div className="card">
        <form onSubmit={send}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            style={{ width: "100%", background: "var(--bg)", color: "var(--text)" }}
            required
          />
          <button type="submit">Send to all PCs</button>
        </form>
        {sent && <p style={{ color: "var(--ok)" }}>{sent}</p>}
      </div>
    </>
  );
}
