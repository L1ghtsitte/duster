import { prisma } from "../db.js";
import { hub } from "../hub.js";
import { signOfflineSession } from "./offline-session.js";
import { grantXp } from "./gamification.js";

export async function startPlayerSession(
  playerId: string,
  computerId: string,
  options?: { minutes?: number; forceUnlimited?: boolean }
) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!player.active) throw new Error("Игрок заблокирован");

  const existing = await prisma.session.findFirst({
    where: { computerId, status: "active" },
  });
  if (existing) throw new Error("ПК занят");

  const isUnlimited = options?.forceUnlimited ?? player.unlimitedTime;
  let minutes = options?.minutes;
  let endsAt: Date | undefined;

  if (!isUnlimited) {
    if (minutes == null && player.prepaidMinutes > 0) {
      minutes = player.prepaidMinutes;
    }
    if (minutes != null) {
      endsAt = new Date(Date.now() + minutes * 60_000);
      if (player.prepaidMinutes >= minutes) {
        await prisma.player.update({
          where: { id: playerId },
          data: { prepaidMinutes: { decrement: minutes } },
        });
      }
    }
  }

  const offlineToken = signOfflineSession({
    sessionId: "pending",
    playerId,
    computerId,
    endsAt: endsAt?.toISOString() ?? null,
    isUnlimited,
  });

  const session = await prisma.session.create({
    data: {
      playerId,
      computerId,
      minutes: isUnlimited ? null : minutes,
      endsAt: isUnlimited ? null : endsAt,
      isUnlimited,
      offlineToken,
    },
    include: { player: true, computer: true },
  });

  const finalOffline = signOfflineSession({
    sessionId: session.id,
    playerId,
    computerId,
    endsAt: session.endsAt?.toISOString() ?? null,
    isUnlimited,
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { offlineToken: finalOffline },
  });

  await prisma.player.update({
    where: { id: playerId },
    data: { visitCount: { increment: 1 }, lastVisitAt: new Date() },
  });

  await prisma.computer.update({
    where: { id: computerId },
    data: { status: "in_use" },
  });

  await grantXp(playerId, 10, "session_start");

  hub.sendToAgent(computerId, { type: "unlock", sessionId: session.id });
  hub.sendToAgent(computerId, { type: "message", text: `OFFLINE_TOKEN:${finalOffline}` });

  hub.notifyComputerUpdate({ computerId });

  return { ...session, offlineToken: finalOffline };
}

export async function endSession(sessionId: string) {
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "ended", endsAt: new Date(), offlineToken: null },
  });
  await prisma.computer.update({
    where: { id: session.computerId },
    data: { status: "locked" },
  });
  hub.sendToAgent(session.computerId, { type: "cleanup_session" });
  hub.sendToAgent(session.computerId, { type: "lock" });
  hub.notifyComputerUpdate({ computerId: session.computerId });
  return session;
}
