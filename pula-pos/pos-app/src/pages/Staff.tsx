import { useState } from "react";
import { SimpleCrudPage } from "../components/SimpleCrudPage";
import { api, ApiRequestError } from "../lib/api";

interface Staff { id: string; name: string; email: string; role: string; status: string; }

export function StaffPage() {
  const [generated, setGenerated] = useState<{ name: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function generatePassword(row: Staff) {
    if (!confirm(`Generate a new password for ${row.name}? Their current password will stop working immediately.`)) return;
    setError(null);
    setBusyId(row.id);
    try {
      const res = await api.post<{ password: string }>(`/staff/${row.id}/generate-password`, {});
      setGenerated({ name: row.name, password: res.password });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to generate password");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <SimpleCrudPage<Staff>
        title="Staff"
        endpoint="/staff"
        fields={[
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "password", label: "Temporary password", required: true },
          { name: "role", label: "Role", type: "select", required: true, options: [
            { value: "ADMIN", label: "Admin" },
            { value: "MANAGER", label: "Manager" },
            { value: "CASHIER", label: "Cashier" },
          ] },
        ]}
        columns={[
          { header: "Name", render: (s) => s.name },
          { header: "Email", render: (s) => s.email },
          { header: "Role", render: (s) => <span className="badge badge-green">{s.role}</span> },
          { header: "Status", render: (s) => <span className={`badge ${s.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>{s.status}</span> },
        ]}
        emptyLabel="No staff added yet."
        renderRowActions={(row) => (
          <button className="btn btn-secondary btn-sm" onClick={() => generatePassword(row)} disabled={busyId === row.id}>
            {busyId === row.id ? "Generating…" : "Generate Password"}
          </button>
        )}
      />
      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

      {generated && (
        <div className="modal-overlay" onClick={() => setGenerated(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New password for {generated.name}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              Copy this now — it won't be shown again. Share it with {generated.name} directly; they'll use it to log in.
            </p>
            <div className="field">
              <input
                value={generated.password}
                readOnly
                onFocus={(e) => e.target.select()}
                style={{ fontFamily: "monospace", fontSize: 16, textAlign: "center" }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setGenerated(null)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
