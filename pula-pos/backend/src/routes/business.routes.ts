import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { notFound } from "../utils/errors";

export const businessRouter = Router();
businessRouter.use(requireBusinessAuth);

/** Returns the signed-in user's own business profile (for the Settings page). */
businessRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const business = await prisma.business.findUnique({
      where: { id: req.auth!.businessId },
      select: {
        id: true,
        name: true,
        tradingName: true,
        email: true,
        phone: true,
        address: true,
        taxNumber: true,
        currency: true,
        logoUrl: true,
      },
    });
    if (!business) throw notFound();
    res.json(business);
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  tradingName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  logoUrl: z.string().max(2_000_000).optional(), // base64 data URL, client-side resized before upload
});

/**
 * Lets a business owner/admin edit their own profile from the Settings
 * page. Deliberately excludes `email` (used as the business's identifying
 * record) and `currency` (changing it after sales exist would corrupt
 * historical financial totals) — those stay admin-portal-only.
 */
businessRouter.patch(
  "/",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const business = await prisma.business.update({ where: { id: req.auth!.businessId }, data });
    res.json(business);
  })
);
