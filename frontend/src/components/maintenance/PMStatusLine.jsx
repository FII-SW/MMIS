const PARTS = [
  { state: "overdue", label: "overdue", className: "text-red-600 dark:text-red-400" },
  { state: "due_soon", label: "due soon", className: "text-yellow-700 dark:text-yellow-400" },
  { state: "never", label: "never done", className: "text-gray-500 dark:text-gray-400" },
];

/** One short, colour-coded PM status line for a project / test-area card. */
export default function PMStatusLine({ counts, emptyLabel = "No PM fixtures" }) {
  const total = ["overdue", "due_soon", "never", "ok", "paused"].reduce(
    (sum, state) => sum + (counts?.[state] || 0),
    0
  );
  if (!total) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">{emptyLabel}</span>;
  }

  const parts = PARTS.filter(({ state }) => counts[state] > 0);
  if (parts.length === 0) {
    return <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ PM up to date</span>;
  }
  return (
    <span className="text-xs font-semibold">
      {parts.map(({ state, label, className }, index) => (
        <span key={state} className={className}>
          {index > 0 && <span className="text-gray-400"> · </span>}
          {counts[state]} {label}
        </span>
      ))}
    </span>
  );
}
