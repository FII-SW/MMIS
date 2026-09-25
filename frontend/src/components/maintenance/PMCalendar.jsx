import { useMemo, useState } from "react";
import { PM_STATE_META } from "./pmStatus";
import { pmTypeLabel } from "./pmTypes";

const WEEKS_SHOWN = 5;
const MAX_PER_DAY = 3;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function TaskChip({ task, onOpen }) {
  const meta = PM_STATE_META[task.entry.state];
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      title={`${task.fixture.fixture_name} · ${pmTypeLabel(task.pmType)}`}
      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${meta?.tile || ""} hover:ring-1 hover:ring-blue-500`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta?.dot || ""}`} />
      <span className="truncate">{task.fixture.fixture_name}</span>
    </button>
  );
}

export default function PMCalendar({ tasks, onOpen }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const { overdue, byDay, later, days, todayKey } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const first = startOfWeek(today);
    const gridDays = Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
    const lastKey = dayKey(gridDays[gridDays.length - 1]);
    const grouped = {};
    const overdueTasks = [];
    let laterCount = 0;
    tasks.forEach((task) => {
      if (task.entry.state === "overdue" || !task.entry.next_due_at) {
        overdueTasks.push(task);
        return;
      }
      const key = dayKey(new Date(task.entry.next_due_at));
      if (key > lastKey) {
        laterCount += 1;
        return;
      }
      (grouped[key] ||= []).push(task);
    });
    return { overdue: overdueTasks, byDay: grouped, later: laterCount, days: gridDays, todayKey: dayKey(today) };
  }, [tasks]);

  const expandedTasks = expandedDay ? byDay[expandedDay] || [] : [];

  return (
    <div className="space-y-3">
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            Overdue now · {overdue.length}
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
            {overdue.slice(0, 24).map((task) => (
              <TaskChip key={`${task.fixture.fixture_id}-${task.pmType}`} task={task} onOpen={onOpen} />
            ))}
          </div>
          {overdue.length > 24 && (
            <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
              +{overdue.length - 24} more. Switch to the list view to see all.
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="grid min-w-[700px] grid-cols-7">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="border-b bg-gray-50 px-2 py-1.5 text-center text-[11px] font-bold uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300"
            >
              {name}
            </div>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const dayTasks = byDay[key] || [];
            const isPast = key < todayKey;
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`min-h-[92px] border-b border-r p-1 dark:border-gray-700 ${
                  isPast ? "bg-gray-50/70 dark:bg-gray-900/30" : ""
                } ${expandedDay === key ? "ring-2 ring-inset ring-blue-500" : ""}`}
              >
                <p
                  className={`mb-1 text-right text-[11px] ${
                    isToday
                      ? "font-bold text-blue-600 dark:text-blue-400"
                      : isPast
                        ? "text-gray-400 dark:text-gray-600"
                        : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {isToday ? "Today · " : ""}
                  {day.getDate() === 1 || day === days[0]
                    ? day.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : day.getDate()}
                </p>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, MAX_PER_DAY).map((task) => (
                    <TaskChip key={`${task.fixture.fixture_id}-${task.pmType}`} task={task} onOpen={onOpen} />
                  ))}
                  {dayTasks.length > MAX_PER_DAY && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(expandedDay === key ? null : key)}
                      className="w-full text-left text-[10px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      +{dayTasks.length - MAX_PER_DAY} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expandedDay && expandedTasks.length > 0 && (
        <div className="rounded-xl border bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Due {new Date(`${expandedDay}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              {" · "}
              {expandedTasks.length} PMs
            </p>
            <button
              type="button"
              onClick={() => setExpandedDay(null)}
              className="text-xs font-semibold text-gray-500 hover:underline dark:text-gray-400"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {expandedTasks.map((task) => (
              <TaskChip key={`${task.fixture.fixture_id}-${task.pmType}`} task={task} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}

      {later > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {later} more PMs are due after this {WEEKS_SHOWN}-week window.
        </p>
      )}
    </div>
  );
}
