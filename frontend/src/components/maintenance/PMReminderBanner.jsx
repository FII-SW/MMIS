import { describeReminderTypes } from "./usePMReminders";

export default function PMReminderBanner({ reminders, onView }) {
  if (!reminders) return null;
  const { overdue, due_soon: dueSoon, overdue_fixtures: overdueFixtures, by_pm_type: byPmType } = reminders;

  if (overdue > 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border-l-4 border-red-600 bg-red-50 p-4 shadow-sm dark:bg-red-900/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-red-800 dark:text-red-200">
            ⚠ {overdue} PM{overdue === 1 ? " is" : "s are"} overdue on {overdueFixtures} fixture
            {overdueFixtures === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            Not reported in time: {describeReminderTypes(byPmType, "overdue")}.
            {dueSoon > 0 && ` Another ${dueSoon} due soon.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onView("overdue")}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
        >
          View overdue PMs
        </button>
      </div>
    );
  }

  if (dueSoon > 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border-l-4 border-yellow-500 bg-yellow-50 p-4 shadow-sm dark:bg-yellow-900/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-yellow-900 dark:text-yellow-200">
            ⏰ {dueSoon} PM{dueSoon === 1 ? " is" : "s are"} due in the next few days
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {describeReminderTypes(byPmType, "due_soon")}. Nothing is overdue yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onView("due_soon")}
          className="shrink-0 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-yellow-950 shadow hover:bg-yellow-600"
        >
          View due soon
        </button>
      </div>
    );
  }

  return null;
}
