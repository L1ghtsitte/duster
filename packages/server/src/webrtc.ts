import type { WebSocket } from "@fastify/websocket";

type Peer = { ws: WebSocket; computerId?: string; adminWatching?: string };

/** Релей SDP/ICE между админом и агентом */
class WebRtcSignaling {
  private agents = new Map<string, Peer>();
  private admins = new Map<WebSocket, Peer>();

  bindAgent(computerId: string, ws: WebSocket): void {
    this.agents.set(computerId, { ws, computerId });
  }

  unbind(ws: WebSocket): void {
    for (const [id, p] of this.agents) {
      if (p.ws === ws) this.agents.delete(id);
    }
    this.admins.delete(ws);
  }

  relayFromAgent(computerId: string, payload: unknown): void {
    const msg = JSON.stringify({ type: "webrtc", computerId, payload });
    for (const [, admin] of this.admins) {
      if (admin.adminWatching === computerId && admin.ws.readyState === 1) {
        admin.ws.send(msg);
      }
    }
  }

  relayFromAdmin(adminWs: WebSocket, computerId: string, payload: unknown): void {
    const agent = this.agents.get(computerId);
    if (agent?.ws.readyState === 1) {
      agent.ws.send(JSON.stringify({ type: "webrtc", payload }));
    }
  }

  setAdminWatch(adminWs: WebSocket, computerId: string): void {
    this.admins.set(adminWs, { ws: adminWs, adminWatching: computerId });
  }
}

export const webrtcSignal = new WebRtcSignaling();
