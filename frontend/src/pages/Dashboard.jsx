// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import FlashBanner from "../components/FlashBanner";
import DashboardItemSearch from "../components/DashboardItemSearch";
import DashboardQuickActions from "../components/DashboardQuickActions";

export default function Dashboard() {
  const [flash, setFlash] = useState(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalTransactions: 0,
    requests: 0,
    returns: 0,
    restocks: 0,
    todayActivity: 0,
  });
  const [inventory, setInventory] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
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
    }
  }, [location, navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const inventoryRes = await API.get("/inventory/");
        const allItems = inventoryRes.data || [];
        setInventory(Array.isArray(allItems) ? allItems : []);

        const lowStockRes = await API.get("/alerts/low-stock");
        const lowStockItems = lowStockRes.data || [];

        const transactionsRes = await API.get("/transactions/all");
        const allTransactions = transactionsRes.data || [];

        const requests = allTransactions.filter(
          (t) => t.transaction_type?.toLowerCase() === "request"
        ).length;
        const returns = allTransactions.filter(
          (t) => t.transaction_type?.toLowerCase() === "return"
        ).length;
        const restocks = allTransactions.filter(
          (t) => t.transaction_type?.toLowerCase() === "restock"
        ).length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayTransactions = allTransactions.filter((t) => {
          const transactionDate = new Date(t.created_at);
          transactionDate.setHours(0, 0, 0, 0);
          return transactionDate.getTime() === today.getTime();
        });

        setStats({
          totalItems: allItems.length,
          lowStockCount: lowStockItems.length,
          totalTransactions: allTransactions.length,
          requests,
          returns,
          restocks,
          todayActivity: todayTransactions.length,
        });

        const recentSorted = [...allTransactions].sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime;
        });
        setRecentActivity(recentSorted.slice(0, 5));
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionTypeColor = (type) => {
    const typeLower = type?.toLowerCase() || "";
    if (typeLower === "request") return "text-red-600";
    if (typeLower === "return") return "text-green-600";
    if (typeLower === "restock") return "text-blue-600";
    return "text-gray-600";
  };

  const getTransactionTypeIcon = (type) => {
    const typeLower = type?.toLowerCase() || "";
    if (typeLower === "request") return "📤";
    if (typeLower === "return") return "📥";
    if (typeLower === "restock") return "📦";
    return "📋";
  };

  const getTransactionTypeBadge = (type) => {
    const typeLower = type?.toLowerCase() || "";
    if (typeLower === "request") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    if (typeLower === "return") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (typeLower === "restock") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  };

  const lowStockPercentage =
    stats.totalItems > 0
      ? Math.round((stats.lowStockCount / stats.totalItems) * 100)
      : 0;

  return (
    <>
      <FlashBanner message={flash?.message} type={flash?.type} onDismiss={() => setFlash(null)} />

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">Loading dashboard…</p>
        </div>
      ) : (
        <>
          <DashboardItemSearch inventory={inventory} />

          {/* Key Metrics Cards — compact for 14" laptops */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Items</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.totalItems}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Active inventory</p>
                </div>
                <div className="text-2xl opacity-20">📦</div>
              </div>
            </div>

            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate("/dashboard/alerts")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Low Stock</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.lowStockCount}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{lowStockPercentage}% of total</p>
                </div>
                <div className="text-2xl opacity-20">⚠️</div>
              </div>
              {stats.lowStockCount > 0 && (
                <div className="mt-2 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1 text-[10px] text-red-700 dark:text-red-400">
                  Action required
                </div>
              )}
            </div>

            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-purple-500 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate("/dashboard/activity")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Transactions</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.totalTransactions}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">All time</p>
                </div>
                <div className="text-2xl opacity-20">📊</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {stats.todayActivity}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Transactions today</p>
                </div>
                <div className="text-2xl opacity-20">⚡</div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Recent Activity</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Latest 5 transactions</p>
                </div>
                <button
                  onClick={() => navigate("/dashboard/activity")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  View All →
                </button>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6 text-sm">No recent activity</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.transaction_id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow text-base shrink-0">
                          {getTransactionTypeIcon(activity.transaction_type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {activity.item_name || "Item"}
                            </p>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${getTransactionTypeBadge(activity.transaction_type)}`}
                            >
                              {activity.transaction_type || "N/A"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {activity.project_name || "Project"}
                            {activity.test_area ? ` • ${activity.test_area}` : ""} •{" "}
                            {formatDate(activity.created_at)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold shrink-0 ml-2 ${getTransactionTypeColor(activity.transaction_type)}`}
                      >
                        {activity.transaction_type?.toLowerCase() === "request" ? "-" : "+"}
                        {activity.quantity_used}
                      </div>
                    </div>
                  ))}
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
