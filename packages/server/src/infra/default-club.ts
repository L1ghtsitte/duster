import { prisma } from "../db.js";

let cachedClubId: string | null = null;

export async function getDefaultClubId(): Promise<string> {
  if (cachedClubId) return cachedClubId;
  const slug = process.env.DUSTER_DEFAULT_CLUB_SLUG ?? "default";
  const club = await prisma.club.findUnique({ where: { slug } });
  if (!club) throw new Error(`Club not found: ${slug}`);
  cachedClubId = club.id;
  return club.id;
}
