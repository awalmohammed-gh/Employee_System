import express from "express";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminSettings,
  createAdminAccount,
  updateEmployeeStatus,
  deleteEmployee,
  bulkUpdateEmployees,
  bulkDeleteEmployees,
  getDashboardStats,
  getAdminPayrollSummary,
} from "../controllers/adminController.js";
import { getSettings, getPenaltySettings, updatePenaltySettings, getAuditLogs } from "../controllers/adminSettingsController.js";
import { createEmployeeAccount } from "../controllers/employeeAuthentication.js";
import { bulkUploadEmployees } from "../controllers/employeeController.js";
import { handleCsvUpload } from "../middleware/csvUploadMiddleware.js";
import { bulkUploadBiometricAttendance } from "../controllers/employeeAttendance.js";
import {
  getPenaltyImpactAnalytics,
  getCurrentMonthLatenessAnalytics,
} from "../controllers/analyticsController.js";
import { getRecentActivityFeed } from "../controllers/dashboardController.js";
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
} from "../controllers/announcementController.js";
import {
  deletePayroll,
  getMonthlyPayrollRun,
  generatePayroll,
  calculateMonthlyPayrollSummary,
  allPayslips,
  getPayrollCycles,
  getEmployeePayslipBreakdownById,
} from "../controllers/payrollController.js";
import { employeeDetails, getEmployeeById, exportEmployeesCSV } from "../controllers/employeeController.js";
import {
  getEmployeeQuarterlyReviews,
  addQuarterlyReview,
} from "../controllers/performanceController.js";
import { getPayrollForecasting, exportForecastingCSV } from "../controllers/payrollForecastingController.js";
import { getEmployeeSalaryHistory } from "../controllers/salaryHistoryController.js";
import { deleteLeave, updateLeaveStatus, getAllLeaves } from "../controllers/leaveController.js";
import { deleteAttendanceRecord, getAllAttendance, getAttendanceById } from "../controllers/employeeAttendance.js";
import { overrideAttendanceRecord, getAdminDailyStats } from "../controllers/attendanceManagementController.js";
import { getActivityLogs, getActivityLogStats } from "../controllers/activityLogController.js";
import {
  getLateUnclockedEmployees,
  notifyLateEmployees,
  excuseLateEmployee,
} from "../controllers/lateAttendanceController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import { validateOrganizationAccess } from "../middleware/validateOrganizationAccess.js";
import { Employee } from "../models/Employee.js";
import { Attendance } from "../models/Attendance.js";
import { Payroll } from "../models/Payroll.js";
import { Leave } from "../models/Leave.js";

const adminRouter = express.Router();

// Admin Leave Management Endpoints (PATCH /api/admin/leave/:id/status)
adminRouter.get("/leave/all", verifyAdmin, getAllLeaves);
adminRouter.get("/leaves", verifyAdmin, getAllLeaves);
adminRouter.patch("/leave/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
adminRouter.put("/leave/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
adminRouter.patch("/leaves/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
adminRouter.put("/leaves/:id/status", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
adminRouter.patch("/leave/status/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);
adminRouter.put("/leave/status/:id", verifyAdmin, validateOrganizationAccess(Leave), updateLeaveStatus);

adminRouter.post("/admin-login", adminLogin);
adminRouter.post("/login", adminLogin);
adminRouter.post("/admin-logout", adminLogout);
adminRouter.post("/logout", adminLogout);
adminRouter.post("/create-account", verifyAdmin, createAdminAccount);
adminRouter.post("/register", verifyAdmin, createAdminAccount);
adminRouter.post("/create-user", verifyAdmin, createEmployeeAccount);
adminRouter.post("/create-employee", verifyAdmin, createEmployeeAccount);
adminRouter.post("/employees", verifyAdmin, createEmployeeAccount);
adminRouter.post("/bulk-upload-employees", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
adminRouter.post("/bulk-employees", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
adminRouter.post("/employees/bulk-upload", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
adminRouter.get("/me", verifyAdmin, getAdminProfile);
adminRouter.get("/profile", verifyAdmin, getAdminProfile);
adminRouter.put("/me", verifyAdmin, updateAdminProfile);
adminRouter.put("/profile", verifyAdmin, updateAdminProfile);
adminRouter.put("/change-password", verifyAdmin, changeAdminPassword);
adminRouter.put("/settings", verifyAdmin, updateAdminSettings);
adminRouter.get("/settings", verifyAdmin, getSettings);
adminRouter.get("/settings/penalties", verifyAdmin, getPenaltySettings);
adminRouter.put("/settings/penalties", verifyAdmin, updatePenaltySettings);
adminRouter.get("/audit-logs", verifyAdmin, getAuditLogs);
adminRouter.get("/settings/audit-logs", verifyAdmin, getAuditLogs);
adminRouter.get("/activity", verifyAdmin, getAuditLogs);
adminRouter.get("/activity-logs", verifyAdmin, getAuditLogs);

// Live Admin Dashboard Stats and Payroll Summaries
adminRouter.get("/payroll/records", verifyAdmin, allPayslips);
adminRouter.get("/payroll/payslips", verifyAdmin, allPayslips);
adminRouter.get("/payroll/payslips/:id", verifyAdmin, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
adminRouter.get("/payroll/payslip/:id", verifyAdmin, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
adminRouter.get("/payroll/cycles", verifyAdmin, getPayrollCycles);
adminRouter.post("/payroll/generate", verifyAdmin, generatePayroll);
adminRouter.post("/payroll/publish", verifyAdmin, generatePayroll);
adminRouter.post("/payroll-generate", verifyAdmin, generatePayroll);
adminRouter.post("/payroll-publish", verifyAdmin, generatePayroll);
adminRouter.get("/dashboard-stats", verifyAdmin, getDashboardStats);
adminRouter.get("/payroll/summary", verifyAdmin, getAdminPayrollSummary);
adminRouter.get("/payroll-summary", verifyAdmin, getAdminPayrollSummary);
adminRouter.get("/payroll/monthly-run", verifyAdmin, getMonthlyPayrollRun);
adminRouter.get("/payroll-monthly-run", verifyAdmin, getMonthlyPayrollRun);
adminRouter.get("/monthly-run", verifyAdmin, getMonthlyPayrollRun);
adminRouter.get("/payroll/calculate-employee", verifyAdmin, calculateMonthlyPayrollSummary);
adminRouter.get("/payroll/calculate-summary", verifyAdmin, calculateMonthlyPayrollSummary);
adminRouter.get("/payroll/employees", verifyAdmin, employeeDetails);
adminRouter.get("/employees/export-csv", verifyAdmin, exportEmployeesCSV);
adminRouter.get("/employees/export", verifyAdmin, exportEmployeesCSV);
adminRouter.get("/employees/export/csv", verifyAdmin, exportEmployeesCSV);
adminRouter.get("/export-employees-csv", verifyAdmin, exportEmployeesCSV);
adminRouter.get("/export-employees", verifyAdmin, exportEmployeesCSV);
adminRouter.get("/employees", verifyAdmin, employeeDetails);
adminRouter.get("/employees/:id/performance", verifyAdmin, getEmployeeQuarterlyReviews);
adminRouter.post("/employees/:id/performance", verifyAdmin, addQuarterlyReview);
adminRouter.get("/employees/:id/salary-history", verifyAdmin, getEmployeeSalaryHistory);
adminRouter.get("/employees/:id", verifyAdmin, validateOrganizationAccess(Employee), getEmployeeById);
adminRouter.get("/employee/:id", verifyAdmin, validateOrganizationAccess(Employee), getEmployeeById);

// Payroll Forecasting Tool (End-of-Month Lateness Deductions Projections)
adminRouter.get("/payroll/forecasting", verifyAdmin, getPayrollForecasting);
adminRouter.get("/payroll/forecasting/export", verifyAdmin, exportForecastingCSV);

// 6-Month Attendance Penalties & Payroll Cost Impact Analytics
adminRouter.get("/analytics/penalty-impact", verifyAdmin, getPenaltyImpactAnalytics);
adminRouter.get("/analytics/penalties-impact", verifyAdmin, getPenaltyImpactAnalytics);

// Current Month Lateness Deductions Recharts Analytics
adminRouter.get("/analytics/monthly-lateness-deductions", verifyAdmin, getCurrentMonthLatenessAnalytics);
adminRouter.get("/analytics/lateness-deductions", verifyAdmin, getCurrentMonthLatenessAnalytics);

// Real-time Recent Activity Feed (Attendance & Payroll)
adminRouter.get("/dashboard/recent-activity", verifyAdmin, getRecentActivityFeed);
adminRouter.get("/recent-activity", verifyAdmin, getRecentActivityFeed);

// Biometric Attendance Bulk Upload
// Attendance Management
adminRouter.get("/daily-stats", verifyAdmin, getAdminDailyStats);
adminRouter.get("/attendance/daily-stats", verifyAdmin, getAdminDailyStats);
adminRouter.get("/attendance", verifyAdmin, getAllAttendance);
adminRouter.get("/attendance/all", verifyAdmin, getAllAttendance);
adminRouter.get("/attendance/:id", verifyAdmin, validateOrganizationAccess(Attendance), getAttendanceById);
adminRouter.get("/attendance/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), getAttendanceById);
adminRouter.post("/attendance/bulk-upload", verifyAdmin, bulkUploadBiometricAttendance);
adminRouter.post("/attendance/biometric-upload", verifyAdmin, bulkUploadBiometricAttendance);

// Attendance Manual Override & Retroactive Adjustment
adminRouter.post("/attendance/override", verifyAdmin, overrideAttendanceRecord);
adminRouter.put("/attendance/:id/override", verifyAdmin, validateOrganizationAccess(Attendance), overrideAttendanceRecord);
adminRouter.post("/attendance/manual-record", verifyAdmin, overrideAttendanceRecord);
adminRouter.put("/attendance/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), overrideAttendanceRecord);

// High-Priority Late Attendance & Unclocked Employee Alerts
adminRouter.get("/attendance/late-unclocked", verifyAdmin, getLateUnclockedEmployees);
adminRouter.post("/attendance/notify-late", verifyAdmin, notifyLateEmployees);
adminRouter.post("/attendance/excuse-late", verifyAdmin, excuseLateEmployee);

// Activity Logs / Audit Trail (Fetched from ActivityLog MongoDB collection)
adminRouter.get("/activity-logs", verifyAdmin, getActivityLogs);
adminRouter.get("/activity-logs/stats", verifyAdmin, getActivityLogStats);
adminRouter.get("/audit-trail", verifyAdmin, getActivityLogs);

// Admin Announcement Endpoints (POST /api/admin/announcements, GET, DELETE, PUT)
adminRouter.get("/announcements", verifyAdmin, getAnnouncements);
adminRouter.get("/announcements/:id", verifyAdmin, getAnnouncementById);
adminRouter.post("/announcements", verifyAdmin, createAnnouncement);
adminRouter.put("/announcements/:id", verifyAdmin, updateAnnouncement);
adminRouter.patch("/announcements/:id/pin", verifyAdmin, togglePinAnnouncement);
adminRouter.delete("/announcements/:id", verifyAdmin, deleteAnnouncement);

// Admin-only payroll deletion (DELETE /api/admin/payroll/:id)
adminRouter.delete("/payroll/:id", verifyAdmin, validateOrganizationAccess(Payroll), deletePayroll);
adminRouter.delete("/payslip/:id", verifyAdmin, validateOrganizationAccess(Payroll), deletePayroll);
adminRouter.delete("/payslips/:id", verifyAdmin, validateOrganizationAccess(Payroll), deletePayroll);

// Admin-only bulk employee update (PATCH /api/admin/employees/bulk-update or POST)
adminRouter.patch("/employees/bulk-update", verifyAdmin, bulkUpdateEmployees);
adminRouter.post("/employees/bulk-update", verifyAdmin, bulkUpdateEmployees);
adminRouter.put("/employees/bulk-update", verifyAdmin, bulkUpdateEmployees);

// Admin-only bulk employee deletion (POST or DELETE /api/admin/employees/bulk-delete)
adminRouter.post("/employees/bulk-delete", verifyAdmin, bulkDeleteEmployees);
adminRouter.delete("/employees/bulk-delete", verifyAdmin, bulkDeleteEmployees);

// Admin-only employee status management (PUT /api/admin/employees/:id/status)
adminRouter.put("/employees/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);
adminRouter.put("/employee/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);
adminRouter.patch("/employees/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);
adminRouter.patch("/employee/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);

// Admin-only employee deletion (DELETE /api/admin/employees/:id)
adminRouter.delete("/employees/:id", verifyAdmin, validateOrganizationAccess(Employee), deleteEmployee);
adminRouter.delete("/employee/:id", verifyAdmin, validateOrganizationAccess(Employee), deleteEmployee);

// Admin-only leave deletion (DELETE /api/admin/leave/:id)
adminRouter.delete("/leave/:id", verifyAdmin, validateOrganizationAccess(Leave), deleteLeave);
adminRouter.delete("/leaves/:id", verifyAdmin, validateOrganizationAccess(Leave), deleteLeave);

// Admin-only attendance deletion (DELETE /api/admin/attendance/:id)
adminRouter.delete("/attendance/:id", verifyAdmin, validateOrganizationAccess(Attendance), deleteAttendanceRecord);
adminRouter.delete("/attendance/record/:id", verifyAdmin, validateOrganizationAccess(Attendance), deleteAttendanceRecord);

adminRouter.delete("/:id", verifyAdmin, validateOrganizationAccess(Employee), deleteEmployee);

export default adminRouter;

