import express from "express";
import {
  createEmployeeAccount,
  employeeLogin,
  employeeLogout,
  changeEmployeePassword,
} from "../controllers/employeeAuthentication.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import {
  employeeDetails,
  employeeNameList,
  getEmployeeById,
  getCurrentLoggedInEmployee,
  updateCurrentEmployee,
  exportEmployeesCSV,
  bulkUploadEmployees,
} from "../controllers/employeeController.js";
import { handleCsvUpload } from "../middleware/csvUploadMiddleware.js";
import {
  employeePayslips,
  getEmployeeLatestPayslipBreakdown,
  getEmployeePayslipBreakdownById,
  getSalaryProjection,
  getEmployeeLivePayrollSummary,
} from "../controllers/payrollController.js";
import { employeeDashboardOverview } from "../controllers/dashboardController.js";
import { updateEmployeeStatus, deleteEmployee } from "../controllers/adminController.js";
import {
  getMyQuarterlyReviews,
  getEmployeeQuarterlyReviews,
} from "../controllers/performanceController.js";
import { getEmployeeLeave, getLeaveEmployeeStats, applyLeave } from "../controllers/leaveController.js";
import { getCurrentMonthLatenessAnalytics } from "../controllers/analyticsController.js";
import { getEmployeeAttendance } from "../controllers/employeeAttendance.js";
import { employeeAuth } from "../middleware/employeeAuth.js";
import { validateOrganizationAccess } from "../middleware/validateOrganizationAccess.js";
import { Employee } from "../models/Employee.js";
import { Payroll } from "../models/Payroll.js";

const employeeRouter = express.Router();

// Current Month Lateness Deductions for Employee
employeeRouter.get("/monthly-lateness-deductions", employeeAuth, getCurrentMonthLatenessAnalytics);
employeeRouter.get("/analytics/monthly-lateness-deductions", employeeAuth, getCurrentMonthLatenessAnalytics);

// Real-Time Employee Leave History & Balances (GET /api/employee/leave-requests)
employeeRouter.get("/leave-requests", employeeAuth, getEmployeeLeave);
employeeRouter.get("/leave/requests", employeeAuth, getEmployeeLeave);
employeeRouter.get("/leave", employeeAuth, getEmployeeLeave);
employeeRouter.get("/leaves", employeeAuth, getEmployeeLeave);
employeeRouter.get("/my-leaves", employeeAuth, getEmployeeLeave);
employeeRouter.get("/leave/stats", employeeAuth, getLeaveEmployeeStats);
employeeRouter.get("/leave-stats", employeeAuth, getLeaveEmployeeStats);
employeeRouter.post("/leave/apply", employeeAuth, applyLeave);
employeeRouter.post("/apply-leave", employeeAuth, applyLeave);

// Real-Time Live Payroll Summary (Calculates dynamic workdays, lateness fines, and unexcused absences)
employeeRouter.get("/payroll/live-summary", employeeAuth, getEmployeeLivePayrollSummary);
employeeRouter.get("/live-summary", employeeAuth, getEmployeeLivePayrollSummary);
employeeRouter.get("/payroll-summary", employeeAuth, getEmployeeLivePayrollSummary);

// Real-Time Dashboard Overview Endpoint for Employee
employeeRouter.get("/dashboard-summary", employeeAuth, employeeDashboardOverview);
employeeRouter.get("/dashboard-overview", employeeAuth, employeeDashboardOverview);
employeeRouter.get("/dashboard", employeeAuth, employeeDashboardOverview);
employeeRouter.get("/overview", employeeAuth, employeeDashboardOverview);

// Real-Time Salary Projection Endpoints for Employee
employeeRouter.get("/salary-projection/current", employeeAuth, getSalaryProjection);
employeeRouter.get("/salary-projection", employeeAuth, getSalaryProjection);
employeeRouter.post("/salary-projection", employeeAuth, getSalaryProjection);
employeeRouter.get("/projection/current", employeeAuth, getSalaryProjection);
employeeRouter.get("/projection", employeeAuth, getSalaryProjection);

// Create account for employees (supports both custom and REST standard endpoints)
employeeRouter.post("/employee-account", verifyAdmin, createEmployeeAccount);
employeeRouter.post("/create", verifyAdmin, createEmployeeAccount);
employeeRouter.post("/add", verifyAdmin, createEmployeeAccount);
employeeRouter.post("/bulk-upload", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
employeeRouter.post("/bulk-create", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
employeeRouter.post("/bulk-import", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
employeeRouter.post("/bulk", verifyAdmin, handleCsvUpload, bulkUploadEmployees);
employeeRouter.post("/", verifyAdmin, createEmployeeAccount);

// Authentication endpoints
employeeRouter.post("/login-account", employeeLogin);
employeeRouter.post("/login", employeeLogin);
employeeRouter.post("/logout-account", employeeLogout);
employeeRouter.post("/logout", employeeLogout);

// Employee payslips & breakdown routes
employeeRouter.get("/payslips/my-payslips", employeeAuth, employeePayslips);
employeeRouter.get("/my-payslips", employeeAuth, employeePayslips);
employeeRouter.get("/payslips/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);
employeeRouter.get("/payslip/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);
employeeRouter.get("/payslips", employeeAuth, employeePayslips);
employeeRouter.get("/payslip/:id", employeeAuth, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
employeeRouter.get("/attendance", employeeAuth, getEmployeeAttendance);

// Employee details & directory list (supports both custom and REST standard endpoints)
employeeRouter.get("/export-csv", verifyAdmin, exportEmployeesCSV);
employeeRouter.get("/export", verifyAdmin, exportEmployeesCSV);
employeeRouter.get("/export/csv", verifyAdmin, exportEmployeesCSV);
employeeRouter.get("/me", employeeAuth, getCurrentLoggedInEmployee);
employeeRouter.put("/me", employeeAuth, updateCurrentEmployee);
employeeRouter.put("/profile", employeeAuth, updateCurrentEmployee);
employeeRouter.put("/change-password", employeeAuth, changeEmployeePassword);
employeeRouter.put("/password", employeeAuth, changeEmployeePassword);
employeeRouter.post("/change-password", employeeAuth, changeEmployeePassword);
employeeRouter.get("/all-employees", verifyAdmin, employeeDetails);
employeeRouter.get("/details", verifyAdmin, employeeDetails);
employeeRouter.get("/all", verifyAdmin, employeeDetails);
employeeRouter.get("/directory", verifyAdmin, employeeDetails);
employeeRouter.get("/list", verifyAdmin, employeeDetails);
employeeRouter.get("/", verifyAdmin, employeeDetails);

employeeRouter.get("/list-employee-name", employeeAuth, employeeNameList);
employeeRouter.get("/names", employeeAuth, employeeNameList);

// Performance Reviews & Growth Visualizations (registered before "/:id" so static paths are not captured as an id)
employeeRouter.get("/my-performance", employeeAuth, getMyQuarterlyReviews);
employeeRouter.get("/performance", employeeAuth, getMyQuarterlyReviews);
employeeRouter.get("/profile/:id/performance", employeeAuth, getEmployeeQuarterlyReviews);
employeeRouter.get("/:id/performance", employeeAuth, getEmployeeQuarterlyReviews);

employeeRouter.get("/profile/:id", employeeAuth, validateOrganizationAccess(Employee), getEmployeeById);
employeeRouter.get("/:id", employeeAuth, validateOrganizationAccess(Employee), getEmployeeById);

// Admin-only status modification
employeeRouter.put("/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);
employeeRouter.put("/status/:id", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);
employeeRouter.patch("/:id/status", verifyAdmin, validateOrganizationAccess(Employee), updateEmployeeStatus);

// Admin-only deletion
employeeRouter.delete("/:id", verifyAdmin, validateOrganizationAccess(Employee), deleteEmployee);

export default employeeRouter;

