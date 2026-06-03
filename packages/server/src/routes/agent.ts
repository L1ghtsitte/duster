import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hub } from "../hub.js";

const heartbeatSchema = z.object({
  ipAddress: z.string().optional(),
  agentVersion: z.string().optional(),
  cpuPercent: z.number().optional(),
  ramPercent: z.number().optional(),
});

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  /** Регистрация агента: обмен agentToken на JWT */
  app.post("/register", async (request, reply) => {
    const body = z
      .object({ agentToken: z.string(), hostname: z.string().optional() })
      .parse(request.body);

    const pc = await prisma.computer.findUnique({
      where: { agentToken: body.agentToken },
    });
    if (!pc) return reply.unauthorized("Неизвестный токен агента");

    const token = await reply.jwtSign(
      { sub: pc.id, role: "agent" },
      { expiresIn: "7d" }
    );

    return {
      token,
      computer: {
        id: pc.id,
        name: pc.name,
        number: pc.number,
        shellMode: pc.shellMode,
      },
    };
  });

  app.post(
    "/heartbeat",
    {
      onRequest: [
        async (req) => {
          await req.jwtVerify();
          if (req.user.role !== "agent") throw req.server.httpErrors.forbidden();
        },
      ],
    },
    async (request) => {
      const body = heartbeatSchema.parse(request.body);
      const computerId = request.user.sub;

      const current = await prisma.computer.findUnique({ where: { id: computerId } });
      const hasSession = await prisma.session.findFirst({
        where: { computerId, status: "active" },
      });
      let status = "online";
      if (hasSession) status = "in_use";
      else if (current?.status === "locked" || current?.status === "maintenance") {
        status = current.status;
      }

      const pc = await prisma.computer.update({
        where: { id: computerId },
        data: {
          lastSeenAt: new Date(),
          ipAddress: body.ipAddress,
          agentVersion: body.agentVersion,
          status,
        },
      });

      hub.notifyComputerUpdate({ computerId, status: pc.status });
      return { ok: true, status: pc.status };
    }
  );

  app.post(
    "/screenshot",
    {
      onRequest: [
        async (req) => {
          await req.jwtVerify();
          if (req.user.role !== "agent") throw req.server.httpErrors.forbidden();
        },
      ],
    },
    async (request) => {
      const body = z.object({ dataBase64: z.string().min(100) }).parse(request.body);
      hub.setScreenshot(request.user.sub, body.dataBase64);
      return { ok: true };
    }
  );
}
