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
import { RequireSection } from "./components/RequireSection";

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
        <Route path="/" element={<RequireSection section="dashboard"><DashboardPage /></RequireSection>} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/products" element={<RequireSection section="products"><ProductsPage /></RequireSection>} />
        <Route path="/categories" element={<RequireSection section="categories"><CategoriesPage /></RequireSection>} />
        <Route path="/stock" element={<RequireSection section="stock"><StockPage /></RequireSection>} />
        <Route path="/customers" element={<RequireSection section="customers"><CustomersPage /></RequireSection>} />
        <Route path="/suppliers" element={<RequireSection section="suppliers"><SuppliersPage /></RequireSection>} />
        <Route path="/sales" element={<RequireSection section="sales"><SalesPage /></RequireSection>} />
        <Route path="/purchases" element={<RequireSection section="purchases"><PurchasesPage /></RequireSection>} />
        <Route path="/expenses" element={<RequireSection section="expenses"><ExpensesPage /></RequireSection>} />
        <Route path="/invoices" element={<RequireSection section="invoices"><InvoicesPage /></RequireSection>} />
        <Route path="/quotations" element={<RequireSection section="quotations"><QuotationsPage /></RequireSection>} />
        <Route path="/shifts" element={<RequireSection section="shifts"><ShiftsPage /></RequireSection>} />
        <Route path="/reports" element={<RequireSection section="reports"><ReportsPage /></RequireSection>} />
        <Route path="/staff" element={<RequireSection section="staff"><StaffPage /></RequireSection>} />
        <Route path="/settings" element={<RequireSection section="settings"><SettingsPage /></RequireSection>} />
      </Route>
    </Routes>
  );
}
