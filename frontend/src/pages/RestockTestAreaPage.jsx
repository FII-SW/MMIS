import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

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
        // Token stores access level as "role" field
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
      <PageLoadingState title="Restock" onBack={() => navigate("/dashboard/restock")} />
    );
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard" />;
  }

  // Test areas
  const testAreas = [
    "ICT_Mobo",
    "BSI_Mobo",
    "FBT_Mobo",
    "ICT_Agora",
    "FBT_Agora",
    "TOOLS",
    "ORT",
    "L10_Racks",
  ];

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Restock" onBack={() => navigate("/dashboard/restock")} />

      {/* SUBTITLE */}
      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-2 text-lg">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-6 text-lg">
        Select Test Area
      </p>

      {/* TEST AREA GRID */}
      <div className="grid grid-cols-3 gap-6 justify-center mx-auto max-w-4xl px-8">
        {testAreas.map((area) => (
          <div
            key={area}
            onClick={() =>
              navigate(`/dashboard/restock/items?project=${project}&test_area=${area}`)
            }
            className="border dark:border-gray-700 p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer 
                       hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
          >
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{area}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

