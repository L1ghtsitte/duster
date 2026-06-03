import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../db.js";

/**
 * Enhanced multi-tenant isolation middleware
 * Ensures all admin operations are scoped to their assigned club
 */

export interface TenantContext {
  adminId: string;
  clubId: string;
  isSuperAdmin: boolean;
  tenantLevel: "network" | "club";
}

/**
 * Validate that a resource belongs to the requesting admin's club
 */
export async function validateTenantAccess(
  adminClubId: string,
  resourceClubId: string | undefined,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (!resourceClubId) return false;
  if (isSuperAdmin) return true; // SuperAdmin can access any club
  return adminClubId === resourceClubId;
}

/**
 * Strict tenant validation middleware - adds automatic scope enforcement
 */
export function createTenantIsolationMiddleware(app: FastifyInstance) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.clubId) {
      throw app.httpErrors.unauthorized("Tenant context not resolved");
    }

    // Validate clubId format (UUID v4)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.clubId)) {
      throw app.httpErrors.badRequest("Invalid club ID format");
    }

    // Verify club exists and is active
    const club = await prisma.club.findFirst({
      where: {
        id: request.clubId,
        active: true,
      },
      select: { id: true },
    });

    if (!club) {
      throw app.httpErrors.forbidden("Club not accessible");
    }
  };
}

/**
 * Helper to build tenant-scoped where clauses
 */
export function tenantWhere(clubId: string, conditions: Record<string, any> = {}) {
  return {
    ...conditions,
    clubId,
  };
}

/**
 * Safe batch operations with tenant validation
 */
export async function validateBatchTenantAccess(
  adminClubId: string,
  resourceIds: string[],
  resourceType: "computer" | "admin" | "player",
  isSuperAdmin: boolean
): Promise<boolean> {
  if (resourceIds.length === 0) return true;

  let validCount = 0;

  switch (resourceType) {
    case "computer":
      validCount = await prisma.computer.count({
        where: {
          id: { in: resourceIds },
          clubId: isSuperAdmin ? undefined : adminClubId,
        },
      });
      break;
    case "admin":
      validCount = await prisma.admin.count({
        where: {
          id: { in: resourceIds },
          clubId: isSuperAdmin ? undefined : adminClubId,
        },
      });
      break;
    case "player":
      validCount = await prisma.player.count({
        where: {
          id: { in: resourceIds },
          clubId: isSuperAdmin ? undefined : adminClubId,
        },
      });
      break;
  }

  return validCount === resourceIds.length;
}

/**
 * Audit log for sensitive cross-tenant operations
 */
export async function auditTenantAccess(
  adminId: string,
  action: string,
  targetClubId: string,
  requestClubId: string,
  success: boolean
): Promise<void> {
  if (targetClubId !== requestClubId && success) {
    // Log cross-tenant access
    console.warn(`[AUDIT] Admin ${adminId} accessed different club: ${targetClubId} (request: ${requestClubId})`);
  }
}
