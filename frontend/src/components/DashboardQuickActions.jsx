import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import { isAdminUser } from "../utils/auth";

const ACTIONS = [
  {
    id: "request",
    label: "Request Item",
    description: "Pull stock for a project",
    path: "/dashboard/request",
    icon: "📤",
    tone: "blue",
    roles: ["admin", "user"],
  },
  {
    id: "return",
    label: "Return Item",
    description: "Return unused parts",
    path: "/dashboard/return",
    icon: "📥",
    tone: "green",
    roles: ["admin", "user"],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Fixture PM & history",
    path: "/dashboard/maintenance",
    icon: "🛠️",
    tone: "slate",
    roles: ["admin", "user"],
    badgeKey: "overduePmCount",
  },
  {
    id: "alerts",
    label: "Low Stock",
    description: "Items needing restock",
    path: "/dashboard/alerts",
    icon: "⚠️",
    tone: "red",
    roles: ["admin", "user"],
    badgeKey: "lowStockCount",
  },
  {
    id: "documents",
    label: "Documents",
    description: "SOPs and project files",
    path: "/dashboard/documents",
    icon: "📄",
    tone: "cyan",
    roles: ["admin", "user"],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Inventory & usage",
    path: "/dashboard/reports",
    icon: "📊",
    tone: "orange",
    roles: ["admin", "user"],
  },
  {
    id: "activity",
    label: "Activity",
    description: "Transaction history",
    path: "/dashboard/activity",
    icon: "📋",
    tone: "indigo",
    roles: ["admin", "user"],
  },
  {
    id: "restock",
    label: "Restock",
    description: "Add or update stock",
    path: "/dashboard/restock",
    icon: "📦",
    tone: "purple",
    roles: ["admin"],
  },
  {
    id: "transfer",
    label: "Transfer",
    description: "Move stock between projects",
    path: "/dashboard/transfer",
    icon: "🔄",
    tone: "teal",
    roles: ["admin"],
  },
];

const TONE = {
  blue: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/35 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800/50",
  green: "bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/35 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800/50",
  slate: "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600",
  red: "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/35 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800/50",
  cyan: "bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/35 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800/50",
  orange: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/35 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800/50",
  indigo: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/35 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50",
  purple: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/35 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800/50",
  teal: "bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/35 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800/50",
};

export default function DashboardQuickActions({ lowStockCount = 0 }) {
  const navigate = useNavigate();
  const isAdmin = isAdminUser();
  const role = isAdmin ? "admin" : "user";

  const [overduePmCount, setOverduePmCount] = useState(0);

  useEffect(() => {
    API.get("/maintenance/summary")
      .then((res) => setOverduePmCount(res.data?.totals?.overdue || 0))
      .catch(() => setOverduePmCount(0));
  }, []);

  const actions = useMemo(
    () => ACTIONS.filter((action) => action.roles.includes(role)),
    [role]
  );
  const badgeCounts = { lowStockCount, overduePmCount };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Quick Actions</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Jump to common workflows
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((action) => {
          const count = action.badgeKey ? badgeCounts[action.badgeKey] : 0;
          const badge = count > 0 ? count : null;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(action.path)}
              className={`relative rounded-lg border p-3 text-left transition shadow-sm hover:shadow ${TONE[action.tone]}`}
            >
              {badge != null && (
                <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              <div className="text-xl mb-1.5" aria-hidden>
                {action.icon}
              </div>
              <div className="text-xs font-semibold leading-tight">{action.label}</div>
              <div className="mt-0.5 text-[10px] opacity-80 leading-snug">{action.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
