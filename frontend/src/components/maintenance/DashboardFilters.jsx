import { useMemo } from "react";
import { DEFAULT_TEST_AREAS } from "../../utils/testAreas";
import { DATE_PRESETS, formatRange, presetRange, toLocalInput } from "./dateRanges";
import { PM_TYPE_LABELS } from "./pmTypes";

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900";

function areaOrder(a, b) {
  const ia = DEFAULT_TEST_AREAS.indexOf(a);
  const ib = DEFAULT_TEST_AREAS.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  return a.localeCompare(b);
}

function Label({ children }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </span>
  );
}

/**
 * filters: { project, testArea, pmType, search, preset, from, to } (from/to are datetime-local strings)
 * range: { from: Date, to: Date } currently applied
 */
export default function DashboardFilters({ options, filters, range, onChange, onReset }) {
  const testAreas = useMemo(() => {
    const byProject = options?.test_areas || {};
    const list = filters.project ? byProject[filters.project] || [] : Object.values(byProject).flat();
    return [...new Set(list)].sort(areaOrder);
  }, [options, filters.project]);

  const pmTypes = options?.pm_types || Object.entries(PM_TYPE_LABELS).map(([value, label]) => ({ value, label, configured: true }));
  const hasFilters =
    filters.project || filters.testArea || filters.pmType !== "all" || filters.search || filters.preset !== "7d";

  const pickPreset = (id) => {
    if (id === "custom") {
      onChange({ preset: "custom", from: toLocalInput(range.from), to: toLocalInput(range.to) });
      return;
    }
    const next = presetRange(id);
    onChange({ preset: id, from: toLocalInput(next.from), to: toLocalInput(next.to) });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <label className="block xl:col-span-5">
          <Label>Search</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Fixture, asset tag, serial, line, manufacturer, or technician…"
              className={`${FIELD} pl-9 pr-8`}
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ search: "" })}
                aria-label="Clear search"
                className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>
        </label>
        <label className="block xl:col-span-3">
          <Label>Project</Label>
          <select
            value={filters.project}
            onChange={(e) => {
              const project = e.target.value;
              const areas = project ? options?.test_areas?.[project] || [] : null;
              onChange({ project, testArea: areas && !areas.includes(filters.testArea) ? "" : filters.testArea });
            }}
            className={FIELD}
          >
            <option value="">All projects</option>
            {(options?.projects || []).map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>
        <label className="block xl:col-span-3">
          <Label>Test area</Label>
          <select
            value={filters.testArea}
            onChange={(e) => onChange({ testArea: e.target.value })}
            disabled={testAreas.length === 0}
            className={FIELD}
          >
            <option value="">All test areas</option>
            {testAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end xl:col-span-1">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasFilters}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>

      <div>
        <Label>PM type</Label>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All PMs", configured: true }, ...pmTypes].map((type) => {
            const active = filters.pmType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange({ pmType: type.value })}
                title={type.configured ? undefined : "No checklist is set up for this PM type yet"}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                } ${type.configured ? "" : "border-dashed"}`}
              >
                {type.label.replace(/ PM$/, "")}
                {!type.configured && <span className="ml-1 text-[10px] font-normal opacity-75">(not set up)</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Label>Date range</Label>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pickPreset(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filters.preset === preset.id
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <Label>From → To (date &amp; time)</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="datetime-local"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onChange({ preset: "custom", from: e.target.value })}
              aria-label="From date and time"
              className={FIELD}
            />
            <span className="hidden text-gray-400 sm:inline">→</span>
            <input
              type="datetime-local"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onChange({ preset: "custom", to: e.target.value })}
              aria-label="To date and time"
              className={FIELD}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <span className="font-semibold">Showing:</span>
        {[
          filters.project || "All projects",
          filters.testArea || "All test areas",
          filters.pmType === "all" ? "All PM types" : PM_TYPE_LABELS[filters.pmType] || filters.pmType,
          filters.search ? `“${filters.search}”` : null,
        ]
          .filter(Boolean)
          .map((chip) => (
            <span key={chip} className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              {chip}
            </span>
          ))}
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
          🗓 {formatRange(range.from, range.to)}
        </span>
      </div>
    </div>
  );
}
