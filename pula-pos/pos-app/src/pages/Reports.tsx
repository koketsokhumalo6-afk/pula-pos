import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface SalesSummary { revenue: number; tax: number; discount: number; count: number; byMethod: Record<string, number>; }
interface TopProduct { product: { name: string } | null; quantitySold: string; revenue: string; }
interface ExpenseSummary { category: string; total: string; }

export function ReportsPage() {
  const { business } = useAuth();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);

  useEffect(() => {
    api.get<SalesSummary>("/reports/sales-summary").then(setSummary).catch(() => {});
    api.get<TopProduct[]>("/reports/top-products").then(setTopProducts).catch(() => {});
    api.get<ExpenseSummary[]>("/reports/expenses-summary").then(setExpenses).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Reports</h2>
      <p className="muted">Last 30 days</p>

      <div className="grid grid-4">
        <div className="card stat-tile"><div className="label">Revenue</div><div className="value">{summary ? money(summary.revenue, business?.currency) : "—"}</div></div>
        <div className="card stat-tile"><div className="label">Sales</div><div className="value">{summary?.count ?? "—"}</div></div>
        <div className="card stat-tile"><div className="label">Tax collected</div><div className="value">{summary ? money(summary.tax, business?.currency) : "—"}</div></div>
        <div className="card stat-tile"><div className="label">Discounts given</div><div className="value">{summary ? money(summary.discount, business?.currency) : "—"}</div></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Top products</h3>
          <table>
            <thead><tr><th>Product</th><th>Qty sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i}><td>{p.product?.name || "Unknown"}</td><td>{p.quantitySold}</td><td>{money(p.revenue, business?.currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {!topProducts.length && <p className="muted">No sales yet.</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Expenses by category</h3>
          <table>
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i}><td>{e.category}</td><td>{money(e.total, business?.currency)}</td></tr>
              ))}
            </tbody>
          </table>
          {!expenses.length && <p className="muted">No expenses yet.</p>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Payment methods</h3>
        <table>
          <thead><tr><th>Method</th><th>Total</th></tr></thead>
          <tbody>
            {summary && Object.entries(summary.byMethod).map(([method, total]) => (
              <tr key={method}><td>{method.replace("_", " ")}</td><td>{money(total, business?.currency)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
