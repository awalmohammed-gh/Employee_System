import mongoose from "mongoose";
import { Attendance } from "../models/attendanceModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { Employee } from "../models/Employee.js";
import { User } from "../models/userModel.js";
import { AuditLog } from "../models/AuditLog.js";
import { calculateWorkHours, safeDateTime } from "../utils/calculateWorkHours.js";
import { evaluateLatenessPenalty } from "../utils/latenessPenaltyCalculator.js";
import { createNotificationRecord } from "./notificationController.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Backend Attendance Override & Retroactive Shift Adjustment
 * Handles POST /api/admin/attendance/override AND PUT /api/admin/attendance/:id/override
 * Uses CompanySettings (workStartTime, workEndTime, lateness tiers) as single source of truth.
 */
export const overrideAttendanceRecord = async (req, res) => {
  try {
    const recordId = req.params?.id || req.body?.id || null;
    const {
      employeeId,
      date,
      clockIn,
      clockOut,
      status,
      notes,
      workHours: customWorkHours,
      delayMinutes: customDelayMinutes,
      latePenalty: customLatePenalty,
      isWaived,
      waivePenalty,
      isExcused,
      excuseReason,
    } = req.body;

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    // 1. Retrieve active shift configurations from CompanySettings (single source of truth)
    let settingsDoc = null;
    try {
      settingsDoc = await CompanySettings.getSingletonSettings(orgId);
    } catch {
      settingsDoc = {
        workStartTime: "08:00",
        workEndTime: "19:00",
      };
    }

    const workStartTime = settingsDoc?.workStartTime || "08:00";
    const workEndTime = settingsDoc?.workEndTime || "19:00";

    // 2. Identify target record or employee
    let existingRecord = null;
    if (recordId && isValidObjectId(recordId)) {
      existingRecord = await Attendance.findOne({ _id: recordId, ...orgScope });
      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found in your company workspace.",
          code: "NOT_FOUND",
        });
      }
      validateOrganizationAccess(existingRecord, req);
    }

    const targetDate =
      date ||
      existingRecord?.date ||
      new Date().toISOString().split("T")[0];

    let targetEmployeeId = employeeId;
    let employeeObjectId = existingRecord?.employee || null;

    if (!employeeObjectId && targetEmployeeId) {
      if (isValidObjectId(targetEmployeeId)) {
        const found = await Employee.findOne({ _id: targetEmployeeId, ...orgScope }).select("_id employeeId fullName organizationId companyId");
        if (found) {
          validateOrganizationAccess(found, req);
          employeeObjectId = found._id;
          targetEmployeeId = found.employeeId || targetEmployeeId;
        }
      }

      if (!employeeObjectId) {
        const found = await Employee.findOne({ employeeId: String(targetEmployeeId).trim(), ...orgScope }).select("_id employeeId fullName organizationId companyId");
        if (found) {
          validateOrganizationAccess(found, req);
          employeeObjectId = found._id;
        }
      }
    }

    if (!existingRecord && employeeObjectId) {
      existingRecord = await Attendance.findOne({
        employee: employeeObjectId,
        date: targetDate,
        ...orgScope,
      });
      if (existingRecord) {
        validateOrganizationAccess(existingRecord, req);
      }
    }

    if (!existingRecord && !employeeObjectId) {
      return res.status(400).json({
        success: false,
        message: "Valid employee identifier or attendance record ID is required.",
      });
    }

    // 3. Format clock timestamps safely
    const safeClockIn = clockIn ? safeDateTime(targetDate, clockIn) : null;
    const safeClockOut = clockOut ? safeDateTime(targetDate, clockOut) : null;

    // 4. Calculate work hours
    let calculatedHours = 0;
    if (customWorkHours !== undefined && customWorkHours !== null && customWorkHours !== "") {
      const parsedH = Number(customWorkHours);
      calculatedHours = !isNaN(parsedH) && Number.isFinite(parsedH) ? parsedH : 0;
    } else if (safeClockIn && safeClockOut) {
      calculatedHours = calculateWorkHours(safeClockIn, safeClockOut);
    }

    // 5. Evaluate Lateness & Penalty using dynamic CompanySettings
    let delayMinutes = 0;
    let latePenalty = 0;
    let penaltyTier = "";
    let finalStatus = status || existingRecord?.status || "Present";

    if (safeClockIn && !isNaN(safeClockIn.getTime())) {
      const penaltyEval = evaluateLatenessPenalty(
        safeClockIn,
        workStartTime,
        settingsDoc || {}
      );
      delayMinutes = penaltyEval.minutesLate || 0;
      latePenalty = penaltyEval.penalty || 0;
      penaltyTier = penaltyEval.tier || "";

      // Auto-select status based on shift comparison if not explicitly specified
      if (!status) {
        finalStatus = delayMinutes > 0 ? "Late" : "On Time";
      }
    }

    // If explicit delayMinutes passed
    if (customDelayMinutes !== undefined && customDelayMinutes !== null) {
      delayMinutes = Math.max(0, Number(customDelayMinutes) || 0);
    }

    // Handle penalty waiver or manual penalty adjustment
    const penaltyWaived = Boolean(isWaived || waivePenalty || isExcused || finalStatus === "On Time" || delayMinutes === 0);
    if (penaltyWaived) {
      latePenalty = 0;
    } else if (customLatePenalty !== undefined && customLatePenalty !== null) {
      const parsedFine = Number(customLatePenalty);
      latePenalty = !isNaN(parsedFine) && parsedFine >= 0 ? parsedFine : 0;
    }

    // 6. Admin Audit Log payload
    const adminId = String(req.admin?._id || req.admin?.id || "admin_01");
    const adminName = req.admin?.fullName || req.admin?.name || "HR Administrator";
    const adjustmentReason = notes || excuseReason || "Manual shift override by administrator";
    const auditLogEntry = {
      adminId,
      adminName,
      reason: adjustmentReason,
      timestamp: new Date(),
    };

    // 7. Update or insert record
    const updatePayload = {
      date: targetDate,
      clockIn: safeClockIn && !isNaN(safeClockIn.getTime()) ? safeClockIn : null,
      clockOut: safeClockOut && !isNaN(safeClockOut.getTime()) ? safeClockOut : null,
      workHours: calculatedHours,
      delayMinutes,
      lateMinutes: delayMinutes,
      latePenalty,
      penaltyTier,
      status: finalStatus,
      notes: adjustmentReason,
      isExcused: Boolean(isExcused || penaltyWaived),
      excuseReason: excuseReason || (penaltyWaived ? "Waived during manual override" : ""),
      auditLog: auditLogEntry,
    };

    const targetOrgId = req.organizationId || existingRecord?.organizationId || null;
    if (targetOrgId) {
      updatePayload.organizationId = targetOrgId;
    }

    if (employeeObjectId) {
      updatePayload.employee = employeeObjectId;
    }

    let savedRecord = null;
    if (existingRecord) {
      savedRecord = await Attendance.findOneAndUpdate(
        { _id: existingRecord._id, ...orgScope },
        { $set: updatePayload },
        { returnDocument: "after" }
      )
        .populate("employee", "fullName department position employeeId email avatar")
        .lean();
    } else {
      savedRecord = await Attendance.findOneAndUpdate(
        { employee: employeeObjectId, date: targetDate, ...orgScope },
        { $set: updatePayload },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      )
        .populate("employee", "fullName department position employeeId email avatar")
        .lean();
    }

    // 8. Record in global system AuditLog collection
    try {
      const empName = savedRecord?.employee?.fullName || targetEmployeeId || "Employee";
      await AuditLog.create({
        action: "ATTENDANCE_MANUAL_OVERRIDE",
        category: "Attendance",
        organizationId: targetOrgId && mongoose.Types.ObjectId.isValid(targetOrgId) ? new mongoose.Types.ObjectId(targetOrgId) : null,
        performedBy: {
          id: adminId,
          name: adminName,
          email: req.admin?.email || "admin@eyenit.com",
          role: req.admin?.role || "admin",
        },
        target: `Attendance: ${targetDate} (${empName})`,
        summary: `Manual override for ${empName} on ${targetDate}. Hours: ${calculatedHours}h, Status: ${finalStatus}, Penalty: GH₵${latePenalty.toFixed(2)}. Shift: ${workStartTime}–${workEndTime}.`,
        changes: [
          { field: "clockIn", label: "Clock-In Time", oldValue: existingRecord?.clockIn || "--", newValue: safeClockIn },
          { field: "clockOut", label: "Clock-Out Time", oldValue: existingRecord?.clockOut || "--", newValue: safeClockOut },
          { field: "workHours", label: "Work Hours", oldValue: existingRecord?.workHours || 0, newValue: calculatedHours },
          { field: "delayMinutes", label: "Delay Minutes", oldValue: existingRecord?.delayMinutes || 0, newValue: delayMinutes },
          { field: "latePenalty", label: "Late Penalty (GH₵)", oldValue: existingRecord?.latePenalty || 0, newValue: latePenalty },
          { field: "status", label: "Status", oldValue: existingRecord?.status || "--", newValue: finalStatus },
          { field: "notes", label: "Reason / Notes", oldValue: existingRecord?.notes || "--", newValue: adjustmentReason },
        ],
        metadata: {
          attendanceId: String(savedRecord?._id || ""),
          workStartTime,
          workEndTime,
          isWaived: penaltyWaived,
          penaltyTier,
        },
        createdAt: new Date(),
      });
    } catch (auditErr) {
      console.warn("Global audit log error in overrideAttendanceRecord:", auditErr.message);
    }

    // 9. Send alert notification to employee if penalty or absence recorded
    if (finalStatus === "Late" || finalStatus === "Absent") {
      try {
        const empTargetId = String(savedRecord?.employee?._id || employeeObjectId || "");
        if (empTargetId) {
          if (finalStatus === "Late" && latePenalty > 0) {
            await createNotificationRecord({
              recipient_id: empTargetId,
              recipient_role: "employee",
              sender_id: adminId,
              sender_role: "admin",
              sender_name: adminName,
              title: "⚠️ Attendance Adjusted: Lateness Penalty Applied",
              message: `Your attendance record for ${targetDate} was adjusted. A lateness penalty of GH₵${latePenalty.toFixed(2)} has been recorded based on your clock-in past ${workStartTime}.`,
              type: "penalty_alert",
              category: "payroll",
              priority: "high",
              action_url: "/employee/dashboard/payslips",
              action_label: "View Attendance & Payslips",
              metadata: { date: targetDate, delayMinutes, latePenalty, tier: penaltyTier, deductionApplied: true },
            });
          } else if (finalStatus === "Late" && latePenalty === 0) {
            await createNotificationRecord({
              recipient_id: empTargetId,
              recipient_role: "employee",
              sender_id: adminId,
              sender_role: "admin",
              sender_name: adminName,
              title: "Clock-In Recorded (No Deduction)",
              message: `Your attendance record for ${targetDate} was adjusted (${delayMinutes} mins late). Company policy applied: No salary deduction for this delay.`,
              type: "attendance_alert",
              category: "attendance",
              priority: "info",
              action_url: "/employee/dashboard",
              action_label: "View Attendance",
              metadata: { date: targetDate, delayMinutes, latePenalty: 0, tier: penaltyTier, deductionApplied: false },
            });
          } else if (finalStatus === "Absent") {
            const absenceRate = settingsDoc?.absenceDeductionRate || 15;
            await createNotificationRecord({
              recipient_id: empTargetId,
              recipient_role: "employee",
              sender_id: adminId,
              sender_role: "admin",
              sender_name: adminName,
              title: "⚠️ Absence Recorded by HR",
              message: `An absence for ${targetDate} was logged by HR. Standard absence deduction rate of GH₵${absenceRate.toFixed(2)} applies.`,
              type: "penalty_alert",
              category: "payroll",
              priority: "high",
              action_url: "/employee/dashboard/payslips",
              action_label: "View Details",
              metadata: { date: targetDate, absenceRate },
            });
          }
        }
      } catch (notifErr) {
        console.warn("Notification dispatch warning:", notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance override applied successfully.",
      attendance: savedRecord,
      shiftSettings: {
        workStartTime,
        workEndTime,
      },
    });
  } catch (error) {
    console.error("Error in overrideAttendanceRecord:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to process attendance override."),
    });
  }
};

/**
 * Strict Employee Daily Attendance Statistics: GET /api/admin/daily-stats
 * Supplies daily metrics with strict employee filtering (explicitly filtering out Admin users).
 * If total employee count is 0, reliably returns all zeros for headcount, present, late, absent, and average hours.
 */
export const getAdminDailyStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Strict employee filtering: Count genuine employees, explicitly excluding Admin/manager users
    const employeeUserCount = await User.countDocuments({ role: "employee" });
    const staffUserCount = await User.countDocuments({ role: "staff" });
    const userCount = employeeUserCount + staffUserCount;

    const employeeDocsCount = await Employee.countDocuments({
      role: { $nin: ["admin", "manager"] },
    });

    const staffHeadcount = Math.max(userCount, employeeDocsCount);

    if (staffHeadcount === 0) {
      return res.status(200).json({
        success: true,
        staffHeadcount: 0,
        headcount: 0,
        totalEmployees: 0,
        presentToday: 0,
        present: 0,
        onTimeToday: 0,
        onTime: 0,
        lateToday: 0,
        late: 0,
        absentToday: 0,
        absent: 0,
        avgHours: "0.0",
        averageHours: "0.0",
      });
    }

    const todayAttendance = await Attendance.find({ date: today }).lean();
    const presentRecords = todayAttendance.filter(
      (a) => a.clockIn || a.status === "Present" || a.status === "On Time" || a.status === "Late"
    );
    const presentToday = presentRecords.length;

    const lateToday = todayAttendance.filter(
      (a) => a.status === "Late" || Number(a.lateMinutes || 0) > 0
    ).length;

    const onTimeToday = todayAttendance.filter(
      (a) => (a.status === "On Time" || a.status === "Present") && !a.lateMinutes && a.status !== "Late"
    ).length;

    const absentToday = Math.max(0, staffHeadcount - presentToday);

    const totalHours = todayAttendance.reduce((sum, item) => sum + (Number(item.workHours) || 0), 0);
    const avgHours = todayAttendance.length > 0 ? (totalHours / todayAttendance.length).toFixed(1) : "0.0";

    return res.status(200).json({
      success: true,
      staffHeadcount,
      headcount: staffHeadcount,
      totalEmployees: staffHeadcount,
      presentToday,
      present: presentToday,
      onTimeToday,
      onTime: onTimeToday,
      lateToday,
      late: lateToday,
      absentToday,
      absent: absentToday,
      avgHours,
      averageHours: avgHours,
    });
  } catch (error) {
    console.error("Error in getAdminDailyStats:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve daily attendance statistics."),
    });
  }
};

export default {
  overrideAttendanceRecord,
  getAdminDailyStats,
};
