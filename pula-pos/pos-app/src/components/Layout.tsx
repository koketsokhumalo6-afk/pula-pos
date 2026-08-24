import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LicenseBanner } from "./LicenseBanner";
import { api } from "../lib/api";

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
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const { user, business, logout } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    // Lightweight own-profile fetch just for branding — logo isn't part of
    // the login response, so the sidebar loads it once per session.
    api.get<{ logoUrl: string | null }>("/business").then((b) => setLogoUrl(b.logoUrl)).catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={business?.name || "Business logo"} className="sidebar-logo" />
          ) : (
            "Pula POS"
          )}
        </div>
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
