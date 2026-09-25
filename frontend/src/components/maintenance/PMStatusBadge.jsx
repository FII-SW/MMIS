import { PM_STATE_META } from "./pmStatus";

export default function PMStatusBadge({ state, label, className = "" }) {
  const meta = PM_STATE_META[state];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {label || meta.label}
    </span>
  );
}
