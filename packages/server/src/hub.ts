import type { WebSocket } from "@fastify/websocket";
import type { AgentCommand } from "@duster/shared";

type Conn = { ws: WebSocket; computerId?: string; role: "agent" | "admin" };

class ConnectionHub {
  private agents = new Map<string, Conn>();
  private admins = new Set<Conn>();
  private screenshots = new Map<string, { dataBase64: string; at: number }>();
  private screenWatchers = new Map<string, Set<Conn>>();

  registerAgent(computerId: string, ws: WebSocket): void {
    const existing = this.agents.get(computerId);
    existing?.ws.close();
    this.agents.set(computerId, { ws, computerId, role: "agent" });
  }

  unregister(ws: WebSocket): void {
    for (const [id, conn] of this.agents) {
      if (conn.ws === ws) this.agents.delete(id);
    }
    for (const conn of this.admins) {
      if (conn.ws === ws) this.admins.delete(conn);
    }
    for (const [, watchers] of this.screenWatchers) {
      watchers.delete({ ws } as Conn);
    }
  }

  registerAdmin(ws: WebSocket): void {
    this.admins.add({ ws, role: "admin" });
  }

  sendToAgent(computerId: string, command: AgentCommand): boolean {
    const conn = this.agents.get(computerId);
    if (!conn || conn.ws.readyState !== 1) return false;
    conn.ws.send(JSON.stringify({ type: "command", payload: command }));
    return true;
  }

  setScreenshot(computerId: string, dataBase64: string): void {
    this.screenshots.set(computerId, { dataBase64, at: Date.now() });
    const watchers = this.screenWatchers.get(computerId);
    if (watchers) {
      const msg = JSON.stringify({
        type: "screenshot",
        computerId,
        dataBase64,
        at: Date.now(),
      });
      for (const w of watchers) {
        if (w.ws.readyState === 1) w.ws.send(msg);
      }
    }
    this.broadcastAdmin({ type: "screenshot", computerId, at: Date.now() });
  }

  getScreenshot(computerId: string): { dataBase64: string; at: number } | null {
    return this.screenshots.get(computerId) ?? null;
  }

  watchScreen(computerId: string, adminWs: WebSocket): void {
    let set = this.screenWatchers.get(computerId);
    if (!set) {
      set = new Set();
      this.screenWatchers.set(computerId, set);
    }
    set.add({ ws: adminWs, role: "admin" });
    this.sendToAgent(computerId, { type: "screenshot" });
  }

  unwatchScreen(computerId: string, adminWs: WebSocket): void {
    const set = this.screenWatchers.get(computerId);
    set?.delete({ ws: adminWs } as Conn);
  }

  broadcastAdmin(message: unknown): void {
    const data = JSON.stringify(message);
    for (const conn of this.admins) {
      if (conn.ws.readyState === 1) conn.ws.send(data);
    }
  }

  broadcastStreamFrame(computerId: string, dataBase64: string): void {
    const msg = JSON.stringify({ type: "stream_frame", computerId, dataBase64, at: Date.now() });
    const watchers = this.screenWatchers.get(computerId);
    if (watchers) {
      for (const w of watchers) {
        if (w.ws.readyState === 1) w.ws.send(msg);
      }
    }
  }

  notifyComputerUpdate(payload: unknown): void {
    this.broadcastAdmin({ type: "computers_updated", payload });
  }

  isAgentOnline(computerId: string): boolean {
    const conn = this.agents.get(computerId);
    return !!conn && conn.ws.readyState === 1;
  }
}

export const hub = new ConnectionHub();
