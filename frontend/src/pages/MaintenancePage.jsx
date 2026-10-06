import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMReminderBanner from "../components/maintenance/PMReminderBanner";
import MaintenanceDashboardTab from "../components/maintenance/MaintenanceDashboardTab";
import MaintenanceTodoTab from "../components/maintenance/MaintenanceTodoTab";
import MaintenanceCompletedTab from "../components/maintenance/MaintenanceCompletedTab";
import MaintenanceIssuesTab from "../components/maintenance/MaintenanceIssuesTab";
import MyPMsTab from "../components/maintenance/MyPMsTab";
import usePMReminders from "../components/maintenance/usePMReminders";
import { isViewerUser } from "../utils/auth";
import { useNotifications } from "../contexts/NotificationContext";

const TABS = ["dashboard", "mine", "todo", "issues", "completed"];

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
  // Viewers can't be assigned PMs, so they don't get the My PMs tab.
  const [viewOnly] = useState(isViewerUser);
  const tabs = viewOnly ? TABS.filter((t) => t !== "mine") : TABS;
  const tab = tabs.includes(params.get("tab")) ? params.get("tab") : "dashboard";
  const todoStatus = params.get("status") || "all";
  const reminders = usePMReminders();
  const [summary, setSummary] = useState(null);
  const [mine, setMine] = useState({ data: null, loading: !viewOnly, error: "" });

  useEffect(() => {
    API.get("/maintenance/summary")
      .then((res) => setSummary(res.data))
      .catch((err) => console.error("Error loading PM summary:", err));
  }, []);

  const loadMine = useCallback(() => {
    if (viewOnly) return;
    setMine((prev) => ({ ...prev, loading: !prev.data, error: "" }));
    API.get("/maintenance/my-fixtures")
      .then((res) => setMine({ data: res.data, loading: false, error: "" }))
      .catch((err) => {
        console.error("Error loading my PM fixtures:", err);
        setMine((prev) => ({ ...prev, loading: false, error: "Failed to load your PM fixtures." }));
      });
  }, [viewOnly]);

  useEffect(() => {
    if (tab === "mine" || !mine.data) loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadMine]);

  // A new assignment notification means the list changed.
  const { serverUnread } = useNotifications();
  useEffect(() => {
    if (serverUnread > 0) loadMine();
  }, [serverUnread, loadMine]);

  const openTab = (nextTab, status) => {
    const next = new URLSearchParams();
    if (nextTab !== "dashboard") next.set("tab", nextTab);
    if (status && status !== "all") next.set("status", status);
    setParams(next, { replace: nextTab === tab });
  };
  const openTodo = (status) => openTab("todo", status);
  const todoCount = (reminders?.overdue || 0) + (reminders?.due_soon || 0);
  const openIssues = summary?.open_issues || 0;
  const mySummary = mine.data?.summary;
  const myCount = (mySummary?.overdue || 0) + (mySummary?.due_soon || 0);
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
          {!viewOnly && (
            <TabButton
              active={tab === "mine"}
              onClick={() => openTab("mine")}
              badge={myCount}
              badgeTone={mySummary?.overdue ? "bg-red-600 text-white" : "bg-yellow-400 text-yellow-950"}
            >
              👤 My PMs
            </TabButton>
          )}
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
        {tab === "mine" && (
          <MyPMsTab
            data={mine.data}
            loading={mine.loading}
            error={mine.error}
            onReload={loadMine}
            onOpenTodo={openTodo}
          />
        )}
        {tab === "todo" && <MaintenanceTodoTab status={todoStatus} onStatusChange={(s) => openTab("todo", s)} />}
        {tab === "issues" && <MaintenanceIssuesTab onCountChange={adjustOpenIssues} />}
        {tab === "completed" && <MaintenanceCompletedTab />}
      </div>
    </div>
  );
}
