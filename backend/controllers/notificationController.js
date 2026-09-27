import mongoose from "mongoose";
import { Notification } from "../models/notificationModel.js";
import { Payroll } from "../models/payrollModel.js";
import { Employee } from "../models/employeeModel.js";
import { Leave } from "../models/leaveModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * Helper to persist a new notification document into MongoDB
 */
export const createNotificationRecord = async ({
  recipient_id,
  recipient_role,
  sender_id = "system",
  sender_role = "system",
  sender_name = "System",
  title,
  message,
  type = "system_update",
  category = "system",
  priority = "medium",
  action_url = "",
  action_label = "View Details",
  metadata = {},
  organizationId = null,
  companyId = null,
}) => {
  try {
    let resolvedCompanyId = companyId || organizationId || null;
    if (!resolvedCompanyId && mongoose.connection.readyState === 1) {
      try {
        const comp = await CompanySettings.findOne().select("_id").lean();
        if (comp && comp._id) {
          resolvedCompanyId = comp._id;
        }
      } catch {
        // ignore fallback lookup error
      }
    }

    const doc = await Notification.create({
      recipient_id: String(
        recipient_id || (recipient_role === "admin" ? "admin" : "all_employees")
      ),
      recipient_role: recipient_role === "admin" ? "admin" : "employee",
      sender_id: String(sender_id),
      sender_role,
      sender_name,
      title: title.trim(),
      message: message.trim(),
      type,
      category,
      priority,
      action_url,
      action_label,
      metadata,
      organizationId: resolvedCompanyId,
      companyId: resolvedCompanyId,
      is_read: false,
      created_at: new Date(),
    });

    return doc.toObject();
  } catch (err) {
    console.error("Error creating notification document:", err.message);
    return null;
  }
};

/**
 * GET /api/notifications
 * Fetches actual documents from the 'notifications' collection based on authenticated user ID / role,
 * sorted by 'created_at' in descending order.
 */
export const getNotifications = async (req, res) => {
  try {
    const queryRole =
      req.query.role ||
      req.headers["x-role"] ||
      (req.baseUrl.includes("admin") ? "admin" : "");
    const userRole =
      req.employee?.role || (req.admin ? "admin" : queryRole || "admin");
    const isAdmin = userRole === "admin" || queryRole === "admin";

    const userId = String(
      req.user?.id ||
      req.user?._id ||
      req.employee?.id ||
      req.employee?._id ||
      req.employee?.employeeId ||
      req.admin?.id ||
      req.query.user_id ||
      req.query.recipient_id ||
      req.headers["x-user-id"] ||
      req.headers["x-employee-id"] ||
      ""
    );

    // Mongoose query targeting actual documents for this recipient
    let query = {};
    if (isAdmin) {
      query = {
        $or: [
          { recipient_role: "admin" },
          { recipient_id: "admin" },
          ...(userId ? [{ recipient_id: userId }] : []),
        ],
      };
    } else {
      const possibleIds = [
        "all_employees",
        "all",
        ...(userId ? [userId] : []),
        ...(req.employee?.employeeId ? [String(req.employee.employeeId)] : []),
        ...(req.employee?._id ? [String(req.employee._id)] : []),
        ...(req.employee?.email ? [String(req.employee.email)] : []),
        ...(req.user?.employeeId ? [String(req.user.employeeId)] : []),
        ...(req.user?._id ? [String(req.user._id)] : []),
        ...(req.user?.email ? [String(req.user.email)] : []),
      ];

      query = {
        $or: [
          { recipient_id: { $in: possibleIds } },
          { recipient_role: "employee", recipient_id: { $in: possibleIds } },
          { recipient_id: "all_employees" },
          { recipient_id: "all" },
        ],
      };
    }

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    if (!tenantId) {
      return res.status(200).json({
        success: true,
        role: isAdmin ? "admin" : "employee",
        recipient_id: isAdmin ? "admin" : userId || "employee",
        notifications: [],
        unreadCount: 0,
        counts: { total: 0, unread: 0, leave: 0, payroll: 0, system: 0, announcement: 0 },
      });
    }
    const tenantMatch = {
      $or: [
        { organizationId: tenantId },
        { companyId: tenantId },
      ],
    };
    if (query.$or) {
      query.$and = [{ $or: query.$or }, tenantMatch];
      delete query.$or;
    } else {
      query.$or = tenantMatch.$or;
    }

    // Execute mongoose query sorted by created_at descending
    const documents = await Notification.find(query)
      .sort({ created_at: -1 })
      .lean();

    // For employees, ensure any published payslips have an active notification alert
    if (!isAdmin && userId) {
      try {
        let empObjectIds = [];
        if (mongoose.Types.ObjectId.isValid(userId)) {
          empObjectIds.push(new mongoose.Types.ObjectId(userId));
        }
        if (req.employee?._id && mongoose.Types.ObjectId.isValid(req.employee._id)) {
          empObjectIds.push(new mongoose.Types.ObjectId(req.employee._id));
        }
        const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};
        if (empObjectIds.length === 0 && userId) {
          const empDoc = await Employee.findOne({
            $or: [{ employeeId: userId }, { email: userId }],
            ...tenantScope,
          }).lean();
          if (empDoc?._id) {
            empObjectIds.push(empDoc._id);
          }
        }

        let empQuery = {};
        if (empObjectIds.length > 0) {
          empQuery = { employee: { $in: empObjectIds } };
        }

        const publishedPayslips = await Payroll.find({
          ...empQuery,
          ...tenantScope,
          status: { $in: ["Published", "published", "Paid", "paid"] },
        }).lean();

        for (const ps of publishedPayslips) {
          const psNumber = ps.payslipNumber || String(ps._id);
          const alreadyNotified = documents.some(
            (d) =>
              d.metadata?.payslipNumber === psNumber ||
              d.metadata?.payslipId === String(ps._id) ||
              d.title?.includes(ps.payMonth)
          );

          if (!alreadyNotified) {
            const netAmount = Number(ps.netSalary || ps.netPay || 0);
            const isPaid = (ps.status || "").toLowerCase() === "paid";
            const newNotif = await createNotificationRecord({
              recipient_id: userId,
              recipient_role: "employee",
              sender_id: "admin",
              sender_role: "admin",
              sender_name: "Management",
              title: isPaid ? "💰 Monthly Payslip Paid & Released" : "📄 New Monthly Payslip Published",
              message: isPaid
                ? `Your salary for ${ps.payMonth} (GH₵${netAmount.toFixed(2)}) has been disbursed and marked as Paid.`
                : `Your official payslip for ${ps.payMonth} has been published by Management. Net Take-Home: GH₵${netAmount.toFixed(2)}.`,
              type: "payroll_alert",
              category: "payroll",
              priority: "high",
              action_url: "/employee/dashboard/payslips",
              action_label: "View Payslip",
              organizationId: tenantId,
              companyId: tenantId,
              metadata: {
                payMonth: ps.payMonth,
                payslipNumber: psNumber,
                payslipId: String(ps._id),
                netPay: netAmount,
                status: ps.status,
              },
            });

            if (newNotif) {
              documents.unshift(newNotif);
            }
          }
        }
      } catch (syncErr) {
        console.warn("Could not auto-sync published payslip notifications:", syncErr.message);
      }
    }

    // For administrators, ensure centralized alerts exist for system-wide events:
    // (1) Pending Leave Approvals
    // (2) New Employee Registrations
    // (3) Payroll Status Updates
    if (isAdmin) {
      try {
        const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

        // 1. Pending Leave Approvals
        const pendingLeaves = await Leave.find({
          status: { $in: ["Pending", "pending"] },
          ...tenantScope,
        })
          .populate("employee", "fullName employeeId department position")
          .sort({ createdAt: -1 })
          .limit(15)
          .lean();

        for (const pl of pendingLeaves) {
          const leaveIdStr = String(pl._id);
          const alreadyNotified = documents.some(
            (d) =>
              d.metadata?.leaveId === leaveIdStr ||
              d.metadata?.leave_id === leaveIdStr
          );

          if (!alreadyNotified) {
            const empName = pl.employee?.fullName || "Staff Member";
            const dept = pl.employee?.department || "General";
            const daysCount = pl.totalDays || 1;
            const lType = pl.leaveType || "Leave";
            const startStr = pl.startDate ? new Date(pl.startDate).toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" }) : "";
            const endStr = pl.endDate ? new Date(pl.endDate).toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" }) : "";

            const newNotif = await createNotificationRecord({
              recipient_id: "admin",
              recipient_role: "admin",
              sender_id: String(pl.employee?._id || pl.employee?.employeeId || "employee"),
              sender_role: "employee",
              sender_name: empName,
              title: `⏳ Pending Leave Approval: ${lType}`,
              message: `${empName} (${dept}) submitted a ${daysCount}-day ${lType} request (${startStr} to ${endStr}) pending administrator approval.`,
              type: "pending_leave_approval",
              category: "leave",
              priority: "high",
              action_url: "/admin/leave",
              action_label: "Review Leave",
              organizationId: tenantId,
              companyId: tenantId,
              metadata: {
                leaveId: leaveIdStr,
                employeeName: empName,
                department: dept,
                leaveType: lType,
                totalDays: daysCount,
                startDate: pl.startDate,
                endDate: pl.endDate,
              },
            });

            if (newNotif) {
              documents.unshift(newNotif);
            }
          }
        }

        // 2. New Employee Registrations
        const recentEmployees = await Employee.find(tenantScope)
          .sort({ createdAt: -1, employmentDate: -1 })
          .limit(10)
          .lean();

        for (const emp of recentEmployees) {
          const empIdStr = String(emp.employeeId || emp._id);
          const alreadyNotified = documents.some(
            (d) =>
              d.metadata?.employeeId === empIdStr ||
              d.metadata?.employeeId === String(emp.employeeId) ||
              d.metadata?.employeeDbId === String(emp._id)
          );

          if (!alreadyNotified) {
            const newNotif = await createNotificationRecord({
              recipient_id: "admin",
              recipient_role: "admin",
              sender_id: String(emp._id),
              sender_role: "system",
              sender_name: "Staff Registration",
              title: `👤 New Employee Registered: ${emp.fullName}`,
              message: `${emp.fullName} (${emp.employeeId}) has registered as ${emp.position || "Staff"} in the ${emp.department || "Operations"} department.`,
              type: "new_employee_registration",
              category: "system",
              priority: "medium",
              action_url: "/admin/employees",
              action_label: "View Employees",
              organizationId: tenantId,
              companyId: tenantId,
              metadata: {
                employeeId: emp.employeeId,
                employeeDbId: String(emp._id),
                fullName: emp.fullName,
                department: emp.department,
                position: emp.position,
                email: emp.email,
              },
            });

            if (newNotif) {
              documents.unshift(newNotif);
            }
          }
        }

        // 3. Payroll Status Updates (Recent records)
        const recentPayroll = await Payroll.find(tenantScope)
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(10)
          .populate("employee", "fullName employeeId department")
          .lean();

        for (const pr of recentPayroll) {
          const prIdStr = String(pr._id);
          const alreadyNotified = documents.some(
            (d) =>
              d.metadata?.payrollId === prIdStr ||
              (d.metadata?.payslipNumber && d.metadata?.payslipNumber === pr.payslipNumber)
          );

          if (!alreadyNotified) {
            const empName = pr.employee?.fullName || pr.employeeName || "Employee";
            const netSalary = Number(pr.netSalary || pr.netPay || 0);
            const status = pr.status || "Pending";
            const pMonth = pr.payMonth || pr.month || "Current Month";

            const newNotif = await createNotificationRecord({
              recipient_id: "admin",
              recipient_role: "admin",
              sender_id: "system",
              sender_role: "system",
              sender_name: "Payroll System",
              title: `💳 Payroll Status: ${empName} (${status})`,
              message: `Payroll for ${empName} (${pMonth}) status is currently "${status}". Net Salary: GH₵${netSalary.toFixed(2)}.`,
              type: "payroll_status_update",
              category: "payroll",
              priority: status === "Paid" ? "high" : "medium",
              action_url: "/admin/payroll",
              action_label: "View Payroll",
              organizationId: tenantId,
              companyId: tenantId,
              metadata: {
                payrollId: prIdStr,
                payslipNumber: pr.payslipNumber,
                status,
                payMonth: pMonth,
                employeeName: empName,
                netSalary,
              },
            });

            if (newNotif) {
              documents.unshift(newNotif);
            }
          }
        }
      } catch (adminSyncErr) {
        console.warn("Could not auto-sync admin system notifications:", adminSyncErr.message);
      }
    }

    // Deduplicate by _id
    const seenMap = new Map();
    const uniqueDocs = [];
    for (const doc of documents) {
      const docId = String(doc._id);
      if (!seenMap.has(docId)) {
        seenMap.set(docId, true);
        uniqueDocs.push(doc);
      }
    }

    const notifications = uniqueDocs.map((doc) => ({
      ...doc,
      id: String(doc._id),
      _id: String(doc._id),
      is_read: Boolean(doc.is_read !== undefined ? doc.is_read : doc.isRead),
      timestamp: doc.created_at || doc.createdAt,
    }));

    // Derive live summary metrics from real database documents
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    const leaveCount = notifications.filter((n) => n.category === "leave").length;
    const payrollCount = notifications.filter(
      (n) => n.category === "payroll" || n.type === "payroll_alert" || n.category === "payslip"
    ).length;
    const systemCount = notifications.filter(
      (n) =>
        (n.category === "system" ||
        n.category === "attendance" ||
        !n.category) &&
        n.category !== "payroll" &&
        n.type !== "payroll_alert" &&
        n.category !== "payslip"
    ).length;
    const announcementCount = notifications.filter(
      (n) => n.category === "announcement" || n.type === "announcement"
    ).length;

    return res.status(200).json({
      success: true,
      role: isAdmin ? "admin" : "employee",
      recipient_id: isAdmin ? "admin" : userId || "employee",
      notifications,
      unreadCount,
      counts: {
        total: notifications.length,
        unread: unreadCount,
        leave: leaveCount,
        payroll: payrollCount,
        system: systemCount,
        announcement: announcementCount,
      },
    });
  } catch (error) {
    console.error("Error in getNotifications:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to fetch notifications from database."),
    });
  }
};

/**
 * PATCH /api/notifications/:id/read & /api/notifications/:id/unread & /api/notifications/:id/toggle
 * Marks a specific notification document as read/unread
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required.",
      });
    }

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const isRead = req.body?.is_read !== undefined ? Boolean(req.body.is_read) : true;
    let updatedDoc = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      const existing = await Notification.findOne({ _id: id, ...tenantScope });
      if (existing) {
        validateOrganizationAccess(existing, req);
        existing.is_read = isRead;
        await existing.save();
        updatedDoc = existing;
      } else {
        return res.status(404).json({
          success: false,
          message: "Notification not found or access denied.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notification marked as ${isRead ? "read" : "unread"} in database.`,
      id,
      notification: updatedDoc,
    });
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update notification read status."),
    });
  }
};

export const markNotificationAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required.",
      });
    }

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    let updatedDoc = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      const existing = await Notification.findOne({ _id: id, ...tenantScope });
      if (existing) {
        validateOrganizationAccess(existing, req);
        existing.is_read = false;
        await existing.save();
        updatedDoc = existing;
      } else {
        return res.status(404).json({
          success: false,
          message: "Notification not found or access denied.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as unread in database.",
      id,
      notification: updatedDoc,
    });
  } catch (error) {
    console.error("Error in markNotificationAsUnread:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to mark notification as unread."),
    });
  }
};

export const toggleNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required.",
      });
    }

    let updatedDoc = null;
    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    if (mongoose.Types.ObjectId.isValid(id)) {
      const existing = await Notification.findOne({ _id: id, ...tenantScope });
      if (existing) {
        validateOrganizationAccess(existing, req);
        existing.is_read = !existing.is_read;
        await existing.save();
        updatedDoc = existing;
      } else {
        return res.status(404).json({
          success: false,
          message: "Notification not found or access denied.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notification status toggled.",
      id,
      notification: updatedDoc,
    });
  } catch (error) {
    console.error("Error in toggleNotificationRead:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to toggle notification status."),
    });
  }
};

/**
 * PATCH /api/notifications/read-all & /api/notifications/mark-all-read
 * Executes an updateMany query marking all unread notifications for this user as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const queryRole = req.query.role || req.headers["x-role"] || "admin";
    const userRole = req.employee?.role || (req.admin ? "admin" : queryRole);
    const isAdmin = userRole === "admin" || queryRole === "admin";
    const userId = String(
      req.user?.id ||
      req.employee?.id ||
      req.admin?.id ||
      req.query.user_id ||
      req.headers["x-user-id"] ||
      req.headers["x-employee-id"] ||
      ""
    );

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const filter = {
      ...tenantScope,
      ...(isAdmin
        ? { recipient_role: "admin", is_read: false }
        : {
            recipient_role: "employee",
            is_read: false,
            ...(userId ? { $or: [{ recipient_id: userId }, { recipient_id: "all_employees" }] } : {}),
          }),
    };

    // Atomic updateMany query
    const result = await Notification.updateMany(filter, { $set: { is_read: true } });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount || 0,
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to mark all notifications as read."),
    });
  }
};

/**
 * DELETE /api/notifications & /api/notifications/clear-all
 * Deletes all notifications for the requesting role or user
 */
export const deleteAllNotifications = async (req, res) => {
  try {
    const queryRole = req.query.role || req.headers["x-role"] || "admin";
    const userRole = req.employee?.role || (req.admin ? "admin" : queryRole);
    const isAdmin = userRole === "admin" || queryRole === "admin";
    const userId = String(
      req.user?.id ||
      req.employee?.id ||
      req.admin?.id ||
      req.query.user_id ||
      req.headers["x-user-id"] ||
      req.headers["x-employee-id"] ||
      ""
    );

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const filter = {
      ...tenantScope,
      ...(isAdmin
        ? { recipient_role: "admin" }
        : {
            recipient_role: "employee",
            ...(userId ? { $or: [{ recipient_id: userId }, { recipient_id: "all_employees" }] } : {}),
          }),
    };

    const result = await Notification.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: "All notifications removed successfully.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error("Error in deleteAllNotifications:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete all notifications."),
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Deletes a notification document from the database
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required.",
      });
    }

    const tenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    if (mongoose.Types.ObjectId.isValid(id)) {
      const existing = await Notification.findOne({ _id: id, ...tenantScope });
      if (existing) {
        validateOrganizationAccess(existing, req);
        await Notification.deleteOne({ _id: id, ...tenantScope });
      } else {
        return res.status(404).json({
          success: false,
          message: "Notification not found or access denied.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notification removed from database.",
      id,
    });
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete notification."),
    });
  }
};

/**
 * POST /api/notifications
 * Creates a real notification document in the database
 */
export const createNotification = async (req, res) => {
  try {
    const {
      recipient_id,
      recipient_role,
      title,
      message,
      type,
      category,
      priority,
      action_url,
      action_label,
      metadata,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required.",
      });
    }

    const newNotif = await createNotificationRecord({
      recipient_id:
        recipient_id || (recipient_role === "admin" ? "admin" : "all_employees"),
      recipient_role: recipient_role || "employee",
      sender_id: req.employee?.id || req.admin?.id || "system",
      sender_role: req.employee ? "employee" : "admin",
      sender_name: req.employee ? "Employee" : "System Administrator",
      title,
      message,
      type: type || "announcement",
      category: category || "announcement",
      priority: priority || "medium",
      action_url: action_url || "",
      action_label: action_label || "View Details",
      metadata: metadata || {},
    });

    return res.status(201).json({
      success: true,
      message: "Notification created in database successfully.",
      notification: newNotif,
    });
  } catch (error) {
    console.error("Error in createNotification:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to create notification."),
    });
  }
};
