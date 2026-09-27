import {
  calculateMonthlyPayrollSummary as baseCalculateMonthlyPayrollSummary,
  generatePayroll as baseGeneratePayroll,
  allPayslips as getAllPayrolls,
  getPayrollById as getPayslipById,
  deletePayroll,
  updatePayrollStatus,
  getPayrollAnalytics as getMonthlyPayrollAnalytics,
  exportPayrollReport as exportPayrollCSV,
  getEmployeeLivePayrollSummary,
} from "./payrollController.js";
import {
  calculateMonthlyPenalties,
  calculateEmployeePayrollEngine,
} from "../services/payrollEngine.js";
import { User } from "../models/userModel.js";
import { Employee } from "../models/employeeModel.js";
import { Payroll } from "../models/payrollModel.js";
import { buildTenantScope, combineTenantScope } from "../utils/tenantScope.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * Controller endpoint to calculate single employee payroll details with accurate lateness and absence deductions.
 */
export const calculateEmployeePayroll = async (req, res) => {
  try {
    const employeeId =
      req.query.employeeId ||
      req.query.employee ||
      req.params.employeeId ||
      req.body?.employeeId ||
      req.body?.employee;
    const year = parseInt(req.query.year || req.body?.year || new Date().getFullYear(), 10);
    const month = req.query.month || req.body?.month;
    let monthIndex = new Date().getMonth();

    if (req.query.monthIndex !== undefined) {
      monthIndex = parseInt(req.query.monthIndex, 10);
    } else if (month) {
      if (!isNaN(parseInt(month, 10))) {
        monthIndex = parseInt(month, 10) - 1;
      } else {
        const monthNames = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const idx = monthNames.indexOf(String(month).trim().toLowerCase());
        if (idx !== -1) monthIndex = idx;
      }
    }

    const baseSalaryInput = req.query.baseSalary || req.body?.baseSalary;
    const allowances = Number(req.query.allowances || req.body?.allowances || 0);
    const customDeductions = Number(req.query.customDeductions || req.body?.customDeductions || 0);

    const calculation = await calculateEmployeePayrollEngine(employeeId, year, monthIndex, {
      baseSalaryInput,
      allowances,
      customDeductions,
      req,
    });

    return res.status(200).json({
      success: true,
      ...calculation,
    });
  } catch (error) {
    console.error("Error in calculateEmployeePayroll (payrollAdminController):", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate employee payroll."),
    });
  }
};

/**
 * Admin endpoint for calculating monthly payroll summaries utilizing the new payrollEngine.
 */
export const calculateMonthlyPayrollSummary = async (req, res) => {
  try {
    const employeeId =
      req.query.employee ||
      req.query.employeeId ||
      req.params.employeeId ||
      req.body?.employee ||
      req.body?.employeeId;

    if (employeeId) {
      return calculateEmployeePayroll(req, res);
    }
    return baseCalculateMonthlyPayrollSummary(req, res);
  } catch (error) {
    console.error("Error in calculateMonthlyPayrollSummary (payrollAdminController):", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate payroll summary."),
    });
  }
};

/**
 * Enhanced payroll generator ensuring attendance penalties and absence deductions are verified via payrollEngine before publication.
 */
export const generatePayroll = async (req, res) => {
  try {
    const { employee, payMonth, absentDaysDeduction, latenessDeduction, latenessPenalties } = req.body;

    // If attendance deductions were not explicitly passed or need aggregation check
    if (
      employee &&
      (absentDaysDeduction === undefined ||
        (latenessDeduction === undefined && latenessPenalties === undefined))
    ) {
      try {
        let year = new Date().getFullYear();
        let monthIndex = new Date().getMonth();

        if (payMonth) {
          const parts = String(payMonth).split("-");
          if (parts.length === 2) {
            year = parseInt(parts[0], 10);
            monthIndex = parseInt(parts[1], 10) - 1;
          }
        }

        const penalties = await calculateMonthlyPenalties(employee, year, monthIndex, { req });
        if (penalties) {
          if (req.body.absentDaysDeduction === undefined) {
            req.body.absentDaysDeduction = penalties.absenceDeductions;
            req.body.originalAbsenceDeduction = penalties.absenceDeductions;
          }
          if (
            req.body.latenessDeduction === undefined &&
            req.body.latenessPenalties === undefined
          ) {
            req.body.latenessDeduction = penalties.latenessPenalties;
            req.body.latenessPenalties = penalties.latenessPenalties;
            req.body.originalLatenessDeduction = penalties.latenessPenalties;
          }
        }
      } catch (err) {
        console.warn("Could not auto-aggregate penalties via payrollEngine:", err.message);
      }
    }

    return baseGeneratePayroll(req, res);
  } catch (error) {
    console.error("Error in generatePayroll (payrollAdminController):", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to generate payroll."),
    });
  }
};

/**
 * Dynamic Aggregation Pipeline for Admin Payroll Summary
 * GET /api/admin/payroll/summary?month=YYYY-MM
 */
export const getAdminPayrollSummary = async (req, res) => {
  try {
    const { month, payMonth, billingCycle } = req.query;
    const filterMonth = month || payMonth || billingCycle;

    const tenantScope = buildTenantScope(req);
    const userId = req.user?._id || req.user?.id || req.admin?._id || req.admin?.id || "unknown";
    const userOrgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId || req.tenantId || "none";

    // 1. Query active employee count from User collection where role: 'employee' and status: 'active'
    let totalEmployees = 0;
    try {
      const userCount = await User.countDocuments(
        combineTenantScope(tenantScope, { role: "employee", status: "active" })
      );
      const employeeCount = await Employee.countDocuments(
        combineTenantScope(tenantScope, {
          $or: [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }],
        })
      );
      totalEmployees = Math.max(userCount, employeeCount);
      if (totalEmployees === 0) {
        const fallbackCount = await User.countDocuments(
          combineTenantScope(tenantScope, { role: "employee" })
        );
        const fallbackEmpCount = await Employee.countDocuments(tenantScope);
        totalEmployees = Math.max(fallbackCount, fallbackEmpCount);
      }
    } catch (countErr) {
      console.warn("Error counting active employees in getAdminPayrollSummary:", countErr.message);
    }

    // 2. Query Payslip / Payroll records in MongoDB strictly scoped to tenant
    let payslips = [];
    try {
      payslips = await Payroll.find(tenantScope)
        .populate("employee", "fullName employeeId department position email")
        .sort({ createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.warn("DB query error in getAdminPayrollSummary:", dbErr.message);
    }

    // 3. Month filtering if specified (supports "2026-08", "August 2026", "August", etc.)
    if (filterMonth && filterMonth !== "all" && filterMonth !== "All" && filterMonth !== "All Months") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const matchStrings = [filterMonth.toLowerCase().trim()];

      const ymMatch = filterMonth.match(/^(\d{4})-(\d{1,2})$/);
      if (ymMatch) {
        const y = ymMatch[1];
        const mIdx = parseInt(ymMatch[2], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          matchStrings.push(`${monthNames[mIdx].toLowerCase()} ${y}`);
          matchStrings.push(monthNames[mIdx].toLowerCase());
        }
      } else {
        const words = filterMonth.trim().split(/\s+/);
        const mName = words[0];
        const mIdx = monthNames.findIndex(m => m.toLowerCase() === mName.toLowerCase());
        if (mIdx !== -1) {
          const year = words[1] || new Date().getFullYear();
          const monthNum = String(mIdx + 1).padStart(2, "0");
          matchStrings.push(`${year}-${monthNum}`);
          matchStrings.push(`${monthNames[mIdx].toLowerCase()} ${year}`);
          matchStrings.push(monthNames[mIdx].toLowerCase());
        }
      }

      payslips = payslips.filter((p) => {
        const pMonth = (p.payMonth || p.month || "").toLowerCase().trim();
        const pDate = p.paymentDate ? String(p.paymentDate) : "";
        return matchStrings.some((str) => pMonth.includes(str) || pDate.startsWith(str));
      });
    }

    // 4. Metrics Computation:
    // - totalPaidOut: Sum of netSalary for all records where status: 'paid' / status: 'published'
    const totalPaidOut = payslips
      .filter((p) => {
        const s = (p.status || "").toLowerCase().trim();
        return s === "paid" || s === "published";
      })
      .reduce((acc, curr) => {
        const net = Number(curr.netSalary !== undefined ? curr.netSalary : (curr.netPay !== undefined ? curr.netPay : (curr.basicSalary || 0)));
        return acc + net;
      }, 0);

    // - pendingApprovals: Sum of netSalary for generated payslips in status: 'draft' or status: 'pending'
    const pendingApprovals = payslips
      .filter((p) => {
        const s = (p.status || "").toLowerCase().trim();
        return s === "draft" || s === "pending" || s === "unpaid";
      })
      .reduce((acc, curr) => {
        const net = Number(curr.netSalary !== undefined ? curr.netSalary : (curr.netPay !== undefined ? curr.netPay : (curr.basicSalary || 0)));
        return acc + net;
      }, 0);

    // - taxesAndDeductions: Sum of all deductions across all generated payslips for that month (Absence Deductions + Lateness Fines + Statutory/Other Deductions)
    const taxesAndDeductions = payslips.reduce((acc, curr) => {
      const absence = Number(curr.absenceDeductions !== undefined ? curr.absenceDeductions : (curr.absentDaysDeduction !== undefined ? curr.absentDaysDeduction : (curr.absenceDeduction || 0)));
      const late = Number(curr.latenessPenalties !== undefined ? curr.latenessPenalties : (curr.latenessDeduction || 0));

      let other = 0;
      if (curr.otherDeductions !== undefined) {
        other = Number(curr.otherDeductions || 0);
      } else if (Array.isArray(curr.customDeductions) && curr.customDeductions.length > 0) {
        other = curr.customDeductions.reduce((s, d) => s + Number(d.amount || 0), 0);
      } else if (typeof curr.deductions === "number") {
        other = Number(curr.deductions || 0);
      } else if (Array.isArray(curr.deductions) && curr.deductions.length > 0) {
        other = curr.deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
      }

      return acc + absence + late + other;
    }, 0);

    return res.status(200).json({
      success: true,
      totalEmployees,
      totalPaidOut: parseFloat(totalPaidOut.toFixed(2)),
      pendingApprovals: parseFloat(pendingApprovals.toFixed(2)),
      taxesAndDeductions: parseFloat(taxesAndDeductions.toFixed(2)),
      totalPayroll: parseFloat(totalPaidOut.toFixed(2)),
      totalPayrollDisbursed: parseFloat(totalPaidOut.toFixed(2)),
      monthlyPayrollTotal: parseFloat(totalPaidOut.toFixed(2)),
      pendingDisbursements: parseFloat(pendingApprovals.toFixed(2)),
      totalEmployeesPaid: payslips.filter((p) => (p.status || "").toLowerCase().trim() === "paid").length,
    });
  } catch (error) {
    console.error("Error in getAdminPayrollSummary (payrollAdminController):", error);
    return res.status(500).json({
      success: false,
      totalEmployees: 0,
      totalPaidOut: 0,
      pendingApprovals: 0,
      taxesAndDeductions: 0,
      message: safeErrorMessage(error, "Failed to calculate payroll summary."),
    });
  }
};

export {
  baseCalculateMonthlyPayrollSummary,
  baseGeneratePayroll,
  getAllPayrolls,
  getPayslipById,
  deletePayroll,
  updatePayrollStatus,
  getMonthlyPayrollAnalytics,
  exportPayrollCSV,
  getEmployeeLivePayrollSummary,
  calculateMonthlyPenalties,
  calculateEmployeePayrollEngine,
};

export default {
  calculateEmployeePayroll,
  calculateMonthlyPayrollSummary,
  generatePayroll,
  getAdminPayrollSummary,
  getAllPayrolls,
  getPayslipById,
  deletePayroll,
  updatePayrollStatus,
  getMonthlyPayrollAnalytics,
  exportPayrollCSV,
  getEmployeeLivePayrollSummary,
};
