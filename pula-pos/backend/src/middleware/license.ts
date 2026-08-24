import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { forbidden, paymentRequired } from "../utils/errors";

/**
 * Enforces the yearly license: blocks the request if the business's license
 * is missing, expired, or suspended. Read-heavy/reporting GETs are allowed
 * through so an expired customer can still see their data — only actions
 * that create new business (sales, purchases, etc.) are blocked, per the
 * requirement "cannot create new sales until the license is renewed".
 */
export function requireActiveLicense(opts: { blockWrites?: boolean } = { blockWrites: true }) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) return next(forbidden());
      const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
      if (!isWrite && !opts.blockWrites) return next();

      const license = await prisma.license.findUnique({ where: { businessId: req.auth.businessId } });
      if (!license) return next(paymentRequired("No license found for this business."));

      const now = new Date();
      const expired = license.expiryDate ? license.expiryDate < now : true;
      const blocked = license.status === "SUSPENDED" || license.status === "CANCELLED" ||
        (license.status === "EXPIRED") || (license.status === "ACTIVE" && expired);

      if (blocked && isWrite) {
        return next(
          paymentRequired(
            `Your Pula POS license is ${expired ? "expired" : license.status.toLowerCase()}. ` +
              `Please renew to continue creating sales and records.`
          )
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
