import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface Props<T extends { id: string }> {
  title: string;
  endpoint: string;
  fields: FieldDef[];
  columns: ColumnDef<T>[];
  emptyLabel?: string;
}

/**
 * Generic list + create modal, backed by the tenant-scoped REST CRUD
 * endpoints the backend exposes for secondary modules (suppliers, expenses,
 * invoices, quotations, staff, …). Keeps every module genuinely wired to
 * the API instead of a static mockup.
 */
export function SimpleCrudPage<T extends { id: string }>({ title, endpoint, fields, columns, emptyLabel }: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    api.get<T[]>(endpoint).then(setRows).catch(() => {});
  }

  function openForm() {
    setForm({});
    setError(null);
    setShowForm(true);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (form[f.name] === undefined || form[f.name] === "") continue;
        payload[f.name] = f.type === "number" ? Number(form[f.name]) : form[f.name];
      }
      await api.post(endpoint, payload);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button className="btn btn-primary" onClick={openForm}>+ New</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>{columns.map((c) => <td key={c.header}>{c.render(row)}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted" style={{ padding: 12 }}>{emptyLabel || "Nothing here yet."}</p>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New {title.replace(/s$/, "")}</h3>
            {fields.map((f) => (
              <div className="field" key={f.name}>
                <label>{f.label}{f.required && " *"}</label>
                {f.type === "select" ? (
                  <select value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                    <option value="">Select…</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea rows={3} value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
                ) : (
                  <input
                    type={f.type || "text"}
                    value={form[f.name] || ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {error && <div className="error-text">{error}</div>}
            <div className="gap-8" style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? "Saving…" : "Save"}</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
