/** Mirrors backend/src/lib/permissions.ts — the configurable per-role page
 * access sections. Dashboard and Point of Sale aren't included; those stay
 * open to every signed-in role regardless of configuration.
 *
 * "laybuys" isn't a page — it gates starting a laybuy sale on the POS
 * screen and the Laybuys tab on the Sales page (recording payments,
 * completing). Cancelling a laybuy still goes through the separate
 * manager-override flow regardless of this setting. */
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

export const SECTION_LABELS: Record<PermissionSection, string> = {
  dashboard: "Dashboard",
  products: "Products",
  categories: "Categories",
  stock: "Stock",
  customers: "Customers",
  suppliers: "Suppliers",
  sales: "Sales",
  laybuys: "Laybuys (start & manage)",
  purchases: "Purchases",
  expenses: "Expenses",
  invoices: "Invoices",
  quotations: "Quotations",
  shifts: "Shifts & Cash",
  reports: "Reports",
  staff: "Staff",
  settings: "Settings",
};
