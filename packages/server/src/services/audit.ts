import { prisma } from "../db.js";

export async function auditLog(params: {
  adminId?: string;
  playerId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      adminId: params.adminId,
      playerId: params.playerId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  });
}
