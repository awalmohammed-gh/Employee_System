import {
  getNotifications as apiGetNotifications,
  markNotificationAsRead as apiMarkNotificationAsRead,
  markNotificationAsUnread as apiMarkNotificationAsUnread,
  toggleNotificationRead as apiToggleNotificationRead,
  markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
  deleteNotification as apiDeleteNotification,
  deleteAllNotifications as apiDeleteAllNotifications,
} from "../apis/fontApis";
import { useState, useEffect, useCallback } from "react";

/**
 * In-memory state cache for notifications per role
 */
const notificationCache = {
  admin: {
    items: [],
    unreadCount: 0,
    metrics: { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 },
    lastFetched: null,
  },
  employee: {
    items: [],
    unreadCount: 0,
    metrics: { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 },
    lastFetched: null,
  },
};

// Set of listener subscribers to broadcast real-time state changes
const subscribers = new Set();

/**
 * Notify all registered listener functions with updated cache
 */
const notifySubscribers = (role) => {
  const currentRole = role || "all";
  subscribers.forEach((callback) => {
    try {
      callback({
        role: currentRole,
        cache: notificationCache,
      });
    } catch (err) {
      console.warn("Notification listener error:", err);
    }
  });
};

/**
 * Computes live category metrics and unread count from items array
 */
const computeMetrics = (items) => {
  if (!Array.isArray(items)) {
    return { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 };
  }

  const unread = items.filter((n) => !n.is_read && n.unread !== false).length;
  const leave = items.filter((n) => n.category === "leave").length;
  const payroll = items.filter(
    (n) =>
      n.category === "payroll" ||
      n.type === "payroll_alert" ||
      n.type === "payroll_status_update" ||
      n.category === "payslip"
  ).length;
  const system = items.filter(
    (n) =>
      (n.category === "system" ||
      n.category === "employee" ||
      n.category === "announcement" ||
      n.category === "attendance" ||
      !n.category) &&
      n.category !== "payroll" &&
      n.type !== "payroll_alert" &&
      n.type !== "payroll_status_update" &&
      n.category !== "payslip"
  ).length;

  return {
    all: items.length,
    leave,
    payroll,
    system,
    unread,
  };
};

/**
 * Frontend Notification Service singleton
 */
export const notificationService = {
  /**
   * Fetch notifications from backend for a specific role/user
   * @param {Object} options { role: 'admin' | 'employee', userId?: string, force?: boolean }
   */
  async getNotifications(options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";
    const params = {
      role,
      ...(options.userId ? { user_id: options.userId, recipient_id: options.userId } : {}),
    };

    try {
      const response = await apiGetNotifications(params);
      const data = response?.data;

      if (data?.success && Array.isArray(data.notifications)) {
        // Robust de-duplication by document _id
        const seenIds = new Set();
        const normalizedItems = [];

        for (const item of data.notifications) {
          const id = String(item._id || item.id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            normalizedItems.push({
              ...item,
              id,
              _id: id,
              is_read: Boolean(item.is_read !== undefined ? item.is_read : item.isRead),
              timestamp: item.created_at || item.createdAt || new Date().toISOString(),
            });
          }
        }

        const metrics = computeMetrics(normalizedItems);
        notificationCache[role] = {
          items: normalizedItems,
          unreadCount: metrics.unread,
          metrics,
          lastFetched: Date.now(),
        };

        notifySubscribers(role);

        return {
          success: true,
          notifications: normalizedItems,
          unreadCount: metrics.unread,
          metrics,
        };
      }

      return {
        success: false,
        notifications: notificationCache[role].items,
        unreadCount: notificationCache[role].unreadCount,
        metrics: notificationCache[role].metrics,
      };
    } catch (error) {
      console.warn(`[NotificationService] Error fetching ${role} notifications:`, error.message);
      return {
        success: false,
        notifications: notificationCache[role].items,
        unreadCount: notificationCache[role].unreadCount,
        metrics: notificationCache[role].metrics,
        error: error.message,
      };
    }
  },

  /**
   * Get cached unread badge count for role
   */
  getCachedUnreadCount(role = "admin") {
    const normalizedRole = role === "admin" ? "admin" : "employee";
    return notificationCache[normalizedRole]?.unreadCount || 0;
  },

  /**
   * Get all cached notifications for role
   */
  getCachedNotifications(role = "admin") {
    const normalizedRole = role === "admin" ? "admin" : "employee";
    return notificationCache[normalizedRole]?.items || [];
  },

  /**
   * Mark a single notification as read (optimistic update + backend sync)
   */
  async markAsRead(id, options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";
    const targetId = String(id);

    // Optimistic local update
    if (notificationCache[role]?.items) {
      notificationCache[role].items = notificationCache[role].items.map((item) =>
        String(item.id || item._id) === targetId
          ? { ...item, is_read: true, unread: false }
          : item
      );
      notificationCache[role].metrics = computeMetrics(notificationCache[role].items);
      notificationCache[role].unreadCount = notificationCache[role].metrics.unread;
      notifySubscribers(role);
    }

    try {
      await apiMarkNotificationAsRead(targetId);
      return { success: true };
    } catch (error) {
      console.error("[NotificationService] Error marking notification read:", error);
      // Re-sync on failure
      this.getNotifications({ role, userId: options.userId });
      return { success: false, error: error.message };
    }
  },

  /**
   * Mark a single notification as unread (optimistic update + backend sync)
   */
  async markAsUnread(id, options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";
    const targetId = String(id);

    // Optimistic local update
    if (notificationCache[role]?.items) {
      notificationCache[role].items = notificationCache[role].items.map((item) =>
        String(item.id || item._id) === targetId
          ? { ...item, is_read: false, unread: true }
          : item
      );
      notificationCache[role].metrics = computeMetrics(notificationCache[role].items);
      notificationCache[role].unreadCount = notificationCache[role].metrics.unread;
      notifySubscribers(role);
    }

    try {
      await apiMarkNotificationAsUnread(targetId);
      return { success: true };
    } catch (error) {
      console.error("[NotificationService] Error marking notification unread:", error);
      this.getNotifications({ role, userId: options.userId });
      return { success: false, error: error.message };
    }
  },

  /**
   * Toggle read/unread state of a single notification
   */
  async toggleReadStatus(id, options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";
    const targetId = String(id);
    let targetIsRead = false;

    if (notificationCache[role]?.items) {
      const currentItem = notificationCache[role].items.find(
        (item) => String(item.id || item._id) === targetId
      );
      targetIsRead = Boolean(currentItem?.is_read);

      notificationCache[role].items = notificationCache[role].items.map((item) =>
        String(item.id || item._id) === targetId
          ? { ...item, is_read: !targetIsRead, unread: targetIsRead }
          : item
      );
      notificationCache[role].metrics = computeMetrics(notificationCache[role].items);
      notificationCache[role].unreadCount = notificationCache[role].metrics.unread;
      notifySubscribers(role);
    }

    try {
      if (targetIsRead) {
        await apiMarkNotificationAsUnread(targetId);
      } else {
        await apiMarkNotificationAsRead(targetId);
      }
      return { success: true };
    } catch {
      try {
        await apiToggleNotificationRead(targetId);
        return { success: true };
      } catch (error) {
        console.error("[NotificationService] Error toggling notification read status:", error);
        this.getNotifications({ role, userId: options.userId });
        return { success: false, error: error.message };
      }
    }
  },

  /**
   * Dismiss notification (alias for deleteNotification)
   */
  async dismissNotification(id, options = {}) {
    return this.deleteNotification(id, options);
  },

  /**
   * Mark all notifications as read for a given role (optimistic update + backend sync)
   */
  async markAllAsRead(options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";

    // Optimistic local update
    if (notificationCache[role]?.items) {
      notificationCache[role].items = notificationCache[role].items.map((item) => ({
        ...item,
        is_read: true,
        unread: false,
      }));
      notificationCache[role].metrics = computeMetrics(notificationCache[role].items);
      notificationCache[role].unreadCount = 0;
      notifySubscribers(role);
    }

    try {
      await apiMarkAllNotificationsAsRead({ role, ...(options.userId ? { user_id: options.userId } : {}) });
      return { success: true };
    } catch (error) {
      console.error("[NotificationService] Error marking all notifications read:", error);
      this.getNotifications({ role, userId: options.userId });
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete / dismiss a notification (optimistic local update + backend sync)
   */
  async deleteNotification(id, options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";
    const targetId = String(id);

    // Optimistic local removal
    if (notificationCache[role]?.items) {
      notificationCache[role].items = notificationCache[role].items.filter(
        (item) => String(item.id || item._id) !== targetId
      );
      notificationCache[role].metrics = computeMetrics(notificationCache[role].items);
      notificationCache[role].unreadCount = notificationCache[role].metrics.unread;
      notifySubscribers(role);
    }

    try {
      await apiDeleteNotification(targetId);
      return { success: true };
    } catch (error) {
      console.error("[NotificationService] Error deleting notification:", error);
      this.getNotifications({ role, userId: options.userId });
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete / clear all notifications for a role (optimistic local removal + backend sync)
   */
  async deleteAllNotifications(options = {}) {
    const role = options.role === "admin" ? "admin" : "employee";

    // Optimistic local removal
    if (notificationCache[role]) {
      notificationCache[role].items = [];
      notificationCache[role].metrics = { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 };
      notificationCache[role].unreadCount = 0;
      notifySubscribers(role);
    }

    try {
      await apiDeleteAllNotifications({ role, ...(options.userId ? { user_id: options.userId } : {}) });
      return { success: true };
    } catch (error) {
      console.error("[NotificationService] Error deleting all notifications:", error);
      this.getNotifications({ role, userId: options.userId });
      return { success: false, error: error.message };
    }
  },

  /**
   * Subscribe to notification updates
   * @param {Function} listener callback function
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener === "function") {
      subscribers.add(listener);
    }
    return () => {
      subscribers.delete(listener);
    };
  },
};

/**
 * Custom React Hook to consume live notifications and badge counters dynamically
 * @param {string} role 'admin' | 'employee'
 * @param {Object} options { autoPoll?: boolean, pollInterval?: number, userId?: string }
 */
export const useNotificationManager = (role = "admin", options = {}) => {
  const normalizedRole = role === "admin" ? "admin" : "employee";
  const { autoPoll = true, pollInterval = 15000, userId } = options;

  const [notifications, setNotifications] = useState(
    () => notificationCache[normalizedRole]?.items || []
  );
  const [unreadCount, setUnreadCount] = useState(
    () => notificationCache[normalizedRole]?.unreadCount || 0
  );
  const [metrics, setMetrics] = useState(
    () => notificationCache[normalizedRole]?.metrics || { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 }
  );
  const [isLoading, setIsLoading] = useState(false);

  // Sync state from cache
  const syncFromCache = useCallback(() => {
    const cached = notificationCache[normalizedRole];
    if (cached) {
      setNotifications(cached.items || []);
      setUnreadCount(cached.unreadCount || 0);
      setMetrics(cached.metrics || { all: 0, leave: 0, payroll: 0, system: 0, unread: 0 });
    }
  }, [normalizedRole]);

  // Initial fetch and subscribe to global notifications
  const refresh = useCallback(
    async (showLoader = false) => {
      if (showLoader) setIsLoading(true);
      try {
        const result = await notificationService.getNotifications({
          role: normalizedRole,
          userId,
        });
        if (result.success) {
          setNotifications(result.notifications);
          setUnreadCount(result.unreadCount);
          setMetrics(result.metrics);
        }
      } finally {
        if (showLoader) setIsLoading(false);
      }
    },
    [normalizedRole, userId]
  );

  useEffect(() => {
    syncFromCache();
    refresh(notifications.length === 0);

    // Subscribe to notification mutations
    const unsubscribe = notificationService.subscribe(({ role: updatedRole }) => {
      if (updatedRole === normalizedRole || updatedRole === "all") {
        syncFromCache();
      }
    });

    // Auto-polling setup
    let intervalId = null;
    if (autoPoll) {
      intervalId = setInterval(() => {
        refresh(false);
      }, pollInterval);
    }

    // Auto-refresh when tab comes into view
    const handleFocus = () => refresh(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [normalizedRole, autoPoll, pollInterval, syncFromCache, refresh, notifications.length]);

  const markAsRead = useCallback(
    (id) => notificationService.markAsRead(id, { role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const markAllAsRead = useCallback(
    () => notificationService.markAllAsRead({ role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const markAsUnread = useCallback(
    (id) => notificationService.markAsUnread(id, { role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const toggleReadStatus = useCallback(
    (id) => notificationService.toggleReadStatus(id, { role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const deleteNotification = useCallback(
    (id) => notificationService.deleteNotification(id, { role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const dismissNotification = useCallback(
    (id) => notificationService.dismissNotification(id, { role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  const deleteAllNotifications = useCallback(
    () => notificationService.deleteAllNotifications({ role: normalizedRole, userId }),
    [normalizedRole, userId]
  );

  return {
    notifications,
    unreadCount,
    metrics,
    isLoading,
    refresh,
    markAsRead,
    markAsUnread,
    toggleReadStatus,
    deleteNotification,
    dismissNotification,
    markAllAsRead,
    deleteAllNotifications,
    deleteAll: deleteAllNotifications,
  };
};

export default notificationService;
