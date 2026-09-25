import { useNavigate } from "react-router-dom";
import usePMReminders, { PM_TODO_URL, describeReminderTypes } from "./usePMReminders";

export default function PMReminderChip() {
  const navigate = useNavigate();
  const reminders = usePMReminders();
  if (!reminders) return null;

  const { overdue, due_soon: dueSoon, by_pm_type: byPmType } = reminders;
  if (!overdue && !dueSoon) return null;

  const isOverdue = overdue > 0;
  const count = isOverdue ? overdue : dueSoon;
  const detail = describeReminderTypes(byPmType, isOverdue ? "overdue" : "due_soon");
  const title = isOverdue
    ? `PM overdue — not reported in time: ${detail}`
    : `PM due soon: ${detail}`;

  return (
    <button
      type="button"
      onClick={() => navigate(`${PM_TODO_URL}&status=${isOverdue ? "overdue" : "due_soon"}`)}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors ${
        isOverdue
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
      }`}
    >
      <span aria-hidden>{isOverdue ? "⚠" : "⏰"}</span>
      <span>
        {count} PM <span className="hidden sm:inline">{isOverdue ? "overdue" : "due soon"}</span>
      </span>
    </button>
  );
}
