import { formatDate } from "./formatDate";

/** "Assigned by Saketh on Oct 5, 2026" (either part may be unknown for older assignments). */
export function assignedByText(by, at, { toYou = false } = {}) {
  const parts = [toYou ? "Assigned to you" : "Assigned"];
  parts.push(by ? `by ${by}` : "by a Super Admin");
  if (at) parts.push(`on ${formatDate(at)}`);
  return parts.join(" ");
}
