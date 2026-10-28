// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import FlashBanner from "../components/FlashBanner";
import DashboardItemSearch from "../components/DashboardItemSearch";
import DashboardQuickActions from "../components/DashboardQuickActions";
import { MAINTENANCE_DASHBOARD_URL } from "../components/maintenance/links";

export default function Dashboard() {
  const [flash, setFlash] = useState(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalTransactions: 0,
    todayActivity: 0,
  });
  const [inventory, setInventory] = useState([]);
  const [pmAttention, setPmAttention] = useState({
    overdueFixtures: 0,
    dueSoonFixtures: 0,
    topProjects: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.flashMessage) {
      setFlash({
        message: location.state.flashMessage,
        type: location.state.flashType || "info",
      });
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.signupNotice) {
      setFlash({
        message: location.state.signupNotice,
        type: "info",
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [inventoryRes, lowStockRes, transactionsRes, remindersRes] = await Promise.all([
          API.get("/inventory/"),
          API.get("/alerts/low-stock"),
          API.get("/transactions/all"),
          API.get("/maintenance/reminders").catch(() => ({ data: null })),
        ]);

        const allItems = inventoryRes.data || [];
        setInventory(Array.isArray(allItems) ? allItems : []);

        const lowStock = lowStockRes.data || [];

        const allTransactions = transactionsRes.data || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTransactions = allTransactions.filter((t) => {
          const transactionDate = new Date(t.created_at);
          transactionDate.setHours(0, 0, 0, 0);
          return transactionDate.getTime() === today.getTime();
        });

        setStats({
          totalItems: allItems.length,
          lowStockCount: lowStock.length,
          totalTransactions: allTransactions.length,
          todayActivity: todayTransactions.length,
        });

        const reminders = remindersRes?.data;
        if (reminders) {
          setPmAttention({
            overdueFixtures: reminders.overdue_fixtures || 0,
            dueSoonFixtures: reminders.due_soon_fixtures || 0,
            topProjects: (reminders.by_project || [])
              .filter((row) => (row.overdue_fixtures || 0) > 0)
              .slice(0, 4),
          });
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const lowStockPercentage =
    stats.totalItems > 0 ? Math.round((stats.lowStockCount / stats.totalItems) * 100) : 0;

  const hasPmAttention = pmAttention.overdueFixtures > 0 || pmAttention.dueSoonFixtures > 0;

  return (
    <>
      <FlashBanner message={flash?.message} type={flash?.type} onDismiss={() => setFlash(null)} />

      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading dashboard…</p>
        </div>
      ) : (
        <>
          <DashboardItemSearch inventory={inventory} />

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow transition-all hover:shadow-md dark:bg-gray-800">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Total Items
              </p>
              <p className="mt-0.5 text-xl font-bold text-gray-800 dark:text-gray-200">{stats.totalItems}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Active inventory</p>
            </div>

            <button
              type="button"
              className="rounded-lg border-l-4 border-red-500 bg-white p-4 text-left shadow transition-all hover:shadow-md dark:bg-gray-800"
              onClick={() => navigate("/dashboard/alerts")}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Low Stock
              </p>
              <p className="mt-0.5 text-xl font-bold text-red-600 dark:text-red-400">{stats.lowStockCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{lowStockPercentage}% of total</p>
            </button>

            <button
              type="button"
              className="rounded-lg border-l-4 border-purple-500 bg-white p-4 text-left shadow transition-all hover:shadow-md dark:bg-gray-800"
              onClick={() => navigate("/dashboard/activity")}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Transactions
              </p>
              <p className="mt-0.5 text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalTransactions}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">All time · open history</p>
            </button>

            <div className="rounded-lg border-l-4 border-green-500 bg-white p-4 shadow transition-all dark:bg-gray-800">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Today</p>
              <p className="mt-0.5 text-xl font-bold text-green-600 dark:text-green-400">{stats.todayActivity}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Transactions today</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Needs attention</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Overdue and due-soon PMs</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue`)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  PM To do →
                </button>
              </div>

              {!hasPmAttention ? (
                <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No overdue or due-soon PMs right now.
                </p>
              ) : (
                <div className="rounded-lg border border-red-100 bg-red-50/80 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                  <div className="flex flex-wrap items-center gap-2">
                    {pmAttention.overdueFixtures > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue`)}
                        className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        {pmAttention.overdueFixtures} fixture
                        {pmAttention.overdueFixtures === 1 ? "" : "s"} overdue
                      </button>
                    )}
                    {pmAttention.dueSoonFixtures > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=due_soon`)}
                        className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        {pmAttention.dueSoonFixtures} due soon
                      </button>
                    )}
                  </div>
                  {pmAttention.topProjects.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pmAttention.topProjects.map((row) => (
                        <li key={row.project}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue&project=${encodeURIComponent(row.project)}`
                              )
                            }
                            className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs hover:bg-white/70 dark:hover:bg-gray-800/60"
                          >
                            <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                              {row.project}
                            </span>
                            <span className="shrink-0 font-semibold text-red-600 dark:text-red-400">
                              {row.overdue_fixtures} overdue
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <DashboardQuickActions lowStockCount={stats.lowStockCount} />
          </div>
        </>
      )}
    </>
  );
}
