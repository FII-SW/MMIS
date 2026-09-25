export const PM_STATES = ["overdue", "due_soon", "never", "ok", "paused"];
export const PM_STATE_RANK = { overdue: 0, due_soon: 1, never: 2, ok: 3, paused: 4 };

/** Fixtures whose PM counts toward compliance (paused ones are out of service). */
export function activePMCount(counts) {
  return ["overdue", "due_soon", "never", "ok"].reduce((sum, state) => sum + (counts?.[state] || 0), 0);
}

export const PM_STATE_META = {
  overdue: {
    label: "Overdue",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
    tile: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
  },
  never: {
    label: "Never done",
    badge: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    dot: "bg-gray-400",
    tile: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  due_soon: {
    label: "Due soon",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    dot: "bg-yellow-500",
    tile: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  },
  ok: {
    label: "Up to date",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500",
    tile: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300",
  },
  paused: {
    label: "PM paused",
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    dot: "bg-slate-500",
    tile: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  },
};

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function describeDue(entry) {
  if (entry?.state === "paused") return "PM paused";
  if (!entry || entry.days_until_due == null) return "Never done";
  const days = entry.days_until_due;
  if (days < 0) return `Overdue by ${plural(-days, "day")}`;
  if (days === 0) return "Due today";
  if (entry.state === "never") return `First PM due in ${plural(days, "day")}`;
  return `Due in ${plural(days, "day")}`;
}
