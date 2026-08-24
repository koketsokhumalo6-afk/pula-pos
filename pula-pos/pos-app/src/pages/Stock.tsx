import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";

interface Product { id: string; name: string; sku: string | null; quantity: string; reorderLevel: string; unit: string; }

/** Renders a quantity with its unit, e.g. "12.5 kg" — bare units like "each" are omitted since they're implied. */
function qtyLabel(qty: string | number, unit: string) {
  return unit && unit !== "each" ? `${qty} ${unit}` : `${qty}`;
}

export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);

  // "Adjust" modal — per-row, supports both adding and removing stock
  // (e.g. stock count corrections, damages) via a signed quantity.
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // "Add Stock" modal — the obvious, dedicated way to receive new stock.
  // Product is picked from a dropdown (not tied to a table row), quantity
  // is always positive, and the reason defaults to something sensible.
  const [addingStock, setAddingStock] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addReason, setAddReason] = useState("Stock received");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

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

  function openAddStock() {
    setAddProductId("");
    setAddQty("");
    setAddReason("Stock received");
    setAddError(null);
    setAddSuccess(null);
    setAddingStock(true);
  }

  const addProduct = products.find((p) => p.id === addProductId);

  async function submitAddStock() {
    setAddError(null);
    if (!addProductId) { setAddError("Select a product"); return; }
    const n = Number(addQty);
    if (!n || n <= 0) { setAddError("Enter a quantity greater than 0"); return; }
    try {
      const product = products.find((p) => p.id === addProductId);
      await api.post(`/products/${addProductId}/adjust`, { quantity: n, reason: addReason || "Stock received" });
      setAddSuccess(`Added ${qtyLabel(n, product?.unit || "each")} to ${product?.name || "product"}.`);
      setAddProductId("");
      setAddQty("");
      setAddReason("Stock received");
      load();
    } catch (err) {
      setAddError(err instanceof ApiRequestError ? err.message : "Failed to add stock");
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Stock</h2>
        <button className="btn btn-primary" onClick={openAddStock}>+ Add Stock</button>
      </div>

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
                <td>{qtyLabel(p.quantity, p.unit)}</td>
                <td>{qtyLabel(p.reorderLevel, p.unit)}</td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => setAdjusting(p)}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <p className="muted" style={{ padding: 12 }}>No products yet — add a product first, then you can add stock to it.</p>}
      </div>

      {addingStock && (
        <div className="modal-overlay" onClick={() => setAddingStock(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Stock</h3>
            <div className="field">
              <label>Product</label>
              <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""} — currently {qtyLabel(p.quantity, p.unit)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantity to add{addProduct && addProduct.unit !== "each" ? ` (${addProduct.unit})` : ""}</label>
              <input type="number" min={0.01} step="any" value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder={addProduct && addProduct.unit !== "each" ? `e.g. 5.5` : "e.g. 50"} />
            </div>
            <div className="field">
              <label>Reason / reference (optional)</label>
              <input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="e.g. New delivery, restock" />
            </div>
            {addError && <div className="error-text">{addError}</div>}
            {addSuccess && <div style={{ color: "#146c43", fontSize: 13, margin: "8px 0" }}>{addSuccess}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submitAddStock}>Add Stock</button>
              <button className="btn btn-secondary" onClick={() => setAddingStock(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {adjusting && (
        <div className="modal-overlay" onClick={() => setAdjusting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust stock — {adjusting.name}</h3>
            <div className="field"><label>Quantity change{adjusting.unit !== "each" ? ` in ${adjusting.unit}` : ""} (+ to add, − to remove)</label><input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
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
