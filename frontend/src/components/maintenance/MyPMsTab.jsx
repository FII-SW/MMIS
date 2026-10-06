import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationContext";
import PMStatusBadge from "./PMStatusBadge";
import { formatDate } from "./formatDate";
import { fixtureDetailUrl } from "./links";
import { assignedByText } from "./assignment";
import { PM_STATE_META, PM_STATE_RANK, describeDue } from "./pmStatus";
import { pmTypeLabel } from "./pmTypes";

const STATE_FILTERS = ["overdue", "due_soon", "never", "ok", "paused"];
const NEW_FOR_DAYS = 7;
const ASSIGNMENT_KINDS = ["pm_assignment", "pm_unassignment", "pm_weekly"];

const naturalCompare = (a, b) =>
  (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

function stateRank(state) {
  return PM_STATE_RANK[state] ?? 9;
}

/** The PM type to open first: most urgent state, then soonest due. */
function mostUrgentType(fixture) {
  const entries = Object.entries(fixture.pm?.status || {});
  entries.sort(
    ([, a], [, b]) =>
      stateRank(a.state) - stateRank(b.state) || (a.days_until_due ?? Infinity) - (b.days_until_due ?? Infinity)
  );
  return entries[0]?.[0] || null;
}

function isNew(fixture) {
  if (!fixture.pm_assigned_at) return false;
  const assigned = new Date(fixture.pm_assigned_at).getTime();
  return Date.now() - assigned < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}

function SummaryTile({ state, count, active, onClick }) {
  const meta = PM_STATE_META[state];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!count && !active}
      className={`rounded-xl border p-3 text-left shadow-sm transition disabled:cursor-default disabled:opacity-50 ${meta.tile} ${
        active ? "ring-2 ring-blue-600" : "hover:shadow-md"
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
      <span className="mt-1 block text-2xl font-bold">{count}</span>
    </button>
  );
}

function FixtureRow({ fixture, onOpen }) {
  const pm = fixture.pm || {};
  const urgentType = mostUrgentType(fixture);
  const needsWork = ["overdue", "due_soon", "never"].includes(pm.state);
  const lastDone = Object.values(pm.status || {})
    .map((entry) => entry.last_performed_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center hover:bg-blue-50/50 dark:hover:bg-gray-700/40">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{fixture.fixture_name}</p>
          {isNew(fixture) && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              New
            </span>
          )}
          {fixture.pm_paused && fixture.pm_pause_reason && (
            <span className="text-xs text-slate-600 dark:text-slate-300">⏸ {fixture.pm_pause_reason}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {[fixture.production_line && `Line ${fixture.production_line}`, fixture.asset_tag && `Asset ${fixture.asset_tag}`]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          📋 {assignedByText(fixture.pm_assigned_by, fixture.pm_assigned_at, { toYou: true })}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(pm.pm_types || []).length === 0 ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">No PM schedule for this test area</span>
          ) : (
            pm.pm_types.map((pmType) => {
              const entry = pm.status[pmType];
              return (
                <button
                  key={pmType}
                  type="button"
                  onClick={() => onOpen(fixture, pmType)}
                  title={entry.next_due_at ? `Next due ${formatDate(entry.next_due_at)}` : undefined}
                >
                  <PMStatusBadge state={entry.state} label={`${pmTypeLabel(pmType)}: ${describeDue(entry)}`} />
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
          Last PM
          <br />
          <span className="font-medium text-gray-700 dark:text-gray-200">{lastDone ? formatDate(lastDone) : "Never"}</span>
        </span>
        <button
          type="button"
          onClick={() => onOpen(fixture, urgentType)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm ${
            needsWork
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {needsWork ? `Start ${pmTypeLabel(urgentType)} →` : "Open →"}
        </button>
      </div>
    </li>
  );
}

export default function MyPMsTab({ data, loading, error, onReload, onOpenTodo }) {
  const navigate = useNavigate();
  const { serverItems, markServerRead } = useNotifications();
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  // Opening My PMs counts as having seen the assignment notifications.
  useEffect(() => {
    serverItems
      .filter((n) => !n.read && ASSIGNMENT_KINDS.includes(n.kind))
      .forEach((n) => markServerRead(n));
  }, [serverItems, markServerRead]);

  const fixtures = useMemo(() => data?.fixtures || [], [data]);
  const summary = data?.summary || {};
  const newCount = fixtures.filter(isNew).length;

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byGroup = new Map();
    fixtures
      .filter((f) => stateFilter === "all" || f.pm?.state === stateFilter)
      .filter(
        (f) =>
          !q ||
          [f.fixture_name, f.project_name, f.test_area, f.production_line, f.asset_tag].some((v) =>
            (v || "").toLowerCase().includes(q)
          )
      )
      .forEach((f) => {
        const key = `${f.project_name} · ${f.test_area}`;
        if (!byGroup.has(key)) {
          byGroup.set(key, {
            key,
            project: f.project_name,
            testArea: f.test_area,
            fixtures: [],
            attention: 0,
            overdue: 0,
          });
        }
        const group = byGroup.get(key);
        group.fixtures.push(f);
        if (["overdue", "due_soon"].includes(f.pm?.state)) group.attention += 1;
        if (f.pm?.state === "overdue") group.overdue += 1;
      });
    const list = [...byGroup.values()];
    list.forEach((g) =>
      g.fixtures.sort(
        (a, b) =>
          stateRank(a.pm?.state) - stateRank(b.pm?.state) ||
          (a.pm?.days_until_due ?? Infinity) - (b.pm?.days_until_due ?? Infinity) ||
          naturalCompare(a.fixture_name, b.fixture_name)
      )
    );
    return list.sort(
      (a, b) => b.attention - a.attention || naturalCompare(a.project, b.project) || naturalCompare(a.testArea, b.testArea)
    );
  }, [fixtures, stateFilter, search]);

  const openFixture = (fixture, pmType) => navigate(fixtureDetailUrl(fixture, { tab: pmType }));

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading your PM fixtures…</p>;
  }
  if (error) {
    return (
      <div className="py-10 text-center text-sm">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button type="button" onClick={onReload} className="mt-2 font-semibold text-blue-600 hover:underline dark:text-blue-400">
          Try again
        </button>
      </div>
    );
  }
  if (fixtures.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 text-4xl">👤</div>
        <p className="font-semibold text-gray-800 dark:text-gray-100">No fixtures are assigned to you yet</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          When your Super Admin assigns fixtures to you, they show up here and you get a notification in the 🔔 bell.
        </p>
        <button
          type="button"
          onClick={() => onOpenTodo()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          See all PMs to do
        </button>
      </div>
    );
  }

  const attention = (summary.overdue || 0) + (summary.due_soon || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm dark:border-blue-900 dark:from-blue-950/40 dark:to-gray-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">
              You're responsible for {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {attention > 0
                ? `${[summary.overdue && `${summary.overdue} overdue`, summary.due_soon && `${summary.due_soon} due soon`]
                    .filter(Boolean)
                    .join(" and ")} — start with the ones at the top.`
                : "Everything assigned to you is on track. Nice work!"}
            </p>
          </div>
          {newCount > 0 && (
            <span className="self-start rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white sm:self-center">
              {newCount} new in the last {NEW_FOR_DAYS} days
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATE_FILTERS.map((state) => (
          <SummaryTile
            key={state}
            state={state}
            count={summary[state] || 0}
            active={stateFilter === state}
            onClick={() => setStateFilter((prev) => (prev === state ? "all" : state))}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your fixtures, line or asset tag…"
          className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        {stateFilter !== "all" && (
          <button
            type="button"
            onClick={() => setStateFilter("all")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Show all ({fixtures.length})
          </button>
        )}
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No fixtures match these filters.</p>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsed[group.key];
          return (
            <section
              key={group.key}
              className="overflow-hidden rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between gap-3 border-b bg-gray-50 px-4 py-2.5 text-left dark:border-gray-700 dark:bg-gray-900/60"
              >
                <span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">{group.project}</span>
                  <span className="text-gray-500 dark:text-gray-400"> · {group.testArea}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  {group.attention > 0 && (
                    <PMStatusBadge
                      state={group.overdue ? "overdue" : "due_soon"}
                      label={`${group.attention} need${group.attention === 1 ? "s" : ""} attention`}
                    />
                  )}
                  {group.fixtures.length} fixture{group.fixtures.length === 1 ? "" : "s"}
                  <svg
                    className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              {!isCollapsed && (
                <ul className="divide-y dark:divide-gray-700">
                  {group.fixtures.map((fixture) => (
                    <FixtureRow key={fixture.fixture_id} fixture={fixture} onOpen={openFixture} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
