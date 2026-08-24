import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface Customer { id: string; name: string; }
interface LineItem { description: string; quantity: number; unitPrice: number; total: number }
interface Invoice { id: string; invoiceNumber: string; total: string; status: string; dueDate: string | null; createdAt: string; customer: Customer; }

export function InvoicesPage() {
  const { business } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
  }, []);
  function load() { api.get<Invoice[]>("/invoices").then(setInvoices).catch(() => {}); }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch, total: (patch.quantity ?? l.quantity) * (patch.unitPrice ?? l.unitPrice) } : l)));
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  async function submit() {
    if (!customerId) { setError("Please select a customer"); return; }
    setError(null);
    try {
      await api.post("/invoices", {
        invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
        customerId,
        items: lines.filter((l) => l.description),
        subtotal,
        taxTotal: 0,
        total: subtotal,
        dueDate: dueDate || undefined,
        status: "SENT",
      });
      setShowForm(false);
      setLines([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save invoice");
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Invoices</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Invoice</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Customer</th><th>Total</th><th>Due date</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>{inv.customer?.name}</td>
                <td>{money(inv.total, business?.currency)}</td>
                <td>{inv.dueDate ? dateTime(inv.dueDate) : "—"}</td>
                <td><span className="badge badge-gray">{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoices.length && <p className="muted" style={{ padding: 12 }}>No invoices yet.</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Invoice</h3>
            <div className="field">
              <label>Customer *</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Due date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
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
              <button className="btn btn-primary" onClick={submit}>Save Invoice</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
