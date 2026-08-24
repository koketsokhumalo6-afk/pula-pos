import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth } from "../middleware/auth";

export const licenseStatusRouter = Router();
licenseStatusRouter.use(requireBusinessAuth);

/** Lets the POS frontend show a banner ("license expires in 5 days", etc). */
licenseStatusRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findUnique({
      where: { businessId: req.auth!.businessId },
      include: { plan: true },
    });
    if (!license) return res.json({ status: "NONE" });
    const daysRemaining = license.expiryDate
      ? Math.ceil((license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    res.json({
      status: license.status,
      licenseKey: license.licenseKey,
      plan: license.plan.name,
      maxUsers: license.maxUsers,
      maxTerminals: license.maxTerminals,
      expiryDate: license.expiryDate,
      daysRemaining,
    });
  })
);
