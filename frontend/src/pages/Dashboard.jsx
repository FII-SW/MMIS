// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import FlashBanner from "../components/FlashBanner";
import DashboardItemSearch from "../components/DashboardItemSearch";
import DashboardQuickActions from "../components/DashboardQuickActions";
import {
  ActivitySpark,
  AnimatedNumber,
  HealthRing,
  LiveOpsClock,
} from "../components/DashboardMissionControl";
import { MAINTENANCE_DASHBOARD_URL } from "../components/maintenance/links";
import { openCommandPalette } from "../components/CommandPalette";
import { isViewerUser } from "../utils/auth";

export default function Dashboard() {
  const viewOnly = isViewerUser();
  const [flash, setFlash] = useState(null);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalTransactions: 0,
    todayActivity: 0,
  });
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
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
        setTransactions(Array.isArray(allTransactions) ? allTransactions : []);

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

  const stockHealth = useMemo(() => {
    if (!stats.totalItems) return 100;
    return Math.max(0, Math.round(((stats.totalItems - stats.lowStockCount) / stats.totalItems) * 100));
  }, [stats]);

  const pmPressure = useMemo(() => {
    const n = pmAttention.overdueFixtures + pmAttention.dueSoonFixtures;
    // Map pressure into a 0–100 "calm" score for the ring (100 = calm)
    if (n <= 0) return 100;
    if (n >= 200) return 8;
    return Math.max(8, Math.round(100 - Math.min(92, n / 2)));
  }, [pmAttention]);

  const hasPmAttention = pmAttention.overdueFixtures > 0 || pmAttention.dueSoonFixtures > 0;

  const kpis = [
    {
      id: "items",
      label: "Items",
      value: stats.totalItems,
      hint: "In inventory",
      accent: "from-blue-500 to-cyan-400",
      ring: "border-blue-400/40",
      onClick: null,
    },
    {
      id: "low",
      label: "Low stock",
      value: stats.lowStockCount,
      hint: stats.totalItems ? `${100 - stockHealth}% of catalog` : "None",
      accent: "from-rose-500 to-orange-400",
      ring: "border-rose-400/40",
      onClick: () => navigate("/dashboard/alerts"),
    },
    {
      id: "tx",
      label: "Transactions",
      value: stats.totalTransactions,
      hint: "All time",
      accent: "from-indigo-500 to-blue-400",
      ring: "border-indigo-400/40",
      onClick: () => navigate("/dashboard/activity"),
    },
    {
      id: "today",
      label: "Today",
      value: stats.todayActivity,
      hint: "Moves today",
      accent: "from-emerald-500 to-teal-400",
      ring: "border-emerald-400/40",
      onClick: null,
    },
  ];

  return (
    <>
      <FlashBanner message={flash?.message} type={flash?.type} onDismiss={() => setFlash(null)} />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-600" />
            <div className="absolute inset-2 animate-pulse rounded-full bg-blue-500/10" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">Spinning up ops board…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mission-control hero */}
          <section className="mmis-dash-hero relative overflow-hidden rounded-2xl border border-blue-500/20 bg-slate-950 text-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 mmis-dash-grid opacity-40" />
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-600/30 blur-3xl" />
            <div className="pointer-events-none absolute right-1/3 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-2xl" />

            <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">
                  MMIS · Floor ops
                </p>
                <LiveOpsClock />
                <p className="mt-3 max-w-lg text-sm text-blue-100/75">
                  Live stock health, PM pressure, and today&apos;s pulse — jump with{" "}
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white hover:bg-white/20"
                  >
                    Ctrl+K
                  </button>
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {!viewOnly && (
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard/request")}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow hover:bg-cyan-50"
                    >
                      Request
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/maintenance")}
                    className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur hover:bg-white/20"
                  >
                    Fixtures
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue`)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${
                      pmAttention.overdueFixtures
                        ? "bg-rose-500 text-white hover:bg-rose-400"
                        : "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {pmAttention.overdueFixtures
                      ? `${pmAttention.overdueFixtures} overdue PMs`
                      : "PM To do"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 sm:justify-end">
                <HealthRing
                  value={stockHealth}
                  color={stockHealth >= 90 ? "#34d399" : stockHealth >= 70 ? "#38bdf8" : "#fb7185"}
                  label="Stock OK"
                  sublabel={`${stats.lowStockCount} low`}
                />
                <HealthRing
                  value={pmPressure}
                  color={pmPressure >= 80 ? "#34d399" : pmPressure >= 50 ? "#fbbf24" : "#f43f5e"}
                  label="PM calm"
                  sublabel={`${pmAttention.overdueFixtures + pmAttention.dueSoonFixtures} hot`}
                />
              </div>
            </div>
          </section>

          <DashboardItemSearch inventory={inventory} />

          {/* Animated KPI strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((kpi, i) => {
              const Tag = kpi.onClick ? "button" : "div";
              return (
                <Tag
                  key={kpi.id}
                  type={kpi.onClick ? "button" : undefined}
                  onClick={kpi.onClick || undefined}
                  className={`mmis-kpi group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
                    kpi.onClick ? "cursor-pointer" : ""
                  }`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div
                    className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${kpi.accent} opacity-20 blur-2xl transition group-hover:opacity-40`}
                  />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                    <AnimatedNumber value={kpi.value} />
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{kpi.hint}</p>
                  <div className={`mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700`}>
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${kpi.accent} mmis-kpi-bar`}
                      style={{ width: "100%", animationDelay: `${120 + i * 80}ms` }}
                    />
                  </div>
                </Tag>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">7-day pulse</h3>
                  <p className="text-[11px] text-slate-500">Transactions this week</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/activity")}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  History →
                </button>
              </div>
              <ActivitySpark transactions={transactions} />
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">Needs attention</h3>
                  <p className="text-[11px] text-slate-500">Overdue and due-soon PMs</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue`)}
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  PM To do →
                </button>
              </div>

              {!hasPmAttention ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 py-8 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-2xl" aria-hidden>
                    ✓
                  </span>
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Floor is clear
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50/60 p-3 dark:border-rose-900/40 dark:from-rose-950/40 dark:to-amber-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    {pmAttention.overdueFixtures > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=overdue`)}
                        className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-rose-700"
                      >
                        {pmAttention.overdueFixtures} overdue
                      </button>
                    )}
                    {pmAttention.dueSoonFixtures > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`${MAINTENANCE_DASHBOARD_URL}?tab=todo&status=due_soon`)}
                        className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-amber-600"
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
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/80 dark:hover:bg-gray-800/60"
                          >
                            <span className="truncate font-medium text-slate-800 dark:text-gray-200">
                              {row.project}
                            </span>
                            <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400">
                              {row.overdue_fixtures}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <DashboardQuickActions lowStockCount={stats.lowStockCount} />
        </div>
      )}
    </>
  );
}
