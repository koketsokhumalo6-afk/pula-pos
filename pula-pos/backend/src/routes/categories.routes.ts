import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { conflict, notFound } from "../utils/errors";

// A curated, per-business list of category names. Kept separate from
// Product.category (a plain string) so this list can be managed freely
// without ever touching existing products — see schema.prisma for the
// reasoning. The Products and POS pages combine this list with whatever
// category names are already in use on products, so nothing typed in
// before this feature existed ever goes missing from a filter/tab.

export const categoriesRouter = Router();
categoriesRouter.use(requireBusinessAuth);

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { businessId: req.auth!.businessId },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  })
);

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

categoriesRouter.post(
  "/",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const existing = await prisma.category.findFirst({ where: { businessId, name: { equals: name, mode: "insensitive" } } });
    if (existing) throw conflict("That category already exists");
    const category = await prisma.category.create({ data: { businessId, name } });
    res.status(201).json(category);
  })
);

categoriesRouter.put(
  "/:id",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const { name } = createSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) throw notFound();
    const clash = await prisma.category.findFirst({
      where: { businessId, name: { equals: name, mode: "insensitive" }, id: { not: existing.id } },
    });
    if (clash) throw conflict("That category already exists");

    // Renaming relabels every product currently filed under the old name,
    // so the change is consistent everywhere rather than orphaning them.
    const [category] = await prisma.$transaction([
      prisma.category.update({ where: { id: existing.id }, data: { name } }),
      prisma.product.updateMany({ where: { businessId, category: existing.name }, data: { category: name } }),
    ]);
    res.json(category);
  })
);

categoriesRouter.delete(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
    if (!existing) throw notFound();
    // Deliberately does not touch products that still use this category —
    // it just stops appearing in the managed list. Their category text is
    // left alone so nothing on existing products silently changes.
    await prisma.category.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);
