import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ALL_PERMISSIONS } from "@duster/shared/permissions.js";
import { prisma } from "../db.js";
import { hashPassword } from "../auth.js";
import { parsePermissions } from "../permissions.js";
import { loadAdminContext } from "../admin-guard.js";

export async function adminsManageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    await app.assertPerm(request, "admins.view");
  });

  app.get("/", async () => {
    const list = await prisma.admin.findMany({
      select: {
        id: true,
        login: true,
        displayName: true,
        isSuperAdmin: true,
        permissions: true,
        active: true,
        createdAt: true,
      },
      orderBy: { login: "asc" },
    });
    return list.map((a) => ({
      ...a,
      permissions: parsePermissions(a.permissions),
    }));
  });

  app.get("/permissions", async () => ({ all: ALL_PERMISSIONS }));

  app.post("/", async (request, reply) => {
    await app.assertPerm(request, "admins.edit");
    const body = z
      .object({
        login: z.string().min(2),
        password: z.string().min(6),
        displayName: z.string(),
        isSuperAdmin: z.boolean().optional(),
        permissions: z.array(z.string()).optional(),
      })
      .parse(request.body);

    const exists = await prisma.admin.findUnique({ where: { login: body.login } });
    if (exists) return reply.conflict("Login taken");

    return prisma.admin.create({
      data: {
        login: body.login,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
        isSuperAdmin: body.isSuperAdmin ?? false,
        permissions: JSON.stringify(body.permissions ?? []),
      },
      select: { id: true, login: true, displayName: true, isSuperAdmin: true, permissions: true },
    });
  });

  app.patch("/:id", async (request, reply) => {
    await app.assertPerm(request, "admins.edit");
    const { id } = request.params as { id: string };
    const body = z
      .object({
        displayName: z.string().optional(),
        password: z.string().min(6).optional(),
        isSuperAdmin: z.boolean().optional(),
        permissions: z.array(z.string()).optional(),
        active: z.boolean().optional(),
      })
      .parse(request.body);

    if (id === request.user.sub && body.active === false) {
      return reply.badRequest("Cannot deactivate yourself");
    }

    return prisma.admin.update({
      where: { id },
      data: {
        displayName: body.displayName,
        isSuperAdmin: body.isSuperAdmin,
        active: body.active,
        ...(body.permissions ? { permissions: JSON.stringify(body.permissions) } : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
      select: { id: true, login: true, displayName: true, isSuperAdmin: true, permissions: true, active: true },
    });
  });

  app.delete("/:id", async (request, reply) => {
    await app.assertPerm(request, "admins.edit");
    const { id } = request.params as { id: string };
    if (id === request.user.sub) return reply.badRequest("Cannot delete yourself");
    await prisma.admin.delete({ where: { id } });
    return { ok: true };
  });
}
