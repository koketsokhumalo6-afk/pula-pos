import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { badRequest, notFound } from "../utils/errors";

export const salesRouter = Router();
salesRouter.use(requireBusinessAuth);

salesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const sales = await prisma.sale.findMany({
      where: {
        businessId: req.auth!.businessId,
        ...(from || to
          ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
          : {}),
      },
      include: { items: true, customer: true, cashier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json(sales);
  })
);

salesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, businessId: req.auth!.businessId },
      include: { items: { include: { product: true } }, customer: true, cashier: { select: { name: true } } },
    });
    if (!sale) throw notFound();
    res.json(sale);
  })
);

const cartItem = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
});

const createSaleSchema = z.object({
  items: z.array(cartItem).min(1),
  customerId: z.string().optional(),
  terminalId: z.string().optional(),
  shiftId: z.string().optional(),
  amountPaid: z.number().nonnegative(),
  paymentMethod: z
    .enum(["CASH", "CARD", "MOBILE_MONEY", "ORANGE_MONEY", "MYZAKA", "SMEGA", "BANK_TRANSFER", "ACCOUNT", "MIXED"])
    .default("CASH"),
});

/**
 * Creates a POS sale: validates stock, computes totals server-side (never
 * trusts client-sent totals), decrements inventory, and records the
 * transaction — all in one DB transaction so a partial sale can never be
 * left behind. Blocked entirely if the business's license is not active.
 */
salesRouter.post(
  "/",
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const data = createSaleSchema.parse(req.body);
    const businessId = req.auth!.businessId;

    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, businessId } });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    const lineData: {
      productId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      taxAmount: number;
      total: number;
    }[] = [];

    for (const item of data.items) {
      const product = byId.get(item.productId);
      if (!product) throw badRequest(`Unknown product: ${item.productId}`);
      if (Number(product.quantity) < item.quantity) {
        throw badRequest(`Insufficient stock for ${product.name} (have ${product.quantity}, need ${item.quantity})`);
      }
      const lineSubtotal = item.unitPrice * item.quantity - item.discount;
      const lineTax = lineSubtotal * (Number(product.taxRate) / 100);
      const lineTotal = lineSubtotal + lineTax;
      subtotal += item.unitPrice * item.quantity;
      discountTotal += item.discount;
      taxTotal += lineTax;
      lineData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxAmount: lineTax,
        total: lineTotal,
      });
    }

    const total = subtotal - discountTotal + taxTotal;
    const changeDue = Math.max(0, data.amountPaid - total);

    const saleNumber = `S-${Date.now().toString(36).toUpperCase()}`;

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          businessId,
          saleNumber,
          cashierId: req.auth!.sub,
          customerId: data.customerId,
          terminalId: data.terminalId,
          shiftId: data.shiftId,
          subtotal,
          taxTotal,
          discountTotal,
          total,
          amountPaid: data.amountPaid,
          changeDue,
          paymentMethod: data.paymentMethod,
          items: { create: lineData },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            reference: created.saleNumber,
            createdBy: req.auth!.sub,
          },
        });
      }

      if (data.customerId && data.paymentMethod === "ACCOUNT") {
        await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: total } } });
      }

      return created;
    });

    res.status(201).json(sale);
  })
);

const voidSchema = z.object({ reason: z.string().min(1) });

/**
 * Voids a sale and restocks the items. Restricted to owner/admin/manager —
 * a cashier who could void their own sales could ring up a purchase, pocket
 * the cash, then void it to erase the record, so this is deliberately not
 * a cashier-level action.
 */
salesRouter.post(
  "/:id/void",
  requireRole("OWNER", "ADMIN", "MANAGER"),
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    voidSchema.parse(req.body);
    const businessId = req.auth!.businessId;
    const sale = await prisma.sale.findFirst({ where: { id: req.params.id, businessId }, include: { items: true } });
    if (!sale) throw notFound();
    if (sale.status !== "COMPLETED") throw badRequest("Only completed sales can be voided");

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: sale.id }, data: { status: "VOIDED" } });
      for (const item of sale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { increment: Number(item.quantity) } } });
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: item.productId,
            type: "RETURN",
            quantity: Number(item.quantity),
            reference: sale.saleNumber,
            reason: "Sale voided",
            createdBy: req.auth!.sub,
          },
        });
      }
    });

    res.json({ ok: true });
  })
);
