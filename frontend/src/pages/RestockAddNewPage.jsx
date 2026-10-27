// src/pages/RestockAddNewPage.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { hasAdminAccess } from "../utils/auth";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function RestockAddNewPage() {
  const navigate = useNavigate();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAccessLevel(hasAdminAccess(payload.role) ? "admin" : payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <PageLoadingState
        title="Add New Stock"
        onBack={() => navigate("/dashboard/restock/project")}
      />
    );
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard/restock/project" />;
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Add New Stock" onBack={() => navigate("/dashboard/restock/project")} />

      <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6">
        <p className="mb-3 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          Select what you want to add
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard/restock/project/add-new-stock")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-5 text-center shadow-sm transition-all hover:bg-blue-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <div className="mb-2 text-3xl">📦</div>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">New Inventory</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Add a new inventory item</p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard/restock/project/add-new-fixture")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-5 text-center shadow-sm transition-all hover:bg-blue-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <div className="mb-2 text-3xl">🔧</div>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">New Fixtures</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Add a new fixture</p>
          </button>
        </div>
      </div>
    </div>
  );
}
