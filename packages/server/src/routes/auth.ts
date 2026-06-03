import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyPassword } from "../auth.js";
import { parsePermissions } from "../permissions.js";

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  clubSlug: z.string().optional(),
  totpCode: z.string().length(6).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    let clubId: string | null = null;
    if (body.clubSlug) {
      const club = await prisma.club.findUnique({ where: { slug: body.clubSlug } });
      clubId = club?.id ?? null;
    }

    const admin = await prisma.admin.findFirst({
      where: {
        login: body.login,
        OR: [{ isSuperAdmin: true }, { clubId }],
      },
    });
    if (!admin?.active) {
      return reply.unauthorized("Invalid login or password");
    }
    const ok = await verifyPassword(body.password, admin.passwordHash);
    if (!ok) return reply.unauthorized("Invalid login or password");

    if (admin.totpEnabled && admin.totpSecret) {
      if (!body.totpCode) return reply.code(428).send({ require2fa: true });
      const { authenticator } = await import("otplib");
      if (!authenticator.verify({ token: body.totpCode, secret: admin.totpSecret })) {
        return reply.unauthorized("Invalid 2FA code");
      }
    }

    const token = await reply.jwtSign(
      { sub: admin.id, role: "admin", clubId: admin.clubId },
      { expiresIn: "12h" }
    );

    return {
      token,
      admin: {
        id: admin.id,
        login: admin.login,
        displayName: admin.displayName,
        isSuperAdmin: admin.isSuperAdmin,
        clubId: admin.clubId,
        permissions: parsePermissions(admin.permissions),
      },
    };
  });

  app.get("/me", { onRequest: [app.authenticate] }, async (request) => {
    const admin = await prisma.admin.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        login: true,
        displayName: true,
        isSuperAdmin: true,
        permissions: true,
      },
    });
    if (!admin) return null;
    return {
      ...admin,
      permissions: parsePermissions(admin.permissions),
    };
  });
}
