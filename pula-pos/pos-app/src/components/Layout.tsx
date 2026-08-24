import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LicenseBanner } from "./LicenseBanner";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/pos", label: "Point of Sale" },
  { to: "/products", label: "Products" },
  { to: "/stock", label: "Stock" },
  { to: "/customers", label: "Customers" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/sales", label: "Sales" },
  { to: "/purchases", label: "Purchases" },
  { to: "/expenses", label: "Expenses" },
  { to: "/invoices", label: "Invoices" },
  { to: "/quotations", label: "Quotations" },
  { to: "/shifts", label: "Shifts & Cash" },
  { to: "/reports", label: "Reports" },
  { to: "/staff", label: "Staff" },
];

export function Layout() {
  const { user, business, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Pula POS</div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">{business?.name}</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div />
          <div className="gap-8" style={{ alignItems: "center" }}>
            <span className="muted">
              {user?.name} · {user?.role}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={logout} style={{ marginLeft: 12 }}>
              Log out
            </button>
          </div>
        </div>
        <LicenseBanner />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
