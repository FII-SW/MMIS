import { useEffect, useState } from "react";
import API from "../../api";

const WEEK_OPTIONS = [8, 12, 26];

function barColor(pct) {
  if (pct == null) return "bg-gray-200 dark:bg-gray-700";
  if (pct >= 90) return "bg-green-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

function shortDate(value) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ComplianceTrendChart({ project, testArea, pmType }) {
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    const params = { weeks };
    if (project) params.project = project;
    if (testArea) params.test_area = testArea;
    if (pmType && pmType !== "all") params.pm_type = pmType;
    API.get("/maintenance/trend", { params })
      .then((res) => setData(res.data?.weeks || []))
      .catch((err) => {
        console.error("Error loading PM trend:", err);
        setError("Compliance trend is unavailable.");
      });
  }, [weeks, project, testArea, pmType]);

  const tracked = (data || []).filter((w) => w.pct != null);
  const latest = tracked[tracked.length - 1];
  const previous = tracked[tracked.length - 2];
  const change = latest && previous ? latest.pct - previous.pct : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">PM compliance trend</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            % of PMs up to date at the end of each week
            {change != null && (
              <span
                className={`ml-2 font-semibold ${
                  change > 0 ? "text-green-600 dark:text-green-400" : change < 0 ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {Math.abs(change)} pts vs last week
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {WEEK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setWeeks(option)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                weeks === option
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {option}w
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="px-4 py-5 text-center text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : !data ? (
        <p className="px-4 py-5 text-center text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : tracked.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-gray-500 dark:text-gray-400">
          No PM history for these filters yet. The trend appears once PMs have been tracked for a week.
        </p>
      ) : (
        <div className="px-4 py-3">
          <div className="flex h-36 items-end gap-1.5">
            {data.map((week) => (
              <div
                key={week.week_end}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                title={
                  week.pct == null
                    ? `Week ending ${shortDate(week.week_end)}: not tracked yet`
                    : `Week ending ${shortDate(week.week_end)}: ${week.pct}% up to date (${week.up_to_date}/${week.tracked}) · ${week.completed} PMs done${week.failed ? `, ${week.failed} with failed tasks` : ""}`
                }
              >
                <span className="mb-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                  {week.pct == null ? "" : `${week.pct}%`}
                </span>
                <div
                  className={`w-full rounded-t ${barColor(week.pct)}`}
                  style={{ height: week.pct == null ? "2px" : `${Math.max(week.pct, 2)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {data.map((week, index) => (
              <span key={week.week_end} className="flex-1 text-center text-[9px] text-gray-400 dark:text-gray-500">
                {index % Math.ceil(data.length / 8) === 0 || index === data.length - 1 ? shortDate(week.week_end) : ""}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" /> 90%+</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-yellow-500" /> 70–89%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> under 70%</span>
          </div>
        </div>
      )}
    </div>
  );
}
