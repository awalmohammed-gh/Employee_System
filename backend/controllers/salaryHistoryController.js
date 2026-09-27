import mongoose from "mongoose";
import { Employee } from "../models/employeeModel.js";
import { Payroll } from "../models/payrollModel.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * GET /api/admin/employees/:id/salary-history
 *
 * Base-salary history built only from the employee's recorded payroll runs: the first payroll,
 * then every run where the base salary differs from the previous one. Nothing is estimated.
 */
export const getEmployeeSalaryHistory = async (req, res) => {
  try {
    const rawId = String(req.params.id || "").trim();
    let employee = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      employee = await Employee.findById(rawId).select("_id fullName employeeId baseSalary").lean();
    }
    if (!employee && rawId) {
      employee = await Employee.findOne({ employeeId: rawId }).select("_id fullName employeeId baseSalary").lean();
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const payrolls = await Payroll.find({ employee: employee._id })
      .select("payMonth paymentDate basicSalary baseSalary status payslipNumber createdAt")
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean();

    const history = [];
    let previous = null;
    for (const pr of payrolls) {
      const base = Number(pr.baseSalary ?? pr.basicSalary ?? 0);
      if (!(base > 0)) continue;
      if (previous !== null && base === previous) continue;

      const percentageChange = previous ? parseFloat((((base - previous) / previous) * 100).toFixed(1)) : 0;
      history.push({
        id: String(pr._id),
        effectiveDate: pr.paymentDate || pr.createdAt,
        payMonth: pr.payMonth,
        previousSalary: previous ?? 0,
        newSalary: base,
        percentageChange,
        type: previous === null ? "First Payroll" : base > previous ? "Salary Increase" : "Salary Decrease",
        reason: `Base salary on the ${pr.payMonth} payroll`,
        reference: pr.payslipNumber || "",
        status: pr.status || "",
      });
      previous = base;
    }

    return res.status(200).json({
      success: true,
      employee: { _id: employee._id, fullName: employee.fullName, employeeId: employee.employeeId },
      currentSalary: Number(employee.baseSalary || 0),
      payrollCount: payrolls.length,
      history: history.reverse(), // most recent first
    });
  } catch (error) {
    console.error("Error in getEmployeeSalaryHistory:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to load salary history."),
    });
  }
};

export default getEmployeeSalaryHistory;
