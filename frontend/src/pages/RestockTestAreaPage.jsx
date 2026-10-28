import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { hasAdminAccess } from "../utils/auth";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import { DEFAULT_TEST_AREAS } from "../utils/testAreas";

export default function RestockTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  const project = params.get("project");

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
    return <PageLoadingState title="Restock" onBack={() => navigate("/dashboard/restock")} />;
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard" />;
  }

  const testAreas = DEFAULT_TEST_AREAS;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Restock" onBack={() => navigate("/dashboard/restock")} />

      <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <p className="mb-0.5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
          Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
        </p>
        <p className="mb-3 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          Select test area
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {testAreas.map((area) => (
            <button
              type="button"
              key={area}
              onClick={() =>
                navigate(`/dashboard/restock/items?project=${project}&test_area=${area}`)
              }
              className="flex min-h-[3.75rem] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-3.5 text-center text-sm font-semibold leading-snug text-gray-800 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-gray-700"
            >
              <span className="line-clamp-2">{area}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
