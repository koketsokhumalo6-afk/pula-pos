import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; }
interface Line { productId: string; quantity: number; unitCost: number }
interface Purchase { id: string; purchaseNumber: string; total: string; status: string; createdAt: string; supplier: Supplier; }

export function PurchasesPage() {
  const { business } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    api.get<Supplier[]>("/suppliers").then(setSuppliers).catch(() => {});
    api.get<Product[]>("/products").then(setProducts).catch(() => {});
  }, []);
  function load() { api.get<Purchase[]>("/purchases").then(setPurchases).catch(() => {}); }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  async function submit() {
    if (!supplierId) { setError("Select a supplier"); return; }
    setError(null);
    try {
      await api.post("/purchases", { supplierId, items: lines.filter((l) => l.productId), status: "RECEIVED" });
      setShowForm(false);
      setLines([{ productId: "", quantity: 1, unitCost: 0 }]);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save purchase");
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Purchases</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Number</th><th>Supplier</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.purchaseNumber}</td>
                <td>{p.supplier?.name}</td>
                <td>{money(p.total, business?.currency)}</td>
                <td><span className="badge badge-green">{p.status}</span></td>
                <td>{dateTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!purchases.length && <p className="muted" style={{ padding: 12 }}>No purchases recorded yet.</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Purchase (stock received)</h3>
            <div className="field">
              <label>Supplier *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="gap-8" style={{ marginBottom: 8 }}>
                <select value={l.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} style={{ flex: 2 }}>
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} style={{ width: 70 }} />
                <input type="number" placeholder="Unit cost" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} style={{ width: 90 }} />
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => setLines([...lines, { productId: "", quantity: 1, unitCost: 0 }])}>+ Add line</button>
            <p style={{ fontWeight: 700, marginTop: 10 }}>Total: {money(total, business?.currency)}</p>
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submit}>Save Purchase</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
