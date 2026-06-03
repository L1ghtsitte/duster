import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");

export const config = {
  host: process.env.DUSTER_HOST ?? "0.0.0.0",
  port: Number(process.env.DUSTER_PORT ?? 3847),
  jwtSecret: process.env.DUSTER_JWT_SECRET ?? "duster-dev-secret",
  redisUrl: process.env.REDIS_URL ?? "",
  publicUrl: process.env.DUSTER_PUBLIC_URL ?? "",
  telegramWebhookPath: process.env.TELEGRAM_WEBHOOK_PATH ?? "/api/telegram/webhook",
  defaultAdminLogin: process.env.DUSTER_DEFAULT_ADMIN_LOGIN ?? "admin",
  defaultAdminPassword: process.env.DUSTER_DEFAULT_ADMIN_PASSWORD ?? "admin123",
  dataDir: process.env.DUSTER_DATA_DIR ?? path.join(serverRoot, "data"),
  reportsDir: process.env.DUSTER_REPORTS_DIR ?? path.join(serverRoot, "data", "reports"),
  shiftsDir: process.env.DUSTER_SHIFTS_DIR ?? path.join(serverRoot, "data", "shifts"),
  screenshotsDir:
    process.env.DUSTER_SCREENSHOTS_DIR ?? path.join(serverRoot, "data", "screenshots"),
};
