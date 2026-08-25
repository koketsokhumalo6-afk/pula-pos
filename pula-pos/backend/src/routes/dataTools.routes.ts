import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth, requireRole } from "../middleware/auth";
import { requireActiveLicense } from "../middleware/license";
import { toCsv } from "../utils/csv";

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
 * belonging to this business. Owner-only by design — this is a
 * download-only safety copy (no self-service restore), so if it's ever
 * needed the owner sends it to support and it's restored directly against
 * the database rather than through an endpoint that could overwrite live
 * data by mistake.
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
      prisma.sale.findMany({ where: { businessId }, include: { items: true } }),
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
