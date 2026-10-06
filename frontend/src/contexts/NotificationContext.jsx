import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import API from "../api";
import { decodeToken } from "../utils/auth";

const STORAGE_KEY = "mmis_transfer_notifications";
const MAX_ITEMS = 30;
const SERVER_POLL_MS = 60 * 1000;

const NotificationContext = createContext(null);

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(loadStored);
  // Saved on the server for this account (e.g. "fixtures assigned to you for PM").
  const [serverItems, setServerItems] = useState([]);
  const [serverUnread, setServerUnread] = useState(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      /* ignore quota */
    }
  }, [notifications]);

  const refreshServer = useCallback(async () => {
    if (!decodeToken(localStorage.getItem("token"))) {
      setServerItems([]);
      setServerUnread(0);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await API.get("/notifications", { params: { limit: 30 } });
      setServerItems(res.data?.items || []);
      setServerUnread(res.data?.unread || 0);
    } catch {
      /* keep the last list; next poll retries */
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refreshServer();
    const id = setInterval(refreshServer, SERVER_POLL_MS);
    window.addEventListener("focus", refreshServer);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refreshServer);
    };
  }, [refreshServer]);

  const markServerRead = useCallback(async (notification) => {
    if (!notification || notification.read) return;
    const id = notification.notification_id;
    setServerItems((prev) => prev.map((n) => (n.notification_id === id ? { ...n, read: true } : n)));
    setServerUnread((count) => Math.max(0, count - 1));
    try {
      await API.post(`/notifications/${id}/read`);
    } catch {
      /* re-synced on next poll */
    }
  }, []);

  const markAllServerRead = useCallback(async () => {
    setServerItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setServerUnread(0);
    try {
      await API.post("/notifications/read-all");
    } catch {
      /* re-synced on next poll */
    }
  }, []);

  const clearReadServer = useCallback(async () => {
    setServerItems((prev) => prev.filter((n) => !n.read));
    try {
      await API.delete("/notifications");
    } catch {
      /* re-synced on next poll */
    }
  }, []);

  const addNotification = useCallback((message) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNotifications((prev) =>
      [{ id, message: String(message), ts: Date.now(), read: false }, ...prev].slice(0, MAX_ITEMS)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearTransfers = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** On sign-out: forget everything shown for this account. */
  const clearAll = useCallback(() => {
    clearTransfers();
    setServerItems([]);
    setServerUnread(0);
  }, [clearTransfers]);

  const transferUnread = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      markAllRead,
      clearTransfers,
      clearAll,
      transferUnread,
      serverItems,
      serverUnread,
      refreshServer,
      markServerRead,
      markAllServerRead,
      clearReadServer,
      unreadCount: transferUnread + serverUnread,
    }),
    [
      notifications,
      addNotification,
      markAllRead,
      clearTransfers,
      clearAll,
      transferUnread,
      serverItems,
      serverUnread,
      refreshServer,
      markServerRead,
      markAllServerRead,
      clearReadServer,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      notifications: [],
      addNotification: () => {},
      markAllRead: () => {},
      clearTransfers: () => {},
      clearAll: () => {},
      transferUnread: 0,
      serverItems: [],
      serverUnread: 0,
      refreshServer: () => {},
      markServerRead: () => {},
      markAllServerRead: () => {},
      clearReadServer: () => {},
      unreadCount: 0,
    };
  }
  return ctx;
}
