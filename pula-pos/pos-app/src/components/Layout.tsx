import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LicenseBanner } from "./LicenseBanner";
import { OfflineBanner } from "./OfflineBanner";
import { api } from "../lib/api";
import type { PermissionSection } from "../lib/permissions";

const NAV: { to: string; label: string; end?: boolean; section?: PermissionSection }[] = [
  { to: "/", label: "Dashboard", end: true, section: "dashboard" },
  { to: "/pos", label: "Point of Sale" },
  { to: "/products", label: "Products", section: "products" },
  { to: "/categories", label: "Categories", section: "categories" },
  { to: "/stock", label: "Stock", section: "stock" },
  { to: "/customers", label: "Customers", section: "customers" },
  { to: "/suppliers", label: "Suppliers", section: "suppliers" },
  { to: "/sales", label: "Sales", section: "sales" },
  { to: "/purchases", label: "Purchases", section: "purchases" },
  { to: "/expenses", label: "Expenses", section: "expenses" },
  { to: "/invoices", label: "Invoices", section: "invoices" },
  { to: "/quotations", label: "Quotations", section: "quotations" },
  { to: "/shifts", label: "Shifts & Cash", section: "shifts" },
  { to: "/reports", label: "Reports", section: "reports" },
  { to: "/staff", label: "Staff", section: "staff" },
  { to: "/settings", label: "Settings", section: "settings" },
];

export function Layout() {
  const { user, business, logout, can } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const visibleNav = NAV.filter((item) => !item.section || can(item.section));

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
          {visibleNav.map((item) => (
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
        <OfflineBanner />
        <LicenseBanner />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
