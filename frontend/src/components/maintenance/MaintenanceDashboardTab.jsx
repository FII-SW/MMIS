import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import { getProjects } from "../../utils/projects";
import { projectRequiresTestArea } from "../../utils/inventoryRules";
import ComplianceTrendChart from "./ComplianceTrendChart";
import DashboardFilters from "./DashboardFilters";
import PMActivityChart from "./PMActivityChart";
import PMStatusBadge from "./PMStatusBadge";
import { formatRange, fromLocalInput, presetRange, rangeToParams, toLocalInput } from "./dateRanges";
import { formatDateTime } from "./formatDate";
import { fixtureDetailUrl } from "./links";
import { PM_STATE_META, activePMCount, describeDue } from "./pmStatus";
import { PM_TYPE_LABELS, pmTypeLabel } from "./pmTypes";
import useStickyState from "./useStickyState";

const DEFAULT_FILTERS = { project: "", testArea: "", pmType: "all", preset: "7d", from: "", to: "" };
const BAR_ORDER = ["ok", "due_soon", "overdue", "never", "paused"];
const EMPTY_TOTALS = { overdue: 0, due_soon: 0, never: 0, ok: 0, paused: 0, fixtures: 0 };

function upToDatePct(counts) {
  const active = activePMCount(counts);
  return active ? Math.round(((counts.ok + counts.due_soon) / active) * 100) : null;
}

function StatusBar({ counts, className = "h-1.5" }) {
  const total = counts?.fixtures || 0;
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}>
      {total > 0 &&
        BAR_ORDER.map((state) =>
          counts[state] > 0 ? (
            <div
              key={state}
              className={PM_STATE_META[state].dot}
              style={{ width: `${(counts[state] / total) * 100}%` }}
              title={`${PM_STATE_META[state].label}: ${counts[state]}`}
            />
          ) : null
        )}
    </div>
  );
}

function KpiTile({ icon, label, value, sublabel, className, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${className} ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
    >
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold">{value ?? "—"}</p>
      {sublabel && <p className="text-[11px] opacity-80">{sublabel}</p>}
    </Tag>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ title, hint }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      {hint && <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p className="px-4 py-5 text-center text-xs text-gray-500 dark:text-gray-400">{children}</p>;
}

function LinkButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
      {children}
    </button>
  );
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MaintenanceDashboardTab({ onOpenTodo, onOpenTab }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useStickyState("mmis:pm-dashboard:filters", DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 350);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const stored = { ...DEFAULT_FILTERS, ...saved };
  const customFrom = fromLocalInput(stored.from);
  const customTo = fromLocalInput(stored.to);
  const customInvalid = stored.preset === "custom" && !(customFrom && customTo && customFrom < customTo);

  const range = useMemo(() => {
    if (stored.preset === "custom" && !customInvalid) return { from: customFrom, to: customTo };
    return presetRange(stored.preset === "custom" ? "7d" : stored.preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.preset, stored.from, stored.to]);

  const filters = {
    ...stored,
    search,
    from: stored.preset === "custom" ? stored.from : toLocalInput(range.from),
    to: stored.preset === "custom" ? stored.to : toLocalInput(range.to),
  };

  const handleChange = (patch) => {
    const { search: nextSearch, ...rest } = patch;
    if (nextSearch !== undefined) setSearch(nextSearch);
    if (Object.keys(rest).length === 0) return;
    setSaved((prev) => {
      const base = { ...DEFAULT_FILTERS, ...prev };
      if (rest.preset === "custom" && base.preset !== "custom") {
        base.from = toLocalInput(range.from);
        base.to = toLocalInput(range.to);
      }
      return { ...base, ...rest };
    });
  };

  const handleReset = () => {
    setSearch("");
    setSaved(DEFAULT_FILTERS);
  };

  const fromKey = range.from.getTime();
  const toKey = range.to.getTime();
  useEffect(() => {
    if (customInvalid) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = rangeToParams(range.from, range.to);
    if (stored.project) params.project = stored.project;
    if (stored.testArea) params.test_area = stored.testArea;
    if (stored.pmType !== "all") params.pm_type = stored.pmType;
    if (debouncedSearch) params.q = debouncedSearch;
    API.get("/maintenance/dashboard", { params })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        console.error("Error loading PM dashboard:", err);
        if (!cancelled) setError(err?.response?.data?.detail || "The PM dashboard could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.project, stored.testArea, stored.pmType, debouncedSearch, fromKey, toKey, customInvalid]);

  const status = data?.status;
  const totals = status?.totals || EMPTY_TOTALS;
  const activity = data?.activity;
  const pct = upToDatePct(totals);
  const passRate = activity?.completed ? Math.round((activity.passed / activity.completed) * 100) : null;
  const rangeLabel = formatRange(range.from, range.to);
  const pmTypeEntries = Object.entries(status?.by_pm_type || {}).sort(
    ([a], [b]) => Object.keys(PM_TYPE_LABELS).indexOf(a) - Object.keys(PM_TYPE_LABELS).indexOf(b)
  );
  const selectedTypeMissing =
    stored.pmType !== "all" && data?.options?.pm_types?.some((t) => t.value === stored.pmType && !t.configured);

  const openLocation = (loc) => {
    const next = new URLSearchParams();
    if (loc.project_name) next.set("project", loc.project_name);
    if (loc.test_area) next.set("test_area", loc.test_area);
    navigate(`/dashboard/maintenance/work?${next.toString()}`);
  };

  const openProject = (project) => {
    const encoded = encodeURIComponent(project);
    navigate(
      projectRequiresTestArea(project)
        ? `/dashboard/maintenance/test-area?project=${encoded}`
        : `/dashboard/maintenance/work?project=${encoded}`
    );
  };

  return (
    <div className="space-y-5">
      <DashboardFilters
        options={data?.options}
        filters={filters}
        range={range}
        onChange={handleChange}
        onReset={handleReset}
      />

      {customInvalid && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          Pick both a <b>From</b> and a <b>To</b> date/time, with From before To.
        </p>
      )}
      {selectedTypeMissing && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          {pmTypeLabel(stored.pmType)} has no checklist set up yet, so no fixture has this PM. Send the checklist and
          the test areas it applies to, and it will start tracking here.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className={`space-y-5 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
        {/* ---------- current status ---------- */}
        <section className="space-y-2">
          <SectionTitle title="Current PM status" hint="As of right now. The date range does not change these numbers." />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile
              icon="✅"
              label="Up to date"
              value={pct == null ? (data ? "—" : null) : `${pct}%`}
              sublabel={data ? `${totals.ok + totals.due_soon} of ${activePMCount(totals)} fixtures` : null}
              className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
            />
            <KpiTile
              icon="⛔"
              label="Overdue"
              value={data ? totals.overdue : null}
              sublabel="Past due date"
              className={PM_STATE_META.overdue.tile}
              onClick={data ? () => onOpenTodo("overdue") : undefined}
            />
            <KpiTile
              icon="⏰"
              label="Due soon"
              value={data ? totals.due_soon : null}
              sublabel="Plan these next"
              className={PM_STATE_META.due_soon.tile}
              onClick={data ? () => onOpenTodo("due_soon") : undefined}
            />
            <KpiTile
              icon="🆕"
              label="Never done"
              value={data ? totals.never : null}
              sublabel="First PM not due yet"
              className={PM_STATE_META.never.tile}
              onClick={data ? () => onOpenTodo("never") : undefined}
            />
            <KpiTile
              icon="⏸"
              label="Paused"
              value={data ? totals.paused : null}
              sublabel="Out of service"
              className={PM_STATE_META.paused.tile}
            />
            <KpiTile
              icon="⚠"
              label="Open issues"
              value={data ? data.open_issues : null}
              sublabel="Failed tasks not fixed"
              className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
              onClick={data ? () => onOpenTab("issues") : undefined}
            />
          </div>
          {totals.fixtures > 0 && (
            <div className="space-y-1">
              <StatusBar counts={totals} className="h-2.5" />
              <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                {BAR_ORDER.map((state) => (
                  <span key={state} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${PM_STATE_META[state].dot}`} />
                    {PM_STATE_META[state].label} {totals[state]}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data && totals.fixtures === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No PM fixtures match these filters.</p>
          )}
        </section>

        {/* ---------- activity in range ---------- */}
        <section className="space-y-2">
          <SectionTitle title="PM activity" hint={rangeLabel} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile
              icon="🛠"
              label="PMs completed"
              value={activity?.completed}
              sublabel={activity ? `${activity.fixtures_serviced} fixtures serviced` : null}
              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
              onClick={activity ? () => onOpenTab("completed") : undefined}
            />
            <KpiTile
              icon="👍"
              label="Passed"
              value={activity?.passed}
              sublabel={passRate == null ? null : `${passRate}% pass rate`}
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
            />
            <KpiTile
              icon="❌"
              label="With failed tasks"
              value={activity?.failed}
              sublabel="Needed repair or follow-up"
              className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            />
            <KpiTile
              icon="🔎"
              label="Issues found"
              value={activity?.issues_opened}
              sublabel={activity ? `${activity.issues_resolved} fixed in this range` : null}
              className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
            />
            <KpiTile
              icon="📦"
              label="Parts from stock"
              value={activity?.parts_used}
              sublabel="Units used during PMs"
              className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
            />
            <KpiTile
              icon="👷"
              label="Technicians"
              value={activity?.technicians}
              sublabel={activity?.top_technicians?.[0] ? `Top: ${activity.top_technicians[0].name}` : null}
              className="border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="PMs completed" subtitle={rangeLabel}>
              {activity ? (
                activity.completed === 0 ? (
                  <EmptyNote>No PMs were completed in this range.</EmptyNote>
                ) : (
                  <PMActivityChart
                    points={activity.chart_points}
                    from={range.from}
                    to={range.to}
                    truncated={activity.chart_truncated}
                  />
                )
              ) : (
                <EmptyNote>Loading…</EmptyNote>
              )}
            </Panel>

            <ComplianceTrendChart project={stored.project} testArea={stored.testArea} pmType={stored.pmType} />

            <Panel title="By project & test area" subtitle="Click a row to open its fixtures">
              {!status ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : status.locations.length === 0 ? (
                <EmptyNote>No PM fixtures match these filters.</EmptyNote>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-2">Project</th>
                        <th className="px-3 py-2">Test area</th>
                        <th className="px-3 py-2 text-right">Fixtures</th>
                        <th className="w-40 px-3 py-2">Up to date</th>
                        <th className="px-3 py-2 text-right text-red-600 dark:text-red-400">Overdue</th>
                        <th className="px-3 py-2 text-right text-yellow-700 dark:text-yellow-400">Due soon</th>
                        <th className="hidden px-3 py-2 text-right sm:table-cell">Never</th>
                        <th className="hidden px-3 py-2 text-right sm:table-cell">Paused</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {status.locations.map((loc) => {
                        const locPct = upToDatePct(loc);
                        return (
                          <tr
                            key={`${loc.project_name}-${loc.test_area}`}
                            onClick={() => openLocation(loc)}
                            className="cursor-pointer hover:bg-blue-50/60 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-2 font-semibold text-gray-800 dark:text-gray-100">{loc.project_name || "—"}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{loc.test_area || "—"}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{loc.fixtures}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <StatusBar counts={loc} className="h-1.5 flex-1" />
                                <span
                                  className={`w-9 text-right text-xs font-bold ${
                                    locPct == null
                                      ? "text-gray-400"
                                      : locPct >= 90
                                        ? "text-green-600 dark:text-green-400"
                                        : locPct >= 70
                                          ? "text-yellow-600 dark:text-yellow-400"
                                          : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {locPct == null ? "—" : `${locPct}%`}
                                </span>
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${loc.overdue ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                              {loc.overdue}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${loc.due_soon ? "text-yellow-700 dark:text-yellow-400" : "text-gray-400"}`}>
                              {loc.due_soon}
                            </td>
                            <td className="hidden px-3 py-2 text-right text-gray-500 dark:text-gray-400 sm:table-cell">{loc.never}</td>
                            <td className="hidden px-3 py-2 text-right text-gray-500 dark:text-gray-400 sm:table-cell">{loc.paused}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="By PM type" subtitle={`Status now · completed in ${rangeLabel}`}>
              {!status ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : pmTypeEntries.length === 0 ? (
                <EmptyNote>No PM types match these filters.</EmptyNote>
              ) : (
                <ul className="space-y-3 px-4 py-3">
                  {pmTypeEntries.map(([type, counts]) => (
                    <li key={type}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{counts.label}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {counts.fixtures ? `${counts.ok + counts.due_soon}/${activePMCount(counts)} up to date` : "No fixtures"}
                        </span>
                      </div>
                      <StatusBar counts={counts} className="h-2" />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {counts.overdue > 0 && <PMStatusBadge state="overdue" label={`${counts.overdue} overdue`} />}
                        {counts.due_soon > 0 && <PMStatusBadge state="due_soon" label={`${counts.due_soon} due soon`} />}
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {counts.completed} done{counts.failed ? ` · ${counts.failed} failed` : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Up next"
              subtitle={status ? `${status.attention_total} overdue or due soon` : null}
              action={status?.attention_total ? <LinkButton onClick={() => onOpenTodo()}>View all</LinkButton> : null}
            >
              {!status ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : status.attention.length === 0 ? (
                <EmptyNote>Nothing overdue or due soon. 🎉</EmptyNote>
              ) : (
                <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
                  {status.attention.map((item) => (
                    <li key={`${item.fixture_id}-${item.pm_type}`}>
                      <button
                        type="button"
                        onClick={() => navigate(fixtureDetailUrl(item, { tab: item.pm_type }))}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {item.fixture_name}
                          </span>
                          <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {pmTypeLabel(item.pm_type)} · {item.project_name} · {item.test_area}
                            {item.production_line ? ` · ${item.production_line}` : ""}
                          </span>
                        </span>
                        <PMStatusBadge state={item.entry.state} label={describeDue(item.entry)} className="shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Top technicians" subtitle={rangeLabel}>
              {!activity ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : activity.top_technicians.length === 0 ? (
                <EmptyNote>No PMs in this range.</EmptyNote>
              ) : (
                <ul className="space-y-2 px-4 py-3">
                  {activity.top_technicians.map((tech, index) => {
                    const share = activity.completed ? (tech.count / activity.completed) * 100 : 0;
                    return (
                      <li key={`${tech.name}-${index}`} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-xs font-bold text-gray-400">{index + 1}</span>
                          <span className="flex-1 truncate text-gray-800 dark:text-gray-100">{tech.name}</span>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {tech.count} PM{tech.count === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="ml-6 mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div className="h-full bg-blue-500" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent PMs"
              subtitle={rangeLabel}
              action={activity?.recent?.length ? <LinkButton onClick={() => onOpenTab("completed")}>View all</LinkButton> : null}
            >
              {!activity ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : activity.recent.length === 0 ? (
                <EmptyNote>No PMs in this range.</EmptyNote>
              ) : (
                <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
                  {activity.recent.map((record) => (
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
                          {pmTypeLabel(record.pm_type)} · {record.performed_by || "Unknown"} · {formatDateTime(record.performed_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <ProjectLinks onOpen={openProject} />
      </div>
    </div>
  );
}

function ProjectLinks({ onOpen }) {
  const [projects, setProjects] = useState(getProjects());
  useEffect(() => {
    const update = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("projectsUpdated", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  if (!projects.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Browse fixtures by project</p>
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => (
          <button
            key={project}
            type="button"
            onClick={() => onOpen(project)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {project}
          </button>
        ))}
      </div>
    </div>
  );
}
