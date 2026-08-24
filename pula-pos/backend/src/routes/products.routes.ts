import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { notFound } from "../utils/errors";

export const productsRouter = Router();
productsRouter.use(requireBusinessAuth);

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || undefined;
    const products = await prisma.product.findMany({
      where: {
        businessId: req.auth!.businessId,
        isActive: true,
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { barcode: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { name: "asc" },
    });
    res.json(products);
  })
);

productsRouter.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const products = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Product" WHERE "businessId" = $1 AND "isActive" = true AND "quantity" <= "reorderLevel" ORDER BY "quantity" ASC`,
      req.auth!.businessId
    );
    res.json(products);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().default("each"),
  costPrice: z.number().nonnegative().default(0),
  sellPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().default(0),
    quantity: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
  imageUrl: z.string().max(2_000_000).optional(), // base64 data URL, client-side resized before upload
});

productsRouter.post(
  "/",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...data, businessId } });
      if (data.quantity > 0) {
        await tx.stockMovement.create({
          data: { businessId, productId: p.id, type: "OPENING", quantity: data.quantity, reason: "Opening stock" },
        });
      }
      return p;
    });
    res.status(201).json(product);
  })
);

const updateSchema = createSchema.partial();

productsRouter.put(
  "/:id",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
    if (!existing) throw notFound();
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  })
);

productsRouter.delete(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
    if (!existing) throw notFound();
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  })
);

const adjustSchema = z.object({
  quantity: z.number(), // positive = add, negative = remove
  reason: z.string().min(1),
});

/** Manual stock adjustment (stock count corrections, damages, etc). */
productsRouter.post(
  "/:id/adjust",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const data = adjustSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) throw notFound();

    const [product] = await prisma.$transaction([
      prisma.product.update({ where: { id: req.params.id }, data: { quantity: { increment: data.quantity } } }),
      prisma.stockMovement.create({
        data: {
          businessId,
          productId: req.params.id,
          type: "ADJUSTMENT",
          quantity: data.quantity,
          reason: data.reason,
          createdBy: req.auth!.sub,
        },
      }),
    ]);
    res.json(product);
  })
);

productsRouter.get(
  "/:id/movements",
  asyncHandler(async (req, res) => {
    const movements = await prisma.stockMovement.findMany({
      where: { productId: req.params.id, businessId: req.auth!.businessId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(movements);
  })
);
