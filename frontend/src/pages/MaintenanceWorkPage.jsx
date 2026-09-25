import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import PMStatusBadge from "../components/maintenance/PMStatusBadge";
import BulkDescriptorEditor from "../components/maintenance/BulkDescriptorEditor";
import { isAdminUser } from "../utils/auth";
import { formatDate } from "../components/maintenance/formatDate";
import { fixtureDetailUrl } from "../components/maintenance/links";
import { PM_STATES, PM_STATE_META, describeDue } from "../components/maintenance/pmStatus";

const STATE_RANK = { overdue: 0, never: 1, due_soon: 2, ok: 3 };

function urgencyCompare(a, b) {
  const rankA = a.pm.state ? STATE_RANK[a.pm.state] : 9;
  const rankB = b.pm.state ? STATE_RANK[b.pm.state] : 9;
  if (rankA !== rankB) return rankA - rankB;
  const dueA = a.pm.days_until_due ?? Infinity;
  const dueB = b.pm.days_until_due ?? Infinity;
  if (dueA !== dueB) return dueA - dueB;
  return (a.fixture_name || "").localeCompare(b.fixture_name || "");
}

function FixtureCard({ fixture, onOpen }) {
  const { pm } = fixture;
  const accent = pm.state ? PM_STATE_META[pm.state].dot : "bg-gray-200 dark:bg-gray-700";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative overflow-hidden text-left bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-md p-4 pl-5 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all"
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 leading-tight">{fixture.fixture_name}</h3>
        <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">#{fixture.fixture_id}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
        Asset {fixture.asset_tag || "—"} · S/N {fixture.fixture_serial_number || "—"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {fixture.production_line && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            {fixture.production_line}
          </span>
        )}
        {fixture.manufacturer && (
          <span className="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {fixture.manufacturer}
          </span>
        )}
      </div>

      {pm.pm_types.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {pm.pm_types.map((type) => {
            const entry = pm.status[type];
            return (
              <li key={type} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300">{entry.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    {entry.last_performed_at ? `Last ${formatDate(entry.last_performed_at)}` : ""}
                  </span>
                  <PMStatusBadge state={entry.state} label={describeDue(entry)} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">No PM checklist for this test area</p>
      )}
    </button>
  );
}

export default function MaintenanceWorkPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const project = params.get("project");
  const testArea = params.get("test_area");
  const stateFilter = params.get("status") || "all";

  const [fixtures, setFixtures] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("urgency");
  const [lineFilter, setLineFilter] = useState("all");
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
    if (!project) {
      navigate("/dashboard/maintenance", { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    const query = { project };
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
  }, [project, testArea, navigate]);

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
        String(fx.fixture_id),
      ].some((value) => (value || "").toLowerCase().includes(q));
    });
    const sorted = [...filtered];
    if (sortBy === "urgency") sorted.sort(urgencyCompare);
    else sorted.sort((a, b) => (a.fixture_name || "").localeCompare(b.fixture_name || ""));
    return sorted;
  }, [fixtures, search, stateFilter, lineFilter, sortBy]);

  if (!project) return null;

  const handleBack = () => {
    if (testArea) {
      navigate(`/dashboard/maintenance/test-area?project=${encodeURIComponent(project)}`);
    } else {
      navigate("/dashboard/maintenance");
    }
  };

  if (loading) {
    return <PageLoadingState title="Maintenance" onBack={handleBack} message="Loading fixtures..." />;
  }

  const locationLabel = testArea ? `${project} • ${testArea}` : project;
  const hasPM = (summary?.pm_applicable || 0) > 0;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={handleBack} />

      <div className="max-w-6xl mx-auto px-2 pb-8 space-y-4">
        <div className="text-center">
          <p className="font-semibold text-gray-700 dark:text-gray-300 text-lg">{locationLabel}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"} for this location
          </p>
        </div>

        {hasPM && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setStateFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                stateFilter === "all"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              All · {fixtures.length}
            </button>
            {PM_STATES.map((state) => (
              <button
                type="button"
                key={state}
                onClick={() => setStateFilter(state)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  stateFilter === state
                    ? "ring-2 ring-blue-500 " + PM_STATE_META[state].tile
                    : PM_STATE_META[state].tile + " opacity-80 hover:opacity-100"
                }`}
              >
                {PM_STATE_META[state].label} · {summary[state]}
              </button>
            ))}
          </div>
        )}

        {fixtures.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row max-w-3xl mx-auto">
            <input
              type="text"
              placeholder="Search by name, asset, serial, line, or manufacturer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 p-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm text-sm"
            />
            {lines.length > 0 && (
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="p-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm text-sm"
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
            {hasPM && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="p-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm text-sm"
              >
                <option value="urgency">Sort: Most urgent first</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
            )}
            {isAdmin && !bulkEditing && (
              <button
                type="button"
                onClick={() => {
                  setSavedMessage("");
                  setBulkEditing(true);
                }}
                className="shrink-0 rounded-lg border-2 border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-gray-700"
              >
                Edit line / manufacturer
              </button>
            )}
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
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFixtures.map((fx) => (
              <FixtureCard
                key={fx.fixture_id}
                fixture={fx}
                onOpen={() =>
                  navigate(
                    fixtureDetailUrl({
                      fixture_id: fx.fixture_id,
                      project_name: project,
                      test_area: testArea,
                    })
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
