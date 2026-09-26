import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import BulkDescriptorEditor from "../components/maintenance/BulkDescriptorEditor";
import FixturePMTable from "../components/maintenance/FixturePMTable";
import useStickyState from "../components/maintenance/useStickyState";
import { isAdminUser } from "../utils/auth";
import {
  MAINTENANCE_DASHBOARD_URL,
  MAINTENANCE_PROJECTS_URL,
  fixtureDetailUrl,
  testAreaUrl,
} from "../components/maintenance/links";
import {
  PM_STATES,
  PM_STATE_META,
  PM_STATE_RANK as STATE_RANK,
  activePMCount,
} from "../components/maintenance/pmStatus";
import { PM_TYPE_LABELS } from "../components/maintenance/pmTypes";

const PAGE_SIZES = [25, 50, 100];
const PM_TYPE_ORDER = Object.keys(PM_TYPE_LABELS);

const naturalCompare = (a, b) =>
  (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

function urgencyCompare(a, b) {
  const rankA = a.pm.state ? STATE_RANK[a.pm.state] : 9;
  const rankB = b.pm.state ? STATE_RANK[b.pm.state] : 9;
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.pm.days_until_due ?? Infinity;
  const dueB = b.pm.days_until_due ?? Infinity;
  if (dueA !== dueB) return dueA - dueB;
  return naturalCompare(a.fixture_name, b.fixture_name);
}

function textCompare(field) {
  return (a, b) => {
    const valueA = a[field];
    const valueB = b[field];
    if (!valueA && valueB) return 1;
    if (valueA && !valueB) return -1;
    return naturalCompare(valueA, valueB) || naturalCompare(a.fixture_name, b.fixture_name);
  };
}

const COMPARATORS = {
  urgency: urgencyCompare,
  name: (a, b) => naturalCompare(a.fixture_name, b.fixture_name),
  line: textCompare("production_line"),
  manufacturer: textCompare("manufacturer"),
};

const SORT_OPTIONS = [
  { value: "urgency", label: "Most urgent first" },
  { value: "name", label: "Fixture name" },
  { value: "line", label: "Production line" },
  { value: "manufacturer", label: "Manufacturer" },
];

function StatusPill({ label, value, active, onClick, meta }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition-all ${
        meta ? meta.tile : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
      } ${active ? "ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-gray-900" : "hover:shadow-md"}`}
    >
      {meta && <span className={`h-2 w-2 rounded-full ${meta.dot}`} />}
      {label}
      <span className="rounded-full bg-white/70 px-1.5 text-xs dark:bg-black/20">{value}</span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.08 3.08a.75.75 0 11-1.06 1.06l-3.08-3.08A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function MaintenanceWorkPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const project = params.get("project");
  const testArea = params.get("test_area");
  const allMode = !project && params.get("all") === "1";
  const stateFilter = params.get("status") || "all";

  const [fixtures, setFixtures] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useStickyState("mmis:pm-work:sort", "urgency");
  const [sortDir, setSortDir] = useStickyState("mmis:pm-work:sort-dir", "asc");
  const [lineFilter, setLineFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useStickyState("mmis:pm-work:page-size", PAGE_SIZES[0]);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const isAdmin = isAdminUser();

  const handleBulkSaved = (updates) => {
    const byId = Object.fromEntries(updates.map((u) => [u.fixture_id, u]));
    setFixtures((prev) =>
      prev.map((fx) =>
        byId[fx.fixture_id]
          ? {
              ...fx,
              manufacturer: byId[fx.fixture_id].manufacturer,
              production_line: byId[fx.fixture_id].production_line,
            }
          : fx
      )
    );
    setBulkEditing(false);
    setSavedMessage(`Saved production info for ${updates.length} fixture${updates.length === 1 ? "" : "s"}.`);
  };
  const [error, setError] = useState("");

  useEffect(() => {
    if (!project && !allMode) {
      navigate(MAINTENANCE_PROJECTS_URL, { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    const query = allMode ? { pm_only: true } : { project };
    if (testArea) query.test_area = testArea;
    API.get("/maintenance/overview", { params: query })
      .then((res) => {
        setFixtures(res.data?.fixtures || []);
        setSummary(res.data?.summary || null);
      })
      .catch((err) => {
        console.error("Error loading fixtures:", err);
        setFixtures([]);
        setSummary(null);
        setError("Failed to load fixtures. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [project, testArea, allMode, navigate]);

  const setStateFilter = (value) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    setParams(next, { replace: true });
  };

  const lines = useMemo(
    () =>
      [...new Set(fixtures.map((fx) => fx.production_line).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [fixtures]
  );

  const visibleFixtures = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = fixtures.filter((fx) => {
      if (stateFilter !== "all" && fx.pm.state !== stateFilter) return false;
      if (lineFilter === "none" && fx.production_line) return false;
      if (lineFilter !== "all" && lineFilter !== "none" && fx.production_line !== lineFilter) return false;
      if (!q) return true;
      return [
        fx.fixture_name,
        fx.asset_tag,
        fx.fixture_serial_number,
        fx.manufacturer,
        fx.production_line,
        fx.project_name,
        fx.test_area,
      ].some((value) => (value || "").toLowerCase().includes(q));
    });
    const compare = COMPARATORS[sortKey] || urgencyCompare;
    const sorted = [...filtered].sort(compare);
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [fixtures, search, stateFilter, lineFilter, sortKey, sortDir]);

  const pmTypeColumns = useMemo(() => {
    const present = new Set(fixtures.flatMap((fx) => fx.pm?.pm_types || []));
    return PM_TYPE_ORDER.filter((type) => present.has(type));
  }, [fixtures]);

  useEffect(() => {
    setPage(1);
  }, [search, stateFilter, lineFilter, sortKey, sortDir, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visibleFixtures.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageFixtures = visibleFixtures.slice(pageStart, pageStart + pageSize);

  const handleSort = (column) => {
    if (column === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDir("asc");
    }
  };

  const openFixture = (fx, pmType) => {
    const target = allMode
      ? fx
      : { fixture_id: fx.fixture_id, project_name: project, test_area: testArea };
    navigate(fixtureDetailUrl(target, pmType ? { tab: pmType } : {}));
  };

  const filtersActive = Boolean(search.trim()) || lineFilter !== "all" || stateFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setLineFilter("all");
    setStateFilter("all");
  };

  if (!project && !allMode) return null;

  const handleBack = () => {
    if (allMode) {
      navigate(MAINTENANCE_DASHBOARD_URL);
    } else if (testArea) {
      navigate(testAreaUrl(project));
    } else {
      navigate(MAINTENANCE_PROJECTS_URL);
    }
  };

  if (loading) {
    return <PageLoadingState title="Maintenance" onBack={handleBack} message="Loading fixtures..." />;
  }

  const locationLabel = allMode
    ? "All projects · PM fixtures"
    : testArea
      ? `${project} • ${testArea}`
      : project;
  const hasPM = (summary?.pm_applicable || 0) > 0;
  const activeCount = activePMCount(summary);
  const upToDatePct = activeCount
    ? Math.round((((summary.ok || 0) + (summary.due_soon || 0)) / activeCount) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={handleBack} />

      <p className="mb-2 px-4 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
        {allMode ? (
          "All projects · PM fixtures"
        ) : (
          <>
            Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
            {testArea && (
              <>
                {" "}
                — Test Area: <span className="text-blue-600 dark:text-blue-400">{testArea}</span>
              </>
            )}
          </>
        )}
      </p>
      <p className="mb-1 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">Select Fixture</p>
      <p className="mb-5 text-center text-sm text-gray-500 dark:text-gray-400">
        {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"}
        {pmTypeColumns.length > 0 && ` · ${pmTypeColumns.map((t) => PM_TYPE_LABELS[t]).join(" & ")}`}
        {hasPM && ` · ${upToDatePct}% PM up to date`}
      </p>

      <div className="max-w-7xl mx-auto px-2 pb-8 space-y-4">
        {hasPM && (
          <div className="flex flex-wrap justify-center gap-2">
            <StatusPill label="All" value={fixtures.length} active={stateFilter === "all"} onClick={() => setStateFilter("all")} />
            {PM_STATES.filter((state) => summary[state] > 0).map((state) => (
              <StatusPill
                key={state}
                label={PM_STATE_META[state].label}
                value={summary[state]}
                meta={PM_STATE_META[state]}
                active={stateFilter === state}
                onClick={() => setStateFilter(stateFilter === state ? "all" : state)}
              />
            ))}
          </div>
        )}

        {fixtures.length > 0 && (
          <div className="sticky top-0 z-10 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Search fixture, asset, serial, line, or manufacturer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {lines.length > 0 && (
                  <select
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                    aria-label="Filter by production line"
                    className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="all">All lines</option>
                    {lines.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                    <option value="none">Line not set</option>
                  </select>
                )}
                <select
                  value={sortKey}
                  onChange={(e) => {
                    setSortKey(e.target.value);
                    setSortDir("asc");
                  }}
                  aria-label="Sort fixtures"
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Sort: {opt.label}
                    </option>
                  ))}
                </select>
                {isAdmin && !bulkEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setSavedMessage("");
                      setBulkEditing(true);
                    }}
                    className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-gray-700"
                  >
                    Edit line / manufacturer
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {visibleFixtures.length === fixtures.length
                  ? `${fixtures.length} fixtures`
                  : `${visibleFixtures.length} of ${fixtures.length} fixtures match`}
                {stateFilter !== "all" && ` · ${PM_STATE_META[stateFilter]?.label || stateFilter}`}
                {lineFilter !== "all" && ` · ${lineFilter === "none" ? "Line not set" : lineFilter}`}
              </span>
              <span className="flex items-center gap-3">
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    Clear filters
                  </button>
                )}
                <span className="hidden sm:inline">Tip: click a PM status to open that checklist</span>
              </span>
            </div>
          </div>
        )}

        {savedMessage && (
          <p className="text-center text-sm font-medium text-green-700 dark:text-green-400">{savedMessage}</p>
        )}

        {error && <p className="text-center text-red-600 dark:text-red-400 text-sm">{error}</p>}

        {bulkEditing && visibleFixtures.length > 0 ? (
          <BulkDescriptorEditor
            fixtures={visibleFixtures}
            onClose={() => setBulkEditing(false)}
            onSaved={handleBulkSaved}
          />
        ) : visibleFixtures.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-3">🔧</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {fixtures.length === 0 ? "No fixtures found" : "No matching fixtures"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {fixtures.length === 0
                ? `There are no fixtures registered for ${locationLabel}.`
                : "Try a different search term or status filter."}
            </p>
            {fixtures.length > 0 && filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <FixturePMTable
              fixtures={pageFixtures}
              pmTypes={pmTypeColumns}
              showLocation={allMode}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onOpen={openFixture}
            />

            <div className="flex flex-col items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row">
              <span>
                Showing <b>{pageStart + 1}</b>–<b>{Math.min(pageStart + pageSize, visibleFixtures.length)}</b> of{" "}
                <b>{visibleFixtures.length}</b>
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
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
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
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  Next ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
