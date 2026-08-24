import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../utils/errors";

export const staffRouter = Router();
staffRouter.use(requireBusinessAuth);

staffRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { businessId: req.auth!.businessId },
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  })
);

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]),
});

/** Creates a staff member, enforcing the license's maxUsers seat limit. */
staffRouter.post(
  "/",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createStaffSchema.parse(req.body);
    const businessId = req.auth!.businessId;

    const [license, userCount] = await Promise.all([
      prisma.license.findUnique({ where: { businessId } }),
      prisma.user.count({ where: { businessId, status: "ACTIVE" } }),
    ]);
    if (license && userCount >= license.maxUsers) {
      throw badRequest(`User limit reached for your plan (${license.maxUsers}). Upgrade your plan to add more staff.`);
    }

    const dupe = await prisma.user.findUnique({ where: { businessId_email: { businessId, email: data.email } } });
    if (dupe) throw conflict("A staff member with this email already exists");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { businessId, name: data.name, email: data.email, passwordHash, role: data.role },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    res.status(201).json(user);
  })
);

const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

staffRouter.put(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateStaffSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
    if (!existing) throw notFound();
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    res.json(user);
  })
);
