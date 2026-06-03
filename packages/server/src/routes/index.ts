import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { adminRoutes } from "./admin.js";
import { agentRoutes } from "./agent.js";
import { publicRoutes } from "./public.js";
import { stationRoutes } from "./station.js";
import { shiftRoutes } from "./shifts.js";
import { settingsRoutes } from "./settings.js";
import { adminsManageRoutes } from "./admins.js";
import { reservationRoutes } from "./reservations.js";
import { analyticsRoutes } from "./analytics.js";
import { extrasRoutes, agentExtrasRoutes } from "./extras.js";
import { telegramAdminRoutes } from "./telegram-admin.js";
import { featureRoutes } from "./features.js";
import { stationQrRoutes } from "./station-qr.js";
import { clubsRoutes } from "./clubs.js";
import { totpRoutes } from "./totp.js";
import { telegramWebhookRoutes } from "./telegram-webhook.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(publicRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(stationRoutes, { prefix: "/api/station" });
  await app.register(stationQrRoutes, { prefix: "/api/station" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(shiftRoutes, { prefix: "/api/admin/shifts" });
  await app.register(settingsRoutes, { prefix: "/api/admin/settings" });
  await app.register(adminsManageRoutes, { prefix: "/api/admin/admins" });
  await app.register(reservationRoutes, { prefix: "/api/admin/reservations" });
  await app.register(agentRoutes, { prefix: "/api/agent" });
  await app.register(agentExtrasRoutes, { prefix: "/api/agent" });
  await app.register(analyticsRoutes, { prefix: "/api/admin/analytics" });
  await app.register(extrasRoutes, { prefix: "/api/admin" });
  await app.register(telegramAdminRoutes, { prefix: "/api/admin/telegram" });
  await app.register(featureRoutes, { prefix: "/api/admin" });
  await app.register(clubsRoutes, { prefix: "/api/admin/clubs" });
  await app.register(totpRoutes, { prefix: "/api/admin/2fa" });
  await app.register(telegramWebhookRoutes, { prefix: "/api" });
}
