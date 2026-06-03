import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { prisma } from "./db.js";
import { hub } from "./hub.js";
import { webrtcSignal } from "./webrtc.js";

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, (socket) => {
    const ws = socket as WebSocket;
    let role: "agent" | "admin" | null = null;
    let computerId: string | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          token?: string;
          payload?: Record<string, unknown>;
        };

        if (msg.type === "auth") {
          if (!msg.token) {
            ws.send(JSON.stringify({ type: "error", message: "token required" }));
            return;
          }
          const decoded = app.jwt.verify<{ sub: string; role: string }>(msg.token);
          role = decoded.role as "agent" | "admin";
          if (role === "agent") {
            computerId = decoded.sub;
            hub.registerAgent(computerId, ws);
            webrtcSignal.bindAgent(computerId, ws);
            await prisma.computer.update({
              where: { id: computerId },
              data: { status: "online", lastSeenAt: new Date() },
            });
            hub.notifyComputerUpdate({ computerId });
          } else if (role === "admin") {
            hub.registerAdmin(ws);
          }
          ws.send(JSON.stringify({ type: "auth_ok", role }));
          return;
        }

        if (role === "agent" && msg.type === "event" && computerId) {
          const ev = msg.payload as { type?: string; dataBase64?: string };
          if (ev?.type === "screenshot" && ev.dataBase64) {
            hub.setScreenshot(computerId, ev.dataBase64);
          } else if (ev?.type === "stream_frame" && ev.dataBase64) {
            hub.broadcastStreamFrame(computerId, ev.dataBase64);
          } else if (ev?.type === "webrtc") {
            const we = ev as { kind?: string; dataBase64?: string };
            if (we.kind === "frame" && we.dataBase64) {
              webrtcSignal.relayFromAgent(computerId, ev);
            } else {
              webrtcSignal.relayFromAgent(computerId, ev);
            }
          } else if (ev?.type === "process_list" && Array.isArray((ev as { processes?: unknown }).processes)) {
            hub.broadcastAdmin({
              type: "process_list",
              computerId,
              processes: (ev as { processes: unknown[] }).processes,
            });
          }
          return;
        }

        if (role === "admin" && msg.type === "watch_screen" && msg.payload?.computerId) {
          const cid = msg.payload.computerId as string;
          hub.watchScreen(cid, ws);
          webrtcSignal.setAdminWatch(ws, cid);
          hub.sendToAgent(cid, { type: "screenshot" });
          return;
        }

        if (role === "admin" && msg.type === "stream_watch" && msg.payload?.computerId) {
          const cid = msg.payload.computerId as string;
          const fps = typeof msg.payload.fps === "number" ? msg.payload.fps : 5;
          hub.watchScreen(cid, ws);
          webrtcSignal.setAdminWatch(ws, cid);
          hub.sendToAgent(cid, { type: "stream_start", fps });
          return;
        }

        if (role === "admin" && msg.type === "stream_stop" && msg.payload?.computerId) {
          hub.sendToAgent(msg.payload.computerId as string, { type: "stream_stop" });
          hub.sendToAgent(msg.payload.computerId as string, { type: "webrtc_stream_stop" });
          return;
        }

        if (role === "admin" && msg.type === "webrtc_watch" && msg.payload?.computerId) {
          const cid = msg.payload.computerId as string;
          const fps = typeof msg.payload.fps === "number" ? msg.payload.fps : 15;
          hub.watchScreen(cid, ws);
          webrtcSignal.setAdminWatch(ws, cid);
          hub.sendToAgent(cid, { type: "webrtc_stream_start", fps });
          return;
        }

        if (role === "admin" && msg.type === "webrtc_stop" && msg.payload?.computerId) {
          hub.sendToAgent(msg.payload.computerId as string, { type: "webrtc_stream_stop" });
          return;
        }

        if (role === "admin" && msg.type === "webrtc" && msg.payload?.computerId) {
          webrtcSignal.relayFromAdmin(ws, msg.payload.computerId as string, msg.payload);
          return;
        }

        if (role === "admin" && msg.type === "unwatch_screen" && msg.payload?.computerId) {
          hub.unwatchScreen(msg.payload.computerId as string, ws);
        }
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : "unknown",
          })
        );
      }
    });

    ws.on("close", async () => {
      hub.unregister(ws);
      webrtcSignal.unbind(ws);
      if (role === "agent" && computerId) {
        await prisma.computer
          .update({ where: { id: computerId }, data: { status: "offline" } })
          .catch(() => undefined);
        hub.notifyComputerUpdate({ computerId, status: "offline" });
      }
    });
  });
}
