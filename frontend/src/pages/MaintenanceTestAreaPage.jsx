import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusBadge from "../components/maintenance/PMStatusBadge";
import { pmTypeLabel, pmTypesForArea } from "../components/maintenance/pmTypes";
import { getMaintenanceTestAreas } from "../utils/testAreas";

export default function MaintenanceTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const testAreas = getMaintenanceTestAreas();
  const [locations, setLocations] = useState({});

  useEffect(() => {
    if (!project) {
      navigate("/dashboard/maintenance", { replace: true });
      return;
    }
    API.get("/maintenance/summary")
      .then((res) => {
        const byArea = {};
        (res.data?.locations || [])
          .filter((loc) => loc.project_name === project)
          .forEach((loc) => {
            byArea[loc.test_area] = loc;
          });
        setLocations(byArea);
      })
      .catch((err) => console.error("Error loading PM summary:", err));
  }, [project, navigate]);

  if (!project) return null;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard/maintenance")} />

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-1 text-lg">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-5">Select Test Area</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 justify-center mx-auto max-w-4xl px-4">
        {testAreas.map((area) => {
          const pmTypes = pmTypesForArea(area);
          const loc = locations[area];
          return (
            <button
              type="button"
              key={area}
              onClick={() =>
                navigate(
                  `/dashboard/maintenance/work?project=${encodeURIComponent(project)}&test_area=${encodeURIComponent(area)}`
                )
              }
              className="flex flex-col items-center gap-2 border dark:border-gray-700 p-5 text-center rounded-xl bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
            >
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{area}</span>
              {pmTypes.length > 0 ? (
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  {pmTypes.map(pmTypeLabel).join(" · ")}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">No PM checklist</span>
              )}
              {loc && (
                <span className="flex flex-wrap justify-center gap-1">
                  {loc.overdue > 0 && <PMStatusBadge state="overdue" label={`${loc.overdue} overdue`} />}
                  {loc.due_soon > 0 && <PMStatusBadge state="due_soon" label={`${loc.due_soon} due soon`} />}
                  {loc.never > 0 && <PMStatusBadge state="never" label={`${loc.never} never done`} />}
                  {loc.overdue + loc.due_soon + loc.never === 0 && <PMStatusBadge state="ok" label="Up to date" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
