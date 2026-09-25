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
      className={`relative -mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
          : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${badgeTone}`}>
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
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-7xl space-y-4 px-2 pb-8">
        <PMReminderBanner reminders={reminders} onView={openTodo} />

        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
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
