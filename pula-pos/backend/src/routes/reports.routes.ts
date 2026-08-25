import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireBusinessAuth } from "../middleware/auth";
import { notFound } from "../utils/errors";

export const reportsRouter = Router();
reportsRouter.use(requireBusinessAuth);

function rangeFromQuery(q: any) {
  const to = q.to ? new Date(q.to as string) : new Date();
  const from = q.from ? new Date(q.from as string) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

reportsRouter.get(
  "/sales-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const sales = await prisma.sale.findMany({
      where: { businessId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      select: { total: true, subtotal: true, taxTotal: true, discountTotal: true, paymentMethod: true, createdAt: true },
    });
    const totals = sales.reduce(
      (acc, s) => {
        acc.revenue += Number(s.total);
        acc.tax += Number(s.taxTotal);
        acc.discount += Number(s.discountTotal);
        acc.count += 1;
        acc.byMethod[s.paymentMethod] = (acc.byMethod[s.paymentMethod] || 0) + Number(s.total);
        return acc;
      },
      { revenue: 0, tax: 0, discount: 0, count: 0, byMethod: {} as Record<string, number> }
    );
    res.json({ from, to, ...totals });
  })
);

reportsRouter.get(
  "/top-products",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const rows = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { businessId, status: "COMPLETED", createdAt: { gte: from, lte: to } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    });
    const products = await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    res.json(rows.map((r) => ({ product: byId.get(r.productId), quantitySold: r._sum.quantity, revenue: r._sum.total })));
  })
);

reportsRouter.get(
  "/expenses-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const rows = await prisma.expense.groupBy({
      by: ["category"],
      where: { businessId, date: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    res.json(rows.map((r) => ({ category: r.category, total: r._sum.amount })));
  })
);

reportsRouter.get(
  "/purchases-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const purchases = await prisma.purchase.findMany({
      where: { businessId, createdAt: { gte: from, lte: to } },
      include: { supplier: true },
    });
    const bySupplier = new Map<string, number>();
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const p of purchases) {
      total += Number(p.total);
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      const key = p.supplier?.name || "Unknown";
      bySupplier.set(key, (bySupplier.get(key) || 0) + Number(p.total));
    }
    const topSuppliers = [...bySupplier.entries()]
      .map(([supplier, total]) => ({ supplier, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    res.json({ from, to, total, count: purchases.length, byStatus, topSuppliers });
  })
);

/** Current stock position — not date-ranged, this reflects what's on the
 * shelf right now rather than activity over a period. */
reportsRouter.get(
  "/stock-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const products = await prisma.product.findMany({ where: { businessId, isActive: true } });
    const totalStockValue = products.reduce((sum, p) => sum + Number(p.costPrice) * Number(p.quantity), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + Number(p.sellPrice) * Number(p.quantity), 0);
    const lowStock = products
      .filter((p) => Number(p.quantity) <= Number(p.reorderLevel))
      .sort((a, b) => Number(a.quantity) - Number(b.quantity))
      .map((p) => ({ name: p.name, sku: p.sku, quantity: p.quantity, reorderLevel: p.reorderLevel }));
    res.json({
      productCount: products.length,
      totalStockValue,
      totalRetailValue,
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 50),
    });
  })
);

reportsRouter.get(
  "/customers-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const [customerCount, balanceAgg, sales] = await Promise.all([
      prisma.customer.count({ where: { businessId } }),
      prisma.customer.aggregate({ where: { businessId }, _sum: { balance: true } }),
      prisma.sale.findMany({
        where: { businessId, status: "COMPLETED", createdAt: { gte: from, lte: to }, customerId: { not: null } },
        select: { customerId: true, total: true, customer: { select: { name: true } } },
      }),
    ]);
    const bySpend = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      if (!s.customerId) continue;
      const entry = bySpend.get(s.customerId) || { name: s.customer?.name || "Unknown", total: 0, count: 0 };
      entry.total += Number(s.total);
      entry.count += 1;
      bySpend.set(s.customerId, entry);
    }
    const topCustomers = [...bySpend.values()].sort((a, b) => b.total - a.total).slice(0, 10);
    res.json({
      from,
      to,
      customerCount,
      totalOutstandingBalance: Number(balanceAgg._sum.balance || 0),
      topCustomers,
    });
  })
);

reportsRouter.get(
  "/invoices-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const invoices = await prisma.invoice.findMany({ where: { businessId, createdAt: { gte: from, lte: to } } });
    const byStatus: Record<string, number> = {};
    let total = 0;
    let paid = 0;
    for (const inv of invoices) {
      total += Number(inv.total);
      paid += Number(inv.amountPaid);
      byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    }
    res.json({ from, to, count: invoices.length, total, paid, outstanding: total - paid, byStatus });
  })
);

reportsRouter.get(
  "/quotations-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const quotations = await prisma.quotation.findMany({ where: { businessId, createdAt: { gte: from, lte: to } } });
    const byStatus: Record<string, number> = {};
    let total = 0;
    let acceptedTotal = 0;
    for (const q of quotations) {
      total += Number(q.total);
      byStatus[q.status] = (byStatus[q.status] || 0) + 1;
      if (q.status === "ACCEPTED" || q.status === "CONVERTED") acceptedTotal += Number(q.total);
    }
    res.json({ from, to, count: quotations.length, total, acceptedTotal, byStatus });
  })
);

/** Sales performance grouped by the cashier who rang each sale up. */
reportsRouter.get(
  "/staff-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const sales = await prisma.sale.findMany({
      where: { businessId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
      select: { cashierId: true, total: true, cashier: { select: { name: true } } },
    });
    const byCashier = new Map<string, { name: string; total: number; count: number }>();
    for (const s of sales) {
      const entry = byCashier.get(s.cashierId) || { name: s.cashier?.name || "Unknown", total: 0, count: 0 };
      entry.total += Number(s.total);
      entry.count += 1;
      byCashier.set(s.cashierId, entry);
    }
    const rows = [...byCashier.values()].sort((a, b) => b.total - a.total);
    res.json({ from, to, rows });
  })
);

/** Open laybuys right now (a Sale with status HELD) — how much is still
 * owed across all of them and how much has already been collected as
 * deposits/installments. Not date-ranged: this is a current position, like
 * stock-summary. */
reportsRouter.get(
  "/laybuys-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const open = await prisma.sale.findMany({
      where: { businessId, status: "HELD" },
      select: { total: true, amountPaid: true },
    });
    const openBalanceTotal = open.reduce((sum, s) => sum + (Number(s.total) - Number(s.amountPaid)), 0);
    const openCollectedTotal = open.reduce((sum, s) => sum + Number(s.amountPaid), 0);
    res.json({ openCount: open.length, openBalanceTotal, openCollectedTotal });
  })
);

reportsRouter.get(
  "/shifts-summary",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const { from, to } = rangeFromQuery(req.query);
    const shifts = await prisma.shift.findMany({
      where: { businessId, openedAt: { gte: from, lte: to } },
      include: { cashMovements: true },
    });
    let cashIn = 0;
    let cashOut = 0;
    let discrepancy = 0;
    let closedCount = 0;
    for (const s of shifts) {
      for (const m of s.cashMovements) {
        if (m.type === "CASH_IN") cashIn += Number(m.amount);
        else cashOut += Number(m.amount);
      }
      if (s.status === "CLOSED" && s.closingBalance != null && s.expectedBalance != null) {
        discrepancy += Number(s.closingBalance) - Number(s.expectedBalance);
        closedCount++;
      }
    }
    res.json({ from, to, shiftCount: shifts.length, closedCount, cashIn, cashOut, discrepancy });
  })
);

/** Customer statement: running list of invoices + account sales for a customer. */
reportsRouter.get(
  "/customer-statement/:customerId",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const customer = await prisma.customer.findFirst({ where: { id: req.params.customerId, businessId } });
    if (!customer) throw notFound("Customer not found");

    const [sales, invoices] = await Promise.all([
      prisma.sale.findMany({ where: { businessId, customerId: customer.id }, orderBy: { createdAt: "asc" } }),
      prisma.invoice.findMany({ where: { businessId, customerId: customer.id }, orderBy: { createdAt: "asc" } }),
    ]);

    res.json({ customer, sales, invoices, balance: customer.balance });
  })
);

reportsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const businessId = req.auth!.businessId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todaySales, lowStockCount, openShifts, customerCount] = await Promise.all([
      prisma.sale.aggregate({ where: { businessId, status: "COMPLETED", createdAt: { gte: startOfDay } }, _sum: { total: true }, _count: true }),
      prisma.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*) as count FROM "Product" WHERE "businessId" = $1 AND "isActive" = true AND "quantity" <= "reorderLevel"`,
        businessId
      ),
      prisma.shift.count({ where: { businessId, status: "OPEN" } }),
      prisma.customer.count({ where: { businessId } }),
    ]);

    res.json({
      todayRevenue: todaySales._sum.total || 0,
      todaySalesCount: todaySales._count,
      lowStockCount: Number(lowStockCount[0]?.count || 0),
      openShifts,
      customerCount,
    });
  })
);
