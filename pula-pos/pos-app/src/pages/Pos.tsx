import { useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { money, dateTime } from "../lib/format";
import { Receipt } from "../components/Receipt";
import type { ReceiptData } from "../lib/receipt";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  sellPrice: string;
  taxRate: string;
  quantity: string;
  imageUrl: string | null;
  unit: string;
  category: string | null;
}

/** Renders a quantity with its unit, e.g. "12.5 kg" — bare units like "each" are omitted since they're implied. */
function qtyLabel(qty: string | number, unit: string) {
  return unit && unit !== "each" ? `${qty} ${unit}` : `${qty}`;
}

interface Customer {
  id: string;
  name: string;
}

interface CartLine {
  product: Product;
  quantity: number;
  discount: number;
}

const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "MOBILE_MONEY",
  "ORANGE_MONEY",
  "MYZAKA",
  "SMEGA",
  "BANK_TRANSFER",
  "ACCOUNT",
] as const;

// A recent completed sale, as returned by GET /sales — just enough to list
// and pick from when voiding something other than the sale just rung up.
interface RecentSale {
  id: string;
  saleNumber: string;
  total: string;
  status: string;
  createdAt: string;
  cashier: { name: string };
}

export function PosPage() {
  const { business, user } = useAuth();
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [managedCategories, setManagedCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // "Void a Sale" — a standing option on this screen (not just the receipt
  // shown right after checkout) so a sale from earlier in the shift can be
  // voided without leaving the register. Same manager-override rule applies:
  // a cashier must supply a manager/admin/owner's own password to confirm.
  const needsApproval = user?.role === "CASHIER";
  const [showVoidPicker, setShowVoidPicker] = useState(false);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [voidingSale, setVoidingSale] = useState<RecentSale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
    api.get<{ id: string; name: string }[]>("/categories").then(setManagedCategories).catch(() => {});
  }, []);

  function loadProducts(q?: string) {
    api
      .get<Product[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(setProducts)
      .catch(() => {});
  }

  // Tabs combine the managed category list with any category text already
  // in use on a loaded product, so nothing gets left off the shelf.
  const categoryTabs = Array.from(
    new Set([...managedCategories.map((c) => c.name), ...products.map((p) => p.category).filter((c): c is string => !!c)])
  ).sort((a, b) => a.localeCompare(b));
  const visibleProducts = selectedCategory ? products.filter((p) => p.category === selectedCategory) : products;

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    for (const line of cart) {
      const lineSubtotal = Number(line.product.sellPrice) * line.quantity - line.discount;
      const lineTax = lineSubtotal * (Number(line.product.taxRate) / 100);
      subtotal += Number(line.product.sellPrice) * line.quantity;
      discountTotal += line.discount;
      taxTotal += lineTax;
    }
    return { subtotal, taxTotal, discountTotal, total: subtotal - discountTotal + taxTotal };
  }, [cart]);

  const paid = Number(amountPaid) || 0;
  const changeDue = Math.max(0, paid - totals.total);

  async function checkout() {
    if (!cart.length) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const sale = await api.post<{ id: string; saleNumber: string; createdAt: string }>("/sales", {
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: Number(l.product.sellPrice), discount: l.discount })),
        customerId: customerId || undefined,
        amountPaid: paid || totals.total,
        paymentMethod,
      });
      setSuccess(`Sale ${sale.saleNumber} completed.`);
      // Built from the cart still in memory rather than re-fetching — the
      // sale response doesn't include product names, and this data is only
      // needed for the receipt shown immediately after checkout.
      setReceiptSale({
        id: sale.id,
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt,
        cashierName: user?.name || "",
        customerName: customerId ? customers.find((c) => c.id === customerId)?.name || null : null,
        paymentMethod,
        items: cart.map((l) => ({
          name: l.product.name,
          unit: l.product.unit,
          quantity: l.quantity,
          unitPrice: Number(l.product.sellPrice),
          total: Number(l.product.sellPrice) * l.quantity,
        })),
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        amountPaid: paid || totals.total,
        changeDue,
      });
      setCart([]);
      setAmountPaid("");
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openVoidPicker() {
    setShowVoidPicker(true);
    setVoidingSale(null);
    setLoadingRecent(true);
    api
      .get<RecentSale[]>("/sales")
      .then((all) => setRecentSales(all.filter((s) => s.status === "COMPLETED").slice(0, 15)))
      .catch(() => setRecentSales([]))
      .finally(() => setLoadingRecent(false));
  }

  function closeVoidPicker() {
    setShowVoidPicker(false);
    setVoidingSale(null);
  }

  function selectSaleToVoid(s: RecentSale) {
    setVoidingSale(s);
    setVoidReason("");
    setApproverEmail("");
    setApproverPassword("");
    setVoidError(null);
  }

  async function submitVoidFromPicker() {
    if (!voidingSale) return;
    if (!voidReason.trim()) {
      setVoidError("A reason is required");
      return;
    }
    if (needsApproval && (!approverEmail.trim() || !approverPassword)) {
      setVoidError("A manager, admin, or owner needs to approve this — enter their email and password.");
      return;
    }
    setVoidError(null);
    setVoidSubmitting(true);
    try {
      await api.post(`/sales/${voidingSale.id}/void`, {
        reason: voidReason.trim(),
        ...(needsApproval ? { approverEmail: approverEmail.trim(), approverPassword } : {}),
      });
      setShowVoidPicker(false);
      setVoidingSale(null);
      loadProducts();
    } catch (err) {
      setVoidError(err instanceof ApiRequestError ? err.message : "Failed to void sale");
    } finally {
      setVoidSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Point of Sale</h2>
        <div className="gap-8" style={{ alignItems: "center" }}>
          <button className="btn btn-danger btn-sm" onClick={openVoidPicker}>
            Void a Sale
          </button>
          <input
            placeholder="Search product name, SKU or barcode…"
            style={{ width: 320 }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              loadProducts(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="pos-layout">
        <div className="product-panel">
          {categoryTabs.length > 0 && (
            <div className="category-tabs">
              <button className={`category-tab${selectedCategory === "" ? " active" : ""}`} onClick={() => setSelectedCategory("")}>
                All
              </button>
              {categoryTabs.map((c) => (
                <button
                  key={c}
                  className={`category-tab${selectedCategory === c ? " active" : ""}`}
                  onClick={() => setSelectedCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="product-grid">
          {visibleProducts.map((p) => (
            <button key={p.id} className="product-tile" onClick={() => addToCart(p)} disabled={Number(p.quantity) <= 0}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="product-tile-img" />
              ) : (
                <div className="product-tile-img product-tile-img-placeholder">{p.name.charAt(0).toUpperCase()}</div>
              )}
              <div className="name">{p.name}</div>
              <div className="price">{money(p.sellPrice, business?.currency)}</div>
              <div className="stock">{Number(p.quantity) <= 0 ? "Out of stock" : `${qtyLabel(p.quantity, p.unit)} in stock`}</div>
            </button>
          ))}
          {!visibleProducts.length && <p className="muted">No products found.</p>}
          </div>
        </div>

        <div className="cart-panel">
          <div className="cart-items">
            {cart.map((line) => (
              <div className="cart-line" key={line.product.id}>
                <div style={{ flex: 1 }}>
                  <div>{line.product.name}</div>
                  <div className="muted">
                    {money(line.product.sellPrice, business?.currency)}
                    {line.product.unit && line.product.unit !== "each" ? ` / ${line.product.unit}` : " each"}
                  </div>
                </div>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  style={{ width: 64 }}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.product.id, { quantity: Math.max(0.01, Number(e.target.value) || 0.01) })}
                />
                {line.product.unit && line.product.unit !== "each" && (
                  <span className="muted" style={{ fontSize: 11.5, marginLeft: 4 }}>{line.product.unit}</span>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => removeLine(line.product.id)} style={{ marginLeft: 6 }}>
                  ✕
                </button>
              </div>
            ))}
            {!cart.length && <p className="muted">Cart is empty — tap a product to add it.</p>}
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Customer (optional)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Payment method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Amount paid</label>
            <input type="number" min={0} placeholder={totals.total.toFixed(2)} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
          </div>

          <div className="cart-totals">
            <div className="row"><span>Subtotal</span><span>{money(totals.subtotal, business?.currency)}</span></div>
            <div className="row"><span>Discount</span><span>-{money(totals.discountTotal, business?.currency)}</span></div>
            <div className="row"><span>Tax</span><span>{money(totals.taxTotal, business?.currency)}</span></div>
            <div className="row total"><span>Total</span><span>{money(totals.total, business?.currency)}</span></div>
            {paid > 0 && <div className="row"><span>Change due</span><span>{money(changeDue, business?.currency)}</span></div>}
          </div>

          {error && <div className="error-text">{error}</div>}
          {success && <div style={{ color: "#146c43", fontSize: 13, margin: "8px 0" }}>{success}</div>}

          <button className="btn btn-primary" style={{ marginTop: 10, justifyContent: "center" }} disabled={!cart.length || submitting} onClick={checkout}>
            {submitting ? "Processing…" : `Charge ${money(totals.total, business?.currency)}`}
          </button>
        </div>
      </div>

      {receiptSale && (
        <Receipt
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
          allowVoid
          onVoided={() => {
            setReceiptSale(null);
            loadProducts();
          }}
        />
      )}

      {showVoidPicker && (
        <div className="modal-overlay" onClick={closeVoidPicker}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {!voidingSale ? (
              <>
                <h3 style={{ marginTop: 0 }}>Void a Sale</h3>
                <p className="muted" style={{ marginTop: -6 }}>
                  Pick a recent sale to void. This restocks the items and marks the sale voided — it can't be undone.
                </p>
                {loadingRecent && <p className="muted">Loading…</p>}
                {!loadingRecent && !recentSales.length && <p className="muted">No completed sales to void.</p>}
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {recentSales.map((s) => (
                    <div
                      key={s.id}
                      className="flex-between"
                      style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}
                    >
                      <div>
                        <div>{s.saleNumber}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {s.cashier?.name} · {dateTime(s.createdAt)} · {money(s.total, business?.currency)}
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => selectSaleToVoid(s)}>
                        Void
                      </button>
                    </div>
                  ))}
                </div>
                <div className="gap-8" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={closeVoidPicker}>Close</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Void sale {voidingSale.saleNumber}</h3>
                <p className="muted" style={{ marginTop: -6 }}>
                  This restocks the items and marks the sale voided. It can't be undone.
                </p>
                <div className="field">
                  <label>Reason *</label>
                  <input
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="e.g. entered by mistake, customer walked away"
                  />
                </div>
                {needsApproval && (
                  <>
                    <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
                      A manager, admin, or owner needs to approve this — enter their own login.
                    </p>
                    <div className="field">
                      <label>Manager/Admin/Owner email *</label>
                      <input value={approverEmail} onChange={(e) => setApproverEmail(e.target.value)} placeholder="their email" />
                    </div>
                    <div className="field">
                      <label>Their password *</label>
                      <input type="password" value={approverPassword} onChange={(e) => setApproverPassword(e.target.value)} />
                    </div>
                  </>
                )}
                {voidError && <div className="error-text">{voidError}</div>}
                <div className="gap-8" style={{ marginTop: 10 }}>
                  <button className="btn btn-danger" onClick={submitVoidFromPicker} disabled={voidSubmitting}>
                    {voidSubmitting ? "Voiding…" : "Confirm Void"}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setVoidingSale(null)}>Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
