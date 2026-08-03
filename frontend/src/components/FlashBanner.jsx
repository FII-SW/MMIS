/** Dismissible banner for one-time messages (e.g. access denied redirect). */
export default function FlashBanner({ message, type = "info", onDismiss }) {
  if (!message) return null;

  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100",
    warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100",
    success: "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/30 dark:border-green-800 dark:text-green-100",
  };

  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles[type] || styles.info}`}
      role="status"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
