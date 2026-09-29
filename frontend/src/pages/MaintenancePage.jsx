import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMReminderBanner from "../components/maintenance/PMReminderBanner";
import MaintenanceDashboardTab from "../components/maintenance/MaintenanceDashboardTab";
import MaintenanceTodoTab from "../components/maintenance/MaintenanceTodoTab";
import MaintenanceCompletedTab from "../components/maintenance/MaintenanceCompletedTab";
import MaintenanceIssuesTab from "../components/maintenance/MaintenanceIssuesTab";
import usePMReminders from "../components/maintenance/usePMReminders";

const TABS = ["dashboard", "todo", "issues", "completed"];

function TabButton({ active, onClick, children, badge, badgeTone = "bg-red-600 text-white" }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "bg-blue-600 text-white shadow-md dark:bg-blue-700"
          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-300"
      }`}
    >
      {children}
      {badge > 0 && (
        <span
          className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${badgeTone} ${
            active ? "ring-2 ring-white/80" : ""
          }`}
        >
          {badge > 999 ? "999+" : badge}
        </span>
      )}
    </button>
  );
}

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "dashboard";
  const todoStatus = params.get("status") || "all";
  const reminders = usePMReminders();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    API.get("/maintenance/summary")
      .then((res) => setSummary(res.data))
      .catch((err) => console.error("Error loading PM summary:", err));
  }, []);

  const openTab = (nextTab, status) => {
    const next = new URLSearchParams();
    if (nextTab !== "dashboard") next.set("tab", nextTab);
    if (status && status !== "all") next.set("status", status);
    setParams(next, { replace: nextTab === tab });
  };
  const openTodo = (status) => openTab("todo", status);
  const todoCount = (reminders?.overdue || 0) + (reminders?.due_soon || 0);
  const openIssues = summary?.open_issues || 0;
  const adjustOpenIssues = (delta) =>
    setSummary((prev) => (prev ? { ...prev, open_issues: Math.max(0, (prev.open_issues || 0) + delta) } : prev));

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="PM Dashboard" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-7xl space-y-4 px-2 pb-8">
        <PMReminderBanner reminders={reminders} onView={openTodo} />

        <div
          role="tablist"
          className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <TabButton active={tab === "dashboard"} onClick={() => openTab("dashboard")}>
            📊 Dashboard
          </TabButton>
          <TabButton
            active={tab === "todo"}
            onClick={() => openTab("todo")}
            badge={todoCount}
            badgeTone={reminders?.overdue ? "bg-red-600 text-white" : "bg-yellow-400 text-yellow-950"}
          >
            📝 To do
          </TabButton>
          <TabButton
            active={tab === "issues"}
            onClick={() => openTab("issues")}
            badge={openIssues}
            badgeTone="bg-orange-500 text-white"
          >
            ⚠ Issues
          </TabButton>
          <TabButton
            active={tab === "completed"}
            onClick={() => openTab("completed")}
            badge={summary?.completed_last_7_days}
            badgeTone="bg-green-600 text-white"
          >
            ✅ Completed
          </TabButton>
        </div>

        {tab === "dashboard" && <MaintenanceDashboardTab onOpenTodo={openTodo} onOpenTab={openTab} />}
        {tab === "todo" && <MaintenanceTodoTab status={todoStatus} onStatusChange={(s) => openTab("todo", s)} />}
        {tab === "issues" && <MaintenanceIssuesTab onCountChange={adjustOpenIssues} />}
        {tab === "completed" && <MaintenanceCompletedTab />}
      </div>
    </div>
  );
}
