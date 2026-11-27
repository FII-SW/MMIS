import { HOLD_REASON_OPTIONS, isOnHold, LIFECYCLE_OPTIONS } from "../../utils/fixtureLifecycle";

const SELECT_CLASS =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white";

/**
 * Status dropdown + Hold location (Warehouse / PM / N/A) when On Hold.
 * `onChange(field, value)` with field = lifecycle_status | hold_reason
 */
export default function FixtureLifecycleFields({
  lifecycleStatus = "production",
  holdReason = "",
  onChange,
  disabled = false,
  compact = false,
  labelClassName = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400",
}) {
  const hold = isOnHold(lifecycleStatus);

  const setStatus = (value) => {
    onChange?.("lifecycle_status", value);
    if (value !== "on_hold") onChange?.("hold_reason", "");
  };

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      <label className={compact ? "min-w-[9rem] flex-1" : "block"}>
        {!compact && <span className={labelClassName}>Status</span>}
        <select
          value={lifecycleStatus || "production"}
          onChange={(e) => setStatus(e.target.value)}
          disabled={disabled}
          aria-label="Fixture status"
          className={SELECT_CLASS}
        >
          {LIFECYCLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {hold && (
        <label className={compact ? "min-w-[8rem] flex-1" : "block"}>
          {!compact && <span className={labelClassName}>Hold location</span>}
          <select
            value={holdReason || ""}
            onChange={(e) => onChange?.("hold_reason", e.target.value)}
            disabled={disabled}
            required
            aria-label="Hold location"
            className={SELECT_CLASS}
          >
            <option value="">Select…</option>
            {HOLD_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
