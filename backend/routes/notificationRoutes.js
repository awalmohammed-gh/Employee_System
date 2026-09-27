import express from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markNotificationAsUnread,
  toggleNotificationRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
} from "../controllers/notificationController.js";
import { employeeAuth } from "../middleware/employeeAuth.js";

const notificationRouter = express.Router();

// Role-flexible authentication: accepts both admin token, employee token, or header role fallback
notificationRouter.get("/", employeeAuth, getNotifications);
notificationRouter.patch("/read-all", employeeAuth, markAllNotificationsAsRead);
notificationRouter.patch("/mark-all-read", employeeAuth, markAllNotificationsAsRead);
notificationRouter.patch("/:id/read", employeeAuth, markNotificationAsRead);
notificationRouter.put("/:id/read", employeeAuth, markNotificationAsRead);
notificationRouter.patch("/:id/unread", employeeAuth, markNotificationAsUnread);
notificationRouter.put("/:id/unread", employeeAuth, markNotificationAsUnread);
notificationRouter.patch("/:id/toggle", employeeAuth, toggleNotificationRead);
notificationRouter.patch("/:id/dismiss", employeeAuth, deleteNotification);
notificationRouter.delete("/clear-all", employeeAuth, deleteAllNotifications);
notificationRouter.delete("/delete-all", employeeAuth, deleteAllNotifications);
notificationRouter.delete("/:id", employeeAuth, deleteNotification);
notificationRouter.delete("/", employeeAuth, deleteAllNotifications);
notificationRouter.post("/", employeeAuth, createNotification);
notificationRouter.post("/create", employeeAuth, createNotification);

export default notificationRouter;
