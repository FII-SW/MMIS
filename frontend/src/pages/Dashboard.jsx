// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import { decodeToken } from "../utils/auth";

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalTransactions: 0,
    requests: 0,
    returns: 0,
    restocks: 0,
  });
  const [projectStats, setProjectStats] = useState([]);
  const [testAreaStats, setTestAreaStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Extract employee_id from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = decodeToken(token);
    if (payload?.employee_id) {
      setEmployeeId(payload.employee_id);
    }
  }, []);

  // Fetch employee name from backend
  useEffect(() => {
    if (!employeeId) return;

    API.get(`/employees/${employeeId}`)
      .then((res) => {
        setUserName(res.data.employee_name);
      })
      .catch((err) => console.error("Error loading employee:", err));
  }, [employeeId]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch all inventory
        const inventoryRes = await API.get("/inventory/");
        const allItems = inventoryRes.data || [];
        
        // Fetch low stock items
        const lowStockRes = await API.get("/alerts/low-stock");
        const lowStockItems = lowStockRes.data || [];
        
        // Fetch recent transactions
        const transactionsRes = await API.get("/transactions/all");
        const allTransactions = transactionsRes.data || [];
        
        // Calculate statistics
        const requests = allTransactions.filter(t => t.transaction_type?.toLowerCase() === "request").length;
        const returns = allTransactions.filter(t => t.transaction_type?.toLowerCase() === "return").length;
        const restocks = allTransactions.filter(t => t.transaction_type?.toLowerCase() === "restock").length;
        
        // Calculate today's activity (transactions from today only)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        const todayTransactions = allTransactions.filter(t => {
          const transactionDate = new Date(t.created_at);
          transactionDate.setHours(0, 0, 0, 0);
          return transactionDate.getTime() === today.getTime();
        });
        
        const todayActivity = todayTransactions.length;
        
        setStats({
          totalItems: allItems.length,
          lowStockCount: lowStockItems.length,
          totalTransactions: allTransactions.length,
          requests,
          returns,
          restocks,
          todayActivity, // Add today's activity count
        });
        
        // Calculate project statistics
        const projectMap = {};
        allTransactions.forEach(t => {
          const project = t.project_name || "Unknown";
          if (!projectMap[project]) {
            projectMap[project] = {
              name: project,
              total: 0,
              requests: 0,
              returns: 0,
              restocks: 0,
            };
          }
          projectMap[project].total++;
          const type = t.transaction_type?.toLowerCase();
          if (type === "request") projectMap[project].requests++;
          else if (type === "return") projectMap[project].returns++;
          else if (type === "restock") projectMap[project].restocks++;
        });
        const projectArray = Object.values(projectMap)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5); // Top 5 projects
        setProjectStats(projectArray);
        
        // Calculate test area statistics
        const testAreaMap = {};
        // Valid test area names (complete names only)
        const validTestAreas = [
          "ICT_Mobo", "BSI_Mobo", "FBT_Mobo", 
          "ICT_Agora", "FBT_Agora", "TOOLS", "ORT", "L10_Racks"
        ];
        
        allTransactions.forEach(t => {
          const testArea = t.test_area || "Unknown";
          // Only include complete test area names (those with underscore or in valid list)
          // Filter out incomplete names like "BSI", "FBT", "ICT" without suffix
          if (testArea === "Unknown" || 
              (!testArea.includes("_") && !validTestAreas.includes(testArea)) ||
              (testArea === "BSI" || testArea === "FBT" || testArea === "ICT")) {
            return; // Skip incomplete test area names
          }
          if (!testAreaMap[testArea]) {
            testAreaMap[testArea] = {
              name: testArea,
              total: 0,
              requests: 0,
              returns: 0,
              restocks: 0,
            };
          }
          testAreaMap[testArea].total++;
          const type = t.transaction_type?.toLowerCase();
          if (type === "request") testAreaMap[testArea].requests++;
          else if (type === "return") testAreaMap[testArea].returns++;
          else if (type === "restock") testAreaMap[testArea].restocks++;
        });
        const testAreaArray = Object.values(testAreaMap)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5); // Top 5 test areas
        setTestAreaStats(testAreaArray);
        
        // Get recent 5 transactions (newest first)
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

  // Calculate percentage for low stock
  const lowStockPercentage = stats.totalItems > 0 
    ? Math.round((stats.lowStockCount / stats.totalItems) * 100) 
    : 0;

  return (
    <>
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 text-white rounded-xl p-8 shadow-lg mb-8 transition-colors">
        <div>
          <h1 className="text-4xl font-bold tracking-wide mb-2">MMIS Dashboard</h1>
          <p className="text-lg opacity-90">
            Welcome back, <span className="font-semibold">{userName || "User"}</span> 👋
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-4">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Inventory Items */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Items</p>
                  <p className="text-3xl font-bold text-gray-800 dark:text-gray-200 mt-2">{stats.totalItems}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active inventory</p>
                </div>
                <div className="text-4xl opacity-20">📦</div>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-all cursor-pointer" onClick={() => navigate("/dashboard/alerts")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Low Stock</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{stats.lowStockCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{lowStockPercentage}% of total</p>
                </div>
                <div className="text-4xl opacity-20">⚠️</div>
              </div>
              {stats.lowStockCount > 0 && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 rounded p-2 text-xs text-red-700 dark:text-red-400">
                  Action required
                </div>
              )}
            </div>

            {/* Total Transactions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-all cursor-pointer" onClick={() => navigate("/dashboard/activity")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Transactions</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{stats.totalTransactions}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All time</p>
                </div>
                <div className="text-4xl opacity-20">📊</div>
              </div>
            </div>

            {/* Active Requests */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Today's Activity</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                          {stats.todayActivity}
                        </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Today's transactions</p>
                </div>
                <div className="text-4xl opacity-20">⚡</div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Recent Activity</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Latest 5 transactions</p>
                </div>
                <button
                  onClick={() => navigate("/dashboard/activity")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  View All →
                </button>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.transaction_id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow text-xl">
                          {getTransactionTypeIcon(activity.transaction_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {activity.item_name || "Item"}
                            </p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getTransactionTypeBadge(activity.transaction_type)}`}>
                              {activity.transaction_type || "N/A"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {activity.project_name || "Project"}{activity.test_area ? ` • ${activity.test_area}` : ""} • {formatDate(activity.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${getTransactionTypeColor(activity.transaction_type)}`}>
                        {activity.transaction_type?.toLowerCase() === "request" ? "-" : "+"}
                        {activity.quantity_used}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/dashboard/request")}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-center transition"
                >
                  <div className="text-3xl mb-2">📤</div>
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-400">Request Item</div>
                </button>
                <button
                  onClick={() => navigate("/dashboard/return")}
                  className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-center transition"
                >
                  <div className="text-3xl mb-2">📥</div>
                  <div className="text-sm font-semibold text-green-700 dark:text-green-400">Return Item</div>
                </button>
                <button
                  onClick={() => navigate("/dashboard/restock")}
                  className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg text-center transition"
                >
                  <div className="text-3xl mb-2">📦</div>
                  <div className="text-sm font-semibold text-purple-700 dark:text-purple-400">Restock</div>
                </button>
                <button
                  onClick={() => navigate("/dashboard/reports")}
                  className="p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg text-center transition"
                >
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm font-semibold text-orange-700 dark:text-orange-400">Reports</div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
