import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface Customer { id: string; name: string; }
interface LineItem { description: string; quantity: number; unitPrice: number; total: number }
interface Quotation { id: string; quoteNumber: string; total: string; status: string; createdAt: string; customer: Customer | null; items: LineItem[]; }

export function QuotationsPage() {
  const { business } = useAuth();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
  }, []);
  function load() { api.get<Quotation[]>("/quotations").then(setQuotes).catch(() => {}); }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch, total: (patch.quantity ?? l.quantity) * (patch.unitPrice ?? l.unitPrice) } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  async function submit() {
    setError(null);
    try {
      await api.post("/quotations", {
        quoteNumber: `Q-${Date.now().toString(36).toUpperCase()}`,
        customerId: customerId || undefined,
        items: lines.filter((l) => l.description),
        subtotal,
        taxTotal: 0,
        total: subtotal,
      });
      setShowForm(false);
      setLines([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save quotation");
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Quotations</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Quotation</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.quoteNumber}</td>
                <td>{q.customer?.name || "—"}</td>
                <td>{money(q.total, business?.currency)}</td>
                <td><span className="badge badge-gray">{q.status}</span></td>
                <td>{dateTime(q.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotes.length && <p className="muted" style={{ padding: 12 }}>No quotations yet.</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Quotation</h3>
            <div className="field">
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="gap-8" style={{ marginBottom: 8 }}>
                <input placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ flex: 2 }} />
                <input type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} style={{ width: 70 }} />
                <input type="number" placeholder="Price" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} style={{ width: 90 }} />
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => setLines([...lines, { description: "", quantity: 1, unitPrice: 0, total: 0 }])}>+ Add line</button>
            <p style={{ fontWeight: 700, marginTop: 10 }}>Total: {money(subtotal, business?.currency)}</p>
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submit}>Save Quotation</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
