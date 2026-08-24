import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { badRequest, notFound } from "../utils/errors";

export const terminalsRouter = Router();
terminalsRouter.use(requireBusinessAuth);

terminalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const terminals = await prisma.terminal.findMany({ where: { businessId: req.auth!.businessId }, orderBy: { createdAt: "asc" } });
    res.json(terminals);
  })
);

const createSchema = z.object({ name: z.string().min(1) });

/** Registers a new POS terminal (a browser/tab checking in), enforcing the license's terminal limit. */
terminalsRouter.post(
  "/",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const [license, count] = await Promise.all([
      prisma.license.findUnique({ where: { businessId } }),
      prisma.terminal.count({ where: { businessId, isActive: true } }),
    ]);
    if (license && count >= license.maxTerminals) {
      throw badRequest(`Terminal limit reached for your plan (${license.maxTerminals}). Upgrade your plan to add more terminals.`);
    }
    const terminal = await prisma.terminal.create({
      data: { businessId, name: data.name, identifier: crypto.randomBytes(4).toString("hex").toUpperCase() },
    });
    res.status(201).json(terminal);
  })
);

terminalsRouter.delete(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.terminal.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
    if (!existing) throw notFound();
    await prisma.terminal.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  })
);
