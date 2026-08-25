import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { toCsv } from "../utils/csv";
import { badRequest } from "../utils/errors";
 
export const dataToolsRouter = Router();
dataToolsRouter.use(requireBusinessAuth);
 
function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
 
/**
 * Export & import are restricted to owner/admin/manager, matching the rest
 * of the app's write-sensitive routes — a cashier has no business reason to
 * pull the full customer list or sales history off the system.
 */
const CAN_USE_DATA_TOOLS = requireRole("OWNER", "ADMIN", "MANAGER");
 
dataToolsRouter.get(
  "/export/products.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { businessId: req.auth!.businessId, isActive: true },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      ["name", "sku", "barcode", "category", "unit", "costPrice", "sellPrice", "taxRate", "quantity", "reorderLevel"],
      products.map((p) => ({
        name: p.name,
        sku: p.sku || "",
        barcode: p.barcode || "",
        category: p.category || "",
        unit: p.unit,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        taxRate: p.taxRate,
        quantity: p.quantity,
        reorderLevel: p.reorderLevel,
      }))
    );
    sendCsv(res, "products.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/sales.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const sales = await prisma.sale.findMany({
      where: { businessId: req.auth!.businessId },
      include: { customer: true, cashier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["saleNumber", "date", "cashier", "customer", "paymentMethod", "status", "subtotal", "discount", "tax", "total", "amountPaid", "changeDue"],
      sales.map((s) => ({
        saleNumber: s.saleNumber,
        date: s.createdAt.toISOString(),
        cashier: s.cashier?.name || "",
        customer: s.customer?.name || "Walk-in",
        paymentMethod: s.paymentMethod,
        status: s.status,
        subtotal: s.subtotal,
        discount: s.discountTotal,
        tax: s.taxTotal,
        total: s.total,
        amountPaid: s.amountPaid,
        changeDue: s.changeDue,
      }))
    );
    sendCsv(res, "sales.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/customers.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({
      where: { businessId: req.auth!.businessId },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      ["name", "idNumber", "phone", "email", "address", "dateOfBirth", "nextOfKinName", "nextOfKinPhone", "notes", "balance"],
      customers.map((c) => ({
        name: c.name,
        idNumber: c.idNumber || "",
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString() : "",
        nextOfKinName: c.nextOfKinName || "",
        nextOfKinPhone: c.nextOfKinPhone || "",
        notes: c.notes || "",
        balance: c.balance,
      }))
    );
    sendCsv(res, "customers.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/suppliers.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: req.auth!.businessId },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      ["name", "phone", "email", "address", "balance"],
      suppliers.map((s) => ({ name: s.name, phone: s.phone || "", email: s.email || "", address: s.address || "", balance: s.balance }))
    );
    sendCsv(res, "suppliers.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/purchases.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      where: { businessId: req.auth!.businessId },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["purchaseNumber", "supplier", "date", "status", "total"],
      purchases.map((p) => ({
        purchaseNumber: p.purchaseNumber,
        supplier: p.supplier?.name || "",
        date: p.createdAt.toISOString(),
        status: p.status,
        total: p.total,
      }))
    );
    sendCsv(res, "purchases.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/expenses.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const expenses = await prisma.expense.findMany({
      where: { businessId: req.auth!.businessId },
      orderBy: { date: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["date", "category", "description", "amount"],
      expenses.map((e) => ({
        date: e.date.toISOString(),
        category: e.category,
        description: e.description || "",
        amount: e.amount,
      }))
    );
    sendCsv(res, "expenses.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/invoices.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { businessId: req.auth!.businessId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["invoiceNumber", "customer", "date", "dueDate", "status", "subtotal", "tax", "total", "amountPaid", "outstanding"],
      invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        customer: i.customer?.name || "",
        date: i.createdAt.toISOString(),
        dueDate: i.dueDate ? i.dueDate.toISOString() : "",
        status: i.status,
        subtotal: i.subtotal,
        tax: i.taxTotal,
        total: i.total,
        amountPaid: i.amountPaid,
        outstanding: Number(i.total) - Number(i.amountPaid),
      }))
    );
    sendCsv(res, "invoices.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/quotations.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const quotations = await prisma.quotation.findMany({
      where: { businessId: req.auth!.businessId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["quoteNumber", "customer", "date", "validUntil", "status", "subtotal", "tax", "total"],
      quotations.map((q) => ({
        quoteNumber: q.quoteNumber,
        customer: q.customer?.name || "",
        date: q.createdAt.toISOString(),
        validUntil: q.validUntil ? q.validUntil.toISOString() : "",
        status: q.status,
        subtotal: q.subtotal,
        tax: q.taxTotal,
        total: q.total,
      }))
    );
    sendCsv(res, "quotations.csv", csv);
  })
);
 
/** Open laybuys only — a Sale with status HELD — with the outstanding
 * balance still owed. Completed/voided laybuys already show up in the
 * regular sales.csv export. */
dataToolsRouter.get(
  "/export/laybuys.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const sales = await prisma.sale.findMany({
      where: { businessId: req.auth!.businessId, status: "HELD" },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["saleNumber", "customer", "date", "total", "amountPaid", "balance"],
      sales.map((s) => ({
        saleNumber: s.saleNumber,
        customer: s.customer?.name || "",
        date: s.createdAt.toISOString(),
        total: s.total,
        amountPaid: s.amountPaid,
        balance: Number(s.total) - Number(s.amountPaid),
      }))
    );
    sendCsv(res, "laybuys.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/staff.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const staff = await prisma.user.findMany({
      where: { businessId: req.auth!.businessId },
      orderBy: { name: "asc" },
    });
    const csv = toCsv(
      ["name", "email", "role", "status", "lastLoginAt"],
      staff.map((u) => ({
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : "",
      }))
    );
    sendCsv(res, "staff.csv", csv);
  })
);
 
dataToolsRouter.get(
  "/export/shifts.csv",
  CAN_USE_DATA_TOOLS,
  asyncHandler(async (req, res) => {
    const shifts = await prisma.shift.findMany({
      where: { businessId: req.auth!.businessId },
      include: { cashier: { select: { name: true } } },
      orderBy: { openedAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      ["cashier", "openedAt", "closedAt", "openingBalance", "closingBalance", "expectedBalance", "status"],
      shifts.map((s) => ({
        cashier: s.cashier?.name || "",
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt ? s.closedAt.toISOString() : "",
        openingBalance: s.openingBalance,
        closingBalance: s.closingBalance ?? "",
        expectedBalance: s.expectedBalance ?? "",
        status: s.status,
      }))
    );
    sendCsv(res, "shifts.csv", csv);
  })
);
 
const importRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellPrice: z.number().nonnegative(),
  taxRate: z.number().nonnegative().optional(),
  quantity: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
});
 
const importSchema = z.object({ rows: z.array(z.record(z.any())).min(1).max(5000) });
 
/**
 * Bulk product import from a CSV parsed client-side into row objects. Each
 * row is validated and applied independently so one bad row doesn't sink
 * the whole batch. A row whose SKU matches an existing product updates its
 * details (name/prices/etc) but deliberately never touches its quantity —
 * stock changes always go through /products/:id/adjust so there's an audit
 * trail; only brand-new products get their quantity column applied, as
 * opening stock (mirroring manual product creation via POST /products).
 */
dataToolsRouter.post(
  "/import/products",
  CAN_USE_DATA_TOOLS,
  requireActiveLicense(),
  asyncHandler(async (req, res) => {
    const { rows } = importSchema.parse(req.body);
    const businessId = req.auth!.businessId;
 
    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];
 
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1 in the source spreadsheet
      const parsed = importRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: rowNum, message: parsed.error.issues[0]?.message || "Invalid row" });
        continue;
      }
      const data = parsed.data;
      try {
        const existing = data.sku ? await prisma.product.findFirst({ where: { businessId, sku: data.sku } }) : null;
 
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              barcode: data.barcode,
              category: data.category,
              unit: data.unit,
              costPrice: data.costPrice,
              sellPrice: data.sellPrice,
              taxRate: data.taxRate,
              reorderLevel: data.reorderLevel,
            },
          });
          updated++;
        } else {
          await prisma.$transaction(async (tx) => {
            const p = await tx.product.create({
              data: {
                businessId,
                name: data.name,
                sku: data.sku,
                barcode: data.barcode,
                category: data.category,
                unit: data.unit || "each",
                costPrice: data.costPrice ?? 0,
                sellPrice: data.sellPrice,
                taxRate: data.taxRate ?? 0,
                quantity: data.quantity ?? 0,
                reorderLevel: data.reorderLevel ?? 0,
              },
            });
            if ((data.quantity ?? 0) > 0) {
              await tx.stockMovement.create({
                data: { businessId, productId: p.id, type: "OPENING", quantity: data.quantity!, reason: "Imported from CSV" },
              });
            }
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, message: err?.code === "P2002" ? "Duplicate SKU" : "Failed to save this row" });
      }
    }
 
    res.json({ created, updated, errors });
  })
);
 
/**
 * Full-data backup: a single downloadable JSON snapshot of everything
 * belonging to this business. Owner-only by design. Pairs with POST
 * /restore below, which loads a file downloaded from here back in.
 */
dataToolsRouter.get(
  "/backup",
  requireRole("OWNER"),
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
 
    const [
      business,
      license,
      products,
      categories,
      customers,
      suppliers,
      sales,
      purchases,
      expenses,
      invoices,
      quotations,
      staff,
      shifts,
      stockMovements,
      terminals,
    ] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.license.findUnique({ where: { businessId } }),
      prisma.product.findMany({ where: { businessId } }),
      prisma.category.findMany({ where: { businessId } }),
      prisma.customer.findMany({ where: { businessId } }),
      prisma.supplier.findMany({ where: { businessId } }),
      prisma.sale.findMany({ where: { businessId }, include: { items: true, laybuyPayments: true } }),
      prisma.purchase.findMany({ where: { businessId }, include: { items: true } }),
      prisma.expense.findMany({ where: { businessId } }),
      prisma.invoice.findMany({ where: { businessId } }),
      prisma.quotation.findMany({ where: { businessId } }),
      prisma.user.findMany({
        where: { businessId },
        select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      }),
      prisma.shift.findMany({ where: { businessId }, include: { cashMovements: true } }),
      prisma.stockMovement.findMany({ where: { businessId } }),
      prisma.terminal.findMany({ where: { businessId } }),
    ]);
 
    const backup = {
      generatedAt: new Date().toISOString(),
      businessId,
      business,
      license,
      products,
      categories,
      customers,
      suppliers,
      sales,
      purchases,
      expenses,
      invoices,
      quotations,
      staff, // never includes password hashes
      shifts,
      stockMovements,
      terminals,
    };
 
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pula-pos-backup-${businessId}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  })
);
 
/* ------------------------------- Restore ---------------------------------- */
// Converts a JSON value that may be an ISO date string (or already absent)
// into a Date, for a field that's always present in a valid backup row.
function toDate(v: unknown): Date {
  return new Date(v as string);
}
// Same, but for an optional/nullable datetime field.
function toDateOrNull(v: unknown): Date | null {
  return v === null || v === undefined ? null : new Date(v as string);
}
 
function mapCategory(businessId: string) {
  return (c: any) => ({ id: c.id, businessId, name: c.name, createdAt: toDate(c.createdAt) });
}
function mapProduct(businessId: string) {
  return (p: any) => ({
    id: p.id,
    businessId,
    name: p.name,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    category: p.category ?? null,
    unit: p.unit || "each",
    costPrice: p.costPrice,
    sellPrice: p.sellPrice,
    taxRate: p.taxRate,
    quantity: p.quantity,
    reorderLevel: p.reorderLevel,
    imageUrl: p.imageUrl ?? null,
    isActive: p.isActive ?? true,
    createdAt: toDate(p.createdAt),
    updatedAt: toDate(p.updatedAt ?? p.createdAt),
  });
}
function mapSupplier(businessId: string) {
  return (s: any) => ({
    id: s.id,
    businessId,
    name: s.name,
    phone: s.phone ?? null,
    email: s.email ?? null,
    address: s.address ?? null,
    balance: s.balance,
    createdAt: toDate(s.createdAt),
  });
}
function mapCustomer(businessId: string) {
  return (c: any) => ({
    id: c.id,
    businessId,
    name: c.name,
    idNumber: c.idNumber ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    dateOfBirth: toDateOrNull(c.dateOfBirth),
    nextOfKinName: c.nextOfKinName ?? null,
    nextOfKinPhone: c.nextOfKinPhone ?? null,
    notes: c.notes ?? null,
    balance: c.balance,
    createdAt: toDate(c.createdAt),
  });
}
function mapTerminal(businessId: string) {
  return (t: any) => ({
    id: t.id,
    businessId,
    name: t.name,
    identifier: t.identifier,
    isActive: t.isActive ?? true,
    createdAt: toDate(t.createdAt),
  });
}
function mapShift(businessId: string) {
  return (s: any) => ({
    id: s.id,
    businessId,
    terminalId: s.terminalId ?? null,
    cashierId: s.cashierId,
    openingBalance: s.openingBalance,
    closingBalance: s.closingBalance ?? null,
    expectedBalance: s.expectedBalance ?? null,
    status: s.status || "OPEN",
    openedAt: toDate(s.openedAt),
    closedAt: toDateOrNull(s.closedAt),
  });
}
function mapPurchase(businessId: string) {
  return (p: any) => ({
    id: p.id,
    businessId,
    purchaseNumber: p.purchaseNumber,
    supplierId: p.supplierId,
    total: p.total,
    status: p.status || "RECEIVED",
    createdAt: toDate(p.createdAt),
  });
}
function mapPurchaseItem(purchaseId: string) {
  return (it: any) => ({
    id: it.id,
    purchaseId,
    productId: it.productId,
    quantity: it.quantity,
    unitCost: it.unitCost,
    total: it.total,
  });
}
function mapSale(businessId: string) {
  return (s: any) => ({
    id: s.id,
    businessId,
    saleNumber: s.saleNumber,
    terminalId: s.terminalId ?? null,
    cashierId: s.cashierId,
    customerId: s.customerId ?? null,
    shiftId: s.shiftId ?? null,
    subtotal: s.subtotal,
    taxTotal: s.taxTotal,
    discountTotal: s.discountTotal,
    total: s.total,
    amountPaid: s.amountPaid,
    changeDue: s.changeDue,
    paymentMethod: s.paymentMethod || "CASH",
    status: s.status || "COMPLETED",
    createdAt: toDate(s.createdAt),
  });
}
function mapSaleItem(saleId: string) {
  return (it: any) => ({
    id: it.id,
    saleId,
    productId: it.productId,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    discount: it.discount,
    taxAmount: it.taxAmount,
    total: it.total,
  });
}
function mapLaybuyPayment(businessId: string, saleId: string) {
  return (lp: any) => ({
    id: lp.id,
    businessId,
    saleId,
    amount: lp.amount,
    paymentMethod: lp.paymentMethod || "CASH",
    createdBy: lp.createdBy ?? null,
    createdAt: toDate(lp.createdAt),
  });
}
function mapCashMovement(businessId: string, shiftId: string) {
  return (cm: any) => ({
    id: cm.id,
    businessId,
    shiftId,
    type: cm.type,
    amount: cm.amount,
    reason: cm.reason ?? null,
    createdById: cm.createdById,
    createdAt: toDate(cm.createdAt),
  });
}
function mapStockMovement(businessId: string) {
  return (sm: any) => ({
    id: sm.id,
    businessId,
    productId: sm.productId,
    type: sm.type,
    quantity: sm.quantity,
    reason: sm.reason ?? null,
    reference: sm.reference ?? null,
    createdBy: sm.createdBy ?? null,
    createdAt: toDate(sm.createdAt),
  });
}
function mapExpense(businessId: string) {
  return (e: any) => ({
    id: e.id,
    businessId,
    category: e.category,
    description: e.description ?? null,
    amount: e.amount,
    date: toDate(e.date),
    createdBy: e.createdBy ?? null,
    createdAt: toDate(e.createdAt),
  });
}
function mapInvoice(businessId: string) {
  return (i: any) => ({
    id: i.id,
    businessId,
    invoiceNumber: i.invoiceNumber,
    customerId: i.customerId,
    items: i.items,
    subtotal: i.subtotal,
    taxTotal: i.taxTotal,
    total: i.total,
    amountPaid: i.amountPaid,
    dueDate: toDateOrNull(i.dueDate),
    status: i.status || "DRAFT",
    createdAt: toDate(i.createdAt),
  });
}
function mapQuotation(businessId: string) {
  return (q: any) => ({
    id: q.id,
    businessId,
    quoteNumber: q.quoteNumber,
    customerId: q.customerId ?? null,
    items: q.items,
    subtotal: q.subtotal,
    taxTotal: q.taxTotal,
    total: q.total,
    validUntil: toDateOrNull(q.validUntil),
    status: q.status || "DRAFT",
    createdAt: toDate(q.createdAt),
  });
}
 
const restoreSchema = z.object({
  businessId: z.string(),
  categories: z.array(z.record(z.any())).optional().default([]),
  products: z.array(z.record(z.any())).optional().default([]),
  suppliers: z.array(z.record(z.any())).optional().default([]),
  customers: z.array(z.record(z.any())).optional().default([]),
  terminals: z.array(z.record(z.any())).optional().default([]),
  shifts: z.array(z.record(z.any())).optional().default([]),
  purchases: z.array(z.record(z.any())).optional().default([]),
  sales: z.array(z.record(z.any())).optional().default([]),
  stockMovements: z.array(z.record(z.any())).optional().default([]),
  expenses: z.array(z.record(z.any())).optional().default([]),
  invoices: z.array(z.record(z.any())).optional().default([]),
  quotations: z.array(z.record(z.any())).optional().default([]),
  generatedAt: z.string().optional(),
});
 
/**
 * Restores this business's data from a JSON file downloaded via GET
 * /backup above. Owner-only, and deliberately narrow in what it touches:
 *
 *  - Business profile, license/plan, and staff accounts (including
 *    passwords) are left completely alone — a backup never includes
 *    password hashes, and overwriting the current plan/license from an old
 *    snapshot would be its own kind of damage. Only operational data is
 *    replaced: products, categories, customers, suppliers, sales,
 *    purchases, expenses, invoices, quotations, shifts, cash movements,
 *    stock movements, and terminals.
 *  - The backup's businessId must match the signed-in business — this is a
 *    multi-tenant system, so a backup can only ever be restored into the
 *    same business it came from.
 *  - Existing rows for every table above are deleted and replaced with the
 *    backup's rows (same original IDs, so every relationship — sale items,
 *    purchase items, laybuy payments, cash movements — reconnects exactly
 *    as it was). This is a full point-in-time replace, not a merge: nothing
 *    created after the backup was taken survives the restore.
 *  - Everything runs inside one transaction, so a failure partway through
 *    (e.g. a corrupted file) leaves the current data completely untouched
 *    rather than half-replaced.
 */
dataToolsRouter.post(
  "/restore",
  requireRole("OWNER"),
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
 
    if (!req.body || typeof req.body !== "object" || !("businessId" in req.body)) {
      throw badRequest("That doesn't look like a Pula POS backup file.");
    }
    const data = restoreSchema.parse(req.body);
    if (data.businessId !== businessId) {
      throw badRequest("This backup belongs to a different business and can't be restored here.");
    }
 
    // Pre-flight check: every cashier/creator reference in the backup must
    // resolve to a staff account that still exists in this business. Staff
    // accounts are never hard-deleted in this app (only deactivated), so in
    // practice this should always pass — but if it wouldn't, better to fail
    // clearly before touching anything than mid-transaction.
    const currentUsers = await prisma.user.findMany({ where: { businessId }, select: { id: true } });
    const knownUserIds = new Set(currentUsers.map((u) => u.id));
    const missingUserIds = new Set<string>();
    for (const s of data.sales) if (s.cashierId && !knownUserIds.has(s.cashierId)) missingUserIds.add(s.cashierId);
    for (const sh of data.shifts) {
      if (sh.cashierId && !knownUserIds.has(sh.cashierId)) missingUserIds.add(sh.cashierId);
      for (const cm of sh.cashMovements || []) {
        if (cm.createdById && !knownUserIds.has(cm.createdById)) missingUserIds.add(cm.createdById);
      }
    }
    if (missingUserIds.size) {
      throw badRequest(
        "This backup references staff accounts that no longer exist in this business — restore cancelled, nothing was changed."
      );
    }
 
    try {
      await prisma.$transaction(
        async (tx) => {
          // 1. Clear existing operational data — children before parents.
          await tx.laybuyPayment.deleteMany({ where: { businessId } });
          await tx.saleItem.deleteMany({ where: { sale: { businessId } } });
          await tx.cashMovement.deleteMany({ where: { businessId } });
          await tx.purchaseItem.deleteMany({ where: { purchase: { businessId } } });
          await tx.stockMovement.deleteMany({ where: { businessId } });
          await tx.sale.deleteMany({ where: { businessId } });
          await tx.purchase.deleteMany({ where: { businessId } });
          await tx.invoice.deleteMany({ where: { businessId } });
          await tx.quotation.deleteMany({ where: { businessId } });
          await tx.shift.deleteMany({ where: { businessId } });
          await tx.terminal.deleteMany({ where: { businessId } });
          await tx.customer.deleteMany({ where: { businessId } });
          await tx.supplier.deleteMany({ where: { businessId } });
          await tx.product.deleteMany({ where: { businessId } });
          await tx.category.deleteMany({ where: { businessId } });
          await tx.expense.deleteMany({ where: { businessId } });
 
          // 2. Recreate from the backup — parents before children.
          if (data.categories.length) {
            await tx.category.createMany({ data: data.categories.map(mapCategory(businessId)), skipDuplicates: true });
          }
          if (data.products.length) {
            await tx.product.createMany({ data: data.products.map(mapProduct(businessId)), skipDuplicates: true });
          }
          if (data.suppliers.length) {
            await tx.supplier.createMany({ data: data.suppliers.map(mapSupplier(businessId)), skipDuplicates: true });
          }
          if (data.customers.length) {
            await tx.customer.createMany({ data: data.customers.map(mapCustomer(businessId)), skipDuplicates: true });
          }
          if (data.terminals.length) {
            await tx.terminal.createMany({ data: data.terminals.map(mapTerminal(businessId)), skipDuplicates: true });
          }
          if (data.shifts.length) {
            await tx.shift.createMany({ data: data.shifts.map(mapShift(businessId)), skipDuplicates: true });
          }
 
          if (data.purchases.length) {
            await tx.purchase.createMany({ data: data.purchases.map(mapPurchase(businessId)), skipDuplicates: true });
            const purchaseItems = data.purchases.flatMap((p: any) => (p.items || []).map(mapPurchaseItem(p.id)));
            if (purchaseItems.length) await tx.purchaseItem.createMany({ data: purchaseItems, skipDuplicates: true });
          }
 
          if (data.sales.length) {
            await tx.sale.createMany({ data: data.sales.map(mapSale(businessId)), skipDuplicates: true });
            const saleItems = data.sales.flatMap((s: any) => (s.items || []).map(mapSaleItem(s.id)));
            if (saleItems.length) await tx.saleItem.createMany({ data: saleItems, skipDuplicates: true });
            const laybuyPayments = data.sales.flatMap((s: any) =>
              (s.laybuyPayments || []).map(mapLaybuyPayment(businessId, s.id))
            );
            if (laybuyPayments.length) await tx.laybuyPayment.createMany({ data: laybuyPayments, skipDuplicates: true });
          }
 
          if (data.shifts.length) {
            const cashMovements = data.shifts.flatMap((s: any) =>
              (s.cashMovements || []).map(mapCashMovement(businessId, s.id))
            );
            if (cashMovements.length) await tx.cashMovement.createMany({ data: cashMovements, skipDuplicates: true });
          }
 
          if (data.stockMovements.length) {
            await tx.stockMovement.createMany({ data: data.stockMovements.map(mapStockMovement(businessId)), skipDuplicates: true });
          }
          if (data.expenses.length) {
            await tx.expense.createMany({ data: data.expenses.map(mapExpense(businessId)), skipDuplicates: true });
          }
          if (data.invoices.length) {
            await tx.invoice.createMany({ data: data.invoices.map(mapInvoice(businessId)), skipDuplicates: true });
          }
          if (data.quotations.length) {
            await tx.quotation.createMany({ data: data.quotations.map(mapQuotation(businessId)), skipDuplicates: true });
          }
        },
        { timeout: 120_000, maxWait: 15_000 }
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Restore failed:", err);
      throw badRequest("Restore failed — nothing was changed. The file may be corrupted or from an incompatible version.");
    }
 
    res.json({
      restoredFrom: data.generatedAt || null,
      counts: {
        categories: data.categories.length,
        products: data.products.length,
        suppliers: data.suppliers.length,
        customers: data.customers.length,
        terminals: data.terminals.length,
        shifts: data.shifts.length,
        purchases: data.purchases.length,
        sales: data.sales.length,
        stockMovements: data.stockMovements.length,
        expenses: data.expenses.length,
        invoices: data.invoices.length,
        quotations: data.quotations.length,
      },
    });
  })
);
 

