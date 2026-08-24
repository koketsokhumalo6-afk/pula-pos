import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, setUnauthorizedHandler } from "../lib/api";

interface AdminUser { id: string; name: string; email: string; role: "OWNER" | "SUPPORT"; }

interface AuthState {
  admin: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "pula_admin_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setAdmin(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    setUnauthorizedHandler(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; admin: AdminUser }>("/auth/admin/login", { email, password });
    setAccessToken(res.accessToken);
    setAdmin(res.admin);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res.admin));
  }

  function logout() {
    setAccessToken(null);
    setAdmin(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(() => ({ admin, login, logout, isAuthenticated: !!admin }), [admin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
