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
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ProfilePage from "./pages/ProfilePage";
import TransferItemPage from "./pages/TransferItemPage";
import MaintenancePage from "./pages/MaintenancePage";
import MaintenanceProjectsPage from "./pages/MaintenanceProjectsPage";
import MaintenanceTestAreaPage from "./pages/MaintenanceTestAreaPage";
import MaintenanceWorkPage from "./pages/MaintenanceWorkPage";
import MaintenanceFixtureDetailPage from "./pages/MaintenanceFixtureDetailPage";
import DocumentsPage from "./pages/DocumentsPage";
import Layout from "./components/Layout";

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
        {/* ADMIN + USER */}
        <Route path="/dashboard/" element={withLayout(["admin", "user"], <Dashboard />)} />
        <Route path="/dashboard/request" element={withLayout(["admin", "user"], <RequestProjectPage />)} />
        <Route path="/dashboard/request/test-area" element={withLayout(["admin", "user"], <RequestTestAreaPage />)} />
        <Route path="/dashboard/request/search" element={withLayout(["admin", "user"], <RequestPage />)} />
        <Route path="/dashboard/request/item/:item_id" element={withLayout(["admin", "user"], <ItemRequestPage />)} />
        <Route path="/dashboard/return/" element={withLayout(["admin", "user"], <ReturnPage />)} />
        <Route path="/dashboard/return/item/:transaction_id" element={withLayout(["admin", "user"], <ItemReturnPage />)} />
        <Route path="/dashboard/alerts" element={withLayout(["admin", "user"], <AlertsPage />)} />
        <Route path="/dashboard/reports" element={withLayout(["admin", "user"], <ReportsPage />)} />
        <Route path="/dashboard/reports/current-inventory" element={withLayout(["admin", "user"], <CurrentInventoryReportPage />)} />
        <Route path="/dashboard/reports/low-stock" element={withLayout(["admin", "user"], <LowStockReportPage />)} />
        <Route path="/dashboard/transfer" element={withLayout(["admin"], <TransferItemPage />)} />
        <Route path="/dashboard/reports/customized" element={withLayout(["admin", "user"], <CustomizedReportPage />)} />
        <Route path="/dashboard/reports/spending" element={withLayout(["admin", "user"], <SpendingReportPage />)} />
        <Route path="/dashboard/activity" element={withLayout(["admin", "user"], <ActivityPage />)} />
        <Route path="/dashboard/documents" element={withLayout(["admin", "user"], <DocumentsPage />)} />
        <Route path="/dashboard/maintenance" element={withLayout(["admin", "user"], <MaintenanceProjectsPage />)} />
        <Route path="/dashboard/maintenance/dashboard" element={withLayout(["admin", "user"], <MaintenancePage />)} />
        <Route path="/dashboard/maintenance/projects" element={<Navigate to="/dashboard/maintenance" replace />} />
        <Route path="/dashboard/maintenance/test-area" element={withLayout(["admin", "user"], <MaintenanceTestAreaPage />)} />
        <Route path="/dashboard/maintenance/work" element={withLayout(["admin", "user"], <MaintenanceWorkPage />)} />
        <Route path="/dashboard/maintenance/fixture/:fixture_id" element={withLayout(["admin", "user"], <MaintenanceFixtureDetailPage />)} />
        <Route path="/dashboard/change-password" element={withLayout(["admin", "user"], <ChangePasswordPage />)} />
        <Route path="/dashboard/profile" element={withLayout(["admin", "user"], <ProfilePage />)} />

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
