import PMStatusBadge from "./PMStatusBadge";
import { formatDate } from "./formatDate";
import { PM_STATE_META, describeDue } from "./pmStatus";
import { pmTypeLabel } from "./pmTypes";

const ACCENT_BORDER = {
  overdue: "border-l-red-500",
  never: "border-l-gray-300 dark:border-l-gray-600",
  due_soon: "border-l-yellow-500",
  ok: "border-l-green-500",
  paused: "border-l-slate-400",
};

function SortHeader({ label, column, sortKey, sortDir, onSort, className = "" }) {
  const active = sortKey === column;
  return (
    <th scope="col" className={`px-3 py-3 text-left ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide ${
          active ? "text-blue-700 dark:text-blue-300" : "text-gray-600 dark:text-gray-300"
        } hover:text-blue-700 dark:hover:text-blue-300`}
      >
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active && sortDir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

function PMCell({ entry, type, onRecord }) {
  if (!entry) {
    return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRecord(type);
      }}
      title={`Open ${entry.label} checklist`}
      className="group flex flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
    >
      <PMStatusBadge state={entry.state} label={describeDue(entry)} />
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {entry.last_performed_at ? `Last ${formatDate(entry.last_performed_at)}` : "Not recorded yet"}
        {entry.covered_by && ` · via ${pmTypeLabel(entry.covered_by)}`}
        {entry.last_result === "failed" && (
          <span className="ml-1 font-semibold text-red-600 dark:text-red-400">· failed</span>
        )}
      </span>
    </button>
  );
}

function Tag({ children, tone = "gray" }) {
  const tones = {
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function FixturePMTable({
  fixtures,
  pmTypes,
  showLocation,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}) {
  const sortProps = { sortKey, sortDir, onSort };

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b dark:bg-gray-900/60 dark:border-gray-700">
            <tr>
              <SortHeader label="Status" column="urgency" {...sortProps} className="w-36" />
              <SortHeader label="Fixture" column="name" {...sortProps} />
              <SortHeader label="Line" column="line" {...sortProps} className="w-24" />
              <SortHeader label="Manufacturer" column="manufacturer" {...sortProps} className="w-44" />
              {pmTypes.map((type) => (
                <th
                  key={type}
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                >
                  {pmTypeLabel(type)}
                </th>
              ))}
              <th scope="col" className="px-3 py-3 w-20">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {fixtures.map((fx) => {
              const { pm } = fx;
              const meta = pm.state ? PM_STATE_META[pm.state] : null;
              return (
                <tr
                  key={fx.fixture_id}
                  onClick={() => onOpen(fx)}
                  className={`group cursor-pointer border-l-4 ${
                    ACCENT_BORDER[pm.state] || "border-l-transparent"
                  } hover:bg-blue-50/60 dark:hover:bg-gray-700/50 transition-colors`}
                >
                  <td className="px-3 py-2.5 align-top">
                    {meta ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.tile}`}>
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">No PM</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fx.fixture_name}</span>
                    {showLocation && (
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {fx.project_name} · {fx.test_area}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Asset {fx.asset_tag || "—"} · S/N {fx.fixture_serial_number || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {fx.production_line ? (
                      <Tag tone="blue">{fx.production_line}</Tag>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top max-w-[11rem]">
                    {fx.manufacturer ? (
                      <Tag>{fx.manufacturer}</Tag>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  {pmTypes.map((type) => (
                    <td key={type} className="px-2 py-1.5 align-top">
                      <PMCell entry={pm.status?.[type]} type={type} onRecord={(t) => onOpen(fx, t)} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 align-top text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(fx);
                      }}
                      className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm group-hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y dark:divide-gray-700">
        {fixtures.map((fx) => {
          const { pm } = fx;
          const meta = pm.state ? PM_STATE_META[pm.state] : null;
          return (
            <li
              key={fx.fixture_id}
              className={`border-l-4 ${ACCENT_BORDER[pm.state] || "border-l-transparent"} px-3 py-3`}
            >
              <button type="button" onClick={() => onOpen(fx)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{fx.fixture_name}</p>
                    {showLocation && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                        {fx.project_name} · {fx.test_area}
                      </p>
                    )}
                  </div>
                  {meta && (
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.tile}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {fx.production_line && <Tag tone="blue">{fx.production_line}</Tag>}
                  {fx.manufacturer && <Tag>{fx.manufacturer}</Tag>}
                </div>
              </button>
              {pm.pm_types.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {pm.pm_types.map((type) => (
                    <div key={type}>
                      <p className="px-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                        {pm.status[type].label}
                      </p>
                      <PMCell entry={pm.status[type]} type={type} onRecord={(t) => onOpen(fx, t)} />
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
