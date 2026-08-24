import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, setUnauthorizedHandler } from "../lib/api";

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
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "pula_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<AuthBusiness | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed.user);
        setBusiness(parsed.business);
      } catch {
        /* ignore corrupt storage */
      }
    }
    setUnauthorizedHandler(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({ user, business, login, logout, isAuthenticated: !!user }),
    [user, business]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
