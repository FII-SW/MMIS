import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../../contexts/NotificationContext";

const MY_PMS_URL = "/dashboard/maintenance/dashboard?tab=mine";

function AnnouncementBanner({ note, onDismiss, onOpen }) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-purple-300 bg-purple-50 p-4 shadow-sm dark:border-purple-800 dark:bg-purple-950/40 sm:flex-row sm:items-center"
    >
      <span className="text-2xl leading-none" aria-hidden>
        📣
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-purple-900 dark:text-purple-100">{note.title}</p>
        <p className="whitespace-pre-line text-sm text-purple-800/90 dark:text-purple-200/90">{note.message}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {note.link && (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700"
          >
            Open →
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-100 dark:border-purple-700 dark:bg-transparent dark:text-purple-200 dark:hover:bg-purple-900/40"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/** Banners shown on every page: new PM assignments (until My PMs is opened) and unread announcements. */
export default function PMAssignmentBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { serverItems, markServerRead } = useNotifications();

  const announcement = serverItems.find((n) => !n.read && n.kind === "announcement");
  const unread = serverItems.filter((n) => !n.read && n.kind === "pm_assignment");
  const onMyPMs =
    location.pathname.startsWith("/dashboard/maintenance/dashboard") &&
    new URLSearchParams(location.search).get("tab") === "mine";
  const announcementBanner = announcement && (
    <AnnouncementBanner
      note={announcement}
      onDismiss={() => markServerRead(announcement)}
      onOpen={() => {
        markServerRead(announcement);
        navigate(announcement.link);
      }}
    />
  );
  if (unread.length === 0 || onMyPMs) return announcementBanner || null;

  const latest = unread[0];
  const dismiss = () => unread.forEach((n) => markServerRead(n));

  return (
    <>
    {announcementBanner}
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 sm:flex-row sm:items-center"
    >
      <span className="text-2xl leading-none" aria-hidden>
        📋
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-blue-900 dark:text-blue-100">
          {unread.length === 1 ? latest.title : `${unread.length} new PM assignments`}
        </p>
        <p className="text-sm text-blue-800/90 dark:text-blue-200/90">{latest.message}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => {
            dismiss();
            navigate(MY_PMS_URL);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          View my PMs →
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:bg-transparent dark:text-blue-200 dark:hover:bg-blue-900/40"
        >
          Got it
        </button>
      </div>
    </div>
    </>
  );
}
