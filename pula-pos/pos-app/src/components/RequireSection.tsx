import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { PermissionSection } from "../lib/permissions";

/**
 * Blocks direct URL navigation to a page the signed-in role isn't allowed
 * to open — hiding the nav link isn't enough on its own, since a cashier
 * could still type the address bar. Falls back to /pos rather than / when
 * blocked, since / (Dashboard) is itself a gateable section and redirecting
 * there could loop if it's also disabled for this role.
 */
export function RequireSection({ section, children }: { section: PermissionSection; children: ReactNode }) {
  const { can, permissionsLoaded } = useAuth();
  if (!permissionsLoaded) return null; // brief wait avoids bouncing before the permission check has loaded
  if (!can(section)) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}
