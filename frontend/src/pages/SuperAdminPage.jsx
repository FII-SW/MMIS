import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import AnnouncementsTab from "../components/superadmin/AnnouncementsTab";
import AssignmentsTab from "../components/superadmin/AssignmentsTab";
import AuditTab from "../components/superadmin/AuditTab";
import SettingsTab from "../components/superadmin/SettingsTab";
import UsersTab from "../components/superadmin/UsersTab";
import WorkloadTab from "../components/superadmin/WorkloadTab";

const TABS = [
  { id: "users", label: "Users", Component: UsersTab },
  { id: "assignments", label: "PM Assignments", Component: AssignmentsTab },
  { id: "workload", label: "Workload", Component: WorkloadTab },
  { id: "announcements", label: "Announcements", Component: AnnouncementsTab },
  { id: "audit", label: "Audit Log", Component: AuditTab },
  { id: "settings", label: "Settings", Component: SettingsTab },
];

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const active = TABS.find((tab) => tab.id === searchParams.get("tab")) || TABS[0];
  const { Component } = active;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />
      <PageHeaderWithBack title="Super Admin" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-7xl space-y-4 px-4 pb-10 sm:px-8">
        <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSearchParams({ tab: tab.id }, { replace: true })}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab.id === active.id
                  ? "bg-blue-600 text-white shadow dark:bg-blue-700"
                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Component />
      </div>
    </div>
  );
}
