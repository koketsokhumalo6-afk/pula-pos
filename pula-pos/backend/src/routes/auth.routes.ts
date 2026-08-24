import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, unauthorized } from "../utils/errors";
import { requireBusinessAuth } from "../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Business-user login. Every business is fully isolated: the email is
 * looked up scoped to a business context via a unique (businessId, email)
 * pair, but since login only has the email, we search across users and
 * confirm the password + business status + (advisory) license state.
 */
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { email },
      include: { business: { include: { license: true } } },
    });
    if (!user || user.status !== "ACTIVE") throw unauthorized("Invalid email or password");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid email or password");

    if (user.business.status !== "ACTIVE") {
      throw unauthorized("This business account has been suspended. Contact support.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = jwt.sign(
      { sub: user.id, businessId: user.businessId, role: user.role },
      env.jwtAccessSecret,
      { expiresIn: env.accessTokenTtl } as jwt.SignOptions
    );

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: {
        id: user.business.id,
        name: user.business.name,
        currency: user.business.currency,
      },
      license: user.business.license
        ? {
            status: user.business.license.status,
            expiryDate: user.business.license.expiryDate,
            plan: user.business.license.planId,
          }
        : null,
    });
  })
);

const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Master admin portal login — completely separate credential space. */
authRouter.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const { email, password } = superAdminLoginSchema.parse(req.body);
    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) throw unauthorized("Invalid email or password");

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw unauthorized("Invalid email or password");

    await prisma.superAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const accessToken = jwt.sign({ sub: admin.id, role: admin.role }, env.superAdminJwtSecret, {
      expiresIn: env.accessTokenTtl,
    } as jwt.SignOptions);

    res.json({ accessToken, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post(
  "/change-password",
  requireBusinessAuth,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    if (!req.auth) throw unauthorized();
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) throw unauthorized();
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) throw badRequest("Current password is incorrect");
    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  })
);
