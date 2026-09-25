export const PM_STATES = ["overdue", "never", "due_soon", "ok"];

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
};

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function describeDue(entry) {
  if (!entry || entry.state === "never" || entry.days_until_due == null) return "Never done";
  const days = entry.days_until_due;
  if (days < 0) return `Overdue by ${plural(-days, "day")}`;
  if (days === 0) return "Due today";
  return `Due in ${plural(days, "day")}`;
}
