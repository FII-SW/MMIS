export const FIELD =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-blue-900";

export const CARD = "rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800";

export const BUTTON_PRIMARY =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600";

export const BUTTON_SECONDARY =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";

export const BUTTON_SMALL =
  "rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700";

export function Label({ children }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </span>
  );
}

export function Notice({ type = "error", children, onClose }) {
  if (!children) return null;
  const styles =
    type === "success"
      ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300";
  return (
    <div className={`flex items-start justify-between gap-3 whitespace-pre-line rounded-lg border px-4 py-2.5 text-sm ${styles}`}>
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function RoleBadge({ role, label }) {
  const styles = {
    superadmin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    user: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    viewer: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[role] || styles.user}`}>
      {label}
    </span>
  );
}
