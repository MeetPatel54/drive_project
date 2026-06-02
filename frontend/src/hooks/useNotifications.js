import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

export const useNotifications = ({ enabled = true } = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markAllRead = useCallback(async () => {
    await api.patch("/notifications/read", {});
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAllRead,
  };
};
