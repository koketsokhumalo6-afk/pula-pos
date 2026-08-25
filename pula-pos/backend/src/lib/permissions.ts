/**
 * Configurable per-role page access. Owners are never listed here — an
 * owner always has full access and can't be restricted. Dashboard and
 * Point of Sale aren't included either; those two stay open to every
 * signed-in role no matter what, since POS is the core function of the app
 * and Dashboard is the universal post-login landing page.
 *
 * "laybuys" is the one entry here that isn't a page — it gates the specific
 * action of starting a laybuy sale, recording a laybuy payment, or
 * completing one (from the POS checkout and the Sales → Laybuys tab), not
 * a sidebar link. Cancelling a laybuy is unaffected — that already goes
 * through the separate manager-override flow, same as voiding any sale.
 */
export const PERMISSION_SECTIONS = [
  "dashboard",
  "products",
  "categories",
  "stock",
  "customers",
  "suppliers",
  "sales",
  "laybuys",
  "purchases",
  "expenses",
  "invoices",
  "quotations",
  "shifts",
  "reports",
  "staff",
  "settings",
] as const;

export type PermissionSection = (typeof PERMISSION_SECTIONS)[number];
export type PermissionRole = "CASHIER" | "MANAGER" | "ADMIN";
export type PermissionMap = Record<PermissionSection, boolean>;

function allOn(): PermissionMap {
  const map = {} as PermissionMap;
  for (const s of PERMISSION_SECTIONS) map[s] = true;
  return map;
}

/**
 * Defaults for a business that hasn't customized its permissions yet (and
 * to fill in any section a saved config doesn't mention). Cashiers default
 * to a lean view — just what running the register day-to-day needs; admins
 * and managers default to everything except staff/settings for managers,
 * matching the write-role restrictions already used elsewhere in the API
 * (staff creation and business settings are owner/admin-only today).
 */
export const DEFAULT_PERMISSIONS: Record<PermissionRole, PermissionMap> = {
  CASHIER: {
    dashboard: true,
    products: false,
    categories: false,
    stock: false,
    customers: false,
    suppliers: false,
    sales: true,
    laybuys: true,
    purchases: false,
    expenses: false,
    invoices: false,
    quotations: false,
    shifts: true,
    reports: false,
    staff: false,
    settings: false,
  },
  MANAGER: { ...allOn(), staff: false, settings: false },
  ADMIN: allOn(),
};

/** Merges a business's saved permissions (which may be partial or absent)
 * over the defaults, so a freshly-added section always has a sane value
 * even for a business that customized its permissions before that section
 * existed. */
export function resolvePermissions(stored: unknown): Record<PermissionRole, PermissionMap> {
  const result: Record<PermissionRole, PermissionMap> = {
    CASHIER: { ...DEFAULT_PERMISSIONS.CASHIER },
    MANAGER: { ...DEFAULT_PERMISSIONS.MANAGER },
    ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN },
  };
  if (stored && typeof stored === "object") {
    for (const role of ["CASHIER", "MANAGER", "ADMIN"] as PermissionRole[]) {
      const roleStored = (stored as Record<string, unknown>)[role];
      if (roleStored && typeof roleStored === "object") {
        for (const section of PERMISSION_SECTIONS) {
          const value = (roleStored as Record<string, unknown>)[section];
          if (typeof value === "boolean") result[role][section] = value;
        }
      }
    }
  }
  return result;
}
