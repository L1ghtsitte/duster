import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.DUSTER_DEFAULT_ADMIN_LOGIN ?? "admin";
  const password = process.env.DUSTER_DEFAULT_ADMIN_PASSWORD ?? "admin123";

  const club = await prisma.club.upsert({
    where: { slug: "default" },
    update: { name: "Duster Club" },
    create: { slug: "default", name: "Duster Club", timezone: "Europe/Moscow" },
  });

  const superExisting = await prisma.admin.findFirst({ where: { login, isSuperAdmin: true } });
  if (superExisting) {
    await prisma.admin.update({
      where: { id: superExisting.id },
      data: { isSuperAdmin: true, permissions: "[]" },
    });
  } else {
    await prisma.admin.create({
      data: {
        clubId: null,
        login,
        passwordHash: await bcrypt.hash(password, 10),
        displayName: "Сеть (SuperAdmin)",
        isSuperAdmin: true,
        permissions: "[]",
      },
    });
  }

  const clubAdmin = await prisma.admin.findFirst({
    where: { clubId: club.id, login: "clubadmin" },
  });
  if (!clubAdmin) {
    await prisma.admin.create({
      data: {
        clubId: club.id,
        login: "clubadmin",
        passwordHash: await bcrypt.hash("clubadmin123", 10),
        displayName: "Админ клуба",
        isSuperAdmin: false,
        permissions: "[]",
      },
    });
  }

  const profile = await prisma.pcProfile.upsert({
    where: { id: "default-profile" },
    update: { clubId: club.id },
    create: {
      id: "default-profile",
      clubId: club.id,
      name: "Стандарт",
      blockUsbStorage: true,
      allowUsbCharge: true,
      cleanupOnLock: true,
    },
  });

  for (let n = 1; n <= 10; n++) {
    const col = (n - 1) % 5;
    const row = Math.floor((n - 1) / 5);
    await prisma.computer.upsert({
      where: { clubId_number: { clubId: club.id, number: n } },
      update: { mapX: 10 + col * 18, mapY: 15 + row * 40, profileId: profile.id },
      create: {
        clubId: club.id,
        name: `PC-${n}`,
        number: n,
        zone: n <= 3 ? "vip" : n <= 6 ? "main" : "standard",
        shellMode: n % 2 === 0 ? "web" : "native",
        mapX: 10 + col * 18,
        mapY: 15 + row * 40,
        profileId: profile.id,
      },
    });
  }

  const settingDefaults: [string, string][] = [
    ["default_hourly_rate", "100"],
    ["telegram_rub_per_star", "1.65"],
    ["telegram_enabled", "false"],
    ["telegram_login_confirm", "true"],
    ["telegram_referral_bonus_rub", "100"],
    ["telegram_referral_bonus_percent", "5"],
    ["telegram_loyalty_per_100rub", "10"],
    ["telegram_group_chat_id", ""],
    ["telegram_use_webhook", "false"],
  ];
  for (const [key, value] of settingDefaults) {
    await prisma.setting.upsert({
      where: { clubId_key: { clubId: club.id, key } },
      update: { value },
      create: { clubId: club.id, key, value },
    });
  }

  const blocked = ["cheatengine", "artmoney", "wemod", "trainer", "processhacker"];
  for (const namePattern of blocked) {
    const exists = await prisma.blockedProcess.findFirst({
      where: { clubId: club.id, namePattern },
    });
    if (!exists) {
      await prisma.blockedProcess.create({
        data: { clubId: club.id, namePattern, action: "kill", screenshot: true, active: true },
      });
    }
  }

  await prisma.player.upsert({
    where: { clubId_username: { clubId: club.id, username: "demo" } },
    update: {},
    create: {
      clubId: club.id,
      username: "demo",
      displayName: "Демо игрок",
      group: "standard",
      balance: 500,
      prepaidMinutes: 60,
      passwordHash: await bcrypt.hash("1234", 10),
      pin: "1234",
      email: "demo@club.local",
      phone: "+79000000000",
      referralCode: "DEMO2026",
    },
  });

  const tiers = [
    { minAmount: 500, bonusPercent: 5, label: "от 500₽ +5%", sortOrder: 1 },
    { minAmount: 1000, bonusPercent: 10, label: "от 1000₽ +10%", sortOrder: 2 },
    { minAmount: 3000, bonusPercent: 15, label: "от 3000₽ +15%", sortOrder: 3 },
  ];
  for (const t of tiers) {
    const exists = await prisma.topupBonusTier.findFirst({
      where: { clubId: club.id, minAmount: t.minAmount },
    });
    if (!exists) await prisma.topupBonusTier.create({ data: { clubId: club.id, ...t } });
  }

  const achievements = [
    { code: "loyal_5", name: "Постоянный клиент", description: "5 визитов", iconKey: "badge-loyal" },
    { code: "night_owl", name: "Ночной волк", description: "Игра после 00:00", iconKey: "badge-night" },
    { code: "whale", name: "Кит", description: "Пополнено 5000₽", iconKey: "badge-whale" },
  ];
  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { clubId_code: { clubId: club.id, code: a.code } },
      update: {},
      create: { clubId: club.id, ...a, xpReward: 100 },
    });
  }

  console.log("Seed OK. SuperAdmin:", login, "/", password, "| Club:", club.slug);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
