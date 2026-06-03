import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyRequest } from "fastify";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function registerJwt(app: FastifyInstance): void {
  app.decorate(
    "authenticate",
    async (request: FastifyRequest): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch {
        throw app.httpErrors.unauthorized("Требуется авторизация");
      }
    }
  );
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: "admin" | "agent" | "station";
      playerId?: string;
      computerId?: string;
    };
    user: {
      sub: string;
      role: "admin" | "agent" | "station";
      playerId?: string;
      computerId?: string;
    };
  }
}
