import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { prisma } from "../db.js";
import { loadAdminContext } from "../admin-guard.js";

export async function totpRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
  });

  app.post("/setup", async (request) => {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: request.user.sub } });
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(admin.login, "Duster Admin", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    await prisma.admin.update({
      where: { id: admin.id },
      data: { totpSecret: secret, totpEnabled: false },
    });
    return { secret, qrDataUrl };
  });

  app.post("/enable", async (request) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(request.body);
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: request.user.sub } });
    if (!admin.totpSecret) throw app.httpErrors.badRequest("Run setup first");
    if (!authenticator.verify({ token: code, secret: admin.totpSecret })) {
      throw app.httpErrors.unauthorized("Invalid code");
    }
    await prisma.admin.update({ where: { id: admin.id }, data: { totpEnabled: true } });
    return { ok: true };
  });

  app.post("/verify", async (request) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(request.body);
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: request.user.sub } });
    if (!admin.totpEnabled || !admin.totpSecret) return { ok: true, skipped: true };
    const ok = authenticator.verify({ token: code, secret: admin.totpSecret });
    if (!ok) throw app.httpErrors.unauthorized("Invalid 2FA code");
    return { ok: true };
  });
}
