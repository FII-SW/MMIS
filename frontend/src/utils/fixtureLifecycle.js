/** Fixture lifecycle: Production / On Hold / Development. */

export const LIFECYCLE_OPTIONS = [
  { value: "production", label: "Production" },
  { value: "on_hold", label: "On Hold" },
  { value: "development", label: "Development" },
];

export const HOLD_REASON_OPTIONS = [
  { value: "warehouse", label: "Warehouse" },
  { value: "pm", label: "PM" },
  { value: "n_a", label: "N/A" },
];

export function lifecycleLabel(status) {
  return LIFECYCLE_OPTIONS.find((o) => o.value === status)?.label || "Production";
}

export function holdReasonLabel(reason) {
  return HOLD_REASON_OPTIONS.find((o) => o.value === reason)?.label || reason || "—";
}

export function isOnHold(status) {
  return (status || "production") === "on_hold";
}

/** Badge classes for list / detail chips. */
export function lifecycleBadgeClass(status) {
  switch (status) {
    case "on_hold":
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700";
    case "development":
      return "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-700";
    default:
      return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700";
  }
}
