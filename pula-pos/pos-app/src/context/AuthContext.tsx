import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, setUnauthorizedHandler } from "../lib/api";
import type { PermissionMap, PermissionRole, PermissionSection } from "../lib/permissions";

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "CASHIER";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthBusiness {
  id: string;
  name: string;
  currency: string;
}

interface AuthState {
  user: AuthUser | null;
  business: AuthBusiness | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  /** Whether the signed-in user's role can open a given page section.
   * Owners are always true. Returns true while permissions are still
   * loading, so the nav/routes don't flash "forbidden" before the check
   * completes. */
  can: (section: PermissionSection) => boolean;
  permissionsLoaded: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "pula_session";

/** Reads the saved session synchronously so the very first render already
 * has the right user/business — restoring it inside a useEffect instead
 * left a one-render gap where `user` was still null, during which
 * ProtectedRoute would see "not authenticated" and redirect to /login
 * before the restore ever ran. That gap only bit on a full page load
 * (a plain <a href> link, a bookmark, or a manual browser refresh), which
 * is exactly why it looked like login "randomly" kicked in. */
function readStoredSession(): { user: AuthUser | null; business: AuthBusiness | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { user: parsed.user ?? null, business: parsed.business ?? null };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { user: null, business: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession().user);
  const [business, setBusiness] = useState<AuthBusiness | null>(() => readStoredSession().business);
  const [permissions, setPermissions] = useState<Record<PermissionRole, PermissionMap> | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Owners are never restricted, so there's nothing to fetch for them —
    // everyone else's nav/route access depends on the business's saved
    // permission config, fetched once per session.
    if (!user) return;
    if (user.role === "OWNER") {
      setPermissionsLoaded(true);
      return;
    }
    api
      .get<Record<PermissionRole, PermissionMap>>("/business/permissions")
      .then((p) => {
        setPermissions(p);
        setPermissionsLoaded(true);
      })
      .catch(() => setPermissionsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; user: AuthUser; business: AuthBusiness }>("/auth/login", {
      email,
      password,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setBusiness(res.business);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: res.user, business: res.business }));
  }

  function logout() {
    setAccessToken(null);
    setUser(null);
    setBusiness(null);
    setPermissions(null);
    setPermissionsLoaded(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  function can(section: PermissionSection): boolean {
    if (!user) return false;
    if (user.role === "OWNER") return true;
    if (!permissions) return true; // still loading — don't flash "forbidden" before the check completes
    const roleMap = permissions[user.role as PermissionRole];
    return roleMap ? roleMap[section] !== false : true;
  }

  const value = useMemo(
    () => ({ user, business, login, logout, isAuthenticated: !!user, can, permissionsLoaded }),
    [user, business, permissions, permissionsLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
