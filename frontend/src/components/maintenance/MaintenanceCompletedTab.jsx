import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import PMStatusBadge from "./PMStatusBadge";
import { formatDateTime } from "./formatDate";
import { fixtureDetailUrl } from "./links";
import { downloadPMRecordPdf, exportPMHistoryCsv } from "./downloadPM";
import { PM_TYPE_LABELS, pmTypeLabel } from "./pmTypes";
import useStickyState from "./useStickyState";
import { getTokenSession } from "../../utils/auth";

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 500;

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

function periodStart(period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "today") return start;
  if (period === "7d") {
    start.setDate(start.getDate() - 6);
    return start;
  }
  if (period === "30d") {
    start.setDate(start.getDate() - 29);
    return start;
  }
  if (period === "month") {
    start.setDate(1);
    return start;
  }
  return null;
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MaintenanceCompletedTab() {
  const navigate = useNavigate();
  const [period, setPeriod] = useStickyState("mmis:pm-completed:period", "7d");
  const [pmType, setPmType] = useStickyState("mmis:pm-completed:type", "all");
  const [result, setResult] = useStickyState("mmis:pm-completed:result", "all");
  const [mineOnly, setMineOnly] = useStickyState("mmis:pm-completed:mine", false);
  const myEmployeeId = getTokenSession()?.employee_id;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, failed: 0, records: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const buildParams = (extra = {}) => {
    const params = { ...extra };
    const start = periodStart(period);
    if (start) params.date_from = start.toISOString();
    if (pmType !== "all") params.pm_type = pmType;
    if (result !== "all") params.result = result;
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (mineOnly && myEmployeeId) params.employee_id = myEmployeeId;
    return params;
  };

  useEffect(() => {
    setPage(1);
  }, [period, pmType, result, debouncedSearch, mineOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    API.get("/maintenance/records", {
      params: buildParams({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    })
      .then((res) => {
        if (!cancelled) setData(res.data || { total: 0, failed: 0, records: [] });
      })
      .catch((err) => {
        console.error("Error loading completed PMs:", err);
        if (!cancelled) setError("Failed to load completed PMs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, pmType, result, debouncedSearch, mineOnly, page]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await API.get("/maintenance/records", { params: buildParams({ limit: EXPORT_LIMIT }) });
      const periodLabel = PERIODS.find((p) => p.id === period)?.label || period;
      exportPMHistoryCsv(res.data?.records || [], null, `Completed_PMs_${periodLabel}`);
    } catch (err) {
      console.error("Error exporting completed PMs:", err);
      alert("Failed to export completed PMs.");
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const passed = data.total - data.failed;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <p className="text-xs font-semibold uppercase tracking-wide">Completed</p>
          <p className="mt-1 text-2xl font-bold">{data.total}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <p className="text-xs font-semibold uppercase tracking-wide">Passed</p>
          <p className="mt-1 text-2xl font-bold">{passed}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <p className="text-xs font-semibold uppercase tracking-wide">With failed tasks</p>
          <p className="mt-1 text-2xl font-bold">{data.failed}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                period === p.id
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
          {myEmployeeId && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Only PMs I did
            </label>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fixture, name, or line…"
            className="flex-1 rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={pmType}
              onChange={(e) => setPmType(e.target.value)}
              aria-label="Filter by PM type"
              className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="all">All PM types</option>
              {Object.entries(PM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              aria-label="Filter by result"
              className="rounded-lg border border-gray-300 bg-white p-2.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="all">All results</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed tasks</option>
            </select>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || data.total === 0}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Fixture</th>
                <th className="px-3 py-3">PM</th>
                <th className="px-3 py-3">Result</th>
                <th className="px-3 py-3 hidden md:table-cell">Name</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y dark:divide-gray-700 ${loading ? "opacity-50" : ""}`}>
              {data.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? "Loading…" : "No PMs completed for these filters."}
                  </td>
                </tr>
              ) : (
                data.records.map((record) => {
                  const failedTasks = (record.checklist || []).filter((item) => item.result === "failed").length;
                  return (
                    <tr key={record.pm_id} className="hover:bg-blue-50/60 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-3 py-2.5 align-top text-gray-700 dark:text-gray-300">
                        {formatDateTime(record.performed_at)}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {record.fixture_name || `Fixture #${record.fixture_id}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {record.project_name} · {record.test_area}
                          {record.production_line ? ` · ${record.production_line}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 align-top font-medium text-gray-700 dark:text-gray-200">
                        {pmTypeLabel(record.pm_type)}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <PMStatusBadge
                          state={record.overall_result === "failed" ? "overdue" : "ok"}
                          label={record.overall_result === "failed" ? `Failed (${failedTasks})` : "Passed"}
                        />
                        {record.notes && (
                          <p className="mt-1 max-w-xs truncate text-[11px] text-gray-500 dark:text-gray-400" title={record.notes}>
                            {record.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top hidden md:table-cell text-gray-700 dark:text-gray-300">
                        {record.performed_by || "Unknown"}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(fixtureDetailUrl(record, { tab: "history" }))}
                            className="whitespace-nowrap rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPMRecordPdf(record, record)}
                            className="whitespace-nowrap rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            ⬇ PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-600 dark:text-gray-300">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            ‹ Prev
          </button>
          <span className="text-xs">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
