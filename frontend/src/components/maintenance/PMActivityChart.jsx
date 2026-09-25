import { useMemo } from "react";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function bucketing(from, to) {
  const span = to - from;
  if (span <= 2 * DAY) return "hour";
  if (span <= 62 * DAY) return "day";
  if (span <= 400 * DAY) return "week";
  return "month";
}

function bucketStart(date, unit) {
  const d = new Date(date);
  if (unit === "hour") {
    d.setMinutes(0, 0, 0);
  } else if (unit === "month") {
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
  } else {
    d.setHours(0, 0, 0, 0);
    if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  }
  return d;
}

function nextBucket(date, unit) {
  const d = new Date(date);
  if (unit === "hour") d.setHours(d.getHours() + 1);
  else if (unit === "day") d.setDate(d.getDate() + 1);
  else if (unit === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function bucketLabel(date, unit) {
  if (unit === "hour") {
    return date.getHours() === 0
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : date.toLocaleTimeString("en-US", { hour: "numeric" });
  }
  if (unit === "month") return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return unit === "week" ? `Wk ${label}` : label;
}

const UNIT_TEXT = { hour: "per hour", day: "per day", week: "per week", month: "per month" };

export default function PMActivityChart({ points, from, to, truncated }) {
  const { unit, buckets } = useMemo(() => {
    const u = bucketing(from, to);
    const list = [];
    for (let start = bucketStart(from, u); start <= to && list.length < 400; start = nextBucket(start, u)) {
      list.push({ start, passed: 0, failed: 0 });
    }
    const index = new Map(list.map((b, i) => [b.start.getTime(), i]));
    points.forEach((point) => {
      const i = index.get(bucketStart(new Date(point.performed_at), u).getTime());
      if (i !== undefined) list[i][point.failed ? "failed" : "passed"] += 1;
    });
    return { unit: u, buckets: list };
  }, [points, from, to]);

  const max = Math.max(1, ...buckets.map((b) => b.passed + b.failed));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 10));

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>PMs completed {UNIT_TEXT[unit]}</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> Passed</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> With failed tasks</span>
        </span>
      </div>
      <div className="flex h-40 items-end gap-[3px]">
        {buckets.map(({ start, passed, failed }) => {
          const total = passed + failed;
          return (
            <div
              key={start.getTime()}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${bucketLabel(start, unit)}: ${total} PM${total === 1 ? "" : "s"}${failed ? ` (${failed} with failed tasks)` : ""}`}
            >
              {total > 0 && buckets.length <= 31 && (
                <span className="mb-0.5 text-center text-[9px] font-semibold text-gray-600 dark:text-gray-300">{total}</span>
              )}
              {total === 0 ? (
                <div className="h-0.5 rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <div
                  className="flex flex-col overflow-hidden rounded-t transition group-hover:opacity-80"
                  style={{ height: `${(total / max) * 100}%` }}
                >
                  {failed > 0 && <div className="bg-red-500" style={{ flexGrow: failed }} />}
                  <div className="bg-blue-500" style={{ flexGrow: passed }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {buckets.map(({ start }, i) => (
          <span key={start.getTime()} className="min-w-0 flex-1 truncate text-center text-[9px] text-gray-400 dark:text-gray-500">
            {i % labelEvery === 0 ? bucketLabel(start, unit) : ""}
          </span>
        ))}
      </div>
      {truncated && (
        <p className="mt-1 text-[10px] text-yellow-700 dark:text-yellow-400">
          Very large range: the chart shows the first 20,000 PMs. Totals above are exact.
        </p>
      )}
    </div>
  );
}
