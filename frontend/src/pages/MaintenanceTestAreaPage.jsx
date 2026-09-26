import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusLine from "../components/maintenance/PMStatusLine";
import { MAINTENANCE_PROJECTS_URL, fixtureListUrl } from "../components/maintenance/links";
import { pmTypesForArea } from "../components/maintenance/pmTypes";
import { getMaintenanceTestAreas } from "../utils/testAreas";

function emptyCounts() {
  return { fixtures: 0, overdue: 0, due_soon: 0, never: 0, ok: 0, paused: 0 };
}

export default function MaintenanceTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!project) {
      navigate(MAINTENANCE_PROJECTS_URL, { replace: true });
      return;
    }
    setLoading(true);
    API.get("/maintenance/overview", { params: { project } })
      .then((res) => setFixtures(res.data?.fixtures || []))
      .catch((err) => {
        console.error("Error loading project fixtures:", err);
        setError("Could not load PM status for this project.");
      })
      .finally(() => setLoading(false));
  }, [project, navigate]);

  const byArea = useMemo(() => {
    const areas = {};
    fixtures.forEach((fx) => {
      const counts = (areas[fx.test_area] ||= emptyCounts());
      counts.fixtures += 1;
      const state = fx.pm?.state;
      if (state) counts[state] += 1;
    });
    return areas;
  }, [fixtures]);

  const testAreas = useMemo(
    () => getMaintenanceTestAreas(fixtures.map((fx) => fx.test_area)),
    [fixtures]
  );

  if (!project) return null;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate(MAINTENANCE_PROJECTS_URL)} />

      <p className="mb-2 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>

      <p className="mb-6 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">Select Test Area</p>

      {error && <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mx-auto grid max-w-4xl grid-cols-2 justify-center gap-6 px-4 pb-8 md:grid-cols-3">
        {testAreas.map((area) => {
          const counts = byArea[area] || emptyCounts();
          const hasPM = pmTypesForArea(area).length > 0;
          return (
            <button
              key={area}
              type="button"
              onClick={() => navigate(fixtureListUrl(project, area))}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-white p-8 text-center shadow-md transition-all hover:bg-blue-100 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">{area}</span>
              {loading ? (
                <span className="text-xs text-gray-400">Loading…</span>
              ) : counts.fixtures === 0 ? (
                <span className="text-xs text-gray-400 dark:text-gray-500">No fixtures</span>
              ) : (
                <>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {counts.fixtures} fixture{counts.fixtures === 1 ? "" : "s"}
                  </span>
                  {hasPM ? (
                    <PMStatusLine counts={counts} />
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">No PM checklist</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
