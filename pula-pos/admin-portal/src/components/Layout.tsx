import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/businesses", label: "Businesses" },
  { to: "/plans", label: "Plans" },
];

export function Layout() {
  const { admin, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Pula POS — Admin</div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Master Admin Portal</div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div />
          <div className="gap-8" style={{ alignItems: "center" }}>
            <span className="muted">{admin?.name} · {admin?.role}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout} style={{ marginLeft: 12 }}>Log out</button>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
