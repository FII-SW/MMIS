// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RequestPage from "./pages/RequestPage";
import ReturnPage from "./pages/ReturnPage";
import RestockPage from "./pages/RestockPage";
import ReportsPage from "./pages/ReportsPage";
import AlertsPage from "./pages/AlertsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ActivityPage from "./pages/ActivityPage";
import RequestProjectPage from "./pages/RequestProjectPage";
import RequestTestAreaPage from "./pages/RequestTestAreaPage";
import ItemRequestPage from "./pages/ItemRequestPage";
import ItemReturnPage from "./pages/ItemReturnPage";
import RestockProjectPage from "./pages/RestockProjectPage";
import RestockTestAreaPage from "./pages/RestockTestAreaPage";
import RestockItemPage from "./pages/RestockItemPage";
import RestockEditItemPage from "./pages/RestockEditItemPage";
import RestockNewStockPage from "./pages/RestockNewStockPage";
import RestockAddNewPage from "./pages/RestockAddNewPage";
import RestockNewFixturePage from "./pages/RestockNewFixturePage";
import RestockEditFixturePage from "./pages/RestockEditFixturePage";
import CurrentInventoryReportPage from "./pages/CurrentInventoryReportPage";
import LowStockReportPage from "./pages/LowStockReportPage";
import CustomizedReportPage from "./pages/CustomizedReportPage";
import SpendingReportPage from "./pages/SpendingReportPage";
import PMReportPage from "./pages/PMReportPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ProfilePage from "./pages/ProfilePage";
import TransferItemPage from "./pages/TransferItemPage";
import MaintenancePage from "./pages/MaintenancePage";
import MaintenanceProjectsPage from "./pages/MaintenanceProjectsPage";
import MaintenanceTestAreaPage from "./pages/MaintenanceTestAreaPage";
import MaintenanceWorkPage from "./pages/MaintenanceWorkPage";
import MaintenanceFixtureDetailPage from "./pages/MaintenanceFixtureDetailPage";
import DocumentsPage from "./pages/DocumentsPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import Layout from "./components/Layout";

const EDITORS = ["admin", "user"];
const EVERYONE = ["admin", "user", "viewer"];

export default function App() {
  const withLayout = (allowedRoles, page) => (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Layout>{page}</Layout>
    </ProtectedRoute>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* ADMIN + USER (not viewers: these pages change stock) */}
        <Route path="/dashboard/request" element={withLayout(EDITORS, <RequestProjectPage />)} />
        <Route path="/dashboard/request/test-area" element={withLayout(EDITORS, <RequestTestAreaPage />)} />
        <Route path="/dashboard/request/search" element={withLayout(EDITORS, <RequestPage />)} />
        <Route path="/dashboard/request/item/:item_id" element={withLayout(EDITORS, <ItemRequestPage />)} />
        <Route path="/dashboard/return/" element={withLayout(EDITORS, <ReturnPage />)} />
        <Route path="/dashboard/return/item/:transaction_id" element={withLayout(EDITORS, <ItemReturnPage />)} />

        {/* EVERYONE, including view-only accounts */}
        <Route path="/dashboard/" element={withLayout(EVERYONE, <Dashboard />)} />
        <Route path="/dashboard/alerts" element={withLayout(EVERYONE, <AlertsPage />)} />
        <Route path="/dashboard/reports" element={withLayout(EVERYONE, <ReportsPage />)} />
        <Route path="/dashboard/reports/current-inventory" element={withLayout(EVERYONE, <CurrentInventoryReportPage />)} />
        <Route path="/dashboard/reports/low-stock" element={withLayout(EVERYONE, <LowStockReportPage />)} />
        <Route path="/dashboard/reports/customized" element={withLayout(EVERYONE, <CustomizedReportPage />)} />
        <Route path="/dashboard/reports/spending" element={withLayout(EVERYONE, <SpendingReportPage />)} />
        <Route path="/dashboard/reports/preventive-maintenance" element={withLayout(EVERYONE, <PMReportPage />)} />
        <Route path="/dashboard/activity" element={withLayout(EVERYONE, <ActivityPage />)} />
        <Route path="/dashboard/documents" element={withLayout(EVERYONE, <DocumentsPage />)} />
        <Route path="/dashboard/maintenance" element={withLayout(EVERYONE, <MaintenanceProjectsPage />)} />
        <Route path="/dashboard/maintenance/dashboard" element={withLayout(EVERYONE, <MaintenancePage />)} />
        <Route path="/dashboard/maintenance/projects" element={<Navigate to="/dashboard/maintenance" replace />} />
        <Route path="/dashboard/maintenance/test-area" element={withLayout(EVERYONE, <MaintenanceTestAreaPage />)} />
        <Route path="/dashboard/maintenance/work" element={withLayout(EVERYONE, <MaintenanceWorkPage />)} />
        <Route path="/dashboard/maintenance/fixture/:fixture_id" element={withLayout(EVERYONE, <MaintenanceFixtureDetailPage />)} />
        <Route path="/dashboard/change-password" element={withLayout(EVERYONE, <ChangePasswordPage />)} />
        <Route path="/dashboard/profile" element={withLayout(EVERYONE, <ProfilePage />)} />

        <Route path="/dashboard/transfer" element={withLayout(["admin"], <TransferItemPage />)} />
        <Route path="/dashboard/super-admin" element={withLayout(["superadmin"], <SuperAdminPage />)} />

        {/* ADMIN ONLY */}
        <Route path="/dashboard/restock" element={withLayout(["admin"], <RestockPage />)} />
        <Route path="/dashboard/restock/project" element={withLayout(["admin"], <RestockProjectPage />)} />
        <Route path="/dashboard/restock/test-area" element={withLayout(["admin"], <RestockTestAreaPage />)} />
        <Route path="/dashboard/restock/items" element={withLayout(["admin"], <RestockItemPage />)} />
        <Route path="/dashboard/restock/item/:item_id/edit" element={withLayout(["admin"], <RestockEditItemPage />)} />
        <Route path="/dashboard/restock/project/add-new" element={withLayout(["admin"], <RestockAddNewPage />)} />
        <Route path="/dashboard/restock/project/add-new-stock" element={withLayout(["admin"], <RestockNewStockPage />)} />
        <Route path="/dashboard/restock/project/add-new-fixture" element={withLayout(["admin"], <RestockNewFixturePage />)} />
        <Route path="/dashboard/restock/fixture/:fixture_id/edit" element={withLayout(["admin"], <RestockEditFixturePage />)} />
      </Routes>
    </BrowserRouter>
  );
}
