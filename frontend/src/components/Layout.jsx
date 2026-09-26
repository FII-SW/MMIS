// src/components/Layout.jsx
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "./Header";
import HelpAssistant from "./HelpAssistant";
import { LayoutProvider } from "../contexts/LayoutContext";

import { decodeToken } from "../utils/auth";

function getRoleFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeToken(token);
  return payload?.role || null;
}

export default function Layout({ children }) {
  const location = useLocation();

  /** Full-width content: no left nav (e.g. Activity History needs horizontal space on laptops). */
  const hideSidebar = location.pathname === "/dashboard/activity";

  // Check if a path is active
  const isActive = (path) => {
    if (path === "/dashboard") {
      // For dashboard, only match exact path
      return location.pathname === "/dashboard" || location.pathname === "/dashboard/";
    }
    // For other paths, check if current path starts with the link path
    return location.pathname.startsWith(path);
  };

  const isChildActive = (child) => {
    const path = location.pathname.replace(/\/+$/, "");
    return path === child.path || (child.match || []).some((prefix) => path.startsWith(prefix));
  };

  const [openGroups, setOpenGroups] = useState({});

  const navItems = useMemo(() => {
    const role = getRoleFromToken();
    const isAdmin = role === "admin";
    const base = [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/dashboard/request", label: "Request" },
      { path: "/dashboard/return", label: "Return" },
      ...(isAdmin ? [{ path: "/dashboard/restock", label: "Restock" }] : []),
      { path: "/dashboard/alerts", label: "Low Stock Alerts" },
      { path: "/dashboard/reports", label: "Reports" },
      { path: "/dashboard/activity", label: "Activity History" },
      { path: "/dashboard/documents", label: "Documents" },
      {
        path: "/dashboard/maintenance",
        label: "Maintenance",
        children: [
          {
            path: "/dashboard/maintenance",
            label: "Record PM",
            match: [
              "/dashboard/maintenance/test-area",
              "/dashboard/maintenance/work",
              "/dashboard/maintenance/fixture",
            ],
          },
          { path: "/dashboard/maintenance/dashboard", label: "PM Dashboard" },
        ],
      },
    ];
    if (isAdmin) {
      base.push({ path: "/dashboard/transfer", label: "Transfer" });
    }
    return base;
  }, [location.pathname]);

  return (
    <LayoutProvider value={true}>
      <div className="flex h-screen bg-transparent transition-colors">
      {!hideSidebar && (
        <aside className="w-64 shrink-0 bg-white dark:bg-gray-800 shadow-md p-6 space-y-4 transition-colors">
          <Link
            to="/dashboard"
            className="block text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            MMIS
          </Link>

          <nav className="space-y-2">
            {navItems.map((item) => {
              if (item.children) {
                const childActive = item.children.map(isChildActive);
                const inGroup = childActive.some(Boolean);
                const open = openGroups[item.label] ?? inGroup;
                return (
                  <div key={item.label}>
                    <div
                      className={`flex items-center rounded-lg transition-all duration-200 ${
                        inGroup
                          ? "bg-blue-50 font-semibold text-blue-700 dark:bg-gray-700 dark:text-blue-300"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                      }`}
                    >
                      <Link to={item.path} className="flex-1 px-4 py-3">
                        {item.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !open }))}
                        aria-expanded={open}
                        aria-label={`${open ? "Hide" : "Show"} ${item.label} pages`}
                        className="mr-1 rounded-md p-2 hover:bg-blue-100 dark:hover:bg-gray-600"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {open && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-100 pl-2 dark:border-gray-700">
                        {item.children.map((child, index) => (
                          <Link
                            key={child.label}
                            to={child.path}
                            className={`block rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                              childActive[index]
                                ? "bg-blue-600 font-semibold text-white shadow-md dark:bg-blue-700"
                                : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? "bg-blue-600 dark:bg-blue-700 text-white font-semibold shadow-md"
                      : "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main Content */}
        <div className="min-w-0 flex-1 flex flex-col">
        {/* Top bar: show MMIS link when sidebar is hidden so users can reach the dashboard */}
        <Header showMMIS={false} brandLogo={hideSidebar} />

        {/* Page Body — flex-1 + min-h-0 so this column scrolls on short viewports (laptop); sticky bars work reliably */}
          <main className="min-h-0 flex-1 overflow-y-auto bg-transparent p-4 transition-colors">
            {children}
          </main>
        </div>
      </div>
      <HelpAssistant />
    </LayoutProvider>
  );
}
