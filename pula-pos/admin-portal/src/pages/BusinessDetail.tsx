import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";

interface Plan { id: string; name: string; }
interface LicenseEvent { id: string; type: string; detail: string | null; actor: string | null; createdAt: string; }
interface License {
  id: string; licenseKey: string; status: string; activationDate: string | null; expiryDate: string | null;
  maxUsers: number; maxTerminals: number; plan: Plan; history: LicenseEvent[];
}
interface User { id: string; name: string; email: string; role: string; status: string; }
interface Business {
  id: string; name: string; email: string; phone: string | null; status: string;
  license: License | null; users: User[];
}

export function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState("12");
  const [days, setDays] = useState("30");

  useEffect(() => { load(); }, [id]);
  function load() { api.get<Business>(`/admin/businesses/${id}`).then(setBusiness).catch(() => {}); }

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed");
    }
  }

  if (!business) return <p className="muted">Loading…</p>;
  const license = business.license;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{business.name}</h2>
      <p className="muted">{business.email} {business.phone ? `· ${business.phone}` : ""}</p>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>License</h3>
          {license ? (
            <>
              <p><strong>Key:</strong> {license.licenseKey}</p>
              <p><strong>Plan:</strong> {license.plan.name}</p>
              <p><strong>Status:</strong> <span className={`badge ${license.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{license.status}</span></p>
              <p><strong>Activated:</strong> {license.activationDate ? new Date(license.activationDate).toLocaleDateString() : "—"}</p>
              <p><strong>Expires:</strong> {license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : "—"}</p>
              <p><strong>Limits:</strong> {license.maxUsers} users · {license.maxTerminals} terminals</p>

              <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid var(--border)" }} />

              {license.status === "PENDING" && (
                <button className="btn btn-primary" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/activate`))}>Activate (12 months)</button>
              )}

              <div className="gap-8" style={{ marginTop: 10, alignItems: "flex-end" }}>
                <div className="field" style={{ marginBottom: 0, width: 100 }}>
                  <label>Months</label>
                  <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/renew`, { months: Number(months) }))}>Renew</button>
              </div>

              <div className="gap-8" style={{ marginTop: 10, alignItems: "flex-end" }}>
                <div className="field" style={{ marginBottom: 0, width: 100 }}>
                  <label>Days</label>
                  <input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
                </div>
                <button className="btn btn-secondary" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/extend`, { days: Number(days) }))}>Extend expiry</button>
              </div>

              <div className="gap-8" style={{ marginTop: 14 }}>
                {license.status !== "SUSPENDED" ? (
                  <button className="btn btn-danger" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/suspend`, {}))}>Suspend</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/reinstate`, {}))}>Reinstate</button>
                )}
                <button className="btn btn-danger" onClick={() => act(() => api.post(`/admin/licenses/${license.id}/cancel`, {}))}>Cancel license</button>
              </div>
              {error && <div className="error-text">{error}</div>}
            </>
          ) : (
            <p className="muted">No license on this business.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Business status</h3>
          <p><span className={`badge ${business.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{business.status}</span></p>
          <div className="gap-8">
            {business.status !== "SUSPENDED" ? (
              <button className="btn btn-danger" onClick={() => act(() => api.patch(`/admin/businesses/${business.id}`, { status: "SUSPENDED" }))}>Suspend business</button>
            ) : (
              <button className="btn btn-primary" onClick={() => act(() => api.patch(`/admin/businesses/${business.id}`, { status: "ACTIVE" }))}>Reactivate business</button>
            )}
          </div>

          <h3>Staff ({business.users.length})</h3>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {business.users.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {license && license.history.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>License history</h3>
          <table>
            <thead><tr><th>Event</th><th>Detail</th><th>Date</th></tr></thead>
            <tbody>
              {license.history.map((h) => (
                <tr key={h.id}><td>{h.type}</td><td>{h.detail}</td><td>{new Date(h.createdAt).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
