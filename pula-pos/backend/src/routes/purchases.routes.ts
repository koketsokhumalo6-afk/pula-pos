import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { badRequest } from "../utils/errors";

export const purchasesRouter = Router();
purchasesRouter.use(requireBusinessAuth);

purchasesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      where: { businessId: req.auth!.businessId },
      include: { items: true, supplier: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(purchases);
  })
);

const purchaseItem = z.object({ productId: z.string(), quantity: z.number().positive(), unitCost: z.number().nonnegative() });

const createSchema = z.object({
  supplierId: z.string(),
  items: z.array(purchaseItem).min(1),
  status: z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]).default("RECEIVED"),
});

/** Records a purchase; if status=RECEIVED, stock is added immediately. */
purchasesRouter.post(
  "/",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    if (!data.items.length) throw badRequest("At least one line item is required");

    const total = data.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    const purchaseNumber = `P-${Date.now().toString(36).toUpperCase()}`;

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          businessId,
          purchaseNumber,
          supplierId: data.supplierId,
          total,
          status: data.status,
          items: { create: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost, total: i.quantity * i.unitCost })) },
        },
        include: { items: true },
      });

      if (data.status === "RECEIVED") {
        for (const item of data.items) {
          await tx.product.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity }, costPrice: item.unitCost } });
          await tx.stockMovement.create({
            data: { businessId, productId: item.productId, type: "PURCHASE", quantity: item.quantity, reference: purchaseNumber, createdBy: req.auth!.sub },
          });
        }
        await tx.supplier.update({ where: { id: data.supplierId }, data: { balance: { increment: total } } });
      }

      return created;
    });

    res.status(201).json(purchase);
  })
);
