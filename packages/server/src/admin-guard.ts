import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Permission } from "@duster/shared/permissions.js";
import { getAdminPermissions, hasPermission } from "./permissions.js";
import { resolveAdminClub } from "./infra/tenant.js";
import { createTenantIsolationMiddleware } from "./infra/tenant-isolation.js";

export function registerAdminGuard(app: FastifyInstance): void {
  app.decorate("assertPerm", async (request: FastifyRequest, perm: Permission) => {
    if (!request.adminPerms) {
      const p = await getAdminPermissions(request.user.sub);
      request.adminPerms = p;
    }
    if (!hasPermission(request.adminPerms.isSuperAdmin, request.adminPerms.permissions, perm)) {
      throw app.httpErrors.forbidden("Permission denied");
    }
  });

  // Register strict tenant isolation middleware
  app.addHook("preHandler", createTenantIsolationMiddleware(app));
}

declare module "fastify" {
  interface FastifyInstance {
    assertPerm: (request: FastifyRequest, perm: Permission) => Promise<void>;
  }
}

export async function loadAdminContext(
  app: FastifyInstance,
  request: FastifyRequest
): Promise<void> {
  await request.jwtVerify();
  if (request.user.role !== "admin") throw app.httpErrors.forbidden();
  request.adminPerms = await getAdminPermissions(request.user.sub);
  const ctx = await resolveAdminClub(request);
  request.clubId = ctx.clubId;
  request.isNetworkSuperAdmin = ctx.isSuperAdmin;
}

declare module "fastify" {
  interface FastifyRequest {
    clubId?: string;
    isNetworkSuperAdmin?: boolean;
    adminPerms?: Awaited<ReturnType<typeof getAdminPermissions>>;
  }
}
