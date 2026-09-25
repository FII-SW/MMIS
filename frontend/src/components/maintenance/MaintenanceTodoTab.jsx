import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import PMStatusBadge from "./PMStatusBadge";
import { formatDate } from "./formatDate";
import { fixtureDetailUrl } from "./links";
import { PM_STATE_META, PM_STATE_RANK, describeDue } from "./pmStatus";
import { PM_TYPE_LABELS, pmTypeLabel } from "./pmTypes";
import PMCalendar from "./PMCalendar";
import useStickyState from "./useStickyState";

const TODO_STATES = ["overdue", "due_soon", "never"];
const PAGE_SIZES = [25, 50, 100];
const PM_TYPE_ORDER = Object.keys(PM_TYPE_LABELS);

const naturalCompare = (a, b) =>
  (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

function taskCompare(a, b) {
  const rank = PM_STATE_RANK[a.entry.state] - PM_STATE_RANK[b.entry.state];
  if (rank) return rank;
  const dueA = a.entry.days_until_due ?? Infinity;
  const dueB = b.entry.days_until_due ?? Infinity;
  if (dueA !== dueB) return dueA - dueB;
  return naturalCompare(a.fixture.fixture_name, b.fixture.fixture_name);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportTodoCsv(tasks) {
  const header = ["Status", "Fixture", "Project", "Test Area", "Line", "PM Type", "Due", "Next Due Date", "Last Done", "Last Done By"];
  const rows = tasks.map(({ fixture, pmType, entry }) => [
    PM_STATE_META[entry.state]?.label || entry.state,
    fixture.fixture_name,
    fixture.project_name,
    fixture.test_area,
    fixture.production_line || "",
    pmTypeLabel(pmType),
    describeDue(entry),
    entry.next_due_at ? formatDate(entry.next_due_at) : "",
    entry.last_performed_at ? formatDate(entry.last_performed_at) : "",
    entry.last_performed_by || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `PM_To_Do_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TypeCard({ pmType, counts, active, onPick }) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
        active ? "ring-2 ring-blue-600" : ""
      }`}
    >
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{pmTypeLabel(pmType)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onPick(pmType, "overdue")} disabled={!counts.overdue}>
          <PMStatusBadge
            state={counts.overdue ? "overdue" : "ok"}
            label={counts.overdue ? `${counts.overdue} overdue` : "None overdue"}
          />
        </button>
        {counts.due_soon > 0 && (
          <button type="button" onClick={() => onPick(pmType, "due_soon")}>
            <PMStatusBadge state="due_soon" label={`${counts.due_soon} due soon`} />
          </button>
        )}
        {counts.never > 0 && (
          <button type="button" onClick={() => onPick(pmType, "never")}>
            <PMStatusBadge state="never" label={`${counts.never} never done`} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MaintenanceTodoTab({ status = "all", onStatusChange }) {
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useStickyState("mmis:pm-todo:type", "all");
  const [projectFilter, setProjectFilter] = useStickyState("mmis:pm-todo:project", "all");
  const [view, setView] = useStickyState("mmis:pm-todo:view", "list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useStickyState("mmis:pm-todo:page-size", PAGE_SIZES[0]);

  useEffect(() => {
    API.get("/maintenance/overview", { params: { pm_only: true } })
      .then((res) => setFixtures(res.data?.fixtures || []))
      .catch((err) => {
        console.error("Error loading PM to-do list:", err);
        setError("Failed to load the PM to-do list.");
      })
      .finally(() => setLoading(false));
  }, []);

  const tasks = useMemo(
    () =>
      fixtures.flatMap((fixture) =>
        (fixture.pm?.pm_types || [])
          .map((pmType) => ({ fixture, pmType, entry: fixture.pm.status[pmType] }))
          .filter((task) => TODO_STATES.includes(task.entry?.state))
      ),
    [fixtures]
  );

  const typeCounts = useMemo(() => {
    const counts = {};
    tasks.forEach(({ pmType, entry }) => {
      counts[pmType] ||= { overdue: 0, due_soon: 0, never: 0 };
      counts[pmType][entry.state] += 1;
    });
    return PM_TYPE_ORDER.filter((type) => counts[type]).map((type) => [type, counts[type]]);
  }, [tasks]);

  const projects = useMemo(
    () => [...new Set(tasks.map((t) => t.fixture.project_name).filter(Boolean))].sort(naturalCompare),
    [tasks]
  );

  const activeType = typeCounts.some(([type]) => type === typeFilter) ? typeFilter : "all";
  const activeProject = projects.includes(projectFilter) ? projectFilter : "all";

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(({ fixture, pmType }) => {
      if (activeType !== "all" && pmType !== activeType) return false;
      if (activeProject !== "all" && fixture.project_name !== activeProject) return false;
      if (!q) return true;
      return [
        fixture.fixture_name,
        fixture.project_name,
        fixture.test_area,
        fixture.production_line,
        fixture.manufacturer,
        fixture.asset_tag,
      ].some((value) => (value || "").toLowerCase().includes(q));
    });
  }, [tasks, search, activeType, activeProject]);

  const stateCounts = useMemo(() => {
    const counts = { overdue: 0, due_soon: 0, never: 0 };
    scoped.forEach(({ entry }) => {
      counts[entry.state] += 1;
    });
    return counts;
  }, [scoped]);

  const visible = useMemo(
    () => scoped.filter(({ entry }) => status === "all" || entry.state === status).sort(taskCompare),
    [scoped, status]
  );

  useEffect(() => {
    setPage(1);
  }, [search, activeType, activeProject, status, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageTasks = visible.slice(pageStart, pageStart + pageSize);

  const pickTypeState = (pmType, state) => {
    setTypeFilter(pmType);
    onStatusChange(state);
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading PM to-do list…</p>;
  }
  if (error) {
    return <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (tasks.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-8 text-center shadow dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 text-4xl">✅</div>
        <p className="font-semibold text-gray-800 dark:text-gray-100">All PMs are up to date</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing is overdue, due soon, or waiting for a first PM.</p>
      </div>
    );
  }

  const statusChips = [
    { id: "all", label: "All to do", count: scoped.length },
    ...TODO_STATES.map((state) => ({ id: state, label: PM_STATE_META[state].label, count: stateCounts[state] })),
  ];

  return (
    <div className="space-y-4">
      {typeCounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {typeCounts.map(([pmType, counts]) => (
            <TypeCard
              key={pmType}
              pmType={pmType}
              counts={counts}
              active={activeType === pmType}
              onPick={pickTypeState}
            />
          ))}
        </div>
      )}

      <div className="sticky top-0 z-10 space-y-2 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
        <div className="flex flex-wrap gap-2">
          {statusChips.map((chip) => {
            const active = status === chip.id;
            const meta = PM_STATE_META[chip.id];
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onStatusChange(chip.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  meta ? meta.tile : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                } ${active ? "ring-2 ring-blue-600" : "opacity-80 hover:opacity-100"}`}
              >
                {meta && <span className={`h-2 w-2 rounded-full ${meta.dot}`} />}
                {chip.label}
                <span className="rounded-full bg-white/70 px-1.5 text-[11px] dark:bg-black/20">{chip.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fixture, project, test area, line, manufacturer…"
            className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={activeType}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by PM type"
              className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="all">All PM types</option>
              {typeCounts.map(([pmType]) => (
                <option key={pmType} value={pmType}>
                  {pmTypeLabel(pmType)}
                </option>
              ))}
            </select>
            <select
              value={activeProject}
              onChange={(e) => setProjectFilter(e.target.value)}
              aria-label="Filter by project"
              className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
              {[
                ["list", "☰ List"],
                ["calendar", "📅 Calendar"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`px-3 py-2 text-sm font-semibold ${
                    view === id
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportTodoCsv(visible)}
              disabled={visible.length === 0}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No PMs match these filters.</p>
      ) : view === "calendar" ? (
        <PMCalendar
          tasks={visible}
          onOpen={({ fixture, pmType }) => navigate(fixtureDetailUrl(fixture, { tab: pmType }))}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Fixture</th>
                  <th className="px-3 py-3">PM</th>
                  <th className="px-3 py-3 hidden md:table-cell">Due date</th>
                  <th className="px-3 py-3 hidden lg:table-cell">Last done</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {pageTasks.map(({ fixture, pmType, entry }) => (
                  <tr
                    key={`${fixture.fixture_id}-${pmType}`}
                    className="hover:bg-blue-50/60 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-3 py-2.5 align-top">
                      <PMStatusBadge state={entry.state} label={describeDue(entry)} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{fixture.fixture_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fixture.project_name} · {fixture.test_area}
                        {fixture.production_line ? ` · ${fixture.production_line}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top font-medium text-gray-700 dark:text-gray-200">
                      {pmTypeLabel(pmType)}
                    </td>
                    <td className="px-3 py-2.5 align-top hidden md:table-cell text-gray-700 dark:text-gray-300">
                      {formatDate(entry.next_due_at)}
                    </td>
                    <td className="px-3 py-2.5 align-top hidden lg:table-cell text-xs text-gray-600 dark:text-gray-400">
                      {entry.last_performed_at ? (
                        <>
                          {formatDate(entry.last_performed_at)}
                          {entry.covered_by && ` (via ${pmTypeLabel(entry.covered_by)})`}
                          <br />
                          {entry.last_performed_by || "Unknown"}
                        </>
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right">
                      <button
                        type="button"
                        onClick={() => navigate(fixtureDetailUrl(fixture, { tab: pmType }))}
                        className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Start PM →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {visible.length > 0 && view !== "calendar" && (
        <div className="flex flex-col items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row">
          <span>
            Showing <b>{pageStart + 1}</b>–<b>{Math.min(pageStart + pageSize, visible.length)}</b> of <b>{visible.length}</b>
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              Rows
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              ‹ Prev
            </button>
            <span className="text-xs">
              Page {currentPage} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
