import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import usePMReminders, { describeReminderTypes } from "./usePMReminders";

function todoUrl(status, project, testArea) {
  const params = new URLSearchParams({ tab: "todo", status });
  if (project) params.set("project", project);
  if (project && testArea) params.set("test_area", testArea);
  return `/dashboard/maintenance/dashboard?${params}`;
}

export default function PMReminderChip() {
  const navigate = useNavigate();
  const location = useLocation();
  const reminders = usePMReminders();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!reminders) return null;

  const {
    overdue,
    due_soon: dueSoon,
    overdue_fixtures: overdueFixtures = 0,
    due_soon_fixtures: dueSoonFixtures = 0,
    by_pm_type: byPmType,
    by_project: byProject = [],
  } = reminders;
  if (!overdue && !dueSoon) return null;

  const isOverdue = overdue > 0;
  const status = isOverdue ? "overdue" : "due_soon";
  const countKey = isOverdue ? "overdue_fixtures" : "due_soon_fixtures";
  const fixtureCount = isOverdue ? overdueFixtures : dueSoonFixtures;
  const checkCount = isOverdue ? overdue : dueSoon;
  const projects = byProject.filter((row) => row[countKey] > 0);
  const pageParams = new URLSearchParams(location.search);
  const here = pageParams.get("project");
  const hereArea = pageParams.get("test_area");
  const hereMatch = projects.find((row) => row.project === here);
  const word = fixtureCount === 1 ? "fixture" : "fixtures";
  const stateLabel = isOverdue ? "overdue" : "due soon";
  const title = isOverdue
    ? `${fixtureCount} ${word} overdue, ${checkCount} PM checks: ${describeReminderTypes(byPmType, "overdue")}`
    : `${fixtureCount} ${word} due soon: ${describeReminderTypes(byPmType, "due_soon")}`;

  const go = (project, testArea) => {
    setOpen(false);
    navigate(todoUrl(status, project, testArea));
  };

  const onClick = () => {
    if (hereMatch) go(hereMatch.project, hereArea);
    else if (projects.length <= 1) go(projects[0]?.project);
    else setOpen((value) => !value);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-expanded={open}
        aria-haspopup={projects.length > 1 ? "menu" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors ${
          isOverdue
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
        }`}
      >
        <span aria-hidden>{isOverdue ? "⚠" : "⏰"}</span>
        <span>
          {fixtureCount > 999 ? "999+" : fixtureCount}{" "}
          <span className="hidden sm:inline">
            {word} {stateLabel}
          </span>
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Open the {stateLabel} list
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => go()}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            All projects
            <span className="text-xs text-gray-500 dark:text-gray-400">{fixtureCount}</span>
          </button>
          {projects.map((row) => (
            <button
              key={row.project}
              type="button"
              role="menuitem"
              onClick={() => go(row.project)}
              className="flex w-full items-center justify-between gap-3 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span className="truncate">{row.project}</span>
              <span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{row[countKey]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
