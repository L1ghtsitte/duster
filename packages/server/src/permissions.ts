import { ALL_PERMISSIONS, type Permission } from "@duster/shared/permissions.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./db.js";

export function parsePermissions(json: string): Permission[] {
  try {
    const arr = JSON.parse(json) as string[];
    return arr.filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission));
  } catch {
    return [];
  }
}

export async function getAdminPermissions(adminId: string): Promise<{
  isSuperAdmin: boolean;
  permissions: Permission[];
}> {
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
  return {
    isSuperAdmin: admin.isSuperAdmin,
    permissions: parsePermissions(admin.permissions),
  };
}

export function hasPermission(
  isSuperAdmin: boolean,
  permissions: Permission[],
  required: Permission
): boolean {
  if (isSuperAdmin) return true;
  return permissions.includes(required);
}

export function requirePermission(required: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await request.jwtVerify();
    if (request.user.role !== "admin") {
      return reply.forbidden("Admin only");
    }
    const { isSuperAdmin, permissions } = await getAdminPermissions(request.user.sub);
    if (!hasPermission(isSuperAdmin, permissions, required)) {
      return reply.forbidden("Permission denied");
    }
    request.adminPerms = { isSuperAdmin, permissions };
  };
}

declare module "fastify" {
  interface FastifyRequest {
    adminPerms?: { isSuperAdmin: boolean; permissions: Permission[] };
  }
}
