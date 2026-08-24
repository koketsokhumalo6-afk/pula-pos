import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";

interface Plan { id: string; code: string; name: string; maxUsers: number; maxTerminals: number; priceYearly: string; currency: string; isActive: boolean; }

const empty = { code: "STARTER", name: "", maxUsers: "2", maxTerminals: "1", priceYearly: "", currency: "BWP" };

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  function load() { api.get<Plan[]>("/admin/plans").then(setPlans).catch(() => {}); }

  async function submit() {
    setError(null);
    try {
      await api.post("/admin/plans", {
        code: form.code,
        name: form.name,
        maxUsers: Number(form.maxUsers),
        maxTerminals: Number(form.maxTerminals),
        priceYearly: Number(form.priceYearly),
        currency: form.currency,
      });
      setShowForm(false);
      setForm(empty);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save plan");
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Plans</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Plan</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Max users</th><th>Max terminals</th><th>Price / year</th><th>Status</th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.maxUsers}</td>
                <td>{p.maxTerminals}</td>
                <td>{p.currency} {Number(p.priceYearly).toFixed(2)}</td>
                <td><span className={`badge ${p.isActive ? "badge-green" : "badge-gray"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Plan</h3>
            <div className="field">
              <label>Code</label>
              <select value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
                <option value="STARTER">Starter</option>
                <option value="STANDARD">Standard</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div className="field"><label>Display name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>Max users</label><input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} /></div>
              <div className="field"><label>Max terminals</label><input type="number" value={form.maxTerminals} onChange={(e) => setForm({ ...form, maxTerminals: e.target.value })} /></div>
            </div>
            <div className="field"><label>Price per year</label><input type="number" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} /></div>
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
