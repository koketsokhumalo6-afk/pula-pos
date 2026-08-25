import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";

interface DashboardStats {
  todayRevenue: number;
  todaySalesCount: number;
  lowStockCount: number;
  openShifts: number;
  customerCount: number;
}

export function DashboardPage() {
  const { business, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/reports/dashboard").then(setStats).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Welcome back, {user?.name?.split(" ")[0]}</h2>
      <p className="muted">{business?.name} · Today's overview</p>

      <div className="grid grid-4">
        <div className="card stat-tile">
          <div className="label">Today's Revenue</div>
          <div className="value">{stats ? money(stats.todayRevenue, business?.currency) : "—"}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Sales Today</div>
          <div className="value">{stats?.todaySalesCount ?? "—"}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Low Stock Items</div>
          <div className="value">{stats?.lowStockCount ?? "—"}</div>
        </div>
        <div className="card stat-tile">
          <div className="label">Open Shifts</div>
          <div className="value">{stats?.openShifts ?? "—"}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick actions</h3>
        <div className="gap-8">
          <Link className="btn btn-primary" to="/pos">Open POS</Link>
          <Link className="btn btn-secondary" to="/products">Manage Products</Link>
          <Link className="btn btn-secondary" to="/reports">View Reports</Link>
        </div>
      </div>
    </div>
  );
}
