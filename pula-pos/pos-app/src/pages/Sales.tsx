import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Receipt } from "../components/Receipt";
import type { ReceiptData } from "../lib/receipt";

// Voiding a sale erases its effect on the books and restocks the items — a
// cashier who could void their own sales could ring one up, pocket the
// cash, then void it to cover the shortfall. So it's owner/admin/manager
// only, matching the backend's requireRole check on POST /sales/:id/void.
const CAN_VOID_ROLES = ["OWNER", "ADMIN", "MANAGER"];

interface Sale {
  id: string;
  saleNumber: string;
  total: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customer: { name: string } | null;
  cashier: { name: string };
  items: { id: string }[];
}

interface SaleDetail {
  saleNumber: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  changeDue: string;
  customer: { name: string } | null;
  cashier: { name: string };
  items: { quantity: string; unitPrice: string; product: { name: string; unit: string } }[];
}

export function SalesPage() {
  const { business, user } = useAuth();
  const canVoid = !!user && CAN_VOID_ROLES.includes(user.role);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Sale[]>("/sales").then(setSales).catch(() => {});
  }

  function openVoid(s: Sale) {
    setVoiding(s);
    setVoidReason("");
    setVoidError(null);
  }

  async function submitVoid() {
    if (!voiding) return;
    if (!voidReason.trim()) { setVoidError("A reason is required"); return; }
    setVoidError(null);
    setVoidSubmitting(true);
    try {
      await api.post(`/sales/${voiding.id}/void`, { reason: voidReason.trim() });
      setVoiding(null);
      load();
    } catch (err) {
      setVoidError(err instanceof ApiRequestError ? err.message : "Failed to void sale");
    } finally {
      setVoidSubmitting(false);
    }
  }

  async function viewReceipt(id: string) {
    setLoadingReceiptId(id);
    try {
      const sale = await api.get<SaleDetail>(`/sales/${id}`);
      setReceiptSale({
        id,
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt,
        cashierName: sale.cashier?.name || "",
        customerName: sale.customer?.name || null,
        paymentMethod: sale.paymentMethod,
        items: sale.items.map((it) => ({
          name: it.product.name,
          unit: it.product.unit,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          total: Number(it.unitPrice) * Number(it.quantity),
        })),
        subtotal: Number(sale.subtotal),
        discountTotal: Number(sale.discountTotal),
        taxTotal: Number(sale.taxTotal),
        total: Number(sale.total),
        amountPaid: Number(sale.amountPaid),
        changeDue: Number(sale.changeDue),
      });
    } catch {
      /* ignore — the row's data still shows on the page even if the receipt fetch fails */
    } finally {
      setLoadingReceiptId(null);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Sales</h2>
      <div className="card">
        <table>
          <thead><tr><th>Sale #</th><th>Cashier</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.saleNumber}</td>
                <td>{s.cashier?.name}</td>
                <td>{s.customer?.name || "Walk-in"}</td>
                <td>{s.items.length}</td>
                <td>{s.paymentMethod.replace("_", " ")}</td>
                <td>{money(s.total, business?.currency)}</td>
                <td><span className={`badge ${s.status === "COMPLETED" ? "badge-green" : "badge-red"}`}>{s.status}</span></td>
                <td>{dateTime(s.createdAt)}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => viewReceipt(s.id)} disabled={loadingReceiptId === s.id}>
                    {loadingReceiptId === s.id ? "Loading…" : "Receipt"}
                  </button>{" "}
                  {canVoid && s.status === "COMPLETED" && (
                    <button className="btn btn-danger btn-sm" onClick={() => openVoid(s)}>Void</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && <p className="muted" style={{ padding: 12 }}>No sales recorded yet.</p>}
      </div>

      {receiptSale && <Receipt sale={receiptSale} onClose={() => setReceiptSale(null)} />}

      {voiding && (
        <div className="modal-overlay" onClick={() => setVoiding(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Void sale {voiding.saleNumber}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              This restocks the items and marks the sale voided. It can't be undone.
            </p>
            <div className="field">
              <label>Reason *</label>
              <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. entered by mistake, customer walked away" />
            </div>
            {voidError && <div className="error-text">{voidError}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-danger" onClick={submitVoid} disabled={voidSubmitting}>
                {voidSubmitting ? "Voiding…" : "Void Sale"}
              </button>
              <button className="btn btn-secondary" onClick={() => setVoiding(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
