import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { resizeImageToDataUrl } from "../lib/image";
import { downloadFile } from "../lib/download";
import { parseCsv, csvRowsToObjects } from "../lib/csv";

/* ------------------------------- Icons ---------------------------------- */
/* Small hand-drawn line icons (no external icon library / dependency) so
   the Settings tab reads visually distinct at a glance. */

function IconBusiness() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M4 21V9l4-4 4 4v12" />
      <path d="M12 21V7l4-3 4 3v14" />
      <path d="M8 12h0M8 16h0M16 11h0M16 15h0" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.8 14.2c2.6.4 4.7 2.4 4.7 5.3" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="M7 8.5l2.2 2L7 12.5" />
      <path d="M12 12.5h3" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.8" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
      <path d="M12 14.5v3" />
    </svg>
  );
}

function IconData() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

type Section = "business" | "users" | "terminals" | "data" | "security";

const CARDS: { key: Section; label: string; blurb: string; icon: () => JSX.Element }[] = [
  { key: "business", label: "Business Profile", blurb: "Name, address, tax details", icon: IconBusiness },
  { key: "users", label: "Users & Roles", blurb: "Manage staff accounts", icon: IconUsers },
  { key: "terminals", label: "Terminals", blurb: "POS devices registered", icon: IconTerminal },
  { key: "data", label: "Data Tools", blurb: "Import, export, backup", icon: IconData },
  { key: "security", label: "Password & Security", blurb: "Change your password", icon: IconLock },
];

export function SettingsPage() {
  const [active, setActive] = useState<Section>("business");

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <div className="settings-grid">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const isActive = active === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className="card settings-card"
              style={{
                cursor: "pointer",
                textAlign: "left",
                border: isActive ? "2px solid #146c43" : "1px solid var(--border, #e2e2e2)",
                background: isActive ? "rgba(20,108,67,0.06)" : undefined,
              }}
            >
              <div style={{ color: isActive ? "#146c43" : "#555", marginBottom: 8 }}>
                <Icon />
              </div>
              <div style={{ fontWeight: 700 }}>{c.label}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{c.blurb}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        {active === "business" && <BusinessProfileSection />}
        {active === "users" && <UsersSection />}
        {active === "terminals" && <TerminalsSection />}
        {active === "data" && <DataToolsSection />}
        {active === "security" && <SecuritySection />}
      </div>
    </div>
  );
}

/* --------------------------- Business Profile ---------------------------- */

interface BusinessProfile {
  id: string;
  name: string;
  tradingName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  currency: string;
  logoUrl: string | null;
}

function BusinessProfileSection() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState({ name: "", tradingName: "", phone: "", address: "", taxNumber: "", logoUrl: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    api.get<BusinessProfile>("/business").then((b) => {
      setProfile(b);
      setForm({
        name: b.name,
        tradingName: b.tradingName || "",
        phone: b.phone || "",
        address: b.address || "",
        taxNumber: b.taxNumber || "",
        logoUrl: b.logoUrl || "",
      });
    }).catch(() => {});
  }, []);

  async function onLogoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 320, 0.75);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch {
      setLogoError("Couldn't read that image — try a different file.");
    } finally {
      e.target.value = "";
    }
  }

  async function save() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await api.patch("/business", {
        name: form.name,
        tradingName: form.tradingName || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        taxNumber: form.taxNumber || undefined,
        logoUrl: form.logoUrl || undefined,
      });
      setSuccess("Business profile updated.");
      // Nav sidebar caches the logo — a refresh will pick up the new one immediately.
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="muted">Loading…</p>;

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3 style={{ marginTop: 0 }}>Business Profile</h3>

      <div className="field">
        <label>Company logo</label>
        <div className="gap-8" style={{ alignItems: "center" }}>
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="Logo preview" className="thumb thumb-lg" />
          ) : (
            <div className="thumb thumb-lg thumb-placeholder">{form.name ? form.name.charAt(0).toUpperCase() : "?"}</div>
          )}
          <div>
            <input type="file" accept="image/*" onChange={onLogoSelected} />
            {form.logoUrl && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, logoUrl: "" })}>
                Remove logo
              </button>
            )}
          </div>
        </div>
        {logoError && <div className="error-text">{logoError}</div>}
      </div>

      <div className="field"><label>Business name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label>Trading name</label><input value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} /></div>
      <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="field"><label>Address</label><textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div className="field"><label>Tax number</label><input value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} /></div>
      <div className="field">
        <label>Email (contact us to change)</label>
        <input value={profile.email} disabled />
      </div>
      <div className="field">
        <label>Currency (contact us to change)</label>
        <input value={profile.currency} disabled />
      </div>
      {error && <div className="error-text">{error}</div>}
      {success && <div style={{ color: "#146c43", fontSize: 13, margin: "8px 0" }}>{success}</div>}
      <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

/* -------------------------------- Users ---------------------------------- */

function UsersSection() {
  const { user } = useAuth();
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3 style={{ marginTop: 0 }}>Users & Roles</h3>
      <p className="muted">
        Add staff accounts, set their role (Admin, Manager, Cashier), and manage who can access this business's POS.
      </p>
      <Link to="/staff" className="btn btn-primary" style={{ display: "inline-flex" }}>
        Go to Staff Management
      </Link>
      {user && (
        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          You're signed in as {user.name} ({user.role}).
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Terminals --------------------------------- */

interface Terminal {
  id: string;
  name: string;
  identifier: string;
  isActive: boolean;
}

function TerminalsSection() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);
  function load() { api.get<Terminal[]>("/terminals").then(setTerminals).catch(() => {}); }

  async function addTerminal() {
    if (!name.trim()) { setError("Enter a terminal name"); return; }
    setError(null);
    setAdding(true);
    try {
      await api.post("/terminals", { name: name.trim() });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to add terminal");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this terminal?")) return;
    await api.del(`/terminals/${id}`);
    load();
  }

  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <h3 style={{ marginTop: 0 }}>Terminals</h3>
      <p className="muted" style={{ marginTop: -6 }}>
        Each device or browser tab used to run the POS can be registered as a terminal, subject to your plan's terminal limit.
      </p>

      <table>
        <thead><tr><th>Name</th><th>Identifier</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {terminals.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td><code>{t.identifier}</code></td>
              <td><span className={`badge ${t.isActive ? "badge-green" : "badge-gray"}`}>{t.isActive ? "Active" : "Removed"}</span></td>
              <td>{t.isActive && <button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>Remove</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!terminals.length && <p className="muted" style={{ padding: "8px 0" }}>No terminals registered yet.</p>}

      <div className="gap-8" style={{ marginTop: 14, alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label>New terminal name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Counter" />
        </div>
        <button className="btn btn-primary" onClick={addTerminal} disabled={adding}>{adding ? "Adding…" : "+ Add Terminal"}</button>
      </div>
      {error && <div className="error-text" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}

/* -------------------------------- Security --------------------------------- */

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h3 style={{ marginTop: 0 }}>Password & Security</h3>
      <div className="field"><label>Current password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
      <div className="field"><label>New password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
      <div className="field"><label>Confirm new password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
      {error && <div className="error-text">{error}</div>}
      {success && <div style={{ color: "#146c43", fontSize: 13, margin: "8px 0" }}>{success}</div>}
      <button className="btn btn-primary" onClick={changePassword} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? "Saving…" : "Change Password"}
      </button>
    </div>
  );
}

/* ------------------------------ Data Tools -------------------------------- */

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

function DataToolsSection() {
  const { user, business } = useAuth();

  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const stamp = () => new Date().toISOString().slice(0, 10);

  async function runExport(key: string, path: string, filename: string) {
    setExportError(null);
    setExportingKey(key);
    try {
      await downloadFile(path, filename);
    } catch {
      setExportError("Download failed — please try again.");
    } finally {
      setExportingKey(null);
    }
  }

  function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = csvRowsToObjects(parseCsv(String(reader.result || "")));
        if (!rows.length) {
          setImportError("That file has no data rows.");
          setImportRows(null);
          return;
        }
        setImportRows(rows);
      } catch {
        setImportError("Couldn't read that file as CSV.");
        setImportRows(null);
      }
    };
    reader.onerror = () => setImportError("Couldn't read that file.");
    reader.readAsText(file);
  }

  async function runImport() {
    if (!importRows) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const payload = importRows.map((r) => ({
        name: r.name || r.Name || "",
        sku: r.sku || r.SKU || undefined,
        barcode: r.barcode || r.Barcode || undefined,
        category: r.category || r.Category || undefined,
        unit: r.unit || r.Unit || undefined,
        costPrice: r.costPrice ? Number(r.costPrice) : undefined,
        sellPrice: Number(r.sellPrice || r.sellprice || r.SellPrice || 0),
        taxRate: r.taxRate ? Number(r.taxRate) : undefined,
        quantity: r.quantity ? Number(r.quantity) : undefined,
        reorderLevel: r.reorderLevel ? Number(r.reorderLevel) : undefined,
      }));
      const result = await api.post<ImportResult>("/data-tools/import/products", { rows: payload });
      setImportResult(result);
      setImportRows(null);
      setImportFileName("");
    } catch (err) {
      setImportError(err instanceof ApiRequestError ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function runBackup() {
    setBackupError(null);
    setBackingUp(true);
    try {
      await downloadFile("/data-tools/backup", `pula-pos-backup-${stamp()}.json`);
    } catch {
      setBackupError("Backup download failed — please try again.");
    } finally {
      setBackingUp(false);
    }
  }

  const exportBtn = (key: string, label: string, path: string, filename: string) => (
    <button
      key={key}
      className="btn btn-secondary btn-sm"
      onClick={() => runExport(key, path, filename)}
      disabled={exportingKey === key}
      style={{ marginRight: 8, marginBottom: 8 }}
    >
      {exportingKey === key ? "Preparing…" : `Export ${label}`}
    </button>
  );

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Data Tools</h3>

      <div style={{ marginBottom: 22 }}>
        <h4 style={{ marginBottom: 6 }}>Export</h4>
        <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
          Download your data as CSV files — for accounting, spreadsheet work, or your own records.
        </p>
        <div>
          {exportBtn("products", "Products", "/data-tools/export/products.csv", `products-${stamp()}.csv`)}
          {exportBtn("sales", "Sales", "/data-tools/export/sales.csv", `sales-${stamp()}.csv`)}
          {exportBtn("customers", "Customers", "/data-tools/export/customers.csv", `customers-${stamp()}.csv`)}
          {exportBtn("suppliers", "Suppliers", "/data-tools/export/suppliers.csv", `suppliers-${stamp()}.csv`)}
          {exportBtn("purchases", "Purchases", "/data-tools/export/purchases.csv", `purchases-${stamp()}.csv`)}
        </div>
        {exportError && <div className="error-text">{exportError}</div>}
      </div>

      <div style={{ marginBottom: 22, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
        <h4 style={{ marginBottom: 6 }}>Import Products</h4>
        <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
          Upload a CSV to bulk-add products, or update existing ones by matching SKU. Columns:{" "}
          <code>name, sku, barcode, category, unit, costPrice, sellPrice, taxRate, quantity, reorderLevel</code> — only{" "}
          <code>name</code> and <code>sellPrice</code> are required. Updating an existing SKU changes its details but never
          its stock quantity — use Stock adjustments for that, so every change stays in the audit trail.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFileSelected} />
        {importFileName && importRows && (
          <p className="muted" style={{ marginTop: 8 }}>
            {importFileName}: {importRows.length} row{importRows.length === 1 ? "" : "s"} ready to import.
          </p>
        )}
        {importRows && (
          <button className="btn btn-primary btn-sm" onClick={runImport} disabled={importing} style={{ marginTop: 4 }}>
            {importing ? "Importing…" : `Import ${importRows.length} Product${importRows.length === 1 ? "" : "s"}`}
          </button>
        )}
        {importError && <div className="error-text">{importError}</div>}
        {importResult && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            <div style={{ color: "#146c43" }}>
              {importResult.created} created, {importResult.updated} updated.
            </div>
            {importResult.errors.length > 0 && (
              <div className="error-text" style={{ marginTop: 6 }}>
                {importResult.errors.length} row{importResult.errors.length === 1 ? "" : "s"} skipped:
                <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
                {importResult.errors.length > 10 && <div>…and {importResult.errors.length - 10} more.</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
        <h4 style={{ marginBottom: 6 }}>Backup</h4>
        <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
          Download a full snapshot of {business?.name || "your business"}'s data as a single file — keep it somewhere safe.
          If you ever need it restored, send it to support and it'll be restored directly.
        </p>
        {user?.role === "OWNER" ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={runBackup} disabled={backingUp}>
              {backingUp ? "Preparing…" : "Download Full Backup"}
            </button>
            {backupError && <div className="error-text">{backupError}</div>}
          </>
        ) : (
          <p className="muted">Only the business owner can download a full backup.</p>
        )}
      </div>
    </div>
  );
}
