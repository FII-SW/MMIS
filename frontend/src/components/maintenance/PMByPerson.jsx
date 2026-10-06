import { useMemo, useState } from "react";
import { downloadCsv } from "./downloadPM";

const TH = "p-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300";
const TD = "p-3 text-sm text-gray-800 dark:text-gray-200";
const pct = (value) => (value === null || value === undefined ? "—" : `${value}%`);

const SORTS = {
  completed: { label: "Most PMs done", fn: (a, b) => b.completed - a.completed },
  overdue: { label: "Most overdue", fn: (a, b) => b.overdue - a.overdue },
  assigned: { label: "Most fixtures assigned", fn: (a, b) => b.assigned_fixtures - a.assigned_fixtures },
  name: { label: "Name", fn: (a, b) => a.employee_name.localeCompare(b.employee_name) },
};

function onTrackTone(value) {
  if (value === null || value === undefined) return "text-gray-500 dark:text-gray-400";
  if (value >= 90) return "text-green-700 dark:text-green-400";
  if (value >= 70) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

/** PM report section: what each person did in the range and how their assigned fixtures are doing. */
export default function PMByPerson({ rows, fileTag }) {
  const [sort, setSort] = useState("completed");
  const sorted = useMemo(() => [...rows].sort(SORTS[sort].fn), [rows, sort]);

  if (!rows.length) return null;

  const download = () =>
    downloadCsv(
      `PM_By_Person_${fileTag}`,
      [
        "Person",
        "Designation",
        "PMs Completed",
        "Passed",
        "Failed",
        "Pass Rate %",
        "Fixtures Serviced",
        "Fixtures Assigned",
        "Assigned PMs Overdue",
        "Assigned Fixtures On Track %",
      ],
      sorted.map((r) => [
        r.employee_name + (r.active ? "" : " (deactivated)"),
        r.employee_designation || "",
        r.completed,
        r.passed,
        r.failed,
        r.pass_rate ?? "",
        r.fixtures_serviced,
        r.assigned_fixtures,
        r.overdue,
        r.assigned_on_track ?? "",
      ])
    );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">By person</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            PMs each person completed in this range, and how the fixtures a Super Admin assigned to them are doing
            right now (on track = no overdue PM).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort people"
            className="rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {Object.entries(SORTS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={download}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700"
          >
            Download CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
              <th className={TH}>Person</th>
              <th className={`${TH} text-right`}>PMs done</th>
              <th className={`${TH} text-right`}>Passed</th>
              <th className={`${TH} text-right`}>Failed</th>
              <th className={`${TH} text-right`}>Pass rate</th>
              <th className={`${TH} text-right`}>Fixtures assigned</th>
              <th className={`${TH} text-right`}>Overdue PMs</th>
              <th className={`${TH} text-right`}>On track</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.employee_id} className={`border-b dark:border-gray-700 ${r.active ? "" : "opacity-60"}`}>
                <td className={TD}>
                  <span className="font-semibold">{r.employee_name}</span>
                  {!r.active && <span className="ml-1 text-xs text-gray-500">(deactivated)</span>}
                  {r.employee_designation && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{r.employee_designation}</div>
                  )}
                </td>
                <td className={`${TD} text-right font-semibold`}>{r.completed}</td>
                <td className={`${TD} text-right text-green-700 dark:text-green-400`}>{r.passed}</td>
                <td className={`${TD} text-right ${r.failed ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>{r.failed}</td>
                <td className={`${TD} text-right`}>{pct(r.pass_rate)}</td>
                <td className={`${TD} text-right`}>{r.assigned_fixtures || "—"}</td>
                <td className={`${TD} text-right ${r.overdue ? "font-semibold text-orange-600 dark:text-orange-400" : ""}`}>
                  {r.assigned_fixtures ? r.overdue : "—"}
                </td>
                <td className={`${TD} text-right font-semibold ${onTrackTone(r.assigned_on_track)}`}>{pct(r.assigned_on_track)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
