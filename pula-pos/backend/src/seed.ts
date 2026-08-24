/**
 * Seeds the platform with: subscription plans, one super admin (you, the
 * Pula POS operator), and one demo business so you can log in immediately
 * after deploying. Run once via `npm run seed`.
 */
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { generateLicenseKey } from "./utils/license";

async function main() {
  const plans = [
    { code: "STARTER" as const, name: "Starter", maxUsers: 2, maxTerminals: 1, priceYearly: 1200 },
    { code: "STANDARD" as const, name: "Standard", maxUsers: 5, maxTerminals: 3, priceYearly: 2800 },
    { code: "PRO" as const, name: "Pro", maxUsers: 15, maxTerminals: 8, priceYearly: 6000 },
    { code: "ENTERPRISE" as const, name: "Enterprise", maxUsers: 100, maxTerminals: 50, priceYearly: 15000 },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  console.log("Plans seeded.");

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || "owner@pulapos.com";
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(superAdminPassword, 10);
  await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: { name: "Pula POS Admin", email: superAdminEmail, passwordHash, role: "OWNER" },
  });
  console.log(`Super admin ready: ${superAdminEmail} / ${superAdminPassword} (CHANGE THIS PASSWORD IMMEDIATELY)`);

  const standard = await prisma.plan.findUniqueOrThrow({ where: { code: "STANDARD" } });
  const demoEmail = "demo@business.com";
  const existing = await prisma.business.findUnique({ where: { email: demoEmail } });
  if (!existing) {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);
    const ownerPasswordHash = await bcrypt.hash("Demo1234!", 10);

    const biz = await prisma.business.create({
      data: { name: "Demo Trading Store", email: demoEmail, currency: "BWP" },
    });
    await prisma.user.create({
      data: { businessId: biz.id, name: "Demo Owner", email: "owner@demo.com", passwordHash: ownerPasswordHash, role: "OWNER" },
    });
    await prisma.license.create({
      data: {
        businessId: biz.id,
        licenseKey: generateLicenseKey(now.getFullYear()),
        planId: standard.id,
        status: "ACTIVE",
        activationDate: now,
        expiryDate: expiry,
        maxUsers: standard.maxUsers,
        maxTerminals: standard.maxTerminals,
      },
    });
    console.log("Demo business ready: login owner@demo.com / Demo1234!");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
