const PARTS = [
  { state: "overdue", label: "overdue", className: "text-red-600 dark:text-red-400" },
  { state: "due_soon", label: "due soon", className: "text-yellow-700 dark:text-yellow-400" },
  { state: "never", label: "never done", className: "text-gray-500 dark:text-gray-400" },
  { state: "on_hold", label: "on hold", className: "text-amber-700 dark:text-amber-400" },
  { state: "development", label: "development", className: "text-violet-700 dark:text-violet-400" },
  { state: "paused", label: "paused", className: "text-slate-500 dark:text-slate-400" },
];

const COUNT_STATES = ["overdue", "due_soon", "never", "ok", "paused", "on_hold", "development"];

/** One short, colour-coded PM status line for a project / test-area card. */
export default function PMStatusLine({ counts, emptyLabel = "No PM fixtures" }) {
  const total = COUNT_STATES.reduce((sum, state) => sum + (counts?.[state] || 0), 0);
  if (!total) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-500">{emptyLabel}</span>;
  }

  const parts = PARTS.filter(({ state }) => counts[state] > 0);
  const onlyOk = parts.length === 0 && (counts.ok || 0) > 0;
  if (onlyOk) {
    return <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">✓ PM up to date</span>;
  }
  if (parts.length === 0) {
    return <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">✓ PM up to date</span>;
  }
  return (
    <span className="text-[11px] font-semibold leading-tight">
      {parts.map(({ state, label, className }, index) => (
        <span key={state} className={className}>
          {index > 0 && <span className="text-gray-400"> · </span>}
          {counts[state]} {label}
        </span>
      ))}
    </span>
  );
}
