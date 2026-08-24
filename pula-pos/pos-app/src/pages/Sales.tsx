import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";

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

export function SalesPage() {
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    api.get<Sale[]>("/sales").then(setSales).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Sales</h2>
      <div className="card">
        <table>
          <thead><tr><th>Sale #</th><th>Cashier</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
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
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && <p className="muted" style={{ padding: 12 }}>No sales recorded yet.</p>}
      </div>
    </div>
  );
}
