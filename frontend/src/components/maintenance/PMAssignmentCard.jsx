import { getTokenSession } from "../../utils/auth";
import { assignedByText } from "./assignment";

/** Who is responsible for this fixture's PMs, and which Super Admin assigned them. */
export default function PMAssignmentCard({ status }) {
  if (!status?.assigned_to) return null;
  const mine = status.assigned_employee_id === getTokenSession()?.employee_id;

  if (mine) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/40">
        <span className="text-2xl leading-none" aria-hidden>
          📋
        </span>
        <div>
          <p className="font-semibold text-blue-900 dark:text-blue-100">You&apos;re responsible for this fixture&apos;s PMs</p>
          <p className="text-sm text-blue-800/90 dark:text-blue-200/90">
            {assignedByText(status.assigned_by, status.assigned_at, { toYou: true })}. Please keep its PMs up to date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm dark:border-purple-800 dark:bg-purple-950/30">
      <span className="text-2xl leading-none" aria-hidden>
        👤
      </span>
      <div>
        <p className="font-semibold text-purple-900 dark:text-purple-100">
          PM responsibility: {status.assigned_to}
        </p>
        <p className="text-sm text-purple-800/90 dark:text-purple-200/90">
          {assignedByText(status.assigned_by, status.assigned_at)}. Anyone can still record a PM if needed.
        </p>
      </div>
    </div>
  );
}
