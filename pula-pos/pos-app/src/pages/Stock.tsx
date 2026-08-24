import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";

interface Product { id: string; name: string; sku: string | null; quantity: string; reorderLevel: string; }

export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Product[]>("/products").then(setProducts).catch(() => {});
    api.get<Product[]>("/products/low-stock").then(setLowStock).catch(() => {});
  }

  async function submitAdjustment() {
    if (!adjusting) return;
    setError(null);
    try {
      await api.post(`/products/${adjusting.id}/adjust`, { quantity: Number(qty), reason });
      setAdjusting(null);
      setQty("");
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to adjust stock");
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Stock</h2>

      {lowStock.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#f0c36d" }}>
          <strong>Low stock alert:</strong> {lowStock.length} item(s) at or below reorder level.
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Reorder level</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku || "—"}</td>
                <td>{p.quantity}</td>
                <td>{p.reorderLevel}</td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => setAdjusting(p)}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <div className="modal-overlay" onClick={() => setAdjusting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust stock — {adjusting.name}</h3>
            <div className="field"><label>Quantity change (+ to add, − to remove)</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="field"><label>Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. stock count correction, damage" /></div>
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submitAdjustment}>Save</button>
              <button className="btn btn-secondary" onClick={() => setAdjusting(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
