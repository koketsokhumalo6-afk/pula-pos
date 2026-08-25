import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { money, dateTime } from "../lib/format";
import { buildReceiptPdf, type ReceiptBusiness, type ReceiptData } from "../lib/receipt";

const WIDTH_KEY = "pula_receipt_width";

/** Remembers the cashier's printer width per-browser (each terminal is its
 * own browser/device, and different terminals may have different printers
 * attached), rather than a single business-wide setting. */
function loadWidth(): "58" | "80" {
  return localStorage.getItem(WIDTH_KEY) === "58" ? "58" : "80";
}

/** A printable/downloadable receipt for one completed sale. Shown as a modal
 * both right after checkout (built from the cart still in memory) and from
 * Sales history when reprinting an older sale (built from a fetched Sale).
 * `allowVoid` additionally offers a Void action — used from the POS screen
 * so a sale can be voided right after ringing it up without leaving the
 * register. A cashier triggering it must supply a manager/admin/owner's own
 * password, verified server-side (see POST /sales/:id/void) — the cashier's
 * own session never changes. */
export function Receipt({
  sale,
  onClose,
  allowVoid,
  onVoided,
}: {
  sale: ReceiptData;
  onClose: () => void;
  allowVoid?: boolean;
  onVoided?: () => void;
}) {
  const { user } = useAuth();
  const [business, setBusiness] = useState<ReceiptBusiness | null>(null);
  const [width, setWidth] = useState<"58" | "80">(loadWidth);
  const [generating, setGenerating] = useState(false);

  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  const needsApproval = user?.role === "CASHIER";

  useEffect(() => {
    api.get<ReceiptBusiness>("/business").then(setBusiness).catch(() => {});
  }, []);

  function changeWidth(w: "58" | "80") {
    setWidth(w);
    localStorage.setItem(WIDTH_KEY, w);
  }

  async function downloadPdf() {
    setGenerating(true);
    try {
      const doc = await buildReceiptPdf(sale, business, Number(width) as 58 | 80);
      doc.save(`Receipt-${sale.saleNumber}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  function openVoid() {
    setVoiding(true);
    setVoidReason("");
    setApproverEmail("");
    setApproverPassword("");
    setVoidError(null);
  }

  async function submitVoid() {
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
      await api.post(`/sales/${sale.id}/void`, {
        reason: voidReason.trim(),
        ...(needsApproval ? { approverEmail: approverEmail.trim(), approverPassword } : {}),
      });
      setVoiding(false);
      onVoided?.();
    } catch (err) {
      setVoidError(err instanceof ApiRequestError ? err.message : "Failed to void sale");
    } finally {
      setVoidSubmitting(false);
    }
  }

  const displayName = business?.tradingName || business?.name || "";
  const currency = business?.currency;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        {/* Sets the printed page size to match the selected thermal paper —
            80mm and 58mm printers otherwise print onto whatever the browser's
            default page size is, which cuts the receipt off or wastes paper. */}
        <style>{`@media print { @page { size: ${width}mm auto; margin: 0; } }`}</style>

        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Receipt</h3>
          <div className="gap-8" style={{ alignItems: "center" }}>
            <label style={{ margin: 0 }}>Paper</label>
            <select style={{ width: 100 }} value={width} onChange={(e) => changeWidth(e.target.value as "58" | "80")}>
              <option value="58">58mm</option>
              <option value="80">80mm</option>
            </select>
          </div>
        </div>

        {sale.pending && (
          <div className="banner banner-warning" style={{ marginBottom: 12, borderRadius: 6 }}>
            Saved offline — this sale hasn't synced to the server yet. Its sale number will update automatically once
            it does.
          </div>
        )}

        <div className={`receipt-printable receipt-${width}`}>
          {business?.logoUrl && <img src={business.logoUrl} alt="" className="receipt-logo" />}
          {displayName && <div className="receipt-center receipt-bold">{displayName}</div>}
          {business?.address && <div className="receipt-center">{business.address}</div>}
          {business?.phone && <div className="receipt-center">{business.phone}</div>}
          <div className="receipt-divider" />
          <div>Sale #: {sale.saleNumber}</div>
          <div>{dateTime(sale.createdAt)}</div>
          <div>Cashier: {sale.cashierName}</div>
          <div>Customer: {sale.customerName || "Walk-in"}</div>
          <div className="receipt-divider" />
          {sale.items.map((it, i) => (
            <div key={i} className="receipt-item">
              <div>{it.name}</div>
              <div className="receipt-row">
                <span>{it.unit && it.unit !== "each" ? `${it.quantity} ${it.unit}` : it.quantity} x {money(it.unitPrice, currency)}</span>
                <span>{money(it.total, currency)}</span>
              </div>
            </div>
          ))}
          <div className="receipt-divider" />
          <div className="receipt-row"><span>Subtotal</span><span>{money(sale.subtotal, currency)}</span></div>
          {sale.discountTotal > 0 && <div className="receipt-row"><span>Discount</span><span>-{money(sale.discountTotal, currency)}</span></div>}
          {sale.taxTotal > 0 && <div className="receipt-row"><span>Tax</span><span>{money(sale.taxTotal, currency)}</span></div>}
          <div className="receipt-row receipt-bold"><span>TOTAL</span><span>{money(sale.total, currency)}</span></div>
          <div className="receipt-row"><span>Paid ({sale.paymentMethod.replace("_", " ")})</span><span>{money(sale.amountPaid, currency)}</span></div>
          {sale.total > sale.amountPaid && (
            <div className="receipt-row receipt-bold"><span>Balance Owing</span><span>{money(sale.total - sale.amountPaid, currency)}</span></div>
          )}
          {sale.changeDue > 0 && <div className="receipt-row"><span>Change</span><span>{money(sale.changeDue, currency)}</span></div>}
          <div className="receipt-divider" />
          <div className="receipt-center">Thank you for your business!</div>
        </div>

        <div className="gap-8" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
          <button className="btn btn-secondary" onClick={downloadPdf} disabled={generating}>
            {generating ? "Preparing…" : "Download PDF"}
          </button>
          {allowVoid && !voiding && !sale.pending && (
            <button className="btn btn-danger" onClick={openVoid}>Void Sale</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        {voiding && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <h4 style={{ margin: "0 0 8px" }}>Void this sale</h4>
            <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
              This restocks the items and marks the sale voided. It can't be undone.
            </p>
            <div className="field">
              <label>Reason *</label>
              <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. entered by mistake, customer walked away" />
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
              <button className="btn btn-danger" onClick={submitVoid} disabled={voidSubmitting}>
                {voidSubmitting ? "Voiding…" : "Confirm Void"}
              </button>
              <button className="btn btn-secondary" onClick={() => setVoiding(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
