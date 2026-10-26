import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusLine from "../components/maintenance/PMStatusLine";
import { FIXTURE_MAINTENANCE_TITLE, MAINTENANCE_PROJECTS_URL, fixtureListUrl } from "../components/maintenance/links";
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

  const testAreas = useMemo(() => {
    const areas = getMaintenanceTestAreas(fixtures.map((fx) => fx.test_area));
    return [...areas].sort((a, b) => {
      const score = (area) => {
        const counts = byArea[area] || emptyCounts();
        return (counts.overdue || 0) * 1000 + (counts.due_soon || 0);
      };
      return score(b) - score(a) || areas.indexOf(a) - areas.indexOf(b);
    });
  }, [fixtures, byArea]);

  if (!project) return null;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title={FIXTURE_MAINTENANCE_TITLE} onBack={() => navigate(MAINTENANCE_PROJECTS_URL)} />

      <p className="mb-2 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>

      <p className="mb-6 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">Select Test Area</p>

      {error && <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mx-auto grid max-w-4xl grid-cols-2 justify-center gap-6 px-4 pb-8 md:grid-cols-3">
        {testAreas.map((area) => {
          const counts = byArea[area] || emptyCounts();
          const hasPM = pmTypesForArea(area).length > 0;
          const overdue = counts.overdue || 0;
          return (
            <div
              key={area}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border bg-white p-6 text-center shadow-md dark:bg-gray-800 ${
                overdue > 0 ? "border-red-300 dark:border-red-800" : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <button
                type="button"
                onClick={() => navigate(fixtureListUrl(project, area))}
                className="flex w-full flex-col items-center justify-center gap-1 rounded-lg p-2 transition-all hover:bg-blue-100 dark:hover:bg-gray-700"
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
              {overdue > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(fixtureListUrl(project, area, "overdue"))}
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  Open {overdue} overdue
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
