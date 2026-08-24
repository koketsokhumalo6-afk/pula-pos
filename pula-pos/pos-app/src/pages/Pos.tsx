import { useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  sellPrice: string;
  taxRate: string;
  quantity: string;
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

export function PosPage() {
  const { business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
    api.get<Customer[]>("/customers").then(setCustomers).catch(() => {});
  }, []);

  function loadProducts(q?: string) {
    api
      .get<Product[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(setProducts)
      .catch(() => {});
  }

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
      const sale = await api.post<{ saleNumber: string }>("/sales", {
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: Number(l.product.sellPrice), discount: l.discount })),
        customerId: customerId || undefined,
        amountPaid: paid || totals.total,
        paymentMethod,
      });
      setSuccess(`Sale ${sale.saleNumber} completed.`);
      setCart([]);
      setAmountPaid("");
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Point of Sale</h2>
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

      <div className="pos-layout">
        <div className="product-grid">
          {products.map((p) => (
            <button key={p.id} className="product-tile" onClick={() => addToCart(p)} disabled={Number(p.quantity) <= 0}>
              <div className="name">{p.name}</div>
              <div className="price">{money(p.sellPrice, business?.currency)}</div>
              <div className="stock">{Number(p.quantity) <= 0 ? "Out of stock" : `${p.quantity} in stock`}</div>
            </button>
          ))}
          {!products.length && <p className="muted">No products found.</p>}
        </div>

        <div className="cart-panel">
          <div className="cart-items">
            {cart.map((line) => (
              <div className="cart-line" key={line.product.id}>
                <div style={{ flex: 1 }}>
                  <div>{line.product.name}</div>
                  <div className="muted">{money(line.product.sellPrice, business?.currency)} each</div>
                </div>
                <input
                  type="number"
                  min={1}
                  style={{ width: 56 }}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.product.id, { quantity: Math.max(1, Number(e.target.value)) })}
                />
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
    </div>
  );
}
