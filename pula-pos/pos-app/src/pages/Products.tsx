import { useEffect, useState, type ChangeEvent } from "react";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";
import { resizeImageToDataUrl } from "../lib/image";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  costPrice: string;
  sellPrice: string;
  taxRate: string;
  quantity: string;
  reorderLevel: string;
  imageUrl: string | null;
  unit: string;
}

interface Category {
  id: string;
  name: string;
}

/** Renders a quantity with its unit, e.g. "12.5 kg" — bare units like "each" are omitted since they're implied. */
function qtyLabel(qty: string | number, unit: string) {
  return unit && unit !== "each" ? `${qty} ${unit}` : `${qty}`;
}

// Common units of measure. "Each" covers most retail items; kg/g/L/ml let
// products sold by weight or volume (e.g. meat, produce, drinks) use
// fractional quantities. "Custom…" covers anything else (case, roll, etc.).
const UNIT_OPTIONS = ["each", "kg", "g", "L", "ml", "box", "pack", "dozen", "pair", "m"];

const empty = { name: "", sku: "", barcode: "", category: "", costPrice: "", sellPrice: "", taxRate: "0", quantity: "0", reorderLevel: "0", imageUrl: "", unit: "each" };

export function ProductsPage() {
  const { business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [customUnit, setCustomUnit] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Product[]>("/products").then(setProducts).catch(() => {});
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }

  // Filter dropdown covers the managed category list plus any category text
  // already in use on a product (e.g. typed in before this feature existed),
  // so nothing already on a product ever silently disappears from the filter.
  const categoryFilterOptions = Array.from(
    new Set([...categories.map((c) => c.name), ...products.map((p) => p.category).filter((c): c is string => !!c)])
  ).sort((a, b) => a.localeCompare(b));
  const visibleProducts = filterCategory ? products.filter((p) => p.category === filterCategory) : products;

  function openNew() { setEditing(null); setForm(empty); setCustomUnit(false); setCustomCategory(false); setError(null); setImageError(null); setShowForm(true); }
  function openEdit(p: Product) {
    setEditing(p);
    const unit = p.unit || "each";
    const category = p.category || "";
    setForm({ name: p.name, sku: p.sku || "", barcode: p.barcode || "", category, costPrice: p.costPrice, sellPrice: p.sellPrice, taxRate: p.taxRate, quantity: p.quantity, reorderLevel: p.reorderLevel, imageUrl: p.imageUrl || "", unit });
    setCustomUnit(!UNIT_OPTIONS.includes(unit));
    setCustomCategory(!!category && !categories.some((c) => c.name === category));
    setError(null);
    setImageError(null);
    setShowForm(true);
  }

  async function onImageSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 480, 0.72);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch {
      setImageError("Couldn't read that image — try a different file.");
    } finally {
      e.target.value = "";
    }
  }

  async function submit() {
    setError(null);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        category: form.category || undefined,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice),
        taxRate: Number(form.taxRate) || 0,
        quantity: Number(form.quantity) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        imageUrl: form.imageUrl || undefined,
        unit: form.unit || "each",
      };
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save product");
    }
  }

  async function remove(id: string) {
    if (!confirm("Deactivate this product?")) return;
    await api.del(`/products/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Products</h2>
        <button className="btn btn-primary" onClick={openNew}>+ New Product</button>
      </div>

      {categoryFilterOptions.length > 0 && (
        <div className="field" style={{ maxWidth: 260, marginBottom: 14 }}>
          <label>Filter by category</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {categoryFilterOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th></th><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="thumb" />
                  ) : (
                    <div className="thumb thumb-placeholder">{p.name.charAt(0).toUpperCase()}</div>
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.sku || "—"}</td>
                <td>{p.category || "—"}</td>
                <td>{money(p.sellPrice, business?.currency)}</td>
                <td>
                  {qtyLabel(p.quantity, p.unit)}
                  {Number(p.quantity) <= Number(p.reorderLevel) && <span className="badge badge-amber" style={{ marginLeft: 6 }}>Low</span>}
                </td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>{" "}<button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <p className="muted" style={{ padding: 12 }}>No products yet — add your first one.</p>}
        {!!products.length && !visibleProducts.length && <p className="muted" style={{ padding: 12 }}>No products in this category.</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit Product" : "New Product"}</h3>

            <div className="field">
              <label>Product photo</label>
              <div className="gap-8" style={{ alignItems: "center" }}>
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Preview" className="thumb thumb-lg" />
                ) : (
                  <div className="thumb thumb-lg thumb-placeholder">{form.name ? form.name.charAt(0).toUpperCase() : "?"}</div>
                )}
                <div>
                  <input type="file" accept="image/*" onChange={onImageSelected} />
                  {form.imageUrl && (
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, imageUrl: "" })}>
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
              {imageError && <div className="error-text">{imageError}</div>}
            </div>

            <div className="field"><label>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="field"><label>Barcode</label><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div className="field">
              <label>Category</label>
              <select
                value={customCategory ? "__custom__" : form.category}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") { setCustomCategory(true); setForm({ ...form, category: "" }); }
                  else { setCustomCategory(false); setForm({ ...form, category: v }); }
                }}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {customCategory && (
                <input style={{ marginTop: 6 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Type a category name" />
              )}
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Manage the category list from the Categories tab.
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Cost price</label><input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
              <div className="field"><label>Sell price *</label><input type="number" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} /></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Tax rate (%)</label><input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></div>
              <div className="field"><label>Reorder level</label><input type="number" step="any" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
            </div>
            <div className="field">
              <label>Unit of measure</label>
              <select
                value={customUnit ? "__custom__" : form.unit}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") { setCustomUnit(true); setForm({ ...form, unit: "" }); }
                  else { setCustomUnit(false); setForm({ ...form, unit: v }); }
                }}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u === "each" ? "Each (default)" : u}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
              {customUnit && (
                <input style={{ marginTop: 6 }} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. bottle, roll, sheet" />
              )}
              <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                Sell by weight or volume? Use kg, g, L or ml to allow decimal quantities like 0.5.
              </div>
            </div>
            {!editing && <div className="field"><label>Opening stock{form.unit && form.unit !== "each" ? ` (${form.unit})` : ""}</label><input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>}
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submit}>Save</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
