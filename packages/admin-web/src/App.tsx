import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import { PermGate } from "./perm";
import { LoginPage } from "./pages/Login";
import { ComputersPage } from "./pages/Computers";
import { PlayersPage } from "./pages/Players";
import { ProductsPage } from "./pages/Products";
import { PackagesPage } from "./pages/Packages";
import { PosPage } from "./pages/Pos";
import { DashboardPage } from "./pages/Dashboard";
import { ShiftsPage } from "./pages/Shifts";
import { SettingsPage } from "./pages/Settings";
import { PlayerProfilePage } from "./pages/PlayerProfile";
import { AdminsPage } from "./pages/Admins";
import { ReservationsPage } from "./pages/Reservations";
import { ClubMapPage } from "./pages/ClubMap";
import { AnalyticsPage } from "./pages/Analytics";
import { AuditPage } from "./pages/Audit";
import { AnnouncementsPage } from "./pages/Announcements";
import { TariffsPage } from "./pages/Tariffs";
import { PcProfilesPage } from "./pages/PcProfiles";
import { TelegramPage } from "./pages/Telegram";
import { AnticheatPage } from "./pages/Anticheat";
import { ReservationCalendarPage } from "./pages/ReservationCalendar";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>{t("app.title")}</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "-1rem" }}>
          {user?.displayName}
        </p>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "ru" | "en" | "zh")}
          style={{ width: "100%", marginBottom: "1rem" }}
        >
          <option value="ru">{t("lang.ru")}</option>
          <option value="en">{t("lang.en")}</option>
          <option value="zh">{t("lang.zh")}</option>
        </select>
        <nav>
          <NavLink to="/" end>
            {t("nav.dashboard")}
          </NavLink>
          <PermGate perm="computers.view">
            <NavLink to="/computers">{t("nav.computers")}</NavLink>
            <NavLink to="/club-map">{t("nav.map")}</NavLink>
          </PermGate>
          <PermGate perm="analytics.view">
            <NavLink to="/analytics">{t("nav.analytics")}</NavLink>
          </PermGate>
          <PermGate perm="reservations.view">
            <NavLink to="/reservations">{t("nav.reservations")}</NavLink>
            <NavLink to="/calendar">{t("nav.calendar")}</NavLink>
          </PermGate>
          <PermGate perm="telegram.manage">
            <NavLink to="/telegram">{t("nav.telegram")}</NavLink>
          </PermGate>
          <PermGate perm="anticheat.manage">
            <NavLink to="/anticheat">{t("nav.anticheat")}</NavLink>
          </PermGate>
          <PermGate perm="players.view">
            <NavLink to="/players">{t("nav.players")}</NavLink>
          </PermGate>
          <PermGate perm="products.view">
            <NavLink to="/products">{t("nav.products")}</NavLink>
          </PermGate>
          <PermGate perm="packages.view">
            <NavLink to="/packages">{t("nav.packages")}</NavLink>
          </PermGate>
          <PermGate perm="pos.use">
            <NavLink to="/pos">{t("nav.pos")}</NavLink>
          </PermGate>
          <PermGate perm="shifts.view">
            <NavLink to="/shifts">{t("nav.shifts")}</NavLink>
          </PermGate>
          <PermGate perm="settings.bonus">
            <NavLink to="/settings">{t("nav.bonus")}</NavLink>
          </PermGate>
          <PermGate perm="settings.tariffs">
            <NavLink to="/tariffs">{t("nav.tariffs")}</NavLink>
          </PermGate>
          <PermGate perm="computers.profiles">
            <NavLink to="/pc-profiles">{t("nav.profiles")}</NavLink>
          </PermGate>
          <PermGate perm="audit.view">
            <NavLink to="/audit">{t("nav.audit")}</NavLink>
          </PermGate>
          <PermGate perm="announcements.send">
            <NavLink to="/announcements">{t("nav.news")}</NavLink>
          </PermGate>
          <PermGate perm="admins.view">
            <NavLink to="/admins">{t("nav.admins")}</NavLink>
          </PermGate>
        </nav>
        <button type="button" className="secondary" style={{ marginTop: "2rem" }} onClick={logout}>
          {t("nav.logout")}
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function App() {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  if (loading) return <p style={{ padding: "2rem" }}>{t("common.loading")}</p>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/computers" element={<ComputersPage />} />
        <Route path="/club-map" element={<ClubMapPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/tariffs" element={<TariffsPage />} />
        <Route path="/pc-profiles" element={<PcProfilesPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/calendar" element={<ReservationCalendarPage />} />
        <Route path="/telegram" element={<TelegramPage />} />
        <Route path="/anticheat" element={<AnticheatPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:id" element={<PlayerProfilePage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/admins" element={<AdminsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
