import type { FastifyRequest } from "fastify";
import { prisma } from "../db.js";

export interface AdminClubContext {
  adminId: string;
  clubId: string;
  isSuperAdmin: boolean;
}

export async function resolveAdminClub(request: FastifyRequest): Promise<AdminClubContext> {
  const admin = await prisma.admin.findUniqueOrThrow({
    where: { id: request.user.sub },
    select: { id: true, clubId: true, isSuperAdmin: true },
  });

  if (admin.isSuperAdmin) {
    const headerClub = request.headers["x-club-id"];
    if (typeof headerClub === "string" && headerClub) {
      return { adminId: admin.id, clubId: headerClub, isSuperAdmin: true };
    }
    const defaultClub = await prisma.club.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
    if (!defaultClub) throw new Error("No club configured");
    return { adminId: admin.id, clubId: defaultClub.id, isSuperAdmin: true };
  }

  if (!admin.clubId) throw new Error("Admin has no club");
  return { adminId: admin.id, clubId: admin.clubId, isSuperAdmin: false };
}

export function clubWhere(clubId: string): { clubId: string } {
  return { clubId };
}
