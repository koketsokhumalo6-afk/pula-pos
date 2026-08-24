import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";

interface Shift {
  id: string;
  openingBalance: string;
  closingBalance: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  cashier: { name: string };
}

export function ShiftsPage() {
  const { business } = useAuth();
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [cashType, setCashType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Shift | null>("/shifts/current").then(setCurrent).catch(() => {});
    api.get<Shift[]>("/shifts").then(setHistory).catch(() => {});
  }

  async function openShift() {
    setError(null);
    try {
      await api.post("/shifts/open", { openingBalance: Number(openingBalance) || 0 });
      setOpeningBalance("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to open shift");
    }
  }

  async function closeShift() {
    if (!current) return;
    setError(null);
    try {
      await api.post(`/shifts/${current.id}/close`, { closingBalance: Number(closingBalance) || 0 });
      setClosingBalance("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to close shift");
    }
  }

  async function recordCash() {
    if (!current) return;
    setError(null);
    try {
      await api.post("/shifts/cash-movement", { shiftId: current.id, type: cashType, amount: Number(cashAmount), reason: cashReason });
      setCashAmount("");
      setCashReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to record cash movement");
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Shifts & Cash Management</h2>

      <div className="card">
        {current ? (
          <div>
            <div className="flex-between">
              <div>
                <strong>Shift open</strong> since {dateTime(current.openedAt)} · Opening float: {money(current.openingBalance, business?.currency)}
              </div>
              <span className="badge badge-green">OPEN</span>
            </div>

            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div>
                <h4>Record cash movement</h4>
                <div className="field">
                  <label>Type</label>
                  <select value={cashType} onChange={(e) => setCashType(e.target.value as any)}>
                    <option value="CASH_IN">Cash in</option>
                    <option value="CASH_OUT">Cash out</option>
                  </select>
                </div>
                <div className="field"><label>Amount</label><input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} /></div>
                <div className="field"><label>Reason</label><input value={cashReason} onChange={(e) => setCashReason(e.target.value)} /></div>
                <button className="btn btn-secondary" onClick={recordCash}>Record</button>
              </div>
              <div>
                <h4>Close shift</h4>
                <div className="field"><label>Counted closing balance</label><input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} /></div>
                <button className="btn btn-primary" onClick={closeShift}>Close Shift</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="muted">No open shift. Start one to begin taking cash sales.</p>
            <div className="field" style={{ maxWidth: 260 }}><label>Opening float</label><input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={openShift}>Open Shift</button>
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Shift history</h3>
        <table>
          <thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th>Opening</th><th>Closing</th><th>Status</th></tr></thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td>{s.cashier?.name}</td>
                <td>{dateTime(s.openedAt)}</td>
                <td>{s.closedAt ? dateTime(s.closedAt) : "—"}</td>
                <td>{money(s.openingBalance, business?.currency)}</td>
                <td>{s.closingBalance ? money(s.closingBalance, business?.currency) : "—"}</td>
                <td><span className={`badge ${s.status === "OPEN" ? "badge-green" : "badge-gray"}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
