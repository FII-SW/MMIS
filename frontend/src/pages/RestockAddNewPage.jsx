// src/pages/RestockAddNewPage.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function RestockAddNewPage() {
  const navigate = useNavigate();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load access level from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAccessLevel(payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  // Check if user is admin
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

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-6 text-lg">
        Select what you want to add
      </p>

      {/* OPTIONS GRID */}
      <div className="max-w-4xl mx-auto px-8">
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* New Inventory Card */}
          <div
            onClick={() => navigate("/dashboard/restock/project/add-new-stock")}
            className="border dark:border-gray-700 p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer 
                       hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
          >
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">New Inventory</h2>
            <p className="text-gray-600 dark:text-gray-400">Add a new inventory item</p>
          </div>

          {/* New Fixtures Card */}
          <div
            onClick={() => navigate("/dashboard/restock/project/add-new-fixture")}
            className="border dark:border-gray-700 p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer 
                       hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
          >
            <div className="text-5xl mb-4">🔧</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">New Fixtures</h2>
            <p className="text-gray-600 dark:text-gray-400">Add a new fixture</p>
          </div>
        </div>
      </div>
    </div>
  );
}

