import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { downloadFile } from "../lib/download";
import { buildCsv, saveCsv } from "../lib/csv";
import { buildReportPdf, type PdfSection } from "../lib/reportPdf";

interface SalesSummary { revenue: number; tax: number; discount: number; count: number; byMethod: Record<string, number>; }
interface TopProduct { product: { name: string } | null; quantitySold: string; revenue: string; }
interface ExpenseSummary { category: string; total: string; }
interface PurchasesSummary { total: number; count: number; byStatus: Record<string, number>; topSuppliers: { supplier: string; total: number }[]; }
interface StockSummary {
  productCount: number;
  totalStockValue: number;
  totalRetailValue: number;
  lowStockCount: number;
  lowStock: { name: string; sku: string | null; quantity: string; reorderLevel: string }[];
}
interface CustomersSummary { customerCount: number; totalOutstandingBalance: number; topCustomers: { name: string; total: number; count: number }[]; }
interface InvoicesSummary { count: number; total: number; paid: number; outstanding: number; byStatus: Record<string, number>; }
interface QuotationsSummary { count: number; total: number; acceptedTotal: number; byStatus: Record<string, number>; }
interface StaffSummary { rows: { name: string; total: number; count: number }[]; }
interface LaybuysSummary { openCount: number; openBalanceTotal: number; openCollectedTotal: number; }
interface ShiftsSummary { shiftCount: number; closedCount: number; cashIn: number; cashOut: number; discrepancy: number; }

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return isoDate(d);
}

/** A card wrapping one report section — its own content, plus a CSV and/or
 * PDF download button. Download buttons only render for roles that can
 * actually use them (the backend CSV exports are OWNER/ADMIN/MANAGER-only,
 * same restriction as Settings > Data Tools). */
function ReportCard({
  title,
  canDownload,
  csv,
  pdf,
  children,
}: {
  title: string;
  canDownload: boolean;
  csv?: () => Promise<void> | void;
  pdf: () => void;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCsv() {
    if (!csv) return;
    setErr(null);
    setBusy(true);
    try {
      await csv();
    } catch {
      setErr("Download failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handlePdf() {
    setErr(null);
    try {
      pdf();
    } catch {
      setErr("Couldn't build the PDF — please try again.");
    }
  }

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {canDownload && (
          <div className="gap-8">
            {csv && (
              <button className="btn btn-secondary btn-sm" onClick={handleCsv} disabled={busy}>
                {busy ? "Preparing…" : "CSV"}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handlePdf}>PDF</button>
          </div>
        )}
      </div>
      {children}
      {err && <div className="error-text">{err}</div>}
    </div>
  );
}

export function ReportsPage() {
  const { user, business } = useAuth();
  const currency = business?.currency;
  const canDownload = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "MANAGER";

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(isoDate(new Date()));
  const [loading, setLoading] = useState(true);

  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [purchases, setPurchases] = useState<PurchasesSummary | null>(null);
  const [customers, setCustomers] = useState<CustomersSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoicesSummary | null>(null);
  const [quotations, setQuotations] = useState<QuotationsSummary | null>(null);
  const [staff, setStaff] = useState<StaffSummary | null>(null);
  const [shifts, setShifts] = useState<ShiftsSummary | null>(null);

  // Not date-ranged — these reflect the current position, not activity
  // over a period, so they load once and don't refetch with the range.
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [laybuys, setLaybuys] = useState<LaybuysSummary | null>(null);

  useEffect(() => {
    api.get<StockSummary>("/reports/stock-summary").then(setStock).catch(() => {});
    api.get<LaybuysSummary>("/reports/laybuys-summary").then(setLaybuys).catch(() => {});
  }, []);

  useEffect(() => {
    loadRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadRange() {
    setLoading(true);
    const qs = `?from=${from}&to=${to}T23:59:59`;
    Promise.all([
      api.get<SalesSummary>(`/reports/sales-summary${qs}`).then(setSales).catch(() => {}),
      api.get<TopProduct[]>(`/reports/top-products${qs}`).then(setTopProducts).catch(() => {}),
      api.get<ExpenseSummary[]>(`/reports/expenses-summary${qs}`).then(setExpenses).catch(() => {}),
      api.get<PurchasesSummary>(`/reports/purchases-summary${qs}`).then(setPurchases).catch(() => {}),
      api.get<CustomersSummary>(`/reports/customers-summary${qs}`).then(setCustomers).catch(() => {}),
      api.get<InvoicesSummary>(`/reports/invoices-summary${qs}`).then(setInvoices).catch(() => {}),
      api.get<QuotationsSummary>(`/reports/quotations-summary${qs}`).then(setQuotations).catch(() => {}),
      api.get<StaffSummary>(`/reports/staff-summary${qs}`).then(setStaff).catch(() => {}),
      api.get<ShiftsSummary>(`/reports/shifts-summary${qs}`).then(setShifts).catch(() => {}),
    ]).finally(() => setLoading(false));
  }

  const stamp = () => isoDate(new Date());
  const periodLabel = `${from} to ${to}`;
  const businessName = business?.name || "Business";

  /* ---------------------------- per-section PDF sections ---------------------------- */

  const salesSection = (): PdfSection => ({
    heading: "Sales",
    summaryLines: sales
      ? [
          `Revenue: ${money(sales.revenue, currency)}`,
          `Sales count: ${sales.count}`,
          `Tax collected: ${money(sales.tax, currency)}`,
          `Discounts given: ${money(sales.discount, currency)}`,
        ]
      : [],
    columns: ["Payment method", "Total"],
    rows: sales ? Object.entries(sales.byMethod).map(([m, t]) => [m.replace("_", " "), money(t, currency)]) : [],
  });

  const topProductsSection = (): PdfSection => ({
    heading: "Top Products",
    columns: ["Product", "Qty sold", "Revenue"],
    rows: topProducts.map((p) => [p.product?.name || "Unknown", p.quantitySold, money(p.revenue, currency)]),
  });

  const expensesSection = (): PdfSection => ({
    heading: "Expenses by Category",
    columns: ["Category", "Total"],
    rows: expenses.map((e) => [e.category, money(e.total, currency)]),
  });

  const purchasesSection = (): PdfSection => ({
    heading: "Purchases",
    summaryLines: purchases
      ? [
          `Total purchased: ${money(purchases.total, currency)}`,
          `Purchase orders: ${purchases.count}`,
          ...Object.entries(purchases.byStatus).map(([s, c]) => `${s}: ${c}`),
        ]
      : [],
    columns: ["Top suppliers", "Total"],
    rows: purchases ? purchases.topSuppliers.map((s) => [s.supplier, money(s.total, currency)]) : [],
  });

  const stockSection = (): PdfSection => ({
    heading: "Stock & Inventory",
    summaryLines: stock
      ? [
          `Active products: ${stock.productCount}`,
          `Stock value (at cost): ${money(stock.totalStockValue, currency)}`,
          `Stock value (at retail): ${money(stock.totalRetailValue, currency)}`,
          `Low stock items: ${stock.lowStockCount}`,
        ]
      : [],
    columns: ["Low stock item", "Qty", "Reorder level"],
    rows: stock ? stock.lowStock.map((p) => [p.name, p.quantity, p.reorderLevel]) : [],
  });

  const customersSection = (): PdfSection => ({
    heading: "Customers",
    summaryLines: customers
      ? [
          `Total customers: ${customers.customerCount}`,
          `Outstanding balance (account sales): ${money(customers.totalOutstandingBalance, currency)}`,
        ]
      : [],
    columns: ["Top customer", "Spent", "Sales"],
    rows: customers ? customers.topCustomers.map((c) => [c.name, money(c.total, currency), c.count]) : [],
  });

  const invoicesSection = (): PdfSection => ({
    heading: "Invoices",
    summaryLines: invoices
      ? [
          `Invoices: ${invoices.count}`,
          `Total invoiced: ${money(invoices.total, currency)}`,
          `Paid: ${money(invoices.paid, currency)}`,
          `Outstanding: ${money(invoices.outstanding, currency)}`,
        ]
      : [],
    columns: ["Status", "Count"],
    rows: invoices ? Object.entries(invoices.byStatus).map(([s, c]) => [s, c]) : [],
  });

  const quotationsSection = (): PdfSection => ({
    heading: "Quotations",
    summaryLines: quotations
      ? [
          `Quotations: ${quotations.count}`,
          `Total quoted: ${money(quotations.total, currency)}`,
          `Accepted/converted value: ${money(quotations.acceptedTotal, currency)}`,
        ]
      : [],
    columns: ["Status", "Count"],
    rows: quotations ? Object.entries(quotations.byStatus).map(([s, c]) => [s, c]) : [],
  });

  const staffSection = (): PdfSection => ({
    heading: "Staff Performance",
    columns: ["Cashier", "Sales", "Revenue"],
    rows: staff ? staff.rows.map((r) => [r.name, r.count, money(r.total, currency)]) : [],
  });

  const laybuysSection = (): PdfSection => ({
    heading: "Laybuys",
    summaryLines: laybuys
      ? [
          `Open laybuys: ${laybuys.openCount}`,
          `Collected so far: ${money(laybuys.openCollectedTotal, currency)}`,
          `Still owed: ${money(laybuys.openBalanceTotal, currency)}`,
        ]
      : [],
  });

  const shiftsSection = (): PdfSection => ({
    heading: "Shifts & Cash",
    summaryLines: shifts
      ? [
          `Shifts: ${shifts.shiftCount} (${shifts.closedCount} closed)`,
          `Cash in: ${money(shifts.cashIn, currency)}`,
          `Cash out: ${money(shifts.cashOut, currency)}`,
          `Cash discrepancy (closed shifts): ${money(shifts.discrepancy, currency)}`,
        ]
      : [],
  });

  function downloadSectionPdf(section: PdfSection, filename: string) {
    const doc = buildReportPdf({ title: section.heading, businessName, periodLabel, sections: [section] });
    doc.save(filename);
  }

  function downloadFullReport() {
    const doc = buildReportPdf({
      title: "Full Business Report",
      businessName,
      periodLabel,
      sections: [
        salesSection(),
        topProductsSection(),
        purchasesSection(),
        stockSection(),
        expensesSection(),
        customersSection(),
        invoicesSection(),
        quotationsSection(),
        staffSection(),
        laybuysSection(),
        shiftsSection(),
      ],
    });
    doc.save(`pula-pos-full-report-${stamp()}.pdf`);
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Reports</h2>
        {canDownload && (
          <button className="btn btn-primary btn-sm" onClick={downloadFullReport}>
            Download Full Report (PDF)
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="gap-8" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadRange} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Sales, purchases, expenses, customers, invoices, quotations, staff, and shift reports below cover this
          period. Stock and open laybuys always reflect right now.
        </p>
      </div>

      <ReportCard
        title="Sales"
        canDownload={canDownload}
        csv={() => downloadFile("/data-tools/export/sales.csv", `sales-${stamp()}.csv`)}
        pdf={() => downloadSectionPdf(salesSection(), `sales-report-${stamp()}.pdf`)}
      >
        <div className="grid grid-4">
          <div className="card stat-tile"><div className="label">Revenue</div><div className="value">{sales ? money(sales.revenue, currency) : "—"}</div></div>
          <div className="card stat-tile"><div className="label">Sales</div><div className="value">{sales?.count ?? "—"}</div></div>
          <div className="card stat-tile"><div className="label">Tax collected</div><div className="value">{sales ? money(sales.tax, currency) : "—"}</div></div>
          <div className="card stat-tile"><div className="label">Discounts given</div><div className="value">{sales ? money(sales.discount, currency) : "—"}</div></div>
        </div>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Payment method</th><th>Total</th></tr></thead>
          <tbody>
            {sales && Object.entries(sales.byMethod).map(([method, total]) => (
              <tr key={method}><td>{method.replace("_", " ")}</td><td>{money(total, currency)}</td></tr>
            ))}
          </tbody>
        </table>
        {sales && !Object.keys(sales.byMethod).length && <p className="muted">No sales yet.</p>}
      </ReportCard>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ReportCard
          title="Top Products"
          canDownload={canDownload}
          csv={() =>
            saveCsv(
              `top-products-${stamp()}.csv`,
              buildCsv(
                ["Product", "Qty sold", "Revenue"],
                topProducts.map((p) => [p.product?.name || "Unknown", p.quantitySold, p.revenue])
              )
            )
          }
          pdf={() => downloadSectionPdf(topProductsSection(), `top-products-${stamp()}.pdf`)}
        >
          <table>
            <thead><tr><th>Product</th><th>Qty sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i}><td>{p.product?.name || "Unknown"}</td><td>{p.quantitySold}</td><td>{money(p.revenue, currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {!topProducts.length && <p className="muted">No sales yet.</p>}
        </ReportCard>

        <ReportCard
          title="Expenses by Category"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/expenses.csv", `expenses-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(expensesSection(), `expenses-report-${stamp()}.pdf`)}
        >
          <table>
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i}><td>{e.category}</td><td>{money(e.total, currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {!expenses.length && <p className="muted">No expenses yet.</p>}
        </ReportCard>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ReportCard
          title="Purchases"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/purchases.csv", `purchases-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(purchasesSection(), `purchases-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-2">
            <div className="card stat-tile"><div className="label">Total purchased</div><div className="value">{purchases ? money(purchases.total, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Purchase orders</div><div className="value">{purchases?.count ?? "—"}</div></div>
          </div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Top suppliers</th><th>Total</th></tr></thead>
            <tbody>
              {purchases?.topSuppliers.map((s, i) => (
                <tr key={i}><td>{s.supplier}</td><td>{money(s.total, currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {purchases && !purchases.topSuppliers.length && <p className="muted">No purchases yet.</p>}
        </ReportCard>

        <ReportCard
          title="Stock & Inventory"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/products.csv", `products-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(stockSection(), `stock-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-2">
            <div className="card stat-tile"><div className="label">Stock value (cost)</div><div className="value">{stock ? money(stock.totalStockValue, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Low stock items</div><div className="value">{stock?.lowStockCount ?? "—"}</div></div>
          </div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Low stock item</th><th>Qty</th><th>Reorder at</th></tr></thead>
            <tbody>
              {stock?.lowStock.map((p, i) => (
                <tr key={i}><td>{p.name}</td><td>{p.quantity}</td><td>{p.reorderLevel}</td></tr>
              ))}
            </tbody>
          </table>
          {stock && !stock.lowStock.length && <p className="muted">Nothing low on stock.</p>}
        </ReportCard>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ReportCard
          title="Customers"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/customers.csv", `customers-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(customersSection(), `customers-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-2">
            <div className="card stat-tile"><div className="label">Customers</div><div className="value">{customers?.customerCount ?? "—"}</div></div>
            <div className="card stat-tile"><div className="label">Outstanding balance</div><div className="value">{customers ? money(customers.totalOutstandingBalance, currency) : "—"}</div></div>
          </div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Top customer</th><th>Spent</th><th>Sales</th></tr></thead>
            <tbody>
              {customers?.topCustomers.map((c, i) => (
                <tr key={i}><td>{c.name}</td><td>{money(c.total, currency)}</td><td>{c.count}</td></tr>
              ))}
            </tbody>
          </table>
          {customers && !customers.topCustomers.length && <p className="muted">No customer sales yet.</p>}
        </ReportCard>

        <ReportCard
          title="Staff Performance"
          canDownload={canDownload}
          csv={() =>
            saveCsv(
              `staff-performance-${stamp()}.csv`,
              buildCsv(["Cashier", "Sales", "Revenue"], (staff?.rows || []).map((r) => [r.name, r.count, r.total]))
            )
          }
          pdf={() => downloadSectionPdf(staffSection(), `staff-performance-${stamp()}.pdf`)}
        >
          <table>
            <thead><tr><th>Cashier</th><th>Sales</th><th>Revenue</th></tr></thead>
            <tbody>
              {staff?.rows.map((r, i) => (
                <tr key={i}><td>{r.name}</td><td>{r.count}</td><td>{money(r.total, currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {staff && !staff.rows.length && <p className="muted">No sales in this period yet.</p>}
        </ReportCard>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ReportCard
          title="Invoices"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/invoices.csv", `invoices-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(invoicesSection(), `invoices-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-4">
            <div className="card stat-tile"><div className="label">Invoices</div><div className="value">{invoices?.count ?? "—"}</div></div>
            <div className="card stat-tile"><div className="label">Invoiced</div><div className="value">{invoices ? money(invoices.total, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Paid</div><div className="value">{invoices ? money(invoices.paid, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Outstanding</div><div className="value">{invoices ? money(invoices.outstanding, currency) : "—"}</div></div>
          </div>
        </ReportCard>

        <ReportCard
          title="Quotations"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/quotations.csv", `quotations-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(quotationsSection(), `quotations-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-2">
            <div className="card stat-tile"><div className="label">Quotations</div><div className="value">{quotations?.count ?? "—"}</div></div>
            <div className="card stat-tile"><div className="label">Accepted/converted</div><div className="value">{quotations ? money(quotations.acceptedTotal, currency) : "—"}</div></div>
          </div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {quotations && Object.entries(quotations.byStatus).map(([s, c]) => (
                <tr key={s}><td>{s}</td><td>{c}</td></tr>
              ))}
            </tbody>
          </table>
        </ReportCard>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ReportCard
          title="Laybuys"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/laybuys.csv", `laybuys-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(laybuysSection(), `laybuys-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-2">
            <div className="card stat-tile"><div className="label">Open laybuys</div><div className="value">{laybuys?.openCount ?? "—"}</div></div>
            <div className="card stat-tile"><div className="label">Still owed</div><div className="value">{laybuys ? money(laybuys.openBalanceTotal, currency) : "—"}</div></div>
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {laybuys ? `${money(laybuys.openCollectedTotal, currency)} collected so far on open laybuys.` : ""}
          </p>
        </ReportCard>

        <ReportCard
          title="Shifts & Cash"
          canDownload={canDownload}
          csv={() => downloadFile("/data-tools/export/shifts.csv", `shifts-${stamp()}.csv`)}
          pdf={() => downloadSectionPdf(shiftsSection(), `shifts-report-${stamp()}.pdf`)}
        >
          <div className="grid grid-4">
            <div className="card stat-tile"><div className="label">Shifts</div><div className="value">{shifts?.shiftCount ?? "—"}</div></div>
            <div className="card stat-tile"><div className="label">Cash in</div><div className="value">{shifts ? money(shifts.cashIn, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Cash out</div><div className="value">{shifts ? money(shifts.cashOut, currency) : "—"}</div></div>
            <div className="card stat-tile"><div className="label">Discrepancy</div><div className="value">{shifts ? money(shifts.discrepancy, currency) : "—"}</div></div>
          </div>
        </ReportCard>
      </div>
    </div>
  );
}
