import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, hasPermission, requirePermission } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { badRequest, notFound, forbidden } from "../utils/errors";

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
      include: {
        items: { include: { product: true } },
        customer: true,
        cashier: { select: { name: true } },
        laybuyPayments: { orderBy: { createdAt: "asc" } },
      },
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
  // A laybuy takes a deposit and reserves the stock now, but the customer
  // only collects — and the sale only counts as COMPLETED — once it's paid
  // off (see POST /:id/laybuy-payment and POST /:id/complete-laybuy).
  isLaybuy: z.boolean().optional().default(false),
  // Client-generated id (the POS sends one on every checkout, not just
  // offline ones) used to make this endpoint safe to retry — see the
  // idempotency check just inside the handler below.
  clientRef: z.string().min(1).max(80).optional(),
});

/**
 * Creates a POS sale: validates stock, computes totals server-side (never
 * trusts client-sent totals), decrements inventory, and records the
 * transaction — all in one DB transaction so a partial sale can never be
 * left behind. Blocked entirely if the business's license is not active.
 * A laybuy is created the same way (stock is reserved immediately) but
 * lands as status HELD instead of COMPLETED, with amountPaid recording just
 * the deposit.
 *
 * Idempotent on `clientRef`: the POS generates one locally for every
 * checkout (not just offline ones) and resends the same one on any retry —
 * a sale that's rung up while offline and queued, or one whose response
 * never made it back after a dropped connection, is replayed with the exact
 * same request. If a sale for this business already exists with that
 * clientRef, it's returned as-is instead of creating a second one.
 */
salesRouter.post(
  "/",
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const data = createSaleSchema.parse(req.body);
    const businessId = req.auth!.businessId;

    if (data.clientRef) {
      const existing = await prisma.sale.findFirst({
        where: { businessId, clientRef: data.clientRef },
        include: { items: true },
      });
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }

    if (data.isLaybuy) {
      if (!data.customerId) throw badRequest("Select a customer to start a laybuy.");
      if (!(await hasPermission(req, "laybuys"))) {
        throw forbidden("You don't have permission to start a laybuy.");
      }
    }

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

    // The random suffix (on top of the millisecond timestamp) keeps this
    // collision-safe even when several queued offline sales replay in a
    // tight loop the moment connectivity returns.
    const saleNumber = `S-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

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
          status: data.isLaybuy ? "HELD" : "COMPLETED",
          clientRef: data.clientRef,
          items: { create: lineData },
        },
        include: { items: true },
      });

      // Stock is reserved the moment a laybuy starts, same as a regular
      // sale — otherwise the item could get sold to someone else while this
      // customer is still paying it off.
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

      // A laybuy deposit isn't a credit-account charge — the customer
      // hasn't taken the goods yet, so it shouldn't add to their ACCOUNT
      // balance the way a real "buy now, pay later" sale does.
      if (data.customerId && data.paymentMethod === "ACCOUNT" && !data.isLaybuy) {
        await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: total } } });
      }

      return created;
    });

    res.status(201).json(sale);
  })
);

const laybuyPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z
    .enum(["CASH", "CARD", "MOBILE_MONEY", "ORANGE_MONEY", "MYZAKA", "SMEGA", "BANK_TRANSFER", "ACCOUNT", "MIXED"])
    .default("CASH"),
});

/**
 * Records another installment payment toward an open laybuy. Open to any
 * signed-in role — recording money coming in doesn't remove value the way
 * voiding does, so it doesn't need the manager-approval gate. Doesn't touch
 * stock (already reserved when the laybuy started) or auto-complete the
 * sale even once fully paid — handing the goods over is a separate,
 * explicit step (see POST /:id/complete-laybuy) since paying it off and
 * physically collecting it don't always happen at the same moment. Gated
 * by the "laybuys" permission, same as starting one.
 */
salesRouter.post(
  "/:id/laybuy-payment",
  requireActiveLicense(),
  requirePermission("laybuys"),
  asyncHandler(async (req, res) => {
    const data = laybuyPaymentSchema.parse(req.body);
    const businessId = req.auth!.businessId;

    const sale = await prisma.sale.findFirst({ where: { id: req.params.id, businessId } });
    if (!sale) throw notFound();
    if (sale.status !== "HELD") throw badRequest("Only an open laybuy can take a payment");

    const newAmountPaid = Number(sale.amountPaid) + data.amount;
    const changeDue = Math.max(0, newAmountPaid - Number(sale.total));

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: { amountPaid: newAmountPaid, changeDue },
      });
      await tx.laybuyPayment.create({
        data: {
          businessId,
          saleId: sale.id,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          createdBy: req.auth!.sub,
        },
      });
      return updatedSale;
    });

    res.json(updated);
  })
);

/**
 * Marks a fully-paid laybuy COMPLETED — the moment the goods are actually
 * handed over. Stock was already decremented when the laybuy started, so
 * this is purely a status change. Refuses if there's still a balance owing.
 * Gated by the "laybuys" permission, same as starting one.
 */
salesRouter.post(
  "/:id/complete-laybuy",
  requireActiveLicense(),
  requirePermission("laybuys"),
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const sale = await prisma.sale.findFirst({ where: { id: req.params.id, businessId } });
    if (!sale) throw notFound();
    if (sale.status !== "HELD") throw badRequest("This sale isn't an open laybuy");

    const remaining = Number(sale.total) - Number(sale.amountPaid);
    if (remaining > 0) {
      throw badRequest(`Laybuy isn't fully paid yet — balance remaining: ${remaining.toFixed(2)}`);
    }

    const updated = await prisma.sale.update({ where: { id: sale.id }, data: { status: "COMPLETED" } });
    res.json(updated);
  })
);

const voidSchema = z.object({
  reason: z.string().min(1),
  approverEmail: z.string().email().optional(),
  approverPassword: z.string().min(1).optional(),
});

/**
 * Voids a sale — or cancels an open laybuy — and restocks the items either
 * way. Owner/admin/manager can do this directly. A cashier can also trigger
 * it — from the POS screen right after a sale, or from the Laybuys tab —
 * but only by supplying a manager/admin/owner's own email + password,
 * verified right here (the "manager override" pattern most POS systems
 * use). Without a valid approval, a cashier who could void their own sales
 * could ring one up, pocket the cash, then void it to erase the record.
 */
salesRouter.post(
  "/:id/void",
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const data = voidSchema.parse(req.body);
    const businessId = req.auth!.businessId;

    if (req.auth!.role === "CASHIER") {
      if (!data.approverEmail || !data.approverPassword) {
        throw forbidden("A manager, admin, or owner must approve this void.");
      }
      const approver = await prisma.user.findUnique({
        where: { businessId_email: { businessId, email: data.approverEmail } },
      });
      const validRole = !!approver && approver.status === "ACTIVE" && ["OWNER", "ADMIN", "MANAGER"].includes(approver.role);
      const validPassword = approver ? await bcrypt.compare(data.approverPassword, approver.passwordHash) : false;
      if (!validRole || !validPassword) throw forbidden("That manager login couldn't be verified.");
    }

    const sale = await prisma.sale.findFirst({ where: { id: req.params.id, businessId }, include: { items: true } });
    if (!sale) throw notFound();
    if (sale.status !== "COMPLETED" && sale.status !== "HELD") {
      throw badRequest("Only completed sales or open laybuys can be voided");
    }

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
            reason: sale.status === "HELD" ? "Laybuy cancelled" : "Sale voided",
            createdBy: req.auth!.sub,
          },
        });
      }
    });

    res.json({ ok: true });
  })
);
