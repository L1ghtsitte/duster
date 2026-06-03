export * from "./permissions.js";

/** Группы игроков */
export type UserGroup = "standard" | "vip" | "staff" | "guest";

export type ComputerStatus =
  | "offline"
  | "online"
  | "locked"
  | "in_use"
  | "maintenance"
  | "booting"
  | "reserved";

export type AgentCommand =
  | { type: "lock" }
  | { type: "unlock"; sessionId?: string }
  | { type: "shutdown"; force?: boolean }
  | { type: "restart"; force?: boolean }
  | { type: "logoff" }
  | { type: "message"; text: string }
  | { type: "kill_process"; pid: number }
  | { type: "screenshot" }
  | { type: "stream_start"; fps?: number }
  | { type: "stream_stop" }
  | { type: "cleanup_session" }
  | { type: "apply_usb_policy"; blockStorage: boolean; allowCharge: boolean }
  | { type: "list_processes" }
  | { type: "webrtc_stream_start"; fps?: number }
  | { type: "webrtc_stream_stop" };

export type AgentEvent =
  | { type: "heartbeat"; cpuPercent?: number; ramPercent?: number }
  | { type: "screenshot"; dataBase64: string }
  | { type: "stream_frame"; dataBase64: string }
  | { type: "webrtc"; sdp?: string; candidate?: unknown; sdpType?: string };

export const DEFAULT_SERVER_PORT = 3847;
