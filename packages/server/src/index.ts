import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerJwt } from "./auth.js";
import { registerAdminGuard } from "./admin-guard.js";
import { registerRoutes } from "./routes/index.js";
import { registerWebSocket } from "./ws.js";
import { ensureDataDirs } from "./services/shift.js";

await ensureDataDirs();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.jwtSecret });
registerJwt(app);
registerAdminGuard(app);
await app.register(websocket);

const { rateLimit } = await import("./infra/redis.js");
app.addHook("onRequest", async (request, reply) => {
  if (!request.url.startsWith("/api/")) return;
  const ok = await rateLimit(`rl:${request.ip}`, 300, 60);
  if (!ok) return reply.code(429).send({ error: "Too many requests" });
});

await registerRoutes(app);
await registerWebSocket(app);

try {
  await app.listen({ host: config.host, port: config.port });
  console.log(`Duster Server: http://${config.host}:${config.port}`);
  const { setJwtSigner } = await import("./telegram/login-approval.js");
  setJwtSigner((payload) => app.jwt.sign(payload, { expiresIn: "24h" }));
  const { startTelegramBot } = await import("./telegram/bot.js");
  startTelegramBot().catch((e) => console.error("Telegram bot failed", e));

  const { runNotificationSweep } = await import("./services/notifications.js");
  setInterval(() => runNotificationSweep().catch(console.error), 60_000);

} catch (err) {
  app.log.error(err);
  process.exit(1);
}
