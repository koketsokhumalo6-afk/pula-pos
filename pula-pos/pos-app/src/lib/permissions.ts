/** Mirrors backend/src/lib/permissions.ts — the configurable per-role page
 * access sections. Dashboard and Point of Sale aren't included; those stay
 * open to every signed-in role regardless of configuration. */
export const PERMISSION_SECTIONS = [
  "dashboard",
  "products",
  "categories",
  "stock",
  "customers",
  "suppliers",
  "sales",
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
  purchases: "Purchases",
  expenses: "Expenses",
  invoices: "Invoices",
  quotations: "Quotations",
  shifts: "Shifts & Cash",
  reports: "Reports",
  staff: "Staff",
  settings: "Settings",
};
