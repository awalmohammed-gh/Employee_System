import express from "express";
import { verifyAdmin } from "../middleware/authAdmin.js";
import {
  allPayslips,
  employeePayslips,
  generatePayroll,
  calculateMonthlyPayrollSummary,
  getPayrollById,
  getEmployeeLatestPayslipBreakdown,
  getEmployeePayslipBreakdownById,
  updatePayrollStatus,
  deletePayroll,
  exportPayrollReport,
  getPayrollAnalytics,
  getPayrollCycles,
  getPenaltyImpactAnalytics,
  getCurrentMonthLatenessAnalytics,
  getSalaryProjection,
  getEmployeeLivePayrollSummary,
  getMonthlyPayrollRun,
} from "../controllers/payrollController.js";
import { getAdminPayrollSummary } from "../controllers/payrollAdminController.js";
import { employeeAuth } from "../middleware/employeeAuth.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateOrganizationAccess } from "../middleware/validateOrganizationAccess.js";
import { Payroll } from "../models/Payroll.js";
import { Employee } from "../models/Employee.js";

import {
  getPayrollForecasting,
  getEmployeeForecasting,
  exportForecastingCSV,
} from "../controllers/payrollForecastingController.js";

const payrollRouter = express.Router();

// Payroll Forecasting Tool (End-of-Month Lateness Deductions Projections)
payrollRouter.get("/forecasting", protect, getPayrollForecasting);
payrollRouter.get("/forecasting/export", protect, exportForecastingCSV);
payrollRouter.get("/forecasting/me", protect, getEmployeeForecasting);
payrollRouter.get("/forecasting/employee/:id", protect, validateOrganizationAccess(Employee), getEmployeeForecasting);

// Dynamic KPI Summary Metrics Aggregation (Admin)
payrollRouter.get("/summary", verifyAdmin, getAdminPayrollSummary);
payrollRouter.get("/admin/summary", verifyAdmin, getAdminPayrollSummary);
payrollRouter.get("/admin/payroll/summary", verifyAdmin, getAdminPayrollSummary);

// Real-Time Monthly Calendar Absence & Lateness Calculation Engine (Employee Live Summary)
payrollRouter.get("/live-summary", employeeAuth, getEmployeeLivePayrollSummary);
payrollRouter.get("/employee/live-summary", employeeAuth, getEmployeeLivePayrollSummary);
payrollRouter.get("/employee/payroll/live-summary", employeeAuth, getEmployeeLivePayrollSummary);

// Batch Monthly Payroll Run Aggregation across All Active Employees (Admin)
payrollRouter.get("/monthly-run", verifyAdmin, getMonthlyPayrollRun);
payrollRouter.get("/admin/monthly-run", verifyAdmin, getMonthlyPayrollRun);
payrollRouter.get("/admin/payroll/monthly-run", verifyAdmin, getMonthlyPayrollRun);

// Dynamic monthly salary calculation based on attendance & approved leaves (Admin Only)
payrollRouter.get("/calculate-summary", verifyAdmin, calculateMonthlyPayrollSummary);
payrollRouter.get("/calculate-employee", verifyAdmin, calculateMonthlyPayrollSummary);
payrollRouter.get("/admin/calculate-summary", verifyAdmin, calculateMonthlyPayrollSummary);
payrollRouter.get("/admin/calculate-employee", verifyAdmin, calculateMonthlyPayrollSummary);
payrollRouter.get("/admin/payroll/calculate-employee", verifyAdmin, calculateMonthlyPayrollSummary);

// Salary Projection Calculator for Employees (estimates end-of-month pay based on attendance & leaves)
payrollRouter.get("/salary-projection/current", employeeAuth, getSalaryProjection);
payrollRouter.get("/salary-projection", employeeAuth, getSalaryProjection);
payrollRouter.post("/salary-projection", employeeAuth, getSalaryProjection);
payrollRouter.get("/projection/current", employeeAuth, getSalaryProjection);
payrollRouter.get("/projection", employeeAuth, getSalaryProjection);
payrollRouter.post("/projection", employeeAuth, getSalaryProjection);
payrollRouter.get("/employee/salary-projection/current", employeeAuth, getSalaryProjection);
payrollRouter.get("/employee/salary-projection", employeeAuth, getSalaryProjection);
payrollRouter.post("/employee/salary-projection", employeeAuth, getSalaryProjection);

// Payroll generation & listing
payrollRouter.post("/generate", verifyAdmin, generatePayroll);
payrollRouter.get("/records", verifyAdmin, allPayslips);
payrollRouter.get("/payslips", verifyAdmin, allPayslips);
payrollRouter.get("/list", verifyAdmin, allPayslips);

// Payroll cycle history & status
payrollRouter.get("/cycles", verifyAdmin, getPayrollCycles);
payrollRouter.get("/history", verifyAdmin, getPayrollCycles);

// 6-Month attendance penalty impact on payroll cost
payrollRouter.get("/penalty-impact", verifyAdmin, getPenaltyImpactAnalytics);
payrollRouter.get("/penalties/impact", verifyAdmin, getPenaltyImpactAnalytics);

// Current Month Lateness Deductions Analytics
payrollRouter.get("/monthly-lateness-deductions", protect, getCurrentMonthLatenessAnalytics);
payrollRouter.get("/penalties/monthly-lateness", protect, getCurrentMonthLatenessAnalytics);

// Payroll export reports
payrollRouter.get("/export", verifyAdmin, exportPayrollReport);

// Payroll analytics for bar charts dashboard (Admin only)
payrollRouter.get("/analytics", verifyAdmin, getPayrollAnalytics);
payrollRouter.get("/admin/analytics", verifyAdmin, getPayrollAnalytics);

// Employee payslips list & latest
payrollRouter.get("/employee-payslip", employeeAuth, employeePayslips);
payrollRouter.get("/employee-payslips", employeeAuth, employeePayslips);
payrollRouter.get("/employee/payslips", employeeAuth, employeePayslips);
payrollRouter.get("/employee/payslips/my-payslips", employeeAuth, employeePayslips);
payrollRouter.get("/payslips/my-payslips", employeeAuth, employeePayslips);
payrollRouter.get("/my-payslips", employeeAuth, employeePayslips);
payrollRouter.get("/employee/payslips/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);
payrollRouter.get("/employee/payslip/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);
payrollRouter.get("/payslips/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);
payrollRouter.get("/payslip/latest", employeeAuth, getEmployeeLatestPayslipBreakdown);

// Single payroll record details (by ID or payslipNumber - authenticated with ownership check)
payrollRouter.get("/employee/payslip/:id", employeeAuth, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
payrollRouter.get("/payslip/:id", employeeAuth, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
payrollRouter.get("/details/:id", employeeAuth, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);
payrollRouter.get("/:id", employeeAuth, validateOrganizationAccess(Payroll), getEmployeePayslipBreakdownById);

// Update status and deletion
payrollRouter.put("/status/:id", verifyAdmin, validateOrganizationAccess(Payroll), updatePayrollStatus);
payrollRouter.delete("/:id", verifyAdmin, validateOrganizationAccess(Payroll), deletePayroll);

export default payrollRouter;

