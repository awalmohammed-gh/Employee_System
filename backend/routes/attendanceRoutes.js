import express from "express";

import { employeeAuth } from "../middleware/employeeAuth.js";
import {
  clockIn,
  clockOut,
  getAllAttendance,
  getCurrentEmployee,
  getEmployeeAttendance,
  getMonthlyAttendanceCalendar,
  getTodayAttendance,
  getTodayAttendanceStatus,
  updateAttendanceRecord,
  excuseAttendanceRecord,
  flagAttendanceRecord,
  unflagAttendanceRecord,
  recalculateAttendanceRecord,
  createManualAttendance,
  bulkUploadBiometricAttendance,
  deleteAttendanceRecord,
  syncAttendancePenalties,
  getPerformanceMetrics,
  forceClockOutHandler,
  getAttendanceById,
  getEmployeeAttendanceHistory,
  getMyAttendanceHistory,
} from "../controllers/employeeAttendance.js";
import { overrideAttendanceRecord, getAdminDailyStats } from "../controllers/attendanceManagementController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import { resolveWorkSchedule } from "../utils/workSchedule.js";
import { validateOrganizationAccess } from "../middleware/validateOrganizationAccess.js";
import { Attendance } from "../models/Attendance.js";
import { Employee } from "../models/Employee.js";

const attendanceRouter = express.Router();

attendanceRouter.get("/performance-metrics", employeeAuth, getPerformanceMetrics);
attendanceRouter.post("/clock-in", employeeAuth, clockIn);
attendanceRouter.post("/clock-out", employeeAuth, clockOut);
attendanceRouter.post("/force-clock-out", employeeAuth, forceClockOutHandler);
attendanceRouter.get("/today", employeeAuth, getTodayAttendance);
attendanceRouter.get("/today-status", employeeAuth, getTodayAttendanceStatus);
attendanceRouter.get("/current-employee", employeeAuth, getCurrentEmployee);
attendanceRouter.get("/attendance", employeeAuth, getEmployeeAttendance);
// The signed-in employee's own attendance/absence history (identity from the token only)
attendanceRouter.get("/my-history", employeeAuth, getMyAttendanceHistory);
// Company work schedule (working days / hours) so calendars mark the admin's rest days correctly
attendanceRouter.get("/work-schedule", employeeAuth, async (req, res) => {
  try {
    return res.status(200).json({ success: true, workSchedule: await resolveWorkSchedule() });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load the work schedule." });
  }
});
attendanceRouter.get("/monthly-calendar", employeeAuth, getMonthlyAttendanceCalendar);
attendanceRouter.get("/calendar", employeeAuth, getMonthlyAttendanceCalendar);
attendanceRouter.get("/now", employeeAuth, getTodayAttendance);
attendanceRouter.post("/sync", employeeAuth, syncAttendancePenalties);
attendanceRouter.post("/sync-penalties", employeeAuth, syncAttendancePenalties);

// admin side
attendanceRouter.get("/daily-stats", verifyAdmin, getAdminDailyStats);
// Individual employee attendance/absence history (Admin: Employee Details → Attendance)
attendanceRouter.get("/employee/:employeeId/history", verifyAdmin, validateOrganizationAccess(Employee), getEmployeeAttendanceHistory);
attendanceRouter.get("/", verifyAdmin, getAllAttendance);
attendanceRouter.get("/all", verifyAdmin, getAllAttendance);
attendanceRouter.get("/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), getAttendanceById);
attendanceRouter.get("/:id", verifyAdmin, validateOrganizationAccess(Attendance), getAttendanceById);
attendanceRouter.post("/admin/sync", verifyAdmin, syncAttendancePenalties);
attendanceRouter.post("/admin/sync-penalties", verifyAdmin, syncAttendancePenalties);
attendanceRouter.post("/override", verifyAdmin, overrideAttendanceRecord);
attendanceRouter.put("/override/:id", verifyAdmin, validateOrganizationAccess(Attendance), overrideAttendanceRecord);
attendanceRouter.put("/:id/override", verifyAdmin, validateOrganizationAccess(Attendance), overrideAttendanceRecord);
attendanceRouter.put("/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), updateAttendanceRecord);
attendanceRouter.put("/record/:id/excuse", verifyAdmin, validateOrganizationAccess(Attendance), excuseAttendanceRecord);
attendanceRouter.put("/record/:id/flag", verifyAdmin, validateOrganizationAccess(Attendance), flagAttendanceRecord);
attendanceRouter.put("/record/:id/unflag", verifyAdmin, validateOrganizationAccess(Attendance), unflagAttendanceRecord);
attendanceRouter.put("/record/:id/recalculate", verifyAdmin, validateOrganizationAccess(Attendance), recalculateAttendanceRecord);
attendanceRouter.post("/manual-record", verifyAdmin, createManualAttendance);
attendanceRouter.post("/bulk-upload", verifyAdmin, bulkUploadBiometricAttendance);
attendanceRouter.post("/biometric-upload", verifyAdmin, bulkUploadBiometricAttendance);

// delete attendance record
attendanceRouter.delete("/:id", verifyAdmin, validateOrganizationAccess(Attendance), deleteAttendanceRecord);
attendanceRouter.delete("/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), deleteAttendanceRecord);

export default attendanceRouter;

