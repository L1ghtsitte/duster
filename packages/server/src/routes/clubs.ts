import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";

export async function clubsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
    if (!request.adminPerms?.isSuperAdmin) {
      throw app.httpErrors.forbidden("SuperAdmin only");
    }
  });

  app.get("/", async () => {
    return prisma.club.findMany({ orderBy: { name: "asc" } });
  });

  app.post("/", async (request) => {
    const body = z
      .object({ slug: z.string().min(2), name: z.string(), timezone: z.string().optional() })
      .parse(request.body);
    return prisma.club.create({ data: body });
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({ name: z.string().optional(), active: z.boolean().optional(), timezone: z.string().optional() })
      .parse(request.body);
    return prisma.club.update({ where: { id }, data: body });
  });
}
