import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";

const REPORTS = [
  { path: "/dashboard/reports/current-inventory", title: "Current Inventory Report" },
  { path: "/dashboard/reports/customized", title: "Customized Report" },
  { path: "/dashboard/reports/low-stock", title: "Low stock Report" },
  { path: "/dashboard/reports/spending", title: "Spending Report" },
  {
    path: "/dashboard/reports/preventive-maintenance",
    title: "Preventive Maintenance Report",
    detail: "PMs passed, failed and overdue by day, week or month",
    wide: true,
  },
];

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Reports" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto mb-6 max-w-4xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORTS.map((report) => (
            <button
              key={report.path}
              type="button"
              onClick={() => navigate(report.path)}
              className={`rounded-lg border-2 border-gray-300 bg-white px-4 py-4 text-center shadow-sm transition hover:border-blue-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-gray-700 ${
                report.wide ? "sm:col-span-2" : ""
              }`}
            >
              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                {report.title}
              </span>
              {report.detail && (
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{report.detail}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
