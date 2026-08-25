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

const LAYBUY_PAYMENT_METHODS = ["CASH", "CARD", "MOBILE_MONEY", "ORANGE_MONEY", "MYZAKA", "SMEGA", "BANK_TRANSFER"];

interface Sale {
  id: string;
  saleNumber: string;
  total: string;
  amountPaid: string;
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

interface LaybuyDetail {
  id: string;
  saleNumber: string;
  status: string;
  total: string;
  amountPaid: string;
  customer: { name: string } | null;
  laybuyPayments: { id: string; amount: string; paymentMethod: string; createdAt: string }[];
}

export function SalesPage() {
  const { business, user } = useAuth();
  const canVoid = !!user && CAN_VOID_ROLES.includes(user.role);
  const needsApproval = user?.role === "CASHIER";

  const [tab, setTab] = useState<"sales" | "laybuys">("sales");
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Laybuy management modal — record payments, complete (hand over), or cancel.
  const [managingId, setManagingId] = useState<string | null>(null);
  const [laybuyDetail, setLaybuyDetail] = useState<LaybuyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [laybuyPaymentMethod, setLaybuyPaymentMethod] = useState("CASH");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelApproverEmail, setCancelApproverEmail] = useState("");
  const [cancelApproverPassword, setCancelApproverPassword] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Sale[]>("/sales").then(setSales).catch(() => {});
  }

  const visibleSales = tab === "laybuys" ? sales.filter((s) => s.status === "HELD") : sales.filter((s) => s.status !== "HELD");
  const laybuyCount = sales.filter((s) => s.status === "HELD").length;

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

  function openManage(saleId: string) {
    setManagingId(saleId);
    setPaymentAmount("");
    setLaybuyPaymentMethod("CASH");
    setPaymentError(null);
    setCompleteError(null);
    setCancelling(false);
    setCancelReason("");
    setCancelApproverEmail("");
    setCancelApproverPassword("");
    setCancelError(null);
    loadDetail(saleId);
  }

  function loadDetail(saleId: string) {
    setLoadingDetail(true);
    api
      .get<LaybuyDetail>(`/sales/${saleId}`)
      .then(setLaybuyDetail)
      .catch(() => setLaybuyDetail(null))
      .finally(() => setLoadingDetail(false));
  }

  function closeManage() {
    setManagingId(null);
    setLaybuyDetail(null);
  }

  async function recordPayment() {
    if (!managingId) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) { setPaymentError("Enter a payment amount"); return; }
    setPaymentError(null);
    setRecordingPayment(true);
    try {
      await api.post(`/sales/${managingId}/laybuy-payment`, { amount, paymentMethod: laybuyPaymentMethod });
      setPaymentAmount("");
      loadDetail(managingId);
      load();
    } catch (err) {
      setPaymentError(err instanceof ApiRequestError ? err.message : "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function completeLaybuy() {
    if (!managingId) return;
    setCompleteError(null);
    setCompleting(true);
    try {
      await api.post(`/sales/${managingId}/complete-laybuy`, {});
      closeManage();
      load();
    } catch (err) {
      setCompleteError(err instanceof ApiRequestError ? err.message : "Failed to complete laybuy");
    } finally {
      setCompleting(false);
    }
  }

  async function submitCancel() {
    if (!managingId) return;
    if (!cancelReason.trim()) { setCancelError("A reason is required"); return; }
    if (needsApproval && (!cancelApproverEmail.trim() || !cancelApproverPassword)) {
      setCancelError("A manager, admin, or owner needs to approve this — enter their email and password.");
      return;
    }
    setCancelError(null);
    setCancelSubmitting(true);
    try {
      await api.post(`/sales/${managingId}/void`, {
        reason: cancelReason.trim(),
        ...(needsApproval ? { approverEmail: cancelApproverEmail.trim(), approverPassword: cancelApproverPassword } : {}),
      });
      closeManage();
      load();
    } catch (err) {
      setCancelError(err instanceof ApiRequestError ? err.message : "Failed to cancel laybuy");
    } finally {
      setCancelSubmitting(false);
    }
  }

  const detailBalance = laybuyDetail ? Math.max(0, Number(laybuyDetail.total) - Number(laybuyDetail.amountPaid)) : 0;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Sales</h2>

      <div className="gap-8" style={{ marginBottom: 14 }}>
        <button className={`btn ${tab === "sales" ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setTab("sales")}>
          Sales
        </button>
        <button className={`btn ${tab === "laybuys" ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setTab("laybuys")}>
          Laybuys{laybuyCount ? ` (${laybuyCount})` : ""}
        </button>
      </div>

      {tab === "sales" && (
        <div className="card">
          <table>
            <thead><tr><th>Sale #</th><th>Cashier</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {visibleSales.map((s) => (
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
          {!visibleSales.length && <p className="muted" style={{ padding: 12 }}>No sales recorded yet.</p>}
        </div>
      )}

      {tab === "laybuys" && (
        <div className="card">
          <table>
            <thead><tr><th>Sale #</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Started</th><th></th></tr></thead>
            <tbody>
              {visibleSales.map((s) => {
                const balance = Math.max(0, Number(s.total) - Number(s.amountPaid));
                return (
                  <tr key={s.id}>
                    <td>{s.saleNumber}</td>
                    <td>{s.customer?.name || "—"}</td>
                    <td>{money(s.total, business?.currency)}</td>
                    <td>{money(s.amountPaid, business?.currency)}</td>
                    <td>{money(balance, business?.currency)}</td>
                    <td>{dateTime(s.createdAt)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openManage(s.id)}>Manage</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleSales.length && <p className="muted" style={{ padding: 12 }}>No open laybuys. Start one from the Point of Sale screen.</p>}
        </div>
      )}

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

      {managingId && (
        <div className="modal-overlay" onClick={closeManage}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {loadingDetail && <p className="muted">Loading…</p>}
            {!loadingDetail && laybuyDetail && (
              <>
                <h3 style={{ marginTop: 0 }}>Laybuy {laybuyDetail.saleNumber}</h3>
                <p className="muted" style={{ marginTop: -6 }}>{laybuyDetail.customer?.name || "Walk-in"}</p>

                <div style={{ fontSize: 13, marginBottom: 12 }}>
                  <div className="flex-between"><span>Total</span><span>{money(laybuyDetail.total, business?.currency)}</span></div>
                  <div className="flex-between"><span>Paid so far</span><span>{money(laybuyDetail.amountPaid, business?.currency)}</span></div>
                  <div className="flex-between" style={{ fontWeight: 700 }}><span>Balance</span><span>{money(detailBalance, business?.currency)}</span></div>
                </div>

                {laybuyDetail.laybuyPayments.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Payment history</div>
                    <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 13 }}>
                      {laybuyDetail.laybuyPayments.map((p) => (
                        <div key={p.id} className="flex-between" style={{ padding: "4px 0" }}>
                          <span>{dateTime(p.createdAt)} · {p.paymentMethod.replace("_", " ")}</span>
                          <span>{money(p.amount, business?.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {laybuyDetail.status === "HELD" && !cancelling && (
                  <>
                    <div className="field">
                      <label>Record a payment</label>
                      <div className="gap-8">
                        <input
                          type="number"
                          min={0}
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <select value={laybuyPaymentMethod} onChange={(e) => setLaybuyPaymentMethod(e.target.value)} style={{ width: 150 }}>
                          {LAYBUY_PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>{m.replace("_", " ")}</option>
                          ))}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={recordPayment} disabled={recordingPayment}>
                          {recordingPayment ? "Recording…" : "Add"}
                        </button>
                      </div>
                      {paymentError && <div className="error-text">{paymentError}</div>}
                    </div>

                    <div className="gap-8" style={{ marginTop: 14 }}>
                      <button className="btn btn-primary" onClick={completeLaybuy} disabled={completing || detailBalance > 0}>
                        {completing ? "Completing…" : "Complete / Hand Over"}
                      </button>
                      <button className="btn btn-danger" onClick={() => setCancelling(true)}>Cancel Laybuy</button>
                      <button className="btn btn-secondary" onClick={closeManage}>Close</button>
                    </div>
                    {completeError && <div className="error-text" style={{ marginTop: 8 }}>{completeError}</div>}
                    {detailBalance > 0 && (
                      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Must be fully paid before it can be handed over — {money(detailBalance, business?.currency)} still owing.
                      </p>
                    )}
                  </>
                )}

                {laybuyDetail.status === "HELD" && cancelling && (
                  <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                    <h4 style={{ margin: "0 0 8px" }}>Cancel this laybuy</h4>
                    <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
                      This restocks the items and marks it voided. It can't be undone.
                    </p>
                    <div className="field">
                      <label>Reason *</label>
                      <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. customer no longer wants it" />
                    </div>
                    {needsApproval && (
                      <>
                        <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
                          A manager, admin, or owner needs to approve this — enter their own login.
                        </p>
                        <div className="field">
                          <label>Manager/Admin/Owner email *</label>
                          <input value={cancelApproverEmail} onChange={(e) => setCancelApproverEmail(e.target.value)} placeholder="their email" />
                        </div>
                        <div className="field">
                          <label>Their password *</label>
                          <input type="password" value={cancelApproverPassword} onChange={(e) => setCancelApproverPassword(e.target.value)} />
                        </div>
                      </>
                    )}
                    {cancelError && <div className="error-text">{cancelError}</div>}
                    <div className="gap-8" style={{ marginTop: 10 }}>
                      <button className="btn btn-danger" onClick={submitCancel} disabled={cancelSubmitting}>
                        {cancelSubmitting ? "Cancelling…" : "Confirm Cancel"}
                      </button>
                      <button className="btn btn-secondary" onClick={() => setCancelling(false)}>Back</button>
                    </div>
                  </div>
                )}

                {laybuyDetail.status !== "HELD" && (
                  <>
                    <p className="muted">This laybuy is now {laybuyDetail.status.toLowerCase()}.</p>
                    <button className="btn btn-secondary" onClick={closeManage}>Close</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
