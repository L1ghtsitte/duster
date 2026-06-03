import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../auth.js";
import { hub } from "../hub.js";
import { sendWakeOnLan } from "../wol.js";
import type { AgentCommand } from "@duster/shared";
import { applyTopup, calculateTopupBonus } from "../services/topup.js";
import { getOpenShift } from "../services/shift.js";
import { startPlayerSession, endSession } from "../services/session.js";

import { loadAdminContext } from "../admin-guard.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    await loadAdminContext(app, request);
  });

  // --- Компьютеры ---
  app.get("/computers", async (request) => {
    await app.assertPerm(request, "computers.view");
    const list = await prisma.computer.findMany({
      where: { clubId: request.clubId! },
      orderBy: { number: "asc" },
    });
    return list.map((c) => ({
      ...c,
      agentOnline: hub.isAgentOnline(c.id),
    }));
  });

  app.post("/computers", async (request) => {
    const body = z
      .object({
        name: z.string(),
        number: z.number().int().positive(),
        macAddress: z.string().optional(),
        zone: z.string().optional(),
        shellMode: z.enum(["native", "web"]).optional(),
      })
      .parse(request.body);

    return prisma.computer.create({
      data: {
        clubId: request.clubId!,
        name: body.name,
        number: body.number,
        macAddress: body.macAddress,
        zone: body.zone ?? "main",
        shellMode: body.shellMode ?? "native",
      },
    });
  });

  app.patch("/computers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        macAddress: z.string().optional(),
        zone: z.string().optional(),
        status: z.string().optional(),
        wolEnabled: z.boolean().optional(),
        shellMode: z.enum(["native", "web"]).optional(),
        maintenanceNote: z.string().optional(),
      })
      .parse(request.body);

    return prisma.computer.update({ where: { id }, data: body });
  });

  app.post("/computers/:id/command", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        command: z.enum(["lock", "unlock", "shutdown", "restart", "logoff", "message"]),
        force: z.boolean().optional(),
        text: z.string().optional(),
      })
      .parse(request.body);

    const pc = await prisma.computer.findUnique({ where: { id } });
    if (!pc) return reply.notFound();

    const cmd = commandToAgent(body);
    const sent = hub.sendToAgent(id, cmd);
    if (!sent) {
      return reply.code(503).send({ error: "Агент не подключён", offline: true });
    }

    if (body.command === "lock") {
      await prisma.computer.update({ where: { id }, data: { status: "locked" } });
    }
    if (body.command === "unlock") {
      await prisma.computer.update({ where: { id }, data: { status: "online" } });
    }

    hub.notifyComputerUpdate({ computerId: id });
    return { ok: true };
  });

  app.post("/computers/:id/wake", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pc = await prisma.computer.findUnique({ where: { id } });
    if (!pc) return reply.notFound();
    if (!pc.macAddress) {
      return reply.badRequest({ error: "MAC не указан" });
    }
    if (!pc.wolEnabled) {
      return reply.badRequest({ error: "WoL отключён для этого ПК" });
    }
    await sendWakeOnLan(pc.macAddress);
    await prisma.computer.update({
      where: { id },
      data: { status: "booting" },
    });
    return { ok: true };
  });

  app.get("/computers/:id/screenshot", async (request, reply) => {
    const { id } = request.params as { id: string };
    const sent = hub.sendToAgent(id, { type: "screenshot" });
    if (!sent) return reply.code(503).send({ error: "Агент офлайн" });
    await new Promise((r) => setTimeout(r, 1500));
    const shot = hub.getScreenshot(id);
    if (!shot) return reply.code(404).send({ error: "Снимок ещё не получен" });
    return { dataBase64: shot.dataBase64, at: shot.at };
  });

  app.post("/computers/:id/screenshot/watch", async (request) => {
    const { id } = request.params as { id: string };
    hub.sendToAgent(id, { type: "screenshot" });
    return { ok: true, hint: "Подключите WS watch_screen для live" };
  });

  // --- Игроки ---
  app.get("/players", async () => {
    return prisma.player.findMany({
      where: { clubId: request.clubId! },
      orderBy: { displayName: "asc" },
    });
  });

  app.get("/players/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 50 },
        sessions: { orderBy: { startedAt: "desc" }, take: 20, include: { computer: true } },
      },
    });
    if (!player) return reply.notFound();
    return player;
  });

  app.post("/players", async (request) => {
    const body = z
      .object({
        username: z.string().min(2),
        displayName: z.string(),
        password: z.string().optional(),
        pin: z.string().optional(),
        group: z.enum(["standard", "vip", "staff", "guest"]).optional(),
        balance: z.number().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
      .parse(request.body);

    return prisma.player.create({
      data: {
        username: body.username,
        displayName: body.displayName,
        passwordHash: body.password ? await hashPassword(body.password) : null,
        pin: body.pin,
        group: body.group ?? "standard",
        balance: body.balance ?? 0,
        email: body.email,
        phone: body.phone,
      },
    });
  });

  app.patch("/players/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        displayName: z.string().optional(),
        group: z.enum(["standard", "vip", "staff", "guest"]).optional(),
        balance: z.number().optional(),
        bonusBalance: z.number().optional(),
        prepaidMinutes: z.number().int().optional(),
        unlimitedTime: z.boolean().optional(),
        customBonusPercent: z.number().min(0).max(100).nullable().optional(),
        active: z.boolean().optional(),
        password: z.string().optional(),
        pin: z.string().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        birthDate: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        tags: z.string().nullable().optional(),
        avatarColor: z.string().optional(),
      })
      .parse(request.body);

    const { password, ...rest } = body;
    return prisma.player.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
  });

  app.post("/players/:id/topup", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        amount: z.number().positive(),
        bonusPercentOverride: z.number().optional(),
        grantMinutes: z.number().int().optional(),
        skipBonus: z.boolean().optional(),
        note: z.string().optional(),
      })
      .parse(request.body);

    const shift = await getOpenShift(request.user.sub);
    return applyTopup(id, body.amount, request.user.sub, shift?.id, {
      bonusPercentOverride: body.bonusPercentOverride,
      grantMinutes: body.grantMinutes,
      skipBonus: body.skipBonus,
      note: body.note,
    });
  });

  app.post("/players/:id/grant-minutes", async (request) => {
    const { id } = request.params as { id: string };
    const { minutes } = z.object({ minutes: z.number().int() }).parse(request.body);
    return prisma.player.update({
      where: { id },
      data: { prepaidMinutes: { increment: minutes } },
    });
  });

  app.get("/players/:id/topup-preview", async (request) => {
    const { id } = request.params as { id: string };
    const { amount } = z
      .object({ amount: z.coerce.number().positive() })
      .parse(request.query);
    return calculateTopupBonus(id, amount);
  });

  // --- Товары ---
  app.get("/products", async () => prisma.product.findMany({ orderBy: { name: "asc" } }));

  app.post("/products", async (request) => {
    const body = z
      .object({
        name: z.string(),
        sku: z.string().optional(),
        category: z.string().optional(),
        price: z.number(),
        cost: z.number().optional(),
        stock: z.number().int().optional(),
        trackStock: z.boolean().optional(),
      })
      .parse(request.body);

    return prisma.product.create({ data: body });
  });

  app.patch("/products/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        sku: z.string().nullable().optional(),
        category: z.string().optional(),
        price: z.number().optional(),
        cost: z.number().optional(),
        stock: z.number().int().optional(),
        active: z.boolean().optional(),
      })
      .parse(request.body);
    return prisma.product.update({ where: { id }, data: body });
  });

  // --- Пакеты ---
  app.get("/packages", async () => prisma.package.findMany({ orderBy: { price: "asc" } }));

  app.post("/packages", async (request) => {
    const body = z
      .object({
        name: z.string(),
        description: z.string().optional(),
        price: z.number(),
        minutes: z.number().int().optional(),
        balanceGrant: z.number().optional(),
        group: z.string().optional(),
      })
      .parse(request.body);
    return prisma.package.create({ data: body });
  });

  app.patch("/packages/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        price: z.number().optional(),
        minutes: z.number().int().optional(),
        balanceGrant: z.number().optional(),
        group: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(request.body);
    return prisma.package.update({ where: { id }, data: body });
  });

  // --- POS / продажи ---
  app.post("/sales", async (request) => {
    const body = z
      .object({
        playerId: z.string().optional(),
        packageId: z.string().optional(),
        payment: z.enum(["cash", "card", "balance"]).default("cash"),
        items: z
          .array(
            z.object({
              productId: z.string(),
              qty: z.number().int().positive(),
            })
          )
          .optional(),
      })
      .parse(request.body);

    let total = 0;
    const saleItems: { productId: string; name: string; qty: number; unitPrice: number }[] = [];

    if (body.packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: body.packageId } });
      if (!pkg?.active) throw app.httpErrors.badRequest("Пакет не найден");
      total += pkg.price;
      if (body.playerId && pkg.balanceGrant > 0) {
        await prisma.player.update({
          where: { id: body.playerId },
          data: { balance: { increment: pkg.balanceGrant } },
        });
      }
    }

    if (body.items?.length) {
      for (const item of body.items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product?.active) throw app.httpErrors.badRequest(`Товар ${item.productId} недоступен`);
        if (product.trackStock && product.stock < item.qty) {
          throw app.httpErrors.badRequest(`Недостаточно «${product.name}» на складе`);
        }
        total += product.price * item.qty;
        saleItems.push({
          productId: product.id,
          name: product.name,
          qty: item.qty,
          unitPrice: product.price,
        });
        if (product.trackStock) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.qty } },
          });
        }
      }
    }

    const shift = await getOpenShift(request.user.sub);

    const sale = await prisma.sale.create({
      data: {
        adminId: request.user.sub,
        shiftId: shift?.id,
        playerId: body.playerId,
        packageId: body.packageId,
        total,
        payment: body.payment,
        items: { create: saleItems },
      },
      include: { items: true },
    });

    if (body.playerId) {
      await prisma.player.update({
        where: { id: body.playerId },
        data: { totalSpent: { increment: total } },
      });
    }

    return sale;
  });

  // --- Сессии ---
  app.get("/sessions/active", async () => {
    return prisma.session.findMany({
      where: { status: "active" },
      include: { player: true, computer: true },
    });
  });

  app.post("/sessions/start", async (request, reply) => {
    const body = z
      .object({
        playerId: z.string(),
        computerId: z.string(),
        minutes: z.number().int().positive().optional(),
        unlimited: z.boolean().optional(),
      })
      .parse(request.body);

    try {
      return await startPlayerSession(body.playerId, body.computerId, {
        minutes: body.minutes,
        forceUnlimited: body.unlimited,
      });
    } catch (e) {
      return reply.badRequest(e instanceof Error ? e.message : "Ошибка");
    }
  });

  app.post("/sessions/:id/end", async (request) => {
    const { id } = request.params as { id: string };
    return endSession(id);
  });

  app.delete("/computers/:id", async (request) => {
    await app.assertPerm(request, "computers.edit");
    const { id } = request.params as { id: string };
    await prisma.computer.delete({ where: { id } });
    return { ok: true };
  });

  app.delete("/players/:id", async (request) => {
    await app.assertPerm(request, "players.edit");
    const { id } = request.params as { id: string };
    await prisma.player.delete({ where: { id } });
    return { ok: true };
  });

  app.delete("/products/:id", async (request) => {
    await app.assertPerm(request, "products.edit");
    const { id } = request.params as { id: string };
    await prisma.product.delete({ where: { id } });
    return { ok: true };
  });

  app.delete("/packages/:id", async (request) => {
    await app.assertPerm(request, "packages.edit");
    const { id } = request.params as { id: string };
    await prisma.package.delete({ where: { id } });
    return { ok: true };
  });
}

function commandToAgent(body: {
  command: string;
  force?: boolean;
  text?: string;
}): AgentCommand {
  switch (body.command) {
    case "lock":
      return { type: "lock" };
    case "unlock":
      return { type: "unlock" };
    case "shutdown":
      return { type: "shutdown", force: body.force };
    case "restart":
      return { type: "restart", force: body.force };
    case "logoff":
      return { type: "logoff" };
    case "message":
      return { type: "message", text: body.text ?? "" };
    default:
      return { type: "lock" };
  }
}
