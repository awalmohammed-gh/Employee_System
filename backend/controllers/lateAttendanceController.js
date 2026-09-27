import mongoose from "mongoose";
import { Employee } from "../models/employeeModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { ShiftPolicy } from "../models/ShiftPolicy.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { Notification } from "../models/notificationModel.js";
import { Leave } from "../models/leaveModel.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * Helper to parse "HH:MM" into minutes from midnight
 */
const timeToMinutes = (timeStr = "08:00") => {
  if (!timeStr || typeof timeStr !== "string") return 480;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * GET /api/admin/attendance/late-unclocked
 * Identifies active employees who have not clocked in by their shift start time today
 */
export const getLateUnclockedEmployees = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // 1. Fetch Company Shift Policy / Settings
    let shiftPolicy = null;
    try {
      shiftPolicy = await ShiftPolicy.findOne().lean();
      if (!shiftPolicy) {
        shiftPolicy = await CompanySettings.findOne().lean();
      }
    } catch {
      // fallback
    }

    const shiftStartTime = shiftPolicy?.workStartTime || "08:00";
    const gracePeriodMinutes = Number(shiftPolicy?.gracePeriodMinutes || 15);
    const shiftStartMinutes = timeToMinutes(shiftStartTime);

    // Current time in minutes from midnight (check local and UTC)
    const localHours = now.getHours();
    const localMinutes = now.getMinutes();
    const localCurrentMinutes = localHours * 60 + localMinutes;

    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcCurrentMinutes = utcHours * 60 + utcMinutes;

    // Use whichever current time is further along or local
    const effectiveCurrentMinutes = Math.max(localCurrentMinutes, utcCurrentMinutes);
    const isShiftStarted = effectiveCurrentMinutes >= shiftStartMinutes;
    const baseMinutesOverdue = Math.max(effectiveCurrentMinutes - shiftStartMinutes, 0);

    // 2. Fetch all active employees
    const activeEmployees = await Employee.find({
      $or: [
        { status: "active" },
        { status: { $exists: false }, isActive: { $ne: false } },
        { isActive: true },
      ],
    })
      .select("fullName name full_name employeeId department position avatar profilePicture email phone baseSalary")
      .lean();

    // 3. Fetch today's attendance records
    const todayAttendances = await Attendance.find({
      date: today,
    }).lean();

    // Build map of today's attendance by employee ObjectId & employeeId
    const attendanceMap = new Map();
    (todayAttendances || []).forEach((att) => {
      if (att.employee) attendanceMap.set(String(att.employee), att);
      if (att.employeeId) attendanceMap.set(String(att.employeeId), att);
    });

    // 4. Fetch approved leaves for today to exclude employees genuinely on approved leave
    const approvedLeavesToday = await Leave.find({
      status: "Approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    }).lean().catch(() => []);

    const onLeaveEmpIds = new Set(
      (approvedLeavesToday || []).map((l) => String(l.employee?._id || l.employee || l.employeeId))
    );

    // 5. Fetch recent late notifications sent today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const notificationsToday = await Notification.find({
      type: "late_attendance_alert",
      created_at: { $gte: startOfToday },
    }).lean().catch(() => []);

    const notifiedMap = new Map();
    (notificationsToday || []).forEach((n) => {
      notifiedMap.set(String(n.recipient_id), n);
    });

    // 6. Identify late / unclocked employees
    const lateEmployeesList = [];
    let clockedInCount = 0;

    for (const emp of activeEmployees) {
      const empIdStr = String(emp._id);
      const empCodeStr = String(emp.employeeId || "");

      // Check if on approved leave
      if (onLeaveEmpIds.has(empIdStr) || (empCodeStr && onLeaveEmpIds.has(empCodeStr))) {
        continue;
      }

      // Check if attendance record exists with clockIn
      const att = attendanceMap.get(empIdStr) || (empCodeStr ? attendanceMap.get(empCodeStr) : null);

      if (att && att.clockIn) {
        clockedInCount++;
        // If employee clocked in late, they can also be flagged if desired
        continue;
      }

      // Employee has NOT clocked in!
      const empName = emp.fullName || emp.name || emp.full_name || "Employee";
      const minutesOverdue = isShiftStarted ? baseMinutesOverdue : 0;

      let urgencyLevel = "medium";
      if (minutesOverdue >= 120) {
        urgencyLevel = "critical";
      } else if (minutesOverdue >= 30) {
        urgencyLevel = "high";
      } else if (minutesOverdue > 0) {
        urgencyLevel = "medium";
      } else {
        urgencyLevel = "upcoming";
      }

      const notifDoc = notifiedMap.get(empIdStr) || (empCodeStr ? notifiedMap.get(empCodeStr) : null);

      lateEmployeesList.push({
        _id: empIdStr,
        id: empIdStr,
        employeeId: emp.employeeId || "EMP",
        fullName: empName,
        department: emp.department || "Operations",
        position: emp.position || "Staff Member",
        email: emp.email || "",
        phone: emp.phone || "",
        avatar: emp.avatar || emp.profilePicture || null,
        shiftStartTime,
        minutesOverdue,
        isShiftStarted,
        urgencyLevel,
        status: att?.status || "Not Clocked In",
        notificationSent: !!notifDoc,
        lastNotificationSentAt: notifDoc ? notifDoc.created_at : null,
        hasAttendanceRecord: !!att,
      });
    }

    // Sort by most overdue first, then by name
    lateEmployeesList.sort((a, b) => b.minutesOverdue - a.minutesOverdue);

    // Format current time display
    const formattedCurrentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return res.status(200).json({
      success: true,
      data: {
        shiftStartTime,
        gracePeriodMinutes,
        currentTime: formattedCurrentTime,
        isShiftStarted,
        totalActive: activeEmployees.length,
        totalClockedIn: clockedInCount,
        totalLateUnclocked: lateEmployeesList.length,
        employees: lateEmployeesList,
      },
    });
  } catch (error) {
    console.error("[LateAttendance] Error identifying late employees:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to identify late employees."),
    });
  }
};

/**
 * POST /api/admin/attendance/notify-late
 * Dispatches high-priority 'Late Attendance' notification to employee(s)
 * and logs to ActivityLog
 */
export const notifyLateEmployees = async (req, res) => {
  try {
    const { employeeId, employeeIds, customMessage, sendAll = false } = req.body;

    let targetIds = [];
    if (sendAll) {
      // Find all active employees who haven't clocked in today
      const today = new Date().toISOString().split("T")[0];
      const active = await Employee.find({ isActive: true }).select("_id employeeId fullName email").lean();
      const attendances = await Attendance.find({ date: today, clockIn: { $ne: null } }).lean();
      const clockedSet = new Set(attendances.map((a) => String(a.employee)));
      targetIds = active.filter((e) => !clockedSet.has(String(e._id))).map((e) => String(e._id));
    } else if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      targetIds = employeeIds.map(String);
    } else if (employeeId) {
      targetIds = [String(employeeId)];
    }

    if (targetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No employee selected for notification.",
      });
    }

    // Retrieve target employees
    const employees = await Employee.find({
      _id: { $in: targetIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) },
    }).lean();

    // Fetch shift policy for shift start time
    const shiftPolicy = await ShiftPolicy.findOne().lean().catch(() => null);
    const shiftStartTime = shiftPolicy?.workStartTime || "08:00";

    const senderName = req.admin?.fullName || req.admin?.full_name || "HR Operations";
    const senderId = String(req.admin?._id || req.admin?.id || "admin");

    const createdNotifications = [];

    for (const emp of employees) {
      const empName = emp.fullName || emp.name || "Employee";
      const notifMessage =
        customMessage ||
        `⚠️ Attendance Alert: You have not clocked in for your scheduled shift starting at ${shiftStartTime}. Please clock in immediately using your portal or contact management.`;

      const targetCompanyId =
        emp.companyId ||
        emp.organizationId ||
        req.companyId ||
        req.organizationId ||
        req.admin?.companyId ||
        req.admin?.organizationId;

      const notifDoc = await Notification.create({
        recipient_id: String(emp._id),
        recipient_role: "employee",
        sender_id: senderId,
        sender_role: "admin",
        sender_name: senderName,
        title: "⚠️ Attendance Alert: Shift Clock-In Required",
        message: notifMessage,
        type: "late_attendance_alert",
        category: "attendance",
        priority: "high",
        action_url: "/employee/attendance",
        action_label: "Clock In Now",
        companyId: targetCompanyId,
        organizationId: targetCompanyId,
        metadata: {
          employeeId: emp.employeeId,
          shiftStartTime,
          date: new Date().toISOString().split("T")[0],
        },
      });

      createdNotifications.push(notifDoc);

      // Record in ActivityLog
      try {
        await logAuditAction({
          req,
          action: "LATE_ATTENDANCE_NOTIFIED",
          category: "Attendance",
          target: `${empName} (${emp.employeeId || emp._id})`,
          targetModel: "Employee",
          summary: `Sent high-priority late attendance notice to ${empName}. Shift scheduled for ${shiftStartTime}.`,
          details: `Message: "${notifMessage}" sent by ${senderName}.`,
          metadata: {
            employeeId: emp.employeeId,
            notificationId: String(notifDoc._id),
          },
        });
      } catch (logErr) {
        console.warn("[LateAttendance] Audit logging warning:", logErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully dispatched late attendance alert to ${createdNotifications.length} employee(s).`,
      count: createdNotifications.length,
      notifications: createdNotifications,
    });
  } catch (error) {
    console.error("[LateAttendance] Error dispatching notification:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to dispatch late attendance notification."),
    });
  }
};

/**
 * POST /api/admin/attendance/excuse-late
 * Quickly excuses an employee's late/missing clock-in from the Attention Required section
 */
export const excuseLateEmployee = async (req, res) => {
  try {
    const { employeeId, reason = "Excused by Administrator" } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required." });
    }

    const today = new Date().toISOString().split("T")[0];

    const employee = await Employee.findOne({
      $or: [{ _id: mongoose.Types.ObjectId.isValid(employeeId) ? employeeId : null }, { employeeId }],
    }).lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee record not found." });
    }

    // Find or create attendance record
    let att = await Attendance.findOne({
      employee: employee._id,
      date: today,
    });

    if (!att) {
      const targetCompanyId =
        employee.companyId ||
        employee.organizationId ||
        req.companyId ||
        req.organizationId ||
        req.admin?.companyId;

      att = new Attendance({
        employee: employee._id,
        employeeId: employee.employeeId,
        companyId: targetCompanyId,
        organizationId: targetCompanyId,
        date: today,
        status: "Present",
        isExcused: true,
        lateReason: reason,
        notes: `Excused from Dashboard Attention Required: ${reason}`,
      });
    } else {
      att.isExcused = true;
      att.status = "Present";
      att.lateReason = reason;
      att.notes = `${att.notes || ""} [Excused: ${reason}]`.trim();
    }

    await att.save();

    // Log to ActivityLog
    try {
      await logAuditAction({
        req,
        action: "EXCUSE_LATE_ATTENDANCE",
        category: "Attendance",
        target: `${employee.fullName || employee.employeeId}`,
        targetModel: "Attendance",
        summary: `Excused late attendance for ${employee.fullName || employee.employeeId}: "${reason}".`,
        details: `Updated attendance record for ${today} to excused status.`,
      });
    } catch (logErr) {
      console.warn("[ExcuseAttendance] Audit logging warning:", logErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Late attendance excused for ${employee.fullName || employee.employeeId}.`,
      attendance: att,
    });
  } catch (error) {
    console.error("[LateAttendance] Error excusing attendance:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to excuse attendance."),
    });
  }
};
