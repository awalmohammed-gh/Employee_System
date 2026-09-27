import express from "express";
import {
  employeeDashboardOverview,
  getDashboardOverview,
  getRecentActivityFeed,
} from "../controllers/dashboardController.js";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import {
  getLateUnclockedEmployees,
  notifyLateEmployees,
  excuseLateEmployee,
} from "../controllers/lateAttendanceController.js";
import { getActivityLogs, getActivityLogStats } from "../controllers/activityLogController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import { employeeAuth } from "../middleware/employeeAuth.js";

const dashboardRouter = express.Router();

dashboardRouter.get("/admin-dashboard", verifyAdmin, getDashboardOverview);
dashboardRouter.get("/admin-dashboard/recent-activity", verifyAdmin, getRecentActivityFeed);
dashboardRouter.get("/recent-activity", verifyAdmin, getRecentActivityFeed);

// High-Priority Late Attendance & Attention Required Feed
dashboardRouter.get("/late-attendance", verifyAdmin, getLateUnclockedEmployees);
dashboardRouter.post("/late-attendance/notify", verifyAdmin, notifyLateEmployees);
dashboardRouter.post("/late-attendance/excuse", verifyAdmin, excuseLateEmployee);

// Audit Trail & Activity Logs
dashboardRouter.get("/audit-trail", verifyAdmin, getActivityLogs);
dashboardRouter.get("/activity-logs", verifyAdmin, getActivityLogs);
dashboardRouter.get("/activity-logs/stats", verifyAdmin, getActivityLogStats);

dashboardRouter.get("/employee-dashboard", employeeAuth, employeeDashboardOverview);
dashboardRouter.get("/notifications", employeeAuth, getNotifications);
dashboardRouter.patch("/notifications/read-all", employeeAuth, markAllNotificationsAsRead);
dashboardRouter.patch("/notifications/:id/read", employeeAuth, markNotificationAsRead);
dashboardRouter.delete("/notifications/:id", employeeAuth, deleteNotification);

export default dashboardRouter;
