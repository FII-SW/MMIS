import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusBadge from "../components/maintenance/PMStatusBadge";
import { PM_STATES, PM_STATE_META, activePMCount } from "../components/maintenance/pmStatus";
import { pmTypeLabel, pmTypesForArea } from "../components/maintenance/pmTypes";
import { getMaintenanceTestAreas } from "../utils/testAreas";

const BAR_ORDER = ["ok", "due_soon", "overdue", "never", "paused"];

const ACCENT = {
  overdue: "border-l-red-500",
  due_soon: "border-l-yellow-500",
  never: "border-l-gray-300 dark:border-l-gray-600",
  ok: "border-l-green-500",
  paused: "border-l-slate-400",
};

function emptyCounts() {
  return { fixtures: 0, pm: 0, overdue: 0, due_soon: 0, never: 0, ok: 0, paused: 0 };
}

function upToDatePct(counts) {
  const active = activePMCount(counts);
  return active ? Math.round(((counts.ok + counts.due_soon) / active) * 100) : 0;
}

function worstState(counts) {
  return PM_STATES.find((state) => counts[state] > 0) || null;
}

function StatusBar({ counts, className = "h-2" }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}>
      {counts.pm > 0 &&
        BAR_ORDER.map((state) =>
          counts[state] > 0 ? (
            <div
              key={state}
              className={PM_STATE_META[state].dot}
              style={{ width: `${(counts[state] / counts.pm) * 100}%` }}
              title={`${PM_STATE_META[state].label}: ${counts[state]}`}
            />
          ) : null
        )}
    </div>
  );
}

function StatusBadges({ counts }) {
  if (counts.overdue + counts.due_soon + counts.never === 0) {
    return <PMStatusBadge state="ok" label="All up to date" />;
  }
  return (
    <>
      {counts.overdue > 0 && <PMStatusBadge state="overdue" label={`${counts.overdue} overdue`} />}
      {counts.due_soon > 0 && <PMStatusBadge state="due_soon" label={`${counts.due_soon} due soon`} />}
      {counts.never > 0 && <PMStatusBadge state="never" label={`${counts.never} never done`} />}
      {counts.paused > 0 && <PMStatusBadge state="paused" label={`${counts.paused} paused`} />}
    </>
  );
}

function AreaCard({ area, counts, loading, onOpen }) {
  const pmTypes = pmTypesForArea(area);
  const hasPM = pmTypes.length > 0;
  const state = hasPM ? worstState(counts) : null;
  const pct = upToDatePct(counts);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex flex-col rounded-xl border border-l-4 bg-white p-4 text-left shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
        ACCENT[state] || "border-l-transparent"
      } ${hasPM ? "" : "opacity-90"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{area}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {loading ? "Loading…" : `${counts.fixtures} fixture${counts.fixtures === 1 ? "" : "s"}`}
          </p>
        </div>
        {hasPM && counts.pm > 0 && (
          <span
            className={`shrink-0 text-xl font-bold ${
              counts.overdue > 0
                ? "text-red-600 dark:text-red-400"
                : pct >= 90
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
            }`}
            title="PM up to date"
          >
            {pct}%
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {hasPM ? (
          pmTypes.map((type) => (
            <span
              key={type}
              className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
            >
              {pmTypeLabel(type)}
            </span>
          ))
        ) : (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            No PM checklist
          </span>
        )}
      </div>

      {hasPM && counts.pm > 0 && (
        <div className="mt-3 space-y-2">
          <StatusBar counts={counts} />
          <div className="flex flex-wrap gap-1">
            <StatusBadges counts={counts} />
          </div>
        </div>
      )}

      <span className="mt-auto pt-3 text-xs font-semibold text-blue-600 group-hover:underline dark:text-blue-400">
        {hasPM ? "View fixtures & PM →" : "View fixtures →"}
      </span>
    </button>
  );
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
      navigate("/dashboard/maintenance", { replace: true });
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

  const { byArea, totals } = useMemo(() => {
    const areas = {};
    const all = emptyCounts();
    fixtures.forEach((fx) => {
      const counts = (areas[fx.test_area] ||= emptyCounts());
      counts.fixtures += 1;
      all.fixtures += 1;
      const state = fx.pm?.state;
      if (state) {
        counts.pm += 1;
        counts[state] += 1;
        all.pm += 1;
        all[state] += 1;
      }
    });
    return { byArea: areas, totals: all };
  }, [fixtures]);

  const testAreas = useMemo(
    () => getMaintenanceTestAreas(fixtures.map((fx) => fx.test_area)),
    [fixtures]
  );

  if (!project) return null;

  const openArea = (area) =>
    navigate(
      `/dashboard/maintenance/work?project=${encodeURIComponent(project)}&test_area=${encodeURIComponent(area)}`
    );

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard/maintenance")} />

      <div className="mx-auto max-w-5xl space-y-5 px-4 pb-8">
        <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Project</p>
              <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">{project}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading
                  ? "Loading fixtures…"
                  : `${totals.fixtures} fixtures · ${totals.pm} with a PM checklist · select a test area below`}
              </p>
            </div>
            {!loading && totals.pm > 0 && (
              <div className="w-full sm:w-72">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">PM up to date</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{upToDatePct(totals)}%</span>
                </div>
                <StatusBar counts={totals} className="mt-1 h-2.5" />
                <div className="mt-2 flex flex-wrap gap-1">
                  <StatusBadges counts={totals} />
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testAreas.map((area) => (
            <AreaCard
              key={area}
              area={area}
              counts={byArea[area] || emptyCounts()}
              loading={loading}
              onOpen={() => openArea(area)}
            />
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          {BAR_ORDER.map((state) => (
            <span key={state} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${PM_STATE_META[state].dot}`} />
              {PM_STATE_META[state].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
