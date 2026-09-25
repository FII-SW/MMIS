export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "quarter", label: "This quarter" },
  { id: "custom", label: "Custom" },
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

/** { from, to } as Date objects for a preset, relative to now. */
export function presetRange(id, now = new Date()) {
  const today = startOfDay(now);
  switch (id) {
    case "today":
      return { from: today, to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y) };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now) };
    }
    case "month":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfDay(now) };
    case "last_month": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to: endOfDay(last) };
    }
    case "quarter":
      return {
        from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
        to: endOfDay(now),
      };
    case "7d":
    default: {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
  }
}

const pad = (n) => String(n).padStart(2, "0");

/** Date -> value for <input type="datetime-local"> (local time, minute precision). */
export function toLocalInput(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> Date in local time (null when empty/invalid). */
export function fromLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "To" is inclusive of its whole minute. */
export function rangeToParams(from, to) {
  return {
    date_from: from.toISOString(),
    date_to: new Date(to.getTime() + 59999).toISOString(),
  };
}

export function formatRange(from, to) {
  const sameYear = from.getFullYear() === to.getFullYear() && from.getFullYear() === new Date().getFullYear();
  const opts = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(sameYear ? {} : { year: "numeric" }) };
  return `${from.toLocaleString("en-US", opts)} – ${to.toLocaleString("en-US", opts)}`;
}
