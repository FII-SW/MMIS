/**
 * Plant clocks use US Central (Chicago).
 * America/Chicago follows CST (UTC-6) and CDT (UTC-5) automatically.
 */
export const PLANT_TIME_ZONE = "America/Chicago";

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsMap(date, options) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: PLANT_TIME_ZONE, ...options });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

/** Date only in Chicago, e.g. "Oct 28, 2026". */
export function formatDate(value) {
  const date = asDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    timeZone: PLANT_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Date + time in Chicago, e.g. "Oct 28, 2026, 09:34 AM". */
export function formatDateTime(value) {
  const date = asDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    timeZone: PLANT_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Compact activity-style stamp with real CST/CDT label, e.g. "10/28/26 9:34 AM CDT".
 */
export function formatDateTimeCentral(value) {
  const date = asDate(value);
  if (!date) return "—";
  const parts = partsMap(date, {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const zone = parts.timeZoneName || "CT";
  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${zone}`;
}
