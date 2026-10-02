import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { downloadCsv } from "../components/maintenance/downloadPM";
import { formatDate, formatDateTime } from "../components/maintenance/formatDate";
import { formatRange, fromLocalInput, rangeToParams, toLocalInput } from "../components/maintenance/dateRanges";
import { fixtureDetailUrl } from "../components/maintenance/links";
import { DEFAULT_TEST_AREAS } from "../utils/testAreas";

const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900";
const ROWS_PER_PAGE = 20;

const GROUPS = [
  { id: "day", label: "Daily", unit: "Day" },
  { id: "week", label: "Weekly", unit: "Week" },
  { id: "month", label: "Monthly", unit: "Month" },
];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function weeksBack(now, weeks) {
  return addDays(startOfWeek(now), -7 * weeks);
}

/** ISO 8601 week (weeks start Monday; week 1 contains the first Thursday of the year). */
function isoWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
}

const isoWeek = (date) => isoWeekYear(date).week;

/** "WW39" for a date/ISO string (local time); "" when missing. */
function workWeek(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `WW${String(isoWeek(date)).padStart(2, "0")}`;
}

function workWeekYear(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : isoWeekYear(date).year;
}

const weekKey = (monday) => toLocalInput(monday).slice(0, 10);

function weekFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function weekLabel(monday) {
  const sunday = addDays(monday, 6);
  const short = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `WW${String(isoWeek(monday)).padStart(2, "0")} · ${short(monday)} – ${short(sunday)}, ${sunday.getFullYear()}`;
}

const WEEK_CHOICES = 53;
const WEEK_STEP =
  "rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";

function Chevron({ direction }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 15l-5-5 5-5" : "M7.5 5l5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const QUICK_RANGES = [
  { id: "this_week", label: "This week", range: (now) => ({ from: startOfWeek(now), to: endOfDay(now) }) },
  {
    id: "last_week",
    label: "Last week",
    range: (now) => {
      const from = weeksBack(now, 1);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      return { from, to: endOfDay(to) };
    },
  },
  { id: "last_4_weeks", label: "Last 4 weeks", range: (now) => ({ from: weeksBack(now, 3), to: endOfDay(now) }) },
  {
    id: "this_month",
    label: "This month",
    range: (now) => ({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) }),
  },
  {
    id: "last_month",
    label: "Last month",
    range: (now) => ({
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    }),
  },
  { id: "this_year", label: "This year", range: (now) => ({ from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) }) },
];

function defaultFilters() {
  const { from, to } = QUICK_RANGES.find((r) => r.id === "last_4_weeks").range(new Date());
  return {
    project: "",
    test_area: "",
    pm_type: "",
    result: "all",
    group_by: "week",
    q: "",
    from: toLocalInput(from),
    to: toLocalInput(to),
    quick: "last_4_weeks",
  };
}

function areaOrder(a, b) {
  const ia = DEFAULT_TEST_AREAS.indexOf(a);
  const ib = DEFAULT_TEST_AREAS.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  return a.localeCompare(b);
}

const pct = (value) => (value === null || value === undefined ? "—" : `${value}%`);

function Label({ children }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </span>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-blue-600 bg-blue-600 text-white shadow"
          : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

const KPI_TONES = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  gray: "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
};

/** Difference between two numbers; `better` says which direction is an improvement. */
function Change({ current, previous, better = "up", unit = "", suffix = "" }) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) {
    return <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">= same{suffix}</span>;
  }
  const improved = better === "up" ? diff > 0 : diff < 0;
  return (
    <span
      className={`text-xs font-semibold ${improved ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
      title={improved ? "Better" : "Worse"}
    >
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
      {unit === " pts" && Math.abs(diff) === 1 ? " pt" : unit}
      {suffix}
    </span>
  );
}

function Kpi({ label, value, sub, tone = "gray", onClick, change }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border p-4 text-left shadow-sm ${KPI_TONES[tone]} ${onClick ? "transition hover:shadow-md" : ""}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-80">{sub}</div>}
      {change && <div className="mt-1.5 rounded bg-white/70 px-1.5 py-0.5 dark:bg-black/20">{change}</div>}
    </Tag>
  );
}

function ResultBadge({ result }) {
  const failed = result === "failed";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
        failed ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      }`}
    >
      {failed ? "FAILED" : "PASSED"}
    </span>
  );
}

function PeriodBar({ passed, failed, max }) {
  if (!max) return null;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
      <div className="bg-green-500" style={{ width: `${(passed / max) * 100}%` }} />
      <div className="bg-red-500" style={{ width: `${(failed / max) * 100}%` }} />
    </div>
  );
}

function Pager({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  if (pages <= 1) return null;
  const button =
    "rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200";
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

const stockPartsText = (record) =>
  (record.parts || [])
    .map((part) => `${part.quantity} × ${part.item_name || "Item"}${part.item_part_number ? ` (${part.item_part_number})` : ""}`)
    .join("; ");

const hasNotesOrParts = (record) => Boolean(record.notes || record.parts_replaced || record.parts?.length);

const isNumber = (value) => typeof value === "number";
const difference = (current, previous) => (isNumber(current) && isNumber(previous) ? current - previous : "");

/** Work week(s) a summary row covers: "WW39" for a day/week, "WW36–WW40" for a month. */
function periodWorkWeek(period, groupId) {
  const first = workWeek(period.start);
  if (groupId !== "month") return first;
  const last = workWeek(new Date(new Date(period.end).getTime() - 1));
  return first === last ? first : `${first}–${last}`;
}

const TH = "p-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300";
const TD = "p-3 text-sm text-gray-800 dark:text-gray-200";

export default function PMReportPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailTab, setDetailTab] = useState("records");
  const [page, setPage] = useState(1);
  const [notesOnly, setNotesOnly] = useState(false);

  const from = fromLocalInput(filters.from);
  const to = fromLocalInput(filters.to);
  const rangeError = !from || !to ? "Pick both a From and a To date." : from >= to ? "'From' must be before 'To'." : "";

  useEffect(() => {
    const start = fromLocalInput(filters.from);
    const end = fromLocalInput(filters.to);
    if (!start || !end || start >= end) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await API.get("/maintenance/report", {
          params: {
            ...rangeToParams(start, end),
            group_by: filters.group_by,
            project: filters.project || undefined,
            test_area: filters.test_area || undefined,
            pm_type: filters.pm_type || undefined,
            result: filters.result,
            q: filters.q.trim() || undefined,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
        if (!cancelled) {
          setReport(res.data);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.detail || "Failed to load the PM report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters]);

  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const pickQuick = (quick) => {
    const { from: start, to: end } = QUICK_RANGES.find((r) => r.id === quick).range(new Date());
    update({ quick, from: toLocalInput(start), to: toLocalInput(end) });
  };

  const currentMonday = startOfWeek(new Date());
  const selectedMonday = from ? startOfWeek(from) : null;
  const isWholeWeek =
    selectedMonday &&
    to &&
    from.getTime() === selectedMonday.getTime() &&
    to.getTime() === endOfDay(addDays(selectedMonday, 6)).getTime();
  const selectedWeek = isWholeWeek ? weekKey(selectedMonday) : "";
  const weekChoices = Array.from({ length: WEEK_CHOICES }, (_, i) => addDays(currentMonday, -7 * i));
  if (selectedWeek && !weekChoices.some((monday) => weekKey(monday) === selectedWeek)) {
    weekChoices.push(selectedMonday);
    weekChoices.sort((a, b) => b - a);
  }

  const pickWeek = (monday) => {
    update({
      from: toLocalInput(monday),
      to: toLocalInput(endOfDay(addDays(monday, 6))),
      quick: "week",
      group_by: "day",
    });
  };
  const shiftWeek = (weeks) => {
    const base = selectedMonday || currentMonday;
    const target = addDays(base, 7 * weeks);
    if (target <= currentMonday) pickWeek(target);
  };

  const options = report?.options;
  const projects = options?.projects || [];
  const testAreas = useMemo(() => {
    const byProject = options?.test_areas || {};
    const areas = filters.project ? byProject[filters.project] || [] : [...new Set(Object.values(byProject).flat())];
    return [...areas].sort(areaOrder);
  }, [options, filters.project]);
  const pmTypes = (options?.pm_types || []).filter((type) => type.configured);

  const group = GROUPS.find((g) => g.id === (report?.group_by || filters.group_by));
  const totals = report?.totals;
  const periods = report?.periods || [];
  const maxCompleted = Math.max(0, ...periods.map((p) => p.completed));
  const allRecords = report?.records || [];
  const records = notesOnly ? allRecords.filter(hasNotesOrParts) : allRecords;
  const failedRecords = records.filter((r) => r.overall_result === "failed");
  const overdue = report?.overdue || [];
  const detailRows = detailTab === "overdue" ? overdue : detailTab === "failed" ? failedRecords : records;
  const pageRows = detailRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const rangeLabel = report ? formatRange(new Date(report.range.date_from), new Date(report.range.date_to)) : "";
  const previous = report?.previous;
  const reportFrom = report ? new Date(report.range.date_from) : null;
  const reportWeek =
    reportFrom &&
    reportFrom.getTime() === startOfWeek(reportFrom).getTime() &&
    Math.abs(new Date(report.range.date_to).getTime() - addDays(reportFrom, 7).getTime()) < 60000
      ? reportFrom
      : null;
  const previousLabel = !previous
    ? ""
    : reportWeek
      ? workWeek(previous.date_from)
      : `previous ${Math.round((new Date(previous.date_to) - new Date(previous.date_from)) / 86400000)} days`;
  const fileTag = report ? `${formatDate(report.range.date_from)}_to_${formatDate(report.range.date_to)}` : "";

  const openDetail = (tab) => {
    setDetailTab(tab);
    setPage(1);
    document.getElementById("pm-report-details")?.scrollIntoView({ behavior: "smooth" });
  };

  const canDrillDown = group.id !== "day";
  const drillDown = (period) => {
    const start = new Date(period.start);
    if (group.id === "week") {
      pickWeek(startOfWeek(start));
    } else if (group.id === "month") {
      const first = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      update({ from: toLocalInput(first), to: toLocalInput(last), quick: "custom", group_by: "week" });
    }
  };

  const downloadSummary = () => {
    const header = [
      group.unit,
      "Year",
      "Work Week",
      "From",
      "To",
      "PMs Completed",
      "Passed",
      "Failed",
      "Pass Rate %",
      "Pass Rate Change (pts)",
      "Overdue at End",
      "Overdue Change",
    ];
    const rows = periods.map((p, i) => [
      p.label,
      workWeekYear(p.start),
      periodWorkWeek(p, group.id),
      formatDateTime(p.start),
      formatDateTime(p.end),
      p.completed,
      p.passed,
      p.failed,
      p.pass_rate ?? "",
      difference(p.pass_rate, periods[i - 1]?.pass_rate),
      p.overdue ?? "",
      difference(p.overdue, periods[i - 1]?.overdue),
    ]);
    rows.push([
      "Total",
      "",
      "",
      "",
      "",
      totals.completed,
      totals.passed,
      totals.failed,
      totals.pass_rate ?? "",
      difference(totals.pass_rate, previous?.pass_rate),
      totals.overdue,
      difference(totals.overdue, previous?.overdue),
    ]);
    downloadCsv(`PM_Report_${group.label}_${fileTag}`, header, rows);
  };

  const downloadDetails = () => {
    if (detailTab === "overdue") {
      downloadCsv(
        `PM_Overdue_${fileTag}`,
        ["Fixture", "Project", "Test Area", "Line", "PM Type", "Due", "Due Year", "Due Work Week", "Days Overdue", "Last Done"],
        overdue.map((row) => [
          row.fixture_name,
          row.project_name,
          row.test_area,
          row.production_line || "",
          row.label,
          formatDateTime(row.due_at),
          workWeekYear(row.due_at),
          workWeek(row.due_at),
          row.days_overdue,
          row.last_performed_at ? formatDateTime(row.last_performed_at) : "Never",
        ])
      );
      return;
    }
    downloadCsv(
      `PM_${detailTab === "failed" ? "Failed" : "Records"}_${fileTag}`,
      [
        "PM ID",
        "Date",
        "Year",
        "Work Week",
        "Fixture",
        "Project",
        "Test Area",
        "Line",
        "PM Type",
        "Result",
        "Completed By",
        "Failed Tasks",
        "Notes",
        "Parts Replaced",
        "Parts From Stock",
      ],
      detailRows.map((r) => [
        r.pm_id,
        formatDateTime(r.performed_at),
        workWeekYear(r.performed_at),
        workWeek(r.performed_at),
        r.fixture_name || r.fixture_id,
        r.project_name,
        r.test_area,
        r.production_line || "",
        r.label,
        r.overall_result === "failed" ? "FAILED" : "PASSED",
        r.performed_by || "Unknown",
        r.failed_tasks.join("; "),
        r.notes || "",
        r.parts_replaced || "",
        stockPartsText(r),
      ])
    );
  };

  const fixtureLink = (row) => (
    <Link to={fixtureDetailUrl(row)} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">
      {row.fixture_name || `Fixture ${row.fixture_id}`}
    </Link>
  );

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />
      <PageHeaderWithBack title="Preventive Maintenance Report" onBack={() => navigate("/dashboard/reports")} />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 sm:px-8">
        {/* FILTERS */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <Label>Project</Label>
              <select
                className={FIELD}
                value={filters.project}
                onChange={(e) => update({ project: e.target.value, test_area: "" })}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Label>Test area</Label>
              <select className={FIELD} value={filters.test_area} onChange={(e) => update({ test_area: e.target.value })}>
                <option value="">All test areas</option>
                {testAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Label>PM type</Label>
              <select className={FIELD} value={filters.pm_type} onChange={(e) => update({ pm_type: e.target.value })}>
                <option value="">All PM types</option>
                {pmTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Label>Result</Label>
              <select className={FIELD} value={filters.result} onChange={(e) => update({ result: e.target.value })}>
                <option value="all">Passed &amp; failed</option>
                <option value="passed">Passed only</option>
                <option value="failed">Failed only</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="w-full sm:w-auto">
              <Label>Week</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  title="Previous week"
                  aria-label="Previous week"
                  className={WEEK_STEP}
                >
                  <Chevron direction="left" />
                </button>
                <select
                  className={`${FIELD} sm:w-72 ${selectedWeek ? "border-blue-500 font-semibold text-blue-700 dark:text-blue-300" : ""}`}
                  value={selectedWeek}
                  onChange={(e) => e.target.value && pickWeek(weekFromKey(e.target.value))}
                >
                  <option value="">— Pick a week —</option>
                  {weekChoices.map((monday) => (
                    <option key={weekKey(monday)} value={weekKey(monday)}>
                      {weekLabel(monday)}
                      {monday.getTime() === currentMonday.getTime() ? " (this week)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  disabled={!selectedMonday || selectedMonday >= currentMonday}
                  title="Next week"
                  aria-label="Next week"
                  className={WEEK_STEP}
                >
                  <Chevron direction="right" />
                </button>
              </div>
            </div>
            <div>
              <Label>Group by</Label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                {GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => update({ group_by: g.id })}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                      filters.group_by === g.id
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="w-full sm:w-auto">
              <Label>Or custom From → To (date &amp; time)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="datetime-local"
                  value={filters.from}
                  onChange={(e) => update({ from: e.target.value, quick: "custom" })}
                  className={`${FIELD} sm:w-52`}
                />
                <span className="hidden text-gray-400 sm:inline">→</span>
                <input
                  type="datetime-local"
                  value={filters.to}
                  onChange={(e) => update({ to: e.target.value, quick: "custom" })}
                  className={`${FIELD} sm:w-52`}
                />
              </div>
            </div>
            <label className="min-w-[12rem] flex-1">
              <Label>Search</Label>
              <input
                type="search"
                value={filters.q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Fixture, asset tag, line or user…"
                className={FIELD}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Quick range:</span>
            {QUICK_RANGES.map((r) => (
              <Pill key={r.id} active={filters.quick === r.id} onClick={() => pickQuick(r.id)}>
                {r.label}
              </Pill>
            ))}
            <button
              type="button"
              onClick={() => setFilters(defaultFilters())}
              className="ml-auto text-sm font-semibold text-gray-500 hover:text-blue-700 dark:text-gray-400"
            >
              Reset
            </button>
          </div>

          {(rangeError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {rangeError || error}
            </div>
          )}
        </div>

        {!report && loading && <div className="py-10 text-center text-gray-500">Loading PM report…</div>}

        {report && (
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="text-center text-sm text-gray-600 dark:text-gray-300">
              {reportWeek && <span className="mr-1 font-bold text-blue-700 dark:text-blue-400">WW{String(isoWeek(reportWeek)).padStart(2, "0")} ·</span>}
              <span className="font-semibold">{rangeLabel}</span>
              {filters.project && ` · ${filters.project}`}
              {filters.test_area && ` · ${filters.test_area}`}
              {loading && " · updating…"}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi
                label="PMs completed"
                value={totals.completed}
                sub={`${totals.fixtures_serviced} fixtures serviced`}
                tone="blue"
                onClick={() => openDetail("records")}
                change={previous && <Change current={totals.completed} previous={previous.completed} suffix={` vs ${previousLabel}`} />}
              />
              <Kpi
                label="Passed"
                value={totals.passed}
                sub={`Pass rate ${pct(totals.pass_rate)}`}
                tone="green"
                onClick={() => openDetail("records")}
                change={
                  previous && (
                    <Change current={totals.pass_rate} previous={previous.pass_rate} unit=" pts" suffix={` pass rate vs ${previousLabel}`} />
                  )
                }
              />
              <Kpi
                label="Failed"
                value={totals.failed}
                sub="Click to see failed tasks"
                tone="red"
                onClick={() => openDetail("failed")}
                change={previous && <Change current={totals.failed} previous={previous.failed} better="down" suffix={` vs ${previousLabel}`} />}
              />
              <Kpi
                label="Overdue"
                value={totals.overdue}
                sub={`${totals.overdue_fixtures} fixtures · as of ${formatDate(report.overdue_checked_at)}`}
                tone="orange"
                onClick={() => openDetail("overdue")}
                change={previous && <Change current={totals.overdue} previous={previous.overdue} better="down" suffix={` vs ${previousLabel}`} />}
              />
              <Kpi label="PMs tracked" value={totals.tracked_pms} sub="Fixture × PM type (not paused)" />
            </div>

            {/* PER PERIOD */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{group.label} summary</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Overdue = PMs past their due date at the end of each {group.unit.toLowerCase()}. Paused fixtures are not counted.
                    {canDrillDown && ` Click a ${group.unit.toLowerCase()} to open it ${group.id === "week" ? "day by day" : "week by week"}.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSummary}
                  disabled={!periods.length}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-50"
                >
                  Download CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                      <th className={TH}>{group.unit}</th>
                      <th className={`${TH} text-right`}>Completed</th>
                      <th className={`${TH} text-right`}>Passed</th>
                      <th className={`${TH} text-right`}>Failed</th>
                      <th className={`${TH} text-right`}>Pass rate</th>
                      <th className={`${TH} text-right`}>Overdue at end</th>
                      <th className={`${TH} w-1/4`} aria-label="Chart" />
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => (
                      <tr
                        key={p.start}
                        onClick={canDrillDown ? () => drillDown(p) : undefined}
                        title={canDrillDown ? `Open ${p.label}` : undefined}
                        className={`border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40 ${canDrillDown ? "cursor-pointer" : ""}`}
                      >
                        <td className={`${TD} font-medium ${canDrillDown ? "text-blue-700 dark:text-blue-400" : ""}`}>
                          {p.label}
                          {group.id !== "week" && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {periodWorkWeek(p, group.id)}
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>{p.completed}</td>
                        <td className={`${TD} text-right text-green-700 dark:text-green-400`}>{p.passed}</td>
                        <td className={`${TD} text-right ${p.failed ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>{p.failed}</td>
                        <td className={`${TD} text-right`}>
                          {pct(p.pass_rate)}
                          {i > 0 && (
                            <div>
                              <Change current={p.pass_rate} previous={periods[i - 1].pass_rate} unit=" pts" />
                            </div>
                          )}
                        </td>
                        <td className={`${TD} text-right ${p.overdue ? "font-semibold text-orange-600 dark:text-orange-400" : ""}`}>
                          {p.overdue ?? "—"}
                          {i > 0 && (
                            <div>
                              <Change current={p.overdue} previous={periods[i - 1].overdue} better="down" />
                            </div>
                          )}
                        </td>
                        <td className={TD}>
                          <PeriodBar passed={p.passed} failed={p.failed} max={maxCompleted} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold dark:bg-gray-700/50">
                      <td className={TD}>Total</td>
                      <td className={`${TD} text-right`}>{totals.completed}</td>
                      <td className={`${TD} text-right text-green-700 dark:text-green-400`}>{totals.passed}</td>
                      <td className={`${TD} text-right text-red-600 dark:text-red-400`}>{totals.failed}</td>
                      <td className={`${TD} text-right`}>{pct(totals.pass_rate)}</td>
                      <td className={`${TD} text-right text-orange-600 dark:text-orange-400`}>{totals.overdue}</td>
                      <td className={TD} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {report.by_pm_type.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.by_pm_type.map((t) => (
                    <div
                      key={t.pm_type}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      <span className="font-bold">{t.label}:</span> {t.completed} done · <span className="text-green-700 dark:text-green-400">{t.passed} passed</span> ·{" "}
                      <span className="text-red-600 dark:text-red-400">{t.failed} failed</span> ·{" "}
                      <span className="text-orange-600 dark:text-orange-400">{t.overdue} overdue</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DETAILS */}
            <div id="pm-report-details" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
                  {[
                    { id: "records", label: "All PMs", count: records.length },
                    { id: "failed", label: "Failed", count: failedRecords.length },
                    { id: "overdue", label: "Overdue", count: overdue.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setDetailTab(tab.id);
                        setPage(1);
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        detailTab === tab.id
                          ? "bg-blue-600 text-white shadow"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  {detailTab !== "overdue" && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={notesOnly}
                        onChange={(e) => {
                          setNotesOnly(e.target.checked);
                          setPage(1);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      Only with notes or parts
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={downloadDetails}
                    disabled={!detailRows.length}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-50"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              {report.records_truncated && detailTab !== "overdue" && (
                <p className="mb-2 text-xs text-orange-600">
                  Showing the latest {records.length} of {report.records_total} PMs. Totals above include all of them; narrow the range to list everything.
                </p>
              )}
              {detailTab === "overdue" && (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  PMs past their due date as of {formatDateTime(report.overdue_checked_at)}.
                </p>
              )}

              {!detailRows.length ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {detailTab === "overdue"
                    ? "Nothing overdue. 🎉"
                    : notesOnly
                      ? "No PMs with notes or parts in this range."
                      : "No PMs in this range."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {detailTab === "overdue" ? (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                          <th className={TH}>Fixture</th>
                          <th className={TH}>Project / Test area</th>
                          <th className={TH}>PM type</th>
                          <th className={TH}>Due</th>
                          <th className={`${TH} text-right`}>Days overdue</th>
                          <th className={TH}>Last done</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <tr key={`${row.fixture_id}-${row.pm_type}`} className="border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                            <td className={TD}>
                              {fixtureLink(row)}
                              {row.production_line && <div className="text-xs text-gray-500">{row.production_line}</div>}
                            </td>
                            <td className={TD}>
                              {row.project_name} · {row.test_area}
                            </td>
                            <td className={TD}>{row.label}</td>
                            <td className={`${TD} whitespace-nowrap`}>
                              {formatDate(row.due_at)}
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{workWeek(row.due_at)}</div>
                            </td>
                            <td className={`${TD} text-right font-semibold text-orange-600 dark:text-orange-400`}>{row.days_overdue}</td>
                            <td className={TD}>{row.last_performed_at ? formatDate(row.last_performed_at) : "Never"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
                          <th className={TH}>Date</th>
                          <th className={TH}>Fixture</th>
                          <th className={TH}>PM type</th>
                          <th className={TH}>Result</th>
                          <th className={TH}>Completed by</th>
                          <th className={TH}>Failed tasks</th>
                          <th className={TH}>Notes</th>
                          <th className={TH}>Parts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r) => (
                          <tr key={r.pm_id} className="border-b align-top hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                            <td className={`${TD} whitespace-nowrap`}>
                              {formatDateTime(r.performed_at)}
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">{workWeek(r.performed_at)}</div>
                            </td>
                            <td className={TD}>
                              {fixtureLink(r)}
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {[r.project_name, r.test_area, r.production_line].filter(Boolean).join(" · ")}
                              </div>
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>{r.label}</td>
                            <td className={TD}>
                              <ResultBadge result={r.overall_result} />
                            </td>
                            <td className={TD}>{r.performed_by || "Unknown"}</td>
                            <td className={`${TD} min-w-[8rem] max-w-[14rem]`}>
                              {r.failed_tasks.length > 0 ? (
                                <ul className="list-disc space-y-0.5 pl-4 text-red-600 dark:text-red-400">
                                  {r.failed_tasks.map((task) => (
                                    <li key={task}>{task}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className={`${TD} min-w-[10rem] max-w-xs whitespace-pre-wrap`}>
                              {r.notes || <span className="text-gray-400">—</span>}
                            </td>
                            <td className={`${TD} min-w-[9rem] max-w-[16rem]`}>
                              {r.parts_replaced && <div className="whitespace-pre-wrap">{r.parts_replaced}</div>}
                              {r.parts.length > 0 && (
                                <div className={`text-xs text-purple-700 dark:text-purple-300 ${r.parts_replaced ? "mt-1" : ""}`}>
                                  📦 {stockPartsText(r)}
                                </div>
                              )}
                              {!r.parts_replaced && !r.parts.length && <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              <Pager page={page} total={detailRows.length} onChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
