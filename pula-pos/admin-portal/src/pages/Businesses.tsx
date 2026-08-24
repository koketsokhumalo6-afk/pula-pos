import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";

interface Plan { id: string; name: string; code: string; }
interface Business {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  license: { status: string; expiryDate: string | null; plan: Plan } | null;
  _count: { users: number };
}

const empty = {
  name: "", tradingName: "", email: "", phone: "", address: "",
  ownerName: "", ownerEmail: "", ownerPassword: "", planId: "",
};

export function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    api.get<Plan[]>("/admin/plans").then(setPlans).catch(() => {});
  }, []);

  function load(query?: string) {
    api.get<Business[]>(`/admin/businesses${query ? `?q=${encodeURIComponent(query)}` : ""}`).then(setBusinesses).catch(() => {});
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await api.post("/admin/businesses", {
        ...form,
        planId: form.planId,
        activateNow: true,
      });
      setShowForm(false);
      setForm(empty);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to create business");
    } finally {
      setSaving(false);
    }
  }

  function statusBadge(b: Business) {
    if (!b.license) return <span className="badge badge-gray">No license</span>;
    const cls = b.license.status === "ACTIVE" ? "badge-green" : b.license.status === "PENDING" ? "badge-amber" : "badge-red";
    return <span className={`badge ${cls}`}>{b.license.status}</span>;
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Businesses</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Business</button>
      </div>

      <input
        placeholder="Search businesses…"
        style={{ maxWidth: 320, marginBottom: 14 }}
        value={q}
        onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
      />

      <div className="card">
        <table>
          <thead><tr><th>Business</th><th>Email</th><th>Plan</th><th>License</th><th>Expires</th><th>Users</th><th></th></tr></thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.email}</td>
                <td>{b.license?.plan.name || "—"}</td>
                <td>{statusBadge(b)}</td>
                <td>{b.license?.expiryDate ? new Date(b.license.expiryDate).toLocaleDateString() : "—"}</td>
                <td>{b._count.users}</td>
                <td><Link className="btn btn-secondary btn-sm" to={`/businesses/${b.id}`}>Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!businesses.length && <p className="muted" style={{ padding: 12 }}>No businesses yet — create the first one.</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3>New Business</h3>
            <div className="field"><label>Business name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Business email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field">
              <label>Plan *</label>
              <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                <option value="">Select plan…</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid var(--border)" }} />
            <p className="muted" style={{ marginTop: 0 }}>Owner login (given to the customer)</p>
            <div className="field"><label>Owner name *</label><input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
            <div className="field"><label>Owner email *</label><input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} /></div>
            <div className="field"><label>Temporary password *</label><input value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} /></div>
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create Business"}</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
