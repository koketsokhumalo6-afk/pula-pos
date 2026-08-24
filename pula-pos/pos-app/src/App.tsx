import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { PosPage } from "./pages/Pos";
import { ProductsPage } from "./pages/Products";
import { CategoriesPage } from "./pages/Categories";
import { StockPage } from "./pages/Stock";
import { CustomersPage } from "./pages/Customers";
import { SuppliersPage } from "./pages/Suppliers";
import { SalesPage } from "./pages/Sales";
import { PurchasesPage } from "./pages/Purchases";
import { ExpensesPage } from "./pages/Expenses";
import { InvoicesPage } from "./pages/Invoices";
import { QuotationsPage } from "./pages/Quotations";
import { ShiftsPage } from "./pages/Shifts";
import { ReportsPage } from "./pages/Reports";
import { StaffPage } from "./pages/Staff";
import { SettingsPage } from "./pages/Settings";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
