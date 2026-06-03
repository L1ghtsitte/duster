import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [loginName, setLogin] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(loginName, password);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  return (
    <div className="login-page">
      <div className="card login-box">
        <h2>{t("login.title")}</h2>
        <form onSubmit={onSubmit}>
          <p>
            <input
              placeholder="Логин"
              value={loginName}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
            />
          </p>
          <p>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </p>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit">{t("login.submit")}</button>
        </form>
      </div>
    </div>
  );
}
