import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized, forbidden } from "../utils/errors";
import { prisma } from "../lib/prisma";
import { resolvePermissions, type PermissionSection } from "../lib/permissions";
import { asyncHandler } from "../utils/asyncHandler";

export interface BusinessAuthPayload {
  sub: string; // user id
  businessId: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "CASHIER";
}

export interface SuperAdminAuthPayload {
  sub: string;
  role: "OWNER" | "SUPPORT";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: BusinessAuthPayload;
      superAdmin?: SuperAdminAuthPayload;
    }
  }
}

/** Verifies a business-user access token and attaches req.auth. */
export function requireBusinessAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized("Missing access token"));
  try {
    const payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as BusinessAuthPayload;
    req.auth = payload;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

/** Restricts a route to specific business roles. */
export function requireRole(...roles: BusinessAuthPayload["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden("Insufficient permissions"));
    next();
  };
}

/**
 * Looks up whether the signed-in user's role currently has `section`
 * enabled in this business's saved permission matrix (see lib/permissions.ts).
 * Owners always pass — they're never restricted. Exported separately from
 * requirePermission so a route that only needs the gate conditionally
 * (e.g. POST /sales, which is a laybuy only when isLaybuy is set) can call
 * it inline instead of applying it to the whole route.
 */
export async function hasPermission(req: Request, section: PermissionSection): Promise<boolean> {
  if (!req.auth) return false;
  if (req.auth.role === "OWNER") return true;
  const business = await prisma.business.findUnique({
    where: { id: req.auth.businessId },
    select: { permissions: true },
  });
  const resolved = resolvePermissions(business?.permissions);
  const roleMap = resolved[req.auth.role as Exclude<BusinessAuthPayload["role"], "OWNER">];
  return roleMap ? roleMap[section] !== false : true;
}

/** Restricts a route to roles whose per-business permission for `section`
 * is enabled — the configurable counterpart to requireRole's fixed list. */
export function requirePermission(section: PermissionSection) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    const allowed = await hasPermission(req, section);
    if (!allowed) return next(forbidden("You don't have permission to do this."));
    next();
  });
}

/** Verifies a super-admin (master admin portal) access token. */
export function requireSuperAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized("Missing access token"));
  try {
    const payload = jwt.verify(header.slice(7), env.superAdminJwtSecret) as SuperAdminAuthPayload;
    req.superAdmin = payload;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}
