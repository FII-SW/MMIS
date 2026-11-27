import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import { isViewerUser } from "../../utils/auth";
import { AnimatedNumber, HealthRing, LiveOpsClock } from "../DashboardMissionControl";
import DashboardFilters from "./DashboardFilters";
import PMActivityChart from "./PMActivityChart";
import PMStatusBadge from "./PMStatusBadge";
import { formatRange, fromLocalInput, presetRange, rangeToParams, toLocalInput } from "./dateRanges";
import { formatDateTime } from "./formatDate";
import { MAINTENANCE_PROJECTS_URL, fixtureDetailUrl, fixtureListUrl } from "./links";
import { PM_STATE_META, activePMCount } from "./pmStatus";
import { PM_TYPE_LABELS, pmTypeLabel } from "./pmTypes";
import useStickyState from "./useStickyState";

const DEFAULT_FILTERS = { project: "", testArea: "", pmType: "all", preset: "7d", from: "", to: "" };
const BAR_ORDER = ["ok", "due_soon", "overdue", "never"];

function upToDatePct(counts) {
  const active = activePMCount(counts);
  return active ? Math.round((((counts.ok || 0) + (counts.due_soon || 0)) / active) * 100) : null;
}

function StatusBar({ counts, className = "h-1.5" }) {
  const total = counts ? BAR_ORDER.reduce((sum, state) => sum + (counts[state] || 0), 0) : 0;
  return (
    <div className={`flex w-full overflow-hidden bg-slate-200/80 dark:bg-slate-700 ${className}`}>
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

function Panel({ title, subtitle, action, children, delay = 0 }) {
  return (
    <div
      className="mmis-pm-panel mmis-pm-stat overflow-hidden rounded-2xl"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/80">
        <div className="min-w-0">
          <p className="mmis-pm-font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </p>
          {subtitle && (
            <p className="mmis-pm-font-mono truncate text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">{children}</p>;
}

function LinkButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-teal-700 hover:underline dark:text-teal-300"
    >
      {children}
    </button>
  );
}

function HeroStat({ label, value, tone = "default", onClick, delay = 0 }) {
  const tones = {
    default: "text-white",
    danger: "text-orange-300",
    warn: "text-amber-200",
    ok: "text-teal-200",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`mmis-pm-stat rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left backdrop-blur-sm transition hover:bg-white/10 ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="mmis-pm-font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-100/70">
        {label}
      </p>
      <p className={`mmis-pm-font-display mt-0.5 text-2xl font-extrabold tabular-nums ${tones[tone]}`}>
        {value == null ? "—" : <AnimatedNumber value={value} />}
      </p>
    </Tag>
  );
}

function ActivityKpi({ label, value, sub, accent, onClick, delay = 0 }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`mmis-pm-panel mmis-pm-stat group relative overflow-hidden rounded-2xl p-3 text-left ${
        onClick ? "cursor-pointer transition hover:-translate-y-0.5" : ""
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <p className="mmis-pm-font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mmis-pm-font-display mt-1 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
        {value == null ? "—" : <AnimatedNumber value={value} />}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </Tag>
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

export default function MaintenanceDashboardTab({ onOpenTab }) {
  const navigate = useNavigate();
  const viewOnly = isViewerUser();
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
  const activity = data?.activity;
  const totals = status?.totals;
  const healthPct = upToDatePct(totals || {});
  const passRate = activity?.completed ? Math.round((activity.passed / activity.completed) * 100) : null;
  const rangeLabel = formatRange(range.from, range.to);
  const pmTypeEntries = Object.entries(status?.by_pm_type || {}).sort(
    ([a], [b]) => Object.keys(PM_TYPE_LABELS).indexOf(a) - Object.keys(PM_TYPE_LABELS).indexOf(b)
  );
  const selectedTypeMissing =
    stored.pmType !== "all" && data?.options?.pm_types?.some((t) => t.value === stored.pmType && !t.configured);
  const attention = status?.attention || [];
  const ringColor =
    healthPct == null ? "#94a3b8" : healthPct >= 90 ? "#2dd4bf" : healthPct >= 70 ? "#fbbf24" : "#fb923c";

  const openLocation = (loc) => navigate(fixtureListUrl(loc.project_name, loc.test_area));

  return (
    <div className="space-y-5">
      {/* Hero — floor ops command */}
      <section className="mmis-pm-hero relative rounded-2xl px-4 py-5 text-white sm:px-6 sm:py-6">
        <div className="mmis-pm-scan" aria-hidden />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="mmis-pm-font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-200/80">
              MMIS · Preventive maintenance
            </p>
            <h1 className="mmis-pm-font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Floor ops board
            </h1>
            <p className="max-w-xl text-sm text-teal-50/75">
              Live compliance across fixtures. Filter the board, then jump into overdue work or open a line.
            </p>
            <LiveOpsClock />
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <HealthRing
              value={healthPct ?? 0}
              size={128}
              stroke={11}
              color={ringColor}
              label="Up to date"
              sublabel="active PM"
              tone="onDark"
            />
            <div className="grid min-w-[11rem] grid-cols-2 gap-2 sm:min-w-[14rem]">
              <HeroStat
                label="Overdue"
                value={totals?.overdue}
                tone="danger"
                delay={80}
                onClick={() => onOpenTab("todo", "overdue")}
              />
              <HeroStat
                label="Due soon"
                value={totals?.due_soon}
                tone="warn"
                delay={140}
                onClick={() => onOpenTab("todo", "due_soon")}
              />
              <HeroStat label="Fixtures" value={totals?.fixtures} delay={200} />
              <HeroStat
                label="On hold"
                value={(totals?.on_hold || 0) + (totals?.development || 0) + (totals?.paused || 0)}
                tone="ok"
                delay={260}
              />
            </div>
          </div>
        </div>
      </section>

      <DashboardFilters
        options={data?.options}
        filters={filters}
        range={range}
        onChange={handleChange}
        onReset={handleReset}
      />

      {customInvalid && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Pick both a <b>From</b> and a <b>To</b> date/time, with From before To.
        </p>
      )}
      {selectedTypeMissing && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
          {pmTypeLabel(stored.pmType)} has no checklist set up yet, so no fixture has this PM.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className={`space-y-5 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="mmis-pm-font-display text-lg font-bold text-slate-900 dark:text-white">Pulse</h2>
            <span className="mmis-pm-font-mono text-[10px] uppercase tracking-wider text-slate-500">{rangeLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <ActivityKpi
              label="Completed"
              value={activity?.completed}
              sub={activity ? `${activity.fixtures_serviced} fixtures serviced` : null}
              accent="bg-teal-500"
              delay={40}
              onClick={activity ? () => onOpenTab("completed") : undefined}
            />
            <ActivityKpi
              label="Passed"
              value={activity?.passed}
              sub={passRate == null ? null : `${passRate}% pass rate`}
              accent="bg-emerald-500"
              delay={90}
            />
            <ActivityKpi
              label="Failed tasks"
              value={activity?.failed}
              sub="Needed repair or follow-up"
              accent="bg-orange-500"
              delay={140}
            />
            <ActivityKpi
              label="Issues found"
              value={activity?.issues_opened}
              sub={activity ? `${activity.issues_resolved} fixed in range` : null}
              accent="bg-amber-500"
              delay={190}
              onClick={() => onOpenTab("issues")}
            />
            <ActivityKpi
              label="Techs active"
              value={activity?.technicians}
              sub={activity?.top_technicians?.[0] ? `Top: ${activity.top_technicians[0].name}` : null}
              accent="bg-slate-500"
              delay={240}
            />
          </div>
        </section>

        {attention.length > 0 && (
          <Panel title="Needs attention now" subtitle={`${status?.attention_total || attention.length} fixtures`} delay={80}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/80">
              {attention.slice(0, 8).map((item) => (
                <li key={`${item.fixture_id}-${item.pm_type}`}>
                  <button
                    type="button"
                    onClick={() => navigate(fixtureDetailUrl(item, { tab: item.pm_type }))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-orange-50/80 dark:hover:bg-slate-800/80"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.entry?.state === "overdue" ? "bg-orange-500" : "bg-amber-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.fixture_name}
                      </span>
                      <span className="mmis-pm-font-mono block truncate text-[10px] uppercase tracking-wide text-slate-500">
                        {item.project_name} · {item.test_area} · {pmTypeLabel(item.pm_type)}
                      </span>
                    </span>
                    <PMStatusBadge state={item.entry?.state} />
                  </button>
                </li>
              ))}
            </ul>
            {(status?.attention_total || 0) > attention.length && (
              <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-700/80">
                <LinkButton onClick={() => onOpenTab("todo", "overdue")}>Open full to-do list</LinkButton>
              </div>
            )}
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Completions" subtitle={rangeLabel} delay={100}>
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

            <Panel title="By project & test area" subtitle="Click a row to open fixtures" delay={160}>
              {!status ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : status.locations.length === 0 ? (
                <EmptyNote>No PM fixtures match these filters.</EmptyNote>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80 text-left dark:bg-slate-900/40">
                      <tr className="mmis-pm-font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5">Project</th>
                        <th className="px-3 py-2.5">Test area</th>
                        <th className="px-3 py-2.5 text-right">Fx</th>
                        <th className="w-44 px-3 py-2.5">Health</th>
                        <th className="px-3 py-2.5 text-right text-orange-600 dark:text-orange-400">OD</th>
                        <th className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">Soon</th>
                        <th className="hidden px-3 py-2.5 text-right sm:table-cell">Never</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                      {status.locations.map((loc) => {
                        const locPct = upToDatePct(loc);
                        return (
                          <tr
                            key={`${loc.project_name}-${loc.test_area}`}
                            onClick={() => openLocation(loc)}
                            className="cursor-pointer transition hover:bg-teal-50/70 dark:hover:bg-teal-950/30"
                          >
                            <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                              {loc.project_name || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{loc.test_area || "—"}</td>
                            <td className="mmis-pm-font-mono px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">
                              {loc.fixtures}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <StatusBar counts={loc} className="h-1.5 flex-1" />
                                <span
                                  className={`mmis-pm-font-mono w-9 text-right text-xs font-bold ${
                                    locPct == null
                                      ? "text-slate-400"
                                      : locPct >= 90
                                        ? "text-teal-600 dark:text-teal-300"
                                        : locPct >= 70
                                          ? "text-amber-600 dark:text-amber-300"
                                          : "text-orange-600 dark:text-orange-300"
                                  }`}
                                >
                                  {locPct == null ? "—" : `${locPct}%`}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`mmis-pm-font-mono px-3 py-2.5 text-right font-semibold ${
                                loc.overdue ? "text-orange-600 dark:text-orange-400" : "text-slate-400"
                              }`}
                            >
                              {loc.overdue}
                            </td>
                            <td
                              className={`mmis-pm-font-mono px-3 py-2.5 text-right font-semibold ${
                                loc.due_soon ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                              }`}
                            >
                              {loc.due_soon}
                            </td>
                            <td className="mmis-pm-font-mono hidden px-3 py-2.5 text-right text-slate-500 sm:table-cell">
                              {loc.never}
                            </td>
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
            <Panel title="By PM type" subtitle={`Now · ${rangeLabel}`} delay={120}>
              {!status ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : pmTypeEntries.length === 0 ? (
                <EmptyNote>No PM types match these filters.</EmptyNote>
              ) : (
                <ul className="space-y-3 px-4 py-3">
                  {pmTypeEntries.map(([type, counts]) => (
                    <li key={type}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{counts.label}</span>
                        <span className="mmis-pm-font-mono text-[10px] text-slate-500">
                          {counts.fixtures
                            ? `${(counts.ok || 0) + (counts.due_soon || 0)}/${activePMCount(counts)} UT`
                            : "None"}
                        </span>
                      </div>
                      <StatusBar counts={counts} className="h-2" />
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {counts.overdue > 0 && <PMStatusBadge state="overdue" label={`${counts.overdue} overdue`} />}
                        {counts.due_soon > 0 && (
                          <PMStatusBadge state="due_soon" label={`${counts.due_soon} due soon`} />
                        )}
                        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                          {counts.completed} done{counts.failed ? ` · ${counts.failed} failed` : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Top techs" subtitle={rangeLabel} delay={180}>
              {!activity ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : activity.top_technicians.length === 0 ? (
                <EmptyNote>No PMs in this range.</EmptyNote>
              ) : (
                <ul className="space-y-2.5 px-4 py-3">
                  {activity.top_technicians.map((tech, index) => {
                    const share = activity.completed ? (tech.count / activity.completed) * 100 : 0;
                    return (
                      <li key={`${tech.name}-${index}`} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="mmis-pm-font-mono w-5 text-xs font-bold text-teal-600 dark:text-teal-300">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                            {tech.name}
                          </span>
                          <span className="mmis-pm-font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            {tech.count}
                          </span>
                        </div>
                        <div className="ml-7 mt-1 h-1 overflow-hidden bg-slate-100 dark:bg-slate-700">
                          <div
                            className="mmis-kpi-bar h-full bg-gradient-to-r from-teal-600 to-teal-400"
                            style={{ width: `${share}%`, animationDelay: `${index * 80}ms` }}
                          />
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
              delay={220}
              action={
                activity?.recent?.length ? (
                  <LinkButton onClick={() => onOpenTab("completed")}>View all</LinkButton>
                ) : null
              }
            >
              {!activity ? (
                <EmptyNote>Loading…</EmptyNote>
              ) : activity.recent.length === 0 ? (
                <EmptyNote>No PMs in this range.</EmptyNote>
              ) : (
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/80">
                  {activity.recent.map((record) => (
                    <li key={record.pm_id}>
                      <button
                        type="button"
                        onClick={() => navigate(fixtureDetailUrl(record, { tab: "history" }))}
                        className="w-full px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {record.fixture_name || `Fixture #${record.fixture_id}`}
                          </span>
                          <PMStatusBadge
                            state={record.overall_result === "failed" ? "overdue" : "ok"}
                            label={record.overall_result === "failed" ? "Failed" : "Passed"}
                          />
                        </span>
                        <span className="mmis-pm-font-mono mt-0.5 block truncate text-[10px] uppercase tracking-wide text-slate-500">
                          {pmTypeLabel(record.pm_type)} · {record.performed_by || "Unknown"} ·{" "}
                          {formatDateTime(record.performed_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="mmis-pm-panel flex flex-col items-start justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
          <div>
            <p className="mmis-pm-font-display font-bold text-slate-900 dark:text-white">
              {viewOnly ? "Look up a fixture" : "Ready to run a PM?"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Project → test area → fixture, or jump from the attention list above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(MAINTENANCE_PROJECTS_URL)}
            className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600"
          >
            Open fixtures
          </button>
        </div>
      </div>
    </div>
  );
}
