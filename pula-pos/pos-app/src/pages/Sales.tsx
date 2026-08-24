import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Receipt } from "../components/Receipt";
import type { ReceiptData } from "../lib/receipt";

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
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Sale[]>("/sales").then(setSales).catch(() => {});
  }, []);

  async function viewReceipt(id: string) {
    setLoadingReceiptId(id);
    try {
      const sale = await api.get<SaleDetail>(`/sales/${id}`);
      setReceiptSale({
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
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && <p className="muted" style={{ padding: 12 }}>No sales recorded yet.</p>}
      </div>

      {receiptSale && <Receipt sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
