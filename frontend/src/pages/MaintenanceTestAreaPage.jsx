import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { getMaintenanceTestAreas } from "../utils/testAreas";

export default function MaintenanceTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const testAreas = getMaintenanceTestAreas();

  if (!project) {
    navigate("/dashboard/maintenance", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard/maintenance")} />

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-2 text-lg">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-6 text-lg">
        Select Test Area
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 justify-center mx-auto max-w-4xl px-4">
        {testAreas.map((area) => (
          <div
            key={area}
            onClick={() =>
              navigate(
                `/dashboard/maintenance/work?project=${encodeURIComponent(project)}&test_area=${encodeURIComponent(area)}`
              )
            }
            className="border dark:border-gray-700 p-6 sm:p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
          >
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{area}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
