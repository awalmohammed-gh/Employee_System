import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import CompanySettings from "../models/CompanySettings.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import { liveAttendanceStore } from "../controllers/employeeAttendance.js";
import { liveLeaveStore } from "../controllers/leaveController.js";
import {
  evaluateLatenessPenalty,
  calculateLatenessPenalty,
  getStandardizedLatenessTiers,
  getTierConfiguredFine,
} from "../utils/latenessPenaltyCalculator.js";
import { isWorkingDay } from "../utils/workSchedule.js";

export { evaluateLatenessPenalty, calculateLatenessPenalty, getStandardizedLatenessTiers, getTierConfiguredFine };

const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Returns the count of working days in a month (the admin's working days; Sunday is a rest day).
 */
export function getWorkingDaysInMonth(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (isWorkingDay(d)) {
      count++;
    }
  }
  return count || 22;
}

/**
 * Unified Single Source of Truth for Monthly Penalties & Attendance Breakdown.
 * Accurately queries attendance logs across date formats and computes exact penalties.
 */
export async function calculateMonthlyPenalties(employeeId, year, monthIndex, options = {}) {
  const currentYear = year || new Date().getFullYear();
  const currentMonthIdx = monthIndex !== undefined ? monthIndex : new Date().getMonth();

  const orgId = options?.orgId || options?.organizationId || options?.companyId ||
    options?.req?.organizationId || options?.req?.companyId ||
    options?.req?.user?.organizationId || options?.req?.user?.companyId;
  const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

  // Start and End of selected month in UTC/Local bounds
  const startDate = new Date(Date.UTC(currentYear, currentMonthIdx, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999));
  const monthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
  const monthName = `${MONTH_NAMES[currentMonthIdx]} ${currentYear}`;

  let settings = {
    workStartTime: "08:00",
    absenceRate: 15.00,
    absenceDeductionRate: 15.00,
    lateTier1_amount: 10,
    lateTier2_amount: 30,
    lateTier3_amount: 50,
    lateTier4_amount: 75,
    lateTier5_amount: 100,
    lateTier6_amount: 150,
    latenessTiers: [
      { minMinutes: 1, maxMinutes: 30, penalty: 10 },
      { minMinutes: 31, maxMinutes: 60, penalty: 30 },
      { minMinutes: 61, maxMinutes: 9999, penalty: 150 },
    ],
  };

  try {
    const dbSettings = await CompanySettings.findOne(orgScope).lean();
    if (dbSettings) {
      settings = {
        ...settings,
        ...dbSettings,
        absenceRate: Number(dbSettings.absenceRate || dbSettings.absenceDeductionRate || 15.00),
      };
    }
  } catch (err) {
    console.warn("Could not query CompanySettings:", err.message);
  }

  // Resolve target employee and associated IDs
  let targetEmployee = null;
  let targetObjectId = null;
  let targetEmpCode = "";

  if (employeeId && employeeId !== "all") {
    try {
      if (isValidObjectId(employeeId)) {
        targetEmployee = await Employee.findOne({ _id: employeeId, ...orgScope }).lean();
        targetObjectId = employeeId;
        if (!targetEmployee) {
          targetEmployee = await User.findOne({ _id: employeeId, ...orgScope }).lean();
        }
      } else {
        targetEmployee = await Employee.findOne({
          $or: [{ employeeId }, { email: employeeId }],
          ...orgScope,
        }).lean();
        if (!targetEmployee) {
          targetEmployee = await User.findOne({
            $or: [{ employeeId }, { email: employeeId }],
            ...orgScope,
          }).lean();
        }
      }
    } catch (err) {
      console.warn("Error querying employee in calculateMonthlyPenalties:", err.message);
    }
  }

  if (!targetEmployee && orgId) {
    try {
      targetEmployee = await Employee.findOne({ isActive: true, ...orgScope }).lean();
      if (!targetEmployee) {
        targetEmployee = await User.findOne({ role: "employee", ...orgScope }).lean();
      }
    } catch (e) {
      // fallback
    }
  }

  if (targetEmployee) {
    targetObjectId = targetEmployee._id?.toString() || targetObjectId;
    targetEmpCode = targetEmployee.employeeId || "";
  }

  // Build employee query clause matching both ObjectId and string ID formats
  const empMatchOr = [];
  if (targetObjectId) {
    empMatchOr.push({ employee: targetObjectId });
    if (isValidObjectId(targetObjectId)) {
      empMatchOr.push({ employee: new mongoose.Types.ObjectId(targetObjectId) });
    }
    empMatchOr.push({ employeeId: targetObjectId });
  }
  if (targetEmpCode) {
    empMatchOr.push({ employeeId: targetEmpCode });
  }
  if (employeeId && typeof employeeId === "string") {
    empMatchOr.push({ employeeId: employeeId });
    if (isValidObjectId(employeeId)) {
      empMatchOr.push({ employee: new mongoose.Types.ObjectId(employeeId) });
      empMatchOr.push({ employee: employeeId });
    }
  }

  // Fetch all attendance logs for the month (matching Date objects, ISO strings, and YYYY-MM prefixes)
  let logs = [];
  try {
    const query = {
      $and: [
        ...(orgId ? [orgScope] : []),
        empMatchOr.length > 0 ? { $or: empMatchOr } : {},
        {
          $or: [
            { date: { $gte: startDate, $lte: endDate } },
            { date: { $regex: `^${monthStr}` } },
            { clockIn: { $gte: startDate, $lte: endDate } },
            { clockInTime: { $gte: startDate, $lte: endDate } },
          ],
        },
      ],
    };

    logs = await Attendance.find(query).lean();
  } catch (err) {
    console.warn("Attendance.find error in calculateMonthlyPenalties:", err.message);
  }

  // Merge live attendance store if in-memory clock-in exists
  if (Array.isArray(liveAttendanceStore)) {
    liveAttendanceStore.forEach((liveAtt) => {
      if (orgId) {
        const itemOrg = liveAtt.organizationId || liveAtt.companyId;
        if (itemOrg && String(itemOrg) !== String(orgId)) return;
      }
      const matchEmp =
        String(liveAtt.employee) === String(targetObjectId) ||
        String(liveAtt.employee?._id) === String(targetObjectId) ||
        liveAtt.employeeId === targetEmpCode ||
        liveAtt.employee?.employeeId === targetEmpCode;

      if (matchEmp && liveAtt.date && String(liveAtt.date).startsWith(monthStr)) {
        if (!logs.some((l) => l.date === liveAtt.date)) {
          logs.push(liveAtt);
        }
      }
    });
  }

  let attendedDays = 0;
  let lateCount = 0;
  let totalLatePenalties = 0;
  const lateLogs = [];

  logs.forEach((log) => {
    const hasClockIn = log.clockInTime || log.clockIn;
    const isExplicitAbsent = (log.status || "").toLowerCase() === "absent";

    if (hasClockIn || (log.status && !isExplicitAbsent)) {
      attendedDays += 1;
    }

    const evalResult = hasClockIn ? evaluateLatenessPenalty(hasClockIn, settings.workStartTime, settings) : null;
    const isLate =
      (log.status || "").toLowerCase() === "late" ||
      Number(log.lateMinutes || log.delayMinutes || 0) > 0 ||
      Number(log.latePenalty || 0) > 0 ||
      (evalResult && evalResult.isLate);

    if (isLate && !isExplicitAbsent) {
      lateCount += 1;
      let fine = 0;
      let lateMins = Number(log.lateMinutes || log.delayMinutes || (evalResult ? evalResult.minutesLate : 0));
      let tierName = log.penaltyTier || (evalResult ? evalResult.tier : "Late Penalty");

      if (log.latePenalty !== undefined && log.latePenalty !== null && log.latePenalty !== "" && !isNaN(Number(log.latePenalty))) {
        fine = Math.max(0, Number(log.latePenalty));
      } else if (evalResult && evalResult.isLate) {
        fine = evalResult.penalty;
        tierName = evalResult.tier;
        lateMins = evalResult.minutesLate;
      } else {
        const fallbackCalc = calculateLatenessPenalty(lateMins || 15, settings);
        fine = fallbackCalc.penalty;
        tierName = fallbackCalc.tier;
        lateMins = fallbackCalc.minutesLate;
      }

      totalLatePenalties += fine;
      lateLogs.push({
        date: log.date,
        clockInTime: hasClockIn,
        lateMinutes: lateMins,
        penalty: fine,
        tier: tierName,
      });
    }
  });

  // Query approved leaves strictly overlapping target month
  let approvedLeaveDays = 0;
  try {
    const leaves = await Leave.find({
      $and: [
        ...(orgId ? [orgScope] : []),
        empMatchOr.length > 0 ? { $or: empMatchOr } : {},
        { status: "Approved" },
        {
          $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
            { startDate: { $gte: startDate, $lte: endDate } },
          ],
        },
      ],
    }).lean();

    leaves.forEach((l) => {
      const lStart = new Date(l.startDate);
      const lEnd = new Date(l.endDate || l.startDate);
      if (!isNaN(lStart.getTime())) {
        const effStart = lStart < startDate ? startDate : lStart;
        const effEnd = lEnd > endDate ? endDate : lEnd;
        if (effStart <= effEnd) {
          let cur = new Date(effStart);
          while (cur <= effEnd) {
            const utcDay = new Date(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate());
            if (isWorkingDay(utcDay)) {
              approvedLeaveDays++;
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
      }
    });
  } catch (err) {
    console.warn("Leave query notice:", err.message);
  }

  // Workday bounds calculation (strict monthly isolation & mid-month elapsed days)
  const now = options?.evaluationDate ? new Date(options.evaluationDate) : new Date();
  const isCurrentMonth = currentYear === now.getFullYear() && currentMonthIdx === now.getMonth();
  const isPastMonth = currentYear < now.getFullYear() || (currentYear === now.getFullYear() && currentMonthIdx < now.getMonth());
  const isFutureMonth = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonthIdx > now.getMonth());

  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  let cutoffDay = 0;
  if (isPastMonth) {
    cutoffDay = daysInMonth;
  } else if (isCurrentMonth) {
    cutoffDay = Math.min(now.getDate(), daysInMonth);
  } else {
    cutoffDay = 0;
  }

  let standardWorkingDays = 0;
  let elapsedWorkingDays = 0;
  let futureWorkingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(currentYear, currentMonthIdx, d);
    if (isWorkingDay(dObj)) {
      standardWorkingDays++;
      if (d <= cutoffDay) {
        elapsedWorkingDays++;
      } else {
        futureWorkingDays++;
      }
    }
  }

  // Rule 1: Future / Unelapsed Days Are Never Counted as Absent
  // If mid-period run, absences are only evaluated against elapsed working days to date.
  const auditWorkDays = options?.isFullMonthAudit ? standardWorkingDays : (isCurrentMonth ? elapsedWorkingDays : standardWorkingDays);
  const absentDays = isFutureMonth ? 0 : Math.max(0, auditWorkDays - attendedDays - approvedLeaveDays);

  const baseSalary = Number(
    options?.baseSalaryInput !== undefined && !isNaN(Number(options.baseSalaryInput))
      ? Number(options.baseSalaryInput)
      : (targetEmployee?.baseSalary ??
         targetEmployee?.basicSalary ??
         targetEmployee?.salary ??
         2500)
  );

  // Dynamic Daily Salary Rate = Employee Base Salary / Total Working Days in Month (Rule 3)
  const dailySalaryRate = standardWorkingDays > 0 ? parseFloat((baseSalary / standardWorkingDays).toFixed(2)) : 0;
  // Realized Absence Deductions = elapsedUnexcusedAbsentDays * dailySalaryRate
  const totalAbsenceDeductions = parseFloat((absentDays * dailySalaryRate).toFixed(2));

  return {
    targetEmployee,
    monthName,
    year: currentYear,
    monthIndex: currentMonthIdx,
    standardWorkingDays,
    elapsedWorkingDays,
    futureWorkingDays,
    cutoffDay,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    attendedDays,
    lateCount,
    lateDays: lateCount,
    lateLogs,
    totalLatePenalties: parseFloat(totalLatePenalties.toFixed(2)),
    latenessPenalties: parseFloat(totalLatePenalties.toFixed(2)),
    approvedLeaveDays,
    absentDays,
    dailySalaryRate,
    dailyRate: dailySalaryRate,
    absenceRate: dailySalaryRate,
    absenceDeductionRate: dailySalaryRate,
    absenceDeductions: totalAbsenceDeductions,
    baseSalary,
    allowances: 0,
    netSalary: parseFloat(
      Math.max(0, baseSalary - totalAbsenceDeductions - totalLatePenalties).toFixed(2)
    ),
    remarks: isCurrentMonth && futureWorkingDays > 0
      ? `Mid-month calculation: ${attendedDays} attended day(s), ${absentDays} unexcused absence(s) across ${elapsedWorkingDays} elapsed working days, and ${lateCount} late check-in(s) for ${monthName}. Remaining ${futureWorkingDays} upcoming days are strictly excluded from absences.`
      : `Calculated from ${attendedDays} attended day(s), ${absentDays} absent day(s), and ${lateCount} late check-in(s) for ${monthName}.`,
  };
}

/**
 * Calculates complete employee payroll with allowance, waiver, and custom deduction support.
 */
export async function calculateEmployeePayrollEngine(employeeId, year, monthIndex, options = {}) {
  const penaltySummary = await calculateMonthlyPenalties(employeeId, year, monthIndex, options);
  const baseSalary = options.baseSalaryInput !== undefined && !isNaN(Number(options.baseSalaryInput))
    ? Number(options.baseSalaryInput)
    : penaltySummary.baseSalary;

  const standardWorkingDays = penaltySummary.standardWorkingDays || 22;
  const dailySalaryRate = standardWorkingDays > 0 ? parseFloat((baseSalary / standardWorkingDays).toFixed(2)) : 0;
  const absentDays = penaltySummary.absentDays || 0;
  const absenceDeductions = parseFloat((absentDays * dailySalaryRate).toFixed(2));

  const allowances = Number(options.allowances || 0);
  const customDeductions = Number(options.customDeductions || options.deductions || 0);
  const latenessPenalties = penaltySummary.latenessPenalties;

  const totalDeductions = parseFloat(
    (customDeductions + absenceDeductions + latenessPenalties).toFixed(2)
  );
  const netSalary = parseFloat(
    Math.max(0, baseSalary + allowances - totalDeductions).toFixed(2)
  );

  return {
    ...penaltySummary,
    baseSalary,
    basicSalary: baseSalary,
    standardWorkingDays,
    dailySalaryRate,
    dailyRate: dailySalaryRate,
    absenceRate: dailySalaryRate,
    absenceDeductions,
    allowances,
    customDeductions,
    totalDeductions,
    netSalary,
    earnedBaseSalary: baseSalary,
  };
}

/**
 * Enforces single source of truth for net salary and deduction calculations.
 * Supports employee-specific dynamic daily salary rate deduction.
 */
export function computeNetSalary({
  baseSalary = 0,
  allowances = 0,
  absentDays = 0,
  dailyAbsenceRate = null,
  standardWorkingDays = 22,
  latenessFines = 0,
  otherDeductions = 0
} = {}) {
  const numBase = Math.max(0, Number(baseSalary) || 0);
  const numAllowances = Math.max(0, Number(allowances) || 0);
  const numAbsentDays = Math.max(0, Number(absentDays) || 0);
  const numWorkingDays = Number(standardWorkingDays) > 0 ? Number(standardWorkingDays) : 22;

  // Daily Salary Rate = Employee Base Salary / Total Working Days in Month
  const computedRate = dailyAbsenceRate !== null && dailyAbsenceRate !== undefined && !isNaN(Number(dailyAbsenceRate)) && Number(dailyAbsenceRate) >= 0
    ? Number(dailyAbsenceRate)
    : (numWorkingDays > 0 ? numBase / numWorkingDays : 0);

  const numDailySalaryRate = Math.max(0, Number(computedRate.toFixed(2)) || 0);
  const numLatenessFines = Math.max(0, Number(latenessFines) || 0);
  const numOtherDeductions = Math.max(0, Number(otherDeductions) || 0);

  const totalEarnings = numBase + numAllowances;
  const totalAbsenceDeduction = Number((numAbsentDays * numDailySalaryRate).toFixed(2));
  const totalDeductions = Number((totalAbsenceDeduction + numLatenessFines + numOtherDeductions).toFixed(2));
  const netSalary = Math.max(0, Number((totalEarnings - totalDeductions).toFixed(2)));

  return {
    baseSalary: Number(numBase.toFixed(2)),
    allowances: Number(numAllowances.toFixed(2)),
    standardWorkingDays: numWorkingDays,
    dailySalaryRate: numDailySalaryRate,
    dailyRate: numDailySalaryRate,
    absentDays: Number(numAbsentDays),
    absenceDeductions: totalAbsenceDeduction,
    latenessPenalties: Number(numLatenessFines.toFixed(2)),
    otherDeductions: Number(numOtherDeductions.toFixed(2)),
    totalDeductions,
    netSalary,
  };
}

export default {
  computeNetSalary,
  calculateMonthlyPenalties,
  calculateEmployeePayrollEngine,
  getWorkingDaysInMonth,
  evaluateLatenessPenalty,
};
