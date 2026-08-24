import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireSuperAdminAuth } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../utils/errors";
import { generateLicenseKey } from "../utils/license";

export const adminRouter = Router();
adminRouter.use(requireSuperAdminAuth);

/* -------------------------------- Plans --------------------------------- */

adminRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ orderBy: { priceYearly: "asc" } });
    res.json(plans);
  })
);

const planSchema = z.object({
  code: z.enum(["STARTER", "STANDARD", "PRO", "ENTERPRISE"]),
  name: z.string().min(1),
  maxUsers: z.number().int().positive(),
  maxTerminals: z.number().int().positive(),
  priceYearly: z.number().nonnegative(),
  currency: z.string().default("BWP"),
  isActive: z.boolean().optional(),
});

adminRouter.post(
  "/plans",
  asyncHandler(async (req, res) => {
    const data = planSchema.parse(req.body);
    const plan = await prisma.plan.create({ data });
    res.status(201).json(plan);
  })
);

adminRouter.patch(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    const data = planSchema.partial().parse(req.body);
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
    res.json(plan);
  })
);

/* ------------------------------ Businesses -------------------------------- */

adminRouter.get(
  "/businesses",
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || undefined;
    const businesses = await prisma.business.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : undefined,
      include: { license: { include: { plan: true } }, _count: { select: { users: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(businesses);
  })
);

adminRouter.get(
  "/businesses/:id",
  asyncHandler(async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        license: { include: { plan: true, history: { orderBy: { createdAt: "desc" } } } },
        users: true,
        terminals: true,
      },
    });
    if (!business) throw notFound("Business not found");
    res.json(business);
  })
);

const createBusinessSchema = z.object({
  name: z.string().min(1),
  tradingName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().default("BWP"),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  planId: z.string(),
  activateNow: z.boolean().default(true),
});

/**
 * Creates a business (tenant), its first OWNER user, and an initial license
 * — everything the customer needs to log in and start using the POS
 * immediately, without installing anything.
 */
adminRouter.post(
  "/businesses",
  asyncHandler(async (req, res) => {
    const data = createBusinessSchema.parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
    if (!plan) throw badRequest("Unknown plan");

    const existing = await prisma.business.findUnique({ where: { email: data.email } });
    if (existing) throw conflict("A business with this email already exists");

    const passwordHash = await bcrypt.hash(data.ownerPassword, 10);
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);

    const business = await prisma.$transaction(async (tx) => {
      const biz = await tx.business.create({
        data: {
          name: data.name,
          tradingName: data.tradingName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          currency: data.currency,
        },
      });

      await tx.user.create({
        data: {
          businessId: biz.id,
          name: data.ownerName,
          email: data.ownerEmail,
          passwordHash,
          role: "OWNER",
        },
      });

      const license = await tx.license.create({
        data: {
          businessId: biz.id,
          licenseKey: generateLicenseKey(now.getFullYear()),
          planId: plan.id,
          status: data.activateNow ? "ACTIVE" : "PENDING",
          activationDate: data.activateNow ? now : null,
          expiryDate: data.activateNow ? expiry : null,
          maxUsers: plan.maxUsers,
          maxTerminals: plan.maxTerminals,
        },
      });

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          type: "CREATED",
          detail: `Business created on ${plan.name} plan`,
          actor: req.superAdmin?.sub,
        },
      });

      return biz;
    });

    res.status(201).json({ businessId: business.id });
  })
);

const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  tradingName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
});

adminRouter.patch(
  "/businesses/:id",
  asyncHandler(async (req, res) => {
    const data = updateBusinessSchema.parse(req.body);
    const business = await prisma.business.update({ where: { id: req.params.id }, data });
    res.json(business);
  })
);

/* -------------------------------- Licenses -------------------------------- */

adminRouter.get(
  "/licenses",
  asyncHandler(async (_req, res) => {
    const licenses = await prisma.license.findMany({
      include: { business: true, plan: true },
      orderBy: { expiryDate: "asc" },
    });
    res.json(licenses);
  })
);

async function logLicenseEvent(licenseId: string, type: any, detail: string, actor?: string) {
  await prisma.licenseEvent.create({ data: { licenseId, type, detail, actor } });
}

adminRouter.post(
  "/licenses/:id/activate",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);
    const license = await prisma.license.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", activationDate: now, expiryDate: expiry },
    });
    await logLicenseEvent(license.id, "ACTIVATED", "License activated for 12 months", req.superAdmin?.sub);
    res.json(license);
  })
);

const renewSchema = z.object({ months: z.number().int().positive().default(12) });

adminRouter.post(
  "/licenses/:id/renew",
  asyncHandler(async (req, res) => {
    const { months } = renewSchema.parse(req.body ?? {});
    const existing = await prisma.license.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("License not found");

    // Renew from the later of "now" or the current expiry, so early renewals
    // stack on top of remaining time instead of losing it.
    const base = existing.expiryDate && existing.expiryDate > new Date() ? existing.expiryDate : new Date();
    const newExpiry = new Date(base);
    newExpiry.setMonth(newExpiry.getMonth() + months);

    const license = await prisma.license.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", expiryDate: newExpiry },
    });
    await logLicenseEvent(license.id, "RENEWED", `Renewed ${months} month(s) to ${newExpiry.toISOString()}`, req.superAdmin?.sub);
    res.json(license);
  })
);

adminRouter.post(
  "/licenses/:id/suspend",
  asyncHandler(async (req, res) => {
    const license = await prisma.license.update({ where: { id: req.params.id }, data: { status: "SUSPENDED" } });
    await logLicenseEvent(license.id, "SUSPENDED", req.body?.reason || "Suspended by admin", req.superAdmin?.sub);
    res.json(license);
  })
);

adminRouter.post(
  "/licenses/:id/reinstate",
  asyncHandler(async (req, res) => {
    const license = await prisma.license.update({ where: { id: req.params.id }, data: { status: "ACTIVE" } });
    await logLicenseEvent(license.id, "REINSTATED", "Reinstated by admin", req.superAdmin?.sub);
    res.json(license);
  })
);

const extendSchema = z.object({ days: z.number().int().positive() });

adminRouter.post(
  "/licenses/:id/extend",
  asyncHandler(async (req, res) => {
    const { days } = extendSchema.parse(req.body);
    const existing = await prisma.license.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("License not found");
    const base = existing.expiryDate ?? new Date();
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + days);
    const license = await prisma.license.update({ where: { id: req.params.id }, data: { expiryDate: newExpiry } });
    await logLicenseEvent(license.id, "EXTENDED", `Extended by ${days} day(s) to ${newExpiry.toISOString()}`, req.superAdmin?.sub);
    res.json(license);
  })
);

const limitsSchema = z.object({
  maxUsers: z.number().int().positive().optional(),
  maxTerminals: z.number().int().positive().optional(),
  planId: z.string().optional(),
});

adminRouter.patch(
  "/licenses/:id/limits",
  asyncHandler(async (req, res) => {
    const data = limitsSchema.parse(req.body);
    const license = await prisma.license.update({ where: { id: req.params.id }, data });
    await logLicenseEvent(license.id, "PLAN_CHANGED", "Limits/plan updated", req.superAdmin?.sub);
    res.json(license);
  })
);

adminRouter.post(
  "/licenses/:id/cancel",
  asyncHandler(async (req, res) => {
    const license = await prisma.license.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });
    await logLicenseEvent(license.id, "CANCELLED", req.body?.reason || "Cancelled by admin", req.superAdmin?.sub);
    res.json(license);
  })
);

/* ----------------------------- Dashboard stats ----------------------------- */

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [totalBusinesses, activeLicenses, expiringSoon, expired] = await Promise.all([
      prisma.business.count(),
      prisma.license.count({ where: { status: "ACTIVE" } }),
      prisma.license.count({
        where: {
          status: "ACTIVE",
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.license.count({ where: { OR: [{ status: "EXPIRED" }, { expiryDate: { lt: new Date() } }] } }),
    ]);
    res.json({ totalBusinesses, activeLicenses, expiringSoon, expired });
  })
);
