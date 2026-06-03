import { prisma } from "../db.js";
import { getTelegramConfig } from "./settings.js";

async function tgApi<T>(method: string, params: Record<string, string | number>): Promise<T | null> {
  const cfg = await getTelegramConfig();
  if (!cfg.botToken) return null;
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/${method}?${qs}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; result?: T };
  return json.ok ? (json.result ?? null) : null;
}

export async function syncTelegramAvatar(
  telegramUserId: number,
  playerId: string,
  username?: string
): Promise<void> {
  const photos = await tgApi<{ photos: { file_id: string }[][] }>("getUserProfilePhotos", {
    user_id: telegramUserId,
    limit: 1,
  });
  const fileId = photos?.photos?.[0]?.[0]?.file_id;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(fileId ? { telegramAvatarFileId: fileId } : {}),
      ...(username != null ? { telegramUsername: username } : {}),
    },
  });
}

export async function getAvatarUrl(fileId: string | null | undefined): Promise<string | null> {
  if (!fileId) return null;
  const cfg = await getTelegramConfig();
  if (!cfg.botToken) return null;
  const file = await tgApi<{ file_path: string }>("getFile", { file_id: fileId });
  if (!file?.file_path) return null;
  return `https://api.telegram.org/file/bot${cfg.botToken}/${file.file_path}`;
}
