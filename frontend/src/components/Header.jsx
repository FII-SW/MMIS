// src/components/Header.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import { useTheme } from "../contexts/ThemeContext";
import { useIsInsideLayout } from "../contexts/LayoutContext";
import { useNotifications } from "../contexts/NotificationContext";

export default function Header({ showMMIS = true, brandLogo = false }) {
  const [userName, setUserName] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [employeeDesignation, setEmployeeDesignation] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const menuRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isInsideLayout = useIsInsideLayout();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  const isDashboard =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  // Load employee info from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setEmployeeId(payload.employee_id);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, []);

  // Fetch employee name and designation from backend
  useEffect(() => {
    if (!employeeId) return;

    API.get(`/employees/${employeeId}`)
      .then((res) => {
        setUserName(res.data.employee_name || "");
        setEmployeeDesignation(res.data.employee_designation || "");
      })
      .catch((err) => console.error("Error loading employee:", err));
  }, [employeeId]);

  // Get user initials (first letter of first name + first letter of last name)
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationPanel(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Pages inside the shared dashboard layout should not render a second page-level header.
  if (isInsideLayout && showMMIS) {
    return null;
  }

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow px-4 py-2.5 flex justify-between items-center gap-3 transition-colors shrink-0">
      {brandLogo ? (
        <span
          className="text-xl font-bold text-blue-600 dark:text-blue-400 cursor-pointer shrink-0"
          onClick={() => navigate("/dashboard")}
        >
          MMIS
        </span>
      ) : showMMIS ? (
        <span
          className="text-xl font-bold text-blue-600 dark:text-blue-400 cursor-pointer shrink-0"
          onClick={() => navigate("/dashboard")}
        >
          MMIS
        </span>
      ) : isInsideLayout && isDashboard ? (
        <div className="flex-1 min-w-0 pl-1">
          <h1 className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight truncate">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug truncate">
            Welcome back,{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {userName || "User"}
            </span>{" "}
            👋
          </p>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Transfer notifications — left of theme toggle */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotificationPanel((open) => {
                const next = !open;
                if (next) markAllRead();
                return next;
              });
              setShowProfileMenu(false);
            }}
            className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {showNotificationPanel && (
            <div className="absolute right-0 mt-2 w-80 max-h-80 overflow-hidden flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Transfers</span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAll();
                      setShowNotificationPanel(false);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="overflow-y-auto max-h-64">
                {notifications.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No transfer notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                        !n.read ? "bg-blue-50/80 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{formatTime(n.ts)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
        {/* Profile Avatar with Dropdown */}
        <div className="relative" ref={menuRef}>
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center font-semibold text-gray-800 dark:text-gray-200 text-sm cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
          >
            {getInitials(userName)}
          </div>
          
          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{employeeDesignation || "No designation"}</p>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/dashboard/profile");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
              >
                <span>👤</span>
                <span>View Profile</span>
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/dashboard/change-password");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
              >
                <span>🔒</span>
                <span>Change Password</span>
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  clearAll();
                  localStorage.removeItem("token");
                  window.location.href = "/";
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <span>🚪</span>
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

