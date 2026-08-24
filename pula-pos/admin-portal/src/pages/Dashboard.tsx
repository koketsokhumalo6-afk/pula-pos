import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Stats { totalBusinesses: number; activeLicenses: number; expiringSoon: number; expired: number; }

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { api.get<Stats>("/admin/stats").then(setStats).catch(() => {}); }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Overview</h2>
      <div className="grid grid-4">
        <div className="card stat-tile"><div className="label">Businesses</div><div className="value">{stats?.totalBusinesses ?? "—"}</div></div>
        <div className="card stat-tile"><div className="label">Active licenses</div><div className="value">{stats?.activeLicenses ?? "—"}</div></div>
        <div className="card stat-tile"><div className="label">Expiring in 30 days</div><div className="value" style={{ color: "#b7791f" }}>{stats?.expiringSoon ?? "—"}</div></div>
        <div className="card stat-tile"><div className="label">Expired</div><div className="value" style={{ color: "#c0392b" }}>{stats?.expired ?? "—"}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick actions</h3>
        <div className="gap-8">
          <a className="btn btn-primary" href="/businesses">Manage Businesses</a>
          <a className="btn btn-secondary" href="/plans">Manage Plans</a>
        </div>
      </div>
    </div>
  );
}
