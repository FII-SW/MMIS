import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusBadge from "../components/maintenance/PMStatusBadge";
import { formatDateTime } from "../components/maintenance/formatDate";
import { PM_STATE_META, describeDue } from "../components/maintenance/pmStatus";
import { pmTypeLabel } from "../components/maintenance/pmTypes";
import { fixtureDetailUrl } from "../components/maintenance/links";
import { getProjects } from "../utils/projects";
import { projectRequiresTestArea } from "../utils/inventoryRules";

function KpiTile({ label, value, sublabel, className }) {
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value ?? "—"}</p>
      {sublabel && <p className="text-[11px] opacity-80">{sublabel}</p>}
    </div>
  );
}

function SidePanel({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="border-b border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
        {title}
      </p>
      <div className="max-h-80 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [projects, setProjects] = useState(getProjects());
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    const handleProjectsUpdate = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", handleProjectsUpdate);
    window.addEventListener("storage", handleProjectsUpdate);
    return () => {
      window.removeEventListener("projectsUpdated", handleProjectsUpdate);
      window.removeEventListener("storage", handleProjectsUpdate);
    };
  }, []);

  useEffect(() => {
    Promise.all([API.get("/maintenance/summary"), API.get("/maintenance/recent", { params: { limit: 10 } })])
      .then(([summaryRes, recentRes]) => {
        setSummary(summaryRes.data);
        setRecent(recentRes.data || []);
      })
      .catch((err) => {
        console.error("Error loading PM summary:", err);
        setSummaryError("PM summary is unavailable right now.");
      });
  }, []);

  const projectCounts = useMemo(() => {
    const counts = {};
    (summary?.locations || []).forEach((loc) => {
      const key = loc.project_name || "";
      counts[key] ||= { overdue: 0, due_soon: 0, never: 0, ok: 0, fixtures: 0 };
      ["overdue", "due_soon", "never", "ok", "fixtures"].forEach((field) => {
        counts[key][field] += loc[field] || 0;
      });
    });
    return counts;
  }, [summary]);

  const filteredProjects = projects.filter((project) =>
    project.toLowerCase().includes(searchInput.toLowerCase().trim())
  );

  const handleProjectClick = (project) => {
    const encoded = encodeURIComponent(project);
    if (!projectRequiresTestArea(project)) {
      navigate(`/dashboard/maintenance/work?project=${encoded}`);
      return;
    }
    navigate(`/dashboard/maintenance/test-area?project=${encoded}`);
  };

  const totals = summary?.totals;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl space-y-4 px-2 pb-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Overdue"
            value={totals?.overdue}
            sublabel={totals ? `of ${totals.fixtures} PM fixtures` : null}
            className={PM_STATE_META.overdue.tile}
          />
          <KpiTile label="Never done" value={totals?.never} sublabel="No PM recorded yet" className={PM_STATE_META.never.tile} />
          <KpiTile label="Due soon" value={totals?.due_soon} sublabel="Plan these next" className={PM_STATE_META.due_soon.tile} />
          <KpiTile
            label="Done last 7 days"
            value={summary?.completed_last_7_days}
            sublabel={summary ? `${summary.failed_last_7_days} with failed tasks` : null}
            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
          />
        </div>
        {summaryError && <p className="text-xs text-red-600 dark:text-red-400">{summaryError}</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Select Project</p>
              <input
                type="text"
                placeholder="Search projects…"
                className="w-full rounded-lg border-2 border-gray-300 bg-white p-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-64"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredProjects.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-500 dark:text-gray-400">
                  <p>No projects found matching &quot;{searchInput}&quot;</p>
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const counts = projectCounts[p];
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => handleProjectClick(p)}
                      className="rounded-xl border bg-white p-4 text-left shadow-md transition-all hover:bg-blue-50 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      <span className="block font-semibold text-gray-800 dark:text-gray-200">{p}</span>
                      {counts ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {counts.overdue > 0 && <PMStatusBadge state="overdue" label={`${counts.overdue} overdue`} />}
                          {counts.due_soon > 0 && <PMStatusBadge state="due_soon" label={`${counts.due_soon} due soon`} />}
                          {counts.never > 0 && <PMStatusBadge state="never" label={`${counts.never} never done`} />}
                          {counts.overdue + counts.due_soon + counts.never === 0 && (
                            <PMStatusBadge state="ok" label="PM up to date" />
                          )}
                        </span>
                      ) : (
                        <span className="mt-2 block text-[11px] text-gray-400 dark:text-gray-500">No PM fixtures</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <SidePanel title="Needs attention">
              {!summary || summary.attention.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  {summary ? "No overdue PMs." : "Loading…"}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {summary.attention.map((fx) => (
                    <li key={fx.fixture_id}>
                      <button
                        type="button"
                        onClick={() => navigate(fixtureDetailUrl(fx))}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {fx.fixture_name}
                          </span>
                          <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {fx.project_name} · {fx.test_area}
                            {fx.production_line ? ` · ${fx.production_line}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400">
                          {describeDue({ state: "overdue", days_until_due: fx.pm.days_until_due })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SidePanel>

            <SidePanel title="Recent PM activity">
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">No PMs recorded yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recent.map((record) => (
                    <li key={record.pm_id}>
                      <button
                        type="button"
                        onClick={() => navigate(fixtureDetailUrl(record, { tab: "history" }))}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {record.fixture_name || `Fixture #${record.fixture_id}`}
                          </span>
                          <PMStatusBadge
                            state={record.overall_result === "failed" ? "overdue" : "ok"}
                            label={record.overall_result === "failed" ? "Failed" : "Passed"}
                          />
                        </span>
                        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {pmTypeLabel(record.pm_type)} · {record.performed_by || "Unknown"} ·{" "}
                          {formatDateTime(record.performed_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SidePanel>
          </div>
        </div>
      </div>
    </div>
  );
}
