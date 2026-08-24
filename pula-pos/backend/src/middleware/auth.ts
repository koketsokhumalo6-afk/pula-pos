import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized, forbidden } from "../utils/errors";

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
