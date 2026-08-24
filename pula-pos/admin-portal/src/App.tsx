import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { BusinessesPage } from "./pages/Businesses";
import { BusinessDetailPage } from "./pages/BusinessDetail";
import { PlansPage } from "./pages/Plans";
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
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/businesses/:id" element={<BusinessDetailPage />} />
        <Route path="/plans" element={<PlansPage />} />
      </Route>
    </Routes>
  );
}
