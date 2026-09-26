import { useEffect, useState } from "react";
import API from "../../api";

const DEFAULT_POLL_MS = 10 * 60 * 1000;

export const PM_TODO_URL = "/dashboard/maintenance/dashboard?tab=todo";

export function describeReminderTypes(byPmType, state) {
  return Object.values(byPmType || {})
    .filter((counts) => counts[state] > 0)
    .map((counts) => `${counts[state]} ${counts.label}`)
    .join(", ");
}

export default function usePMReminders(pollMs = DEFAULT_POLL_MS) {
  const [reminders, setReminders] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!localStorage.getItem("token")) return;
      API.get("/maintenance/reminders")
        .then((res) => {
          if (!cancelled) setReminders(res.data);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, pollMs);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", load);
    };
  }, [pollMs]);

  return reminders;
}
