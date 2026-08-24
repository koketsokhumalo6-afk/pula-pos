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
