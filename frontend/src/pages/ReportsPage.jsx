import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Reports" onBack={() => navigate("/dashboard")} />

      {/* REPORT OPTIONS */}
      <div className="max-w-4xl mx-auto px-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate("/dashboard/reports/current-inventory")}
            className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-600 transition shadow-md"
          >
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">Current Inventory Report</span>
          </button>

          <button
            onClick={() => navigate("/dashboard/reports/customized")}
            className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-600 transition shadow-md"
          >
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">Customized Report</span>
          </button>

          <button
            onClick={() => navigate("/dashboard/reports/low-stock")}
            className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-600 transition shadow-md"
          >
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">Low stock Report</span>
          </button>

        <button
            onClick={() => navigate("/dashboard/reports/spending")}
            className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-600 transition shadow-md"
          >
            <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">Spending Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
