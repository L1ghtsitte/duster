import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface OfflineSessionPayload {
  sessionId: string;
  playerId: string;
  computerId: string;
  endsAt: string | null;
  isUnlimited: boolean;
}

export function signOfflineSession(payload: OfflineSessionPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyOfflineSession(token: string): OfflineSessionPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as OfflineSessionPayload;
  } catch {
    return null;
  }
}
