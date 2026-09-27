import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Payroll } from "../models/payrollModel.js";
import { Payslip } from "../models/Payslip.js";
import { Leave } from "../models/leaveModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { AuditLog } from "../models/AuditLog.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { liveAttendanceStore } from "./employeeAttendance.js";
import { liveLeaveStore } from "./leaveController.js";
import { createNotificationRecord } from "./notificationController.js";
import { calculateMonthlyPenalties, computeNetSalary } from "../services/payrollEngine.js";
import {
  evaluateLatenessPenalty,
  calculateLatenessPenalty,
  getStandardizedLatenessTiers,
  getTierConfiguredFine,
} from "../utils/latenessPenaltyCalculator.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { isWorkingDay } from "../utils/workSchedule.js";

export { evaluateLatenessPenalty, calculateLatenessPenalty, getStandardizedLatenessTiers, getTierConfiguredFine };

// Accepts ObjectId strings and ObjectId instances (e.g. _id values read with .lean()).
const isValidObjectId = (id) => {
  if (!id) return false;
  if (id instanceof mongoose.Types.ObjectId) return true;
  return (
    typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === id
  );
};

export const livePayrollStore = [];

/**
 * Calculates calendar and business day boundaries for a target billing month.
 * Enforces strict monthly isolation and mid-month elapsed vs future day tracking.
 *
 * @param {number|string} year - 4-digit year (e.g. 2026)
 * @param {number|string} monthIndex - 0-indexed month (0 = Jan, 8 = Sept)
 * @param {Date|string|null} evaluationDate - Reference cutoff date (defaults to current date)
 * @returns {Object} Boundaries, standard working days, elapsed working days, future working days, and business days.
 */
export const getMonthDateBoundaries = (year = 2026, monthIndex = 7, evaluationDate = null) => {
  const targetYear = parseInt(year, 10) || new Date().getFullYear();
  let targetMonthIndex = parseInt(monthIndex, 10);
  if (isNaN(targetMonthIndex) || targetMonthIndex < 0 || targetMonthIndex > 11) {
    targetMonthIndex = new Date().getMonth();
  }

  const evalDate = evaluationDate
    ? (evaluationDate instanceof Date ? evaluationDate : new Date(evaluationDate))
    : new Date();
  const safeEvalDate = !isNaN(evalDate.getTime()) ? evalDate : new Date();

  const evalYear = safeEvalDate.getFullYear();
  const evalMonthIndex = safeEvalDate.getMonth();
  const evalDay = safeEvalDate.getDate();

  // Strict start and end of target billing month (local and UTC)
  const totalDaysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const startOfMonth = new Date(targetYear, targetMonthIndex, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(targetYear, targetMonthIndex, totalDaysInMonth, 23, 59, 59, 999);

  const startOfMonthUTC = new Date(Date.UTC(targetYear, targetMonthIndex, 1, 0, 0, 0, 0));
  const endOfMonthUTC = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999));

  const monthString = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}`;

  const isPastMonth =
    targetYear < evalYear || (targetYear === evalYear && targetMonthIndex < evalMonthIndex);
  const isCurrentMonth =
    targetYear === evalYear && targetMonthIndex === evalMonthIndex;
  const isFutureMonth =
    targetYear > evalYear || (targetYear === evalYear && targetMonthIndex > evalMonthIndex);

  // Determine cutoff day:
  // - Future month: 0 days have elapsed
  // - Past month: All days of month have elapsed (cutoff = totalDaysInMonth)
  // - Current month: Only days up to today (evalDay) have elapsed: Math.min(today, monthEnd)
  let cutoffDay = 0;
  if (isPastMonth) {
    cutoffDay = totalDaysInMonth;
  } else if (isCurrentMonth) {
    cutoffDay = Math.min(evalDay, totalDaysInMonth);
  } else {
    cutoffDay = 0;
  }

  let totalWorkingDaysInMonth = 0;
  let elapsedWorkingDays = 0;
  let futureWorkingDays = 0;
  const businessDays = [];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayDate = new Date(targetYear, targetMonthIndex, d);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = !isWorkingDay(dayDate); // rest day per the admin's working days

    if (!isWeekend) {
      totalWorkingDaysInMonth++;
      const isElapsed = isPastMonth ? true : (isCurrentMonth ? d <= cutoffDay : false);
      if (isElapsed) {
        elapsedWorkingDays++;
      } else {
        futureWorkingDays++;
      }

      const dateStr = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      businessDays.push({
        dayNumber: d,
        dateStr,
        date: dayDate,
        dayOfWeek,
        isWeekend: false,
        isElapsed,
        isFuture: !isElapsed,
      });
    }
  }

  const standardWorkingDays = totalWorkingDaysInMonth > 0 ? totalWorkingDaysInMonth : 22;

  return {
    year: targetYear,
    monthIndex: targetMonthIndex,
    monthString,
    totalDaysInMonth,
    startOfMonth,
    endOfMonth,
    startOfMonthUTC,
    endOfMonthUTC,
    totalWorkingDaysInMonth: standardWorkingDays,
    standardWorkingDays,
    elapsedWorkingDays,
    futureWorkingDays,
    cutoffDay,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    evaluationDate: safeEvalDate,
    businessDays,
  };
};

// Helper: Calculate working days in a month (excluding Sat/Sun)
export const getWorkingDaysInMonth = (year = 2026, monthIndex = 7) => {
  const boundaries = getMonthDateBoundaries(year, monthIndex);
  return boundaries.standardWorkingDays;
};

// Calculate monthly salary breakdown based on real attendance (deductions for absence & lateness tiers)
export const calculateMonthlyPayrollSummary = async (req, res) => {
  try {
    let { employeeId, month, year, baseSalaryInput } = req.query;

    // Security & Scope: Extract token from header or cookies if not decoded by middleware
    if (!req.employee && !req.admin) {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
      const token =
        req.cookies?.employeeToken ||
        req.cookies?.token ||
        bearerToken ||
        req.headers["x-employee-token"] ||
        req.headers["x-admin-token"];

      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key_12345";
      if (token) {
        try {
          const decoded = jwt.verify(token, jwtSecret);
          if (decoded) {
            if (decoded.role === "admin") {
              req.admin = decoded;
            } else {
              req.employee = {
                _id: decoded.id || decoded._id,
                id: decoded.id || decoded._id,
                employeeId: decoded.employeeId,
                role: decoded.role || "employee",
              };
            }
          }
        } catch (err) {
          // Token decode silent catch
        }
      }
    }

    // Security & Scope: If requested by standard employee, enforce that calculation targets only themselves
    if (req.employee && (!req.admin || req.admin.role === "employee")) {
      employeeId = req.employee.id || req.employee._id || req.employee.employeeId;
    }

    // Month & Year Parsing
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const now = new Date();
    let targetYear = parseInt(year, 10) || now.getFullYear();
    let targetMonthIndex = now.getMonth();
    let targetMonthName = monthNames[targetMonthIndex];

    if (month) {
      const raw = String(month).trim();
      const ymMatch = raw.match(/^(\d{4})-(\d{1,2})$/);
      if (ymMatch) {
        targetYear = parseInt(ymMatch[1], 10);
        const mVal = parseInt(ymMatch[2], 10);
        if (mVal >= 1 && mVal <= 12) {
          targetMonthIndex = mVal - 1;
          targetMonthName = monthNames[targetMonthIndex];
        }
      } else {
        const yearMatch = raw.match(/\b(20\d\d)\b/);
        if (yearMatch) {
          targetYear = parseInt(yearMatch[1], 10);
        }
        const foundIdx = monthNames.findIndex((m) =>
          raw.toLowerCase().includes(m.toLowerCase())
        );
        if (foundIdx !== -1) {
          targetMonthIndex = foundIdx;
          targetMonthName = monthNames[foundIdx];
        } else {
          const num = parseInt(raw, 10);
          if (!isNaN(num) && num >= 1 && num <= 12) {
            targetMonthIndex = num - 1;
            targetMonthName = monthNames[targetMonthIndex];
          }
        }
      }
    }

    const formattedTargetMonth = `${targetMonthName} ${targetYear}`;
    const boundaries = getMonthDateBoundaries(targetYear, targetMonthIndex);
    const standardWorkingDays = boundaries.standardWorkingDays;
    const {
      startOfMonth,
      endOfMonth,
      monthString,
      elapsedWorkingDays,
      futureWorkingDays,
      isCurrentMonth,
      isPastMonth,
      isFutureMonth,
      cutoffDay,
      businessDays,
    } = boundaries;

    // Fetch active CompanySettings for penalty rules
    let companySettings = {
      workStartTime: "08:00",
      absenceDeductionRate: 10,
      lateTier1_amount: 0,
      lateTier2_amount: 0,
      lateTier3_amount: 0,
      lateTier4_amount: 0,
      lateTier5_amount: 0,
      lateTier6_amount: 0,
    };

    const activeTenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    try {
      const dbSettings = activeTenantId
        ? (await CompanySettings.findById(activeTenantId).lean() || await CompanySettings.findOne({ $or: [{ organizationId: activeTenantId }, { companyId: activeTenantId }] }).lean())
        : null;
      if (dbSettings) {
        companySettings = { ...companySettings, ...dbSettings };
      }
    } catch (err) {
      console.warn("DB settings query in calculateMonthlyPayrollSummary fallback:", err.message);
    }

    let targetEmployee = null;
    const orgFilter = activeTenantId
      ? { $or: [{ organizationId: activeTenantId }, { companyId: activeTenantId }] }
      : {};

    if (employeeId && employeeId !== "all") {
      try {
        if (isValidObjectId(employeeId)) {
          targetEmployee = await Employee.findOne({ _id: employeeId, ...orgFilter }).lean();
        } else {
          targetEmployee = await Employee.findOne({
            $or: [{ employeeId }, { email: employeeId }],
            ...orgFilter,
          }).lean();
        }
      } catch (err) {
        console.warn("Could not query DB employee in calculateMonthlyPayrollSummary:", err.message);
      }
    }

    if (!targetEmployee && !employeeId) {
      targetEmployee = await Employee.findOne({ isActive: true, ...orgFilter }).lean();
    }

    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "No active employee found to calculate payroll summary.",
      });
    }

    const isTargetValidObjId = isValidObjectId(targetEmployee._id);

    // Check for existing saved Payroll record for this employee and month (MongoDB & memory store)
    let existingPayroll = null;
    if (isTargetValidObjId) {
      try {
        existingPayroll = await Payroll.findOne({
          employee: targetEmployee._id,
          $or: [
            { payMonth: formattedTargetMonth },
            { payMonth: { $regex: new RegExp(`^${targetMonthName}\\s*${targetYear}`, "i") } },
            { payMonth: { $regex: new RegExp(targetMonthName, "i") } },
          ],
        }).lean();
      } catch (err) {
        console.warn("Error querying existing payroll record:", err.message);
      }
    }

    if (!existingPayroll) {
      existingPayroll = livePayrollStore.find(
        (p) =>
          String(p.employee) === String(targetEmployee._id) &&
          (p.payMonth === formattedTargetMonth ||
            (p.payMonth && p.payMonth.toLowerCase().includes(targetMonthName.toLowerCase())))
      );
    }

    // Dynamic Base Monthly Salary: Bind directly to baseSalary from DB record or employee
    const baseSalary = existingPayroll?.baseSalary ??
      existingPayroll?.basicSalary ??
      (parseFloat(baseSalaryInput) ||
        (targetEmployee.baseSalary !== undefined && targetEmployee.baseSalary !== null
          ? Number(targetEmployee.baseSalary)
          : targetEmployee.salary !== undefined && targetEmployee.salary !== null
          ? Number(targetEmployee.salary)
          : 4000));

    // Dynamic Daily Salary Rate = Employee Base Salary / Total Working Days in Month (Rule 3)
    const dailySalaryRate = standardWorkingDays > 0 ? parseFloat((baseSalary / standardWorkingDays).toFixed(2)) : 0;
    const dailyRate = dailySalaryRate;
    const hourlyRate = parseFloat((dailySalaryRate / 8).toFixed(2));
    const absenceRate = dailySalaryRate;

    // 1. Gather Attendance Records strictly for the selected billing month (Rule 2: Strict Monthly Isolation)
    let attendanceRecords = [];
    if (isTargetValidObjId) {
      try {
        const dbAttendance = await Attendance.find({
          employee: targetEmployee._id,
          $or: [
            { date: { $regex: `^${monthString}` } },
            { date: { $gte: startOfMonth, $lte: endOfMonth } },
            { clockIn: { $gte: startOfMonth, $lte: endOfMonth } },
            { clockInTime: { $gte: startOfMonth, $lte: endOfMonth } },
          ],
        }).lean();

        if (dbAttendance && dbAttendance.length > 0) {
          attendanceRecords = dbAttendance;
        }
      } catch (err) {
        console.warn("DB attendance query for payroll calculation:", err.message);
      }
    }

    // Add active live clock-ins from memory strictly for this target month
    liveAttendanceStore.forEach((liveAtt) => {
      if (String(liveAtt.employee) === String(targetEmployee._id)) {
        if (liveAtt.date && String(liveAtt.date).startsWith(monthString)) {
          if (!attendanceRecords.some((a) => a.date === liveAtt.date)) {
            attendanceRecords.push(liveAtt);
          }
        }
      }
    });

    // Filter attendance records strictly to target month and year
    const filteredAttendance = attendanceRecords.filter((rec) => {
      if (!rec) return false;
      if (typeof rec.date === "string") {
        if (rec.date.startsWith(monthString)) return true;
        if (
          rec.date.toLowerCase().includes(targetMonthName.toLowerCase()) &&
          rec.date.includes(String(targetYear))
        ) {
          return true;
        }
      }
      const d = new Date(rec.date || rec.clockIn);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex;
      }
      return false;
    });

    // 2. Gather Approved Leave Requests strictly overlapping target month (Rule 2)
    let approvedLeaves = [];
    if (isTargetValidObjId) {
      try {
        const dbLeaves = await Leave.find({
          employee: targetEmployee._id,
          status: "Approved",
          $or: [
            { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
            { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
          ],
        }).lean();

        if (dbLeaves && dbLeaves.length > 0) {
          approvedLeaves = dbLeaves;
        }
      } catch (err) {
        console.warn("DB leave query for payroll calculation:", err.message);
      }
    }

    if (Array.isArray(liveLeaveStore) && liveLeaveStore.length > 0) {
      liveLeaveStore.forEach((liveL) => {
        if (
          (String(liveL.employee?._id || liveL.employee) === String(targetEmployee._id) ||
            liveL.employeeId === targetEmployee.employeeId) &&
          liveL.status === "Approved"
        ) {
          if (!approvedLeaves.some((r) => String(r._id) === String(liveL._id))) {
            approvedLeaves.push(liveL);
          }
        }
      });
    }

    let approvedPaidLeaveDays = 0;
    let approvedUnpaidLeaveDays = 0;
    const approvedLeavesList = [];

    approvedLeaves.forEach((leave) => {
      const lStart = new Date(leave.startDate);
      const lEnd = new Date(leave.endDate || leave.startDate);
      if (isNaN(lStart.getTime())) return;

      const effectiveStart = lStart < startOfMonth ? startOfMonth : lStart;
      const effectiveEnd = lEnd > endOfMonth ? endOfMonth : lEnd;

      if (effectiveStart <= effectiveEnd) {
        let daysInMonth = 0;
        const cur = new Date(effectiveStart);
        while (cur <= effectiveEnd) {
          if (isWorkingDay(cur)) {
            daysInMonth++;
          }
          cur.setDate(cur.getDate() + 1);
        }

        if (daysInMonth > 0) {
          if ((leave.leaveType || "").toLowerCase().includes("unpaid")) {
            approvedUnpaidLeaveDays += daysInMonth;
          } else {
            approvedPaidLeaveDays += daysInMonth;
          }

          approvedLeavesList.push({
            _id: leave._id,
            leaveType: leave.leaveType,
            totalDays: daysInMonth,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason || "",
          });
        }
      }
    });

    // 3. Perform Day-by-Day Audit across all business days
    // Rule 1: Future / Unelapsed days are NEVER counted as absent or penalized!
    // Absences are strictly evaluated against elapsed working days up to cutoffDay.
    let attendedDays = 0;
    let explicitAbsentDays = 0;
    let lateDays = 0;
    let onTimeDays = 0;
    let totalWorkHours = 0;
    let overtimeHours = 0;
    let totalLatenessDeductions = 0;
    let elapsedUnexcusedAbsentDays = 0;
    const latenessDetails = [];
    const dailyAuditList = [];

    businessDays.forEach((bDay) => {
      const { dateStr, dayNumber, isElapsed, dayOfWeek } = bDay;

      // Check if covered by approved leave
      const matchedLeave = approvedLeaves.find((leave) => {
        const s = new Date(leave.startDate);
        const e = new Date(leave.endDate || leave.startDate);
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        const d = new Date(bDay.date);
        d.setHours(12, 0, 0, 0);
        return d >= s && d <= e;
      });

      // Check attendance record for this day
      const attRecord = filteredAttendance.find((a) => {
        if (typeof a.date === "string" && a.date.startsWith(dateStr)) return true;
        const ad = new Date(a.date || a.clockIn);
        return !isNaN(ad.getTime()) && ad.getDate() === dayNumber && ad.getMonth() === targetMonthIndex && ad.getFullYear() === targetYear;
      });

      const isExplicitAbsent = attRecord && (attRecord.status || "").toLowerCase() === "absent";
      const hasClockIn = attRecord && (attRecord.clockIn || attRecord.clockInTime || (attRecord.status && !isExplicitAbsent));

      // RULE 1: Future / unelapsed days are strictly excluded from absences!
      if (!isElapsed) {
        dailyAuditList.push({
          date: dateStr,
          dayNumber,
          dayOfWeek,
          status: "Unelapsed / Future",
          isElapsed: false,
          isFuture: true,
          isAttended: false,
          isAbsent: false,
          penalty: 0,
          reason: "Future day - strictly excluded from absences",
        });
        return;
      }

      // ELAPSED WORKDAY EVALUATION:
      if (matchedLeave) {
        dailyAuditList.push({
          date: dateStr,
          dayNumber,
          dayOfWeek,
          status: "Approved Leave",
          isElapsed: true,
          isFuture: false,
          isAttended: false,
          isAbsent: false,
          penalty: 0,
          reason: `Covered by approved leave: ${matchedLeave.leaveType}`,
        });
      } else if (hasClockIn && !isExplicitAbsent) {
        attendedDays++;
        const hrs = Number(attRecord.workHours) || 8;
        totalWorkHours += hrs;
        if (attRecord.overtimeHours) {
          overtimeHours += Number(attRecord.overtimeHours);
        } else if (hrs > 8) {
          overtimeHours += hrs - 8;
        }

        const checkInTimeValue = attRecord.clockIn || attRecord.clockInTime;
        let penaltyResult = null;
        if (checkInTimeValue) {
          penaltyResult = evaluateLatenessPenalty(checkInTimeValue, companySettings.workStartTime, companySettings);
        }

        const st = (attRecord.status || "").toLowerCase();
        const isLate =
          st === "late" ||
          Number(attRecord.lateMinutes || attRecord.delayMinutes || 0) > 0 ||
          Number(attRecord.latePenalty || 0) > 0 ||
          (penaltyResult && penaltyResult.isLate);

        if (isLate) {
          lateDays++;
          let penaltyAmount = 0;
          let minutesLate = 0;
          let tierName = "";
          let clockInFormatted = "--";

          if (attRecord.latePenalty !== undefined && attRecord.latePenalty !== null && attRecord.latePenalty !== "" && !isNaN(Number(attRecord.latePenalty))) {
            penaltyAmount = Math.max(0, Number(attRecord.latePenalty));
            minutesLate = Number(attRecord.lateMinutes || attRecord.delayMinutes || (penaltyResult ? penaltyResult.minutesLate : 0));
            tierName = attRecord.penaltyTier || (penaltyResult ? penaltyResult.tier : "Late Penalty");
            clockInFormatted = penaltyResult?.clockInFormatted || (checkInTimeValue ? new Date(checkInTimeValue).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "Late");
          } else if (penaltyResult && penaltyResult.isLate) {
            penaltyAmount = penaltyResult.penalty;
            minutesLate = penaltyResult.minutesLate;
            tierName = penaltyResult.tier;
            clockInFormatted = penaltyResult.clockInFormatted;
          } else {
            const fallbackCalc = calculateLatenessPenalty(attRecord.lateMinutes || attRecord.delayMinutes || 15, companySettings);
            penaltyAmount = fallbackCalc.penalty;
            minutesLate = fallbackCalc.minutesLate;
            tierName = fallbackCalc.tier;
            clockInFormatted = checkInTimeValue ? new Date(checkInTimeValue).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "Late";
          }

          totalLatenessDeductions += penaltyAmount;
          latenessDetails.push({
            date: dateStr,
            clockIn: clockInFormatted,
            minutesLate,
            delayMinutes: minutesLate,
            tier: tierName,
            penalty: penaltyAmount,
            latePenalty: penaltyAmount,
          });

          dailyAuditList.push({
            date: dateStr,
            dayNumber,
            dayOfWeek,
            status: "Late",
            isElapsed: true,
            isFuture: false,
            isAttended: true,
            isAbsent: false,
            lateMinutes: minutesLate,
            tier: tierName,
            penalty: penaltyAmount,
            reason: `Late clock-in (${minutesLate} mins delay)`,
          });
        } else {
          onTimeDays++;
          dailyAuditList.push({
            date: dateStr,
            dayNumber,
            dayOfWeek,
            status: "On Time",
            isElapsed: true,
            isFuture: false,
            isAttended: true,
            isAbsent: false,
            penalty: 0,
            reason: "Clocked in on time",
          });
        }
      } else {
        // Unworked elapsed workday without approved leave -> Realized Unexcused Absence
        elapsedUnexcusedAbsentDays++;
        if (isExplicitAbsent) explicitAbsentDays++;
        dailyAuditList.push({
          date: dateStr,
          dayNumber,
          dayOfWeek,
          status: "Unexcused Absent",
          isElapsed: true,
          isFuture: false,
          isAttended: false,
          isAbsent: true,
          penalty: dailySalaryRate,
          reason: "Unexcused absence on elapsed workday",
        });
      }
    });

    let presentDays = attendedDays;
    let absentDaysCount = elapsedUnexcusedAbsentDays;
    let unexcusedAbsences = elapsedUnexcusedAbsentDays;
    let payableDays = Math.min(standardWorkingDays, attendedDays + approvedPaidLeaveDays);

    // Call Unified Single Source of Truth Calculation Engine with dynamic base salary
    try {
      const engineResult = await calculateMonthlyPenalties(
        targetEmployee._id || targetEmployee.employeeId || employeeId,
        targetYear,
        targetMonthIndex,
        { baseSalaryInput: baseSalary }
      );

      if (engineResult) {
        if (engineResult.attendedDays !== undefined && engineResult.attendedDays > attendedDays) {
          attendedDays = engineResult.attendedDays;
          presentDays = engineResult.attendedDays;
        }
        if (engineResult.lateCount !== undefined && engineResult.lateCount > lateDays) {
          lateDays = engineResult.lateCount;
        }
        if (engineResult.totalLatePenalties !== undefined && engineResult.totalLatePenalties > totalLatenessDeductions) {
          totalLatenessDeductions = engineResult.totalLatePenalties;
        }
        if (engineResult.absentDays !== undefined) {
          absentDaysCount = engineResult.absentDays;
          unexcusedAbsences = engineResult.absentDays;
        }
      }
    } catch (engineErr) {
      console.warn("calculateMonthlyPenalties warning in payrollController:", engineErr.message);
    }

    // 4. Dynamic Allowances (from MongoDB payroll record or empty)
    let dynamicAllowances = [];
    if (existingPayroll) {
      if (Array.isArray(existingPayroll.earnings) && existingPayroll.earnings.length > 0) {
        dynamicAllowances = existingPayroll.earnings.map((e) => ({
          title: e.title || e.description || e.name || "Allowance",
          description: e.description || e.title || "Custom Allowance",
          amount: Number(e.amount) || 0,
        }));
      } else if (Array.isArray(existingPayroll.allowances) && existingPayroll.allowances.length > 0) {
        dynamicAllowances = existingPayroll.allowances.map((e) => ({
          title: e.title || e.description || e.name || "Allowance",
          description: e.description || e.title || "Custom Allowance",
          amount: Number(e.amount) || 0,
        }));
      } else if (typeof existingPayroll.allowances === "number" && existingPayroll.allowances > 0) {
        dynamicAllowances = [{
          title: "Allowance",
          description: "Monthly Allowance",
          amount: Number(existingPayroll.allowances),
        }];
      }
    }

    const totalAllowances = dynamicAllowances.reduce((acc, item) => acc + Number(item.amount || 0), 0);

    // 5. Dynamic Custom Deductions (from MongoDB payroll record or empty)
    let dynamicCustomDeductions = [];
    if (existingPayroll) {
      if (Array.isArray(existingPayroll.deductions) && existingPayroll.deductions.length > 0) {
        dynamicCustomDeductions = existingPayroll.deductions.map((d) => ({
          title: d.title || d.description || d.name || "Deduction",
          description: d.description || d.title || "Custom Deduction",
          amount: Number(d.amount) || 0,
        }));
      } else if (typeof existingPayroll.deductions === "number" && existingPayroll.deductions > 0) {
        dynamicCustomDeductions = [{
          title: "Deduction",
          description: "Admin Adjustment",
          amount: Number(existingPayroll.deductions),
        }];
      }
    }

    const totalCustomDeductions = dynamicCustomDeductions.reduce((acc, item) => acc + Number(item.amount || 0), 0);

    // 6. Deductions Itemization: Dynamic Absenteeism (absentDays * dailySalaryRate), Lateness Tiers & Custom Deductions
    const computedBreakdown = computeNetSalary({
      baseSalary,
      allowances: totalAllowances,
      absentDays: absentDaysCount,
      dailyAbsenceRate: dailySalaryRate,
      standardWorkingDays,
      latenessFines: totalLatenessDeductions,
      otherDeductions: totalCustomDeductions,
    });

    const absentDaysDeduction = computedBreakdown.absenceDeductions;
    const latenessDeductions = computedBreakdown.latenessPenalties;
    const totalAttendanceDeductions = parseFloat((absentDaysDeduction + latenessDeductions).toFixed(2));
    const totalDeductions = computedBreakdown.totalDeductions;
    const grossEarnings = parseFloat((baseSalary + totalAllowances).toFixed(2));
    const netCalculatedSalary = computedBreakdown.netSalary;

    const summary = {
      month: formattedTargetMonth,
      year: targetYear,
      employee: {
        _id: targetEmployee._id,
        id: targetEmployee._id,
        fullName: targetEmployee.fullName || `${targetEmployee.firstName || ""} ${targetEmployee.lastName || ""}`.trim() || "Employee",
        employeeId: targetEmployee.employeeId || "EMP",
        department: targetEmployee.department || "General",
        position: targetEmployee.position || "Staff",
        baseSalary,
        salary: baseSalary,
      },
      workingDaysMetric: {
        standardWorkingDays,
        totalWorkingDaysInMonth: standardWorkingDays,
        elapsedWorkingDays,
        futureWorkingDays,
        cutoffDay,
        isCurrentMonth,
        isPastMonth,
        isFutureMonth,
        presentDays: attendedDays,
        attendedDays,
        onTimeDays,
        lateDays,
        absentDays: absentDaysCount,
        unexcusedAbsences: absentDaysCount,
        elapsedUnexcusedAbsentDays: absentDaysCount,
        totalWorkHours,
        overtimeHours: parseFloat(overtimeHours.toFixed(1)),
        approvedPaidLeaveDays,
        approvedUnpaidLeaveDays,
        payableDays,
        dailySalaryRate,
        dailyRate: dailySalaryRate,
        hourlyRate,
      },
      calendar: {
        totalDaysInMonth: boundaries.totalDaysInMonth,
        totalWorkingDaysInMonth: standardWorkingDays,
        standardWorkingDays,
        elapsedWorkingDays,
        futureWorkingDays,
        cutoffDay,
        isCurrentMonth,
        isPastMonth,
        isFutureMonth,
      },
      dailyAudit: dailyAuditList,
      rates: {
        monthlyBaseSalary: baseSalary,
        dailySalaryRate,
        dailyRate: dailySalaryRate,
        hourlyRate,
        standardWorkingDays,
        absenceDeductionRate: dailySalaryRate,
        workStartTime: companySettings.workStartTime,
        lateTier1_amount: companySettings.lateTier1_amount,
        lateTier2_amount: companySettings.lateTier2_amount,
        lateTier3_amount: companySettings.lateTier3_amount,
        lateTier4_amount: companySettings.lateTier4_amount,
        lateTier5_amount: companySettings.lateTier5_amount,
        lateTier6_amount: companySettings.lateTier6_amount,
      },
      earnings: dynamicAllowances,
      customDeductions: dynamicCustomDeductions,
      latenessBreakdown: latenessDetails,
      approvedLeavesList,
      salaryCalculation: {
        baseSalary,
        basicSalary: baseSalary,
        earnedBaseSalary: baseSalary,
        standardWorkingDays,
        dailySalaryRate,
        dailyRate: dailySalaryRate,
        hourlyRate,
        grossEarnings,
        totalAllowances,
        absentDays: absentDaysCount,
        absenceDeductionRate: dailySalaryRate,
        absentDaysDeduction,
        absenceDeductions: absentDaysDeduction,
        lateDays,
        latenessDeductions,
        latenessPenalties: latenessDeductions,
        latenessPenalty: latenessDeductions,
        totalAttendanceDeductions,
        totalCustomDeductions,
        totalDeductions,
        netCalculatedSalary,
        netPay: netCalculatedSalary,
        netSalary: netCalculatedSalary,
        liveNetPay: netCalculatedSalary,
        deductions: {
          absenceDeduction: absentDaysDeduction,
          absenceDeductions: absentDaysDeduction,
          latenessDeduction: latenessDeductions,
          latenessPenalties: latenessDeductions,
          customDeductions: totalCustomDeductions,
          total: totalDeductions,
        },
      },
      dailySalaryRate,
      dailyRate: dailySalaryRate,
      standardWorkingDays,
      absenceDeductionRate: dailySalaryRate,
      absenceDeductions: absentDaysDeduction,
      absentDaysDeduction,
      absentDaysCount,
      absenceDeductionDetails: {
        daysCount: absentDaysCount,
        ratePerDay: dailySalaryRate,
        standardWorkingDays,
        totalAmount: absentDaysDeduction,
        formula: `${absentDaysCount} days × GH₵${dailySalaryRate.toFixed(2)} = -GH₵${absentDaysDeduction.toFixed(2)}`,
      },
      latenessPenalties: latenessDeductions,
      latenessDeductions,
      netPay: netCalculatedSalary,
      netSalary: netCalculatedSalary,
      liveNetPay: netCalculatedSalary,
      payrollRecord: existingPayroll || null,
      formulaExplanation: {
        baseSalaryFormula: `Base Monthly Salary: GH₵${baseSalary.toFixed(2)}`,
        dailyRateFormula: `Daily Rate = GH₵${baseSalary.toFixed(2)} ÷ ${standardWorkingDays} Working Days = GH₵${dailySalaryRate.toFixed(2)}/day`,
        absentDaysFormula: `Absenteeism Deduction: ${absentDaysCount} absent day(s) × GH₵${dailySalaryRate.toFixed(2)}/day = GH₵${absentDaysDeduction.toFixed(2)}`,
        latenessFormula: `Lateness Penalties: ${lateDays} late clock-in(s) evaluated by tier = GH₵${latenessDeductions.toFixed(2)}`,
        netSalaryFormula: `Net Take-Home = Base Salary (GH₵${baseSalary.toFixed(2)}) + Allowances (GH₵${totalAllowances.toFixed(2)}) - Total Deductions (GH₵${totalDeductions.toFixed(2)}) = GH₵${netCalculatedSalary.toFixed(2)}`,
      },
    };

    return res.status(200).json({
      success: true,
      baseSalary,
      basicSalary: baseSalary,
      standardWorkingDays,
      dailySalaryRate,
      dailyRate: dailySalaryRate,
      allowances: totalAllowances,
      absentDays: absentDaysCount,
      absenceDeductions: absentDaysDeduction,
      absentDaysDeduction,
      absenceDeductionDetails: {
        daysCount: absentDaysCount,
        ratePerDay: dailySalaryRate,
        standardWorkingDays,
        totalAmount: absentDaysDeduction,
        formula: `${absentDaysCount} days × GH₵${dailySalaryRate.toFixed(2)} = -GH₵${absentDaysDeduction.toFixed(2)}`,
      },
      lateDays,
      latenessPenalties: latenessDeductions,
      latenessDeductions,
      totalDeductions,
      netSalary: netCalculatedSalary,
      netPay: netCalculatedSalary,
      remarks: `Calculated from ${attendedDays} attended days, ${absentDaysCount} absent days, and ${lateDays} late check-in(s) for ${formattedTargetMonth}.`,
      summary,
    });
  } catch (error) {
    console.error("Error in calculateMonthlyPayrollSummary:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate payroll summary."),
    });
  }
};

export const generatePayroll = async (req, res) => {
  try {
    const {
      employee,
      payMonth,
      paymentDate,
      basicSalary,
      baseSalary: customBaseSalary,
      allowances,
      deductions,
      earnings,
      absentDaysDeduction,
      latenessDeduction,
      latenessPenalties,
      originalAbsenceDeduction,
      originalLatenessDeduction,
      penaltyOverride,
      paymentMethod,
      remarks,
    } = req.body;

    const finalBaseSalary = Number(customBaseSalary !== undefined ? customBaseSalary : basicSalary);

    if (
      !employee ||
      !payMonth ||
      !paymentDate ||
      finalBaseSalary === undefined ||
      isNaN(finalBaseSalary) ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields are required (employee, payMonth, paymentDate, baseSalary, paymentMethod).",
      });
    }

    // Process dynamic earnings array [{ description: String, amount: Number }]
    let parsedEarnings = [];
    if (Array.isArray(earnings)) {
      parsedEarnings = earnings
        .filter((e) => e && (e.description || e.name || e.label))
        .map((e) => ({
          description: e.description || e.name || e.label || "Allowance",
          amount: Number(e.amount || 0),
        }));
    } else if (Number(allowances || 0) > 0) {
      parsedEarnings = [
        {
          description: "Allowances & Bonuses",
          amount: Number(allowances),
        },
      ];
    }

    // Process dynamic deductions array [{ description: String, amount: Number }]
    let parsedDeductions = [];
    if (Array.isArray(deductions)) {
      parsedDeductions = deductions
        .filter((d) => d && (d.description || d.name || d.label))
        .map((d) => ({
          description: d.description || d.name || d.label || "Deduction",
          amount: Number(d.amount || 0),
        }));
    } else if (typeof deductions === "number" && Number(deductions) > 0) {
      parsedDeductions = [
        {
          description: "Standard Deductions",
          amount: Number(deductions),
        },
      ];
    }

    const totalCustomEarnings = parsedEarnings.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalCustomDeductions = parsedDeductions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    
    // Evaluate penalty overrides & waivers if provided
    const origAbsence = Number(originalAbsenceDeduction !== undefined ? originalAbsenceDeduction : (absentDaysDeduction || 0));
    const origLateness = Number(originalLatenessDeduction !== undefined ? originalLatenessDeduction : (latenessDeduction !== undefined ? latenessDeduction : (latenessPenalties || 0)));
    
    let finalAbsentDeduction = Number(absentDaysDeduction || 0);
    let finalLatenessDeduction = Number(latenessDeduction !== undefined ? latenessDeduction : (latenessPenalties || 0));
    let penaltyOverrideData = null;

    if (penaltyOverride && penaltyOverride.isWaived) {
      const waivedAbsence = Math.max(0, Number(penaltyOverride.waivedAbsenceDeduction || 0));
      const waivedLateness = Math.max(0, Number(penaltyOverride.waivedLatenessDeduction || 0));
      const totalWaived = Number(penaltyOverride.totalWaived || (waivedAbsence + waivedLateness));
      
      finalAbsentDeduction = Math.max(0, origAbsence - waivedAbsence);
      finalLatenessDeduction = Math.max(0, origLateness - waivedLateness);

      penaltyOverrideData = {
        isWaived: true,
        waivedAbsenceDeduction: waivedAbsence,
        waivedLatenessDeduction: waivedLateness,
        totalWaived,
        reason: penaltyOverride.reason || "Manual penalty waiver approved by Administrator.",
        waivedBy: req.admin?.fullName || req.admin?.full_name || "Administrator",
        waivedAt: new Date(),
      };
    }

    const totalAttendanceDeductions = finalAbsentDeduction + finalLatenessDeduction;

    // Determine target month and year for working days and dynamic daily rate
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonthIndex = now.getMonth();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    if (payMonth) {
      const rawMonth = String(payMonth).trim();
      const ymMatch = rawMonth.match(/^(\d{4})-(\d{1,2})$/);
      if (ymMatch) {
        targetYear = parseInt(ymMatch[1], 10);
        const mVal = parseInt(ymMatch[2], 10);
        if (mVal >= 1 && mVal <= 12) {
          targetMonthIndex = mVal - 1;
        }
      } else {
        const yMatch = rawMonth.match(/\b(20\d\d)\b/);
        if (yMatch) targetYear = parseInt(yMatch[1], 10);
        const mIdx = monthNames.findIndex((m) => rawMonth.toLowerCase().includes(m.toLowerCase()));
        if (mIdx !== -1) targetMonthIndex = mIdx;
      }
    }

    const boundaries = getMonthDateBoundaries(targetYear, targetMonthIndex);
    const standardWorkingDays = Number(req.body.standardWorkingDays) || boundaries.standardWorkingDays;
    const dailySalaryRate = Number(req.body.dailySalaryRate) || (standardWorkingDays > 0 ? parseFloat((finalBaseSalary / standardWorkingDays).toFixed(2)) : 0);

    const resolvedAbsentDays = req.body.absentDays !== undefined && !isNaN(Number(req.body.absentDays))
      ? Number(req.body.absentDays)
      : (origAbsence > 0 && dailySalaryRate > 0 ? Math.round(origAbsence / dailySalaryRate) : 0);

    const computedPayroll = computeNetSalary({
      baseSalary: finalBaseSalary,
      allowances: totalCustomEarnings,
      absentDays: resolvedAbsentDays,
      dailyAbsenceRate: dailySalaryRate,
      standardWorkingDays,
      latenessFines: finalLatenessDeduction,
      otherDeductions: totalCustomDeductions,
    });

    const calculatedNetPay = penaltyOverrideData?.isWaived
      ? Math.max(
          0,
          parseFloat((finalBaseSalary + totalCustomEarnings - totalCustomDeductions - totalAttendanceDeductions).toFixed(2))
        )
      : computedPayroll.netSalary;

    const payslipNumber = `PAY-${Date.now()}`;

    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.admin?.organizationId || req.admin?.companyId;
    const orgScope = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    let empDoc = null;
    if (isValidObjectId(employee)) {
      try {
        empDoc = await Employee.findOne({ _id: employee, ...orgScope })
          .select("employeeId fullName email department position bankName accountNumber organizationId companyId")
          .lean();
      } catch (err) {
        console.warn("Could not find employee for payroll generation:", err.message);
      }
    } else if (employee) {
      try {
        empDoc = await Employee.findOne({
          $or: [{ employeeId: employee }, { email: employee }],
          ...orgScope,
        }).select("employeeId fullName email department position bankName accountNumber organizationId companyId").lean();
      } catch (err) {
        console.warn("Could not find employee by identifier for payroll generation:", err.message);
      }
    }

    if (!empDoc) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found in database or access denied.",
      });
    }

    validateOrganizationAccess(empDoc, req);

    const finalStatus = req.body.status || "Published";

    const absenceDeductionDetails = {
      daysCount: resolvedAbsentDays,
      ratePerDay: dailySalaryRate,
      standardWorkingDays,
      totalAmount: finalAbsentDeduction,
      formula: `${resolvedAbsentDays} days × GH₵${dailySalaryRate.toFixed(2)} = -GH₵${finalAbsentDeduction.toFixed(2)}`,
    };
    const latenessDeductionDetails = {
      totalLateMinutes: 0,
      lateDaysCount: finalLatenessDeduction > 0 ? 1 : 0,
      tierBreakdown: [],
      totalAmount: finalLatenessDeduction,
    };
    const breakdownSnapshot = {
      baseSalary: finalBaseSalary,
      standardWorkingDays,
      dailySalaryRate,
      dailyRate: dailySalaryRate,
      grossEarnings: finalBaseSalary + totalCustomEarnings,
      allowances: parsedEarnings,
      absenceDeduction: absenceDeductionDetails,
      latenessDeduction: latenessDeductionDetails,
      customDeductions: parsedDeductions,
      totalAttendanceDeductions,
      totalDeductions: totalCustomDeductions + totalAttendanceDeductions,
      netSalary: calculatedNetPay,
    };

    const newRecord = {
      _id: "pay_" + Date.now(),
      id: payslipNumber,
      payslipNumber,
      employee: empDoc,
      employeeId: empDoc.employeeId || "",
      employeeName: empDoc.fullName || "Staff Member",
      department: empDoc.department || "Operations",
      position: empDoc.position || "Staff Member",
      payMonth,
      month: payMonth,
      paymentDate,
      basicSalary: finalBaseSalary,
      baseSalary: finalBaseSalary,
      standardWorkingDays,
      dailySalaryRate,
      dailyRate: dailySalaryRate,
      absentDays: resolvedAbsentDays,
      earnings: parsedEarnings,
      deductions: parsedDeductions,
      absentDaysDeduction: finalAbsentDeduction,
      latenessDeduction: finalLatenessDeduction,
      totalAttendanceDeductions,
      originalAbsenceDeduction: origAbsence,
      originalLatenessDeduction: origLateness,
      penaltyOverride: penaltyOverrideData,
      absenceDeductionDetails,
      latenessDeductionDetails,
      breakdown: breakdownSnapshot,
      allowances: totalCustomEarnings,
      netSalary: calculatedNetPay,
      netPay: calculatedNetPay,
      paymentMethod,
      remarks: remarks || (penaltyOverrideData?.isWaived ? `Waived GH₵${penaltyOverrideData.totalWaived} penalties. Note: ${penaltyOverrideData.reason}` : "Generated monthly salary disbursement."),
      status: finalStatus,
      createdAt: new Date().toISOString(),
    };

    // If valid MongoDB connection, save or update in MongoDB
    if (isValidObjectId(empDoc._id)) {
      try {
        const targetOrgId = req.organizationId || empDoc?.organizationId || empDoc?.companyId || null;
        const payroll = await Payroll.findOneAndUpdate(
          { employee: empDoc._id, payMonth, ...(targetOrgId ? { $or: [{ organizationId: targetOrgId }, { companyId: targetOrgId }] } : {}) },
          {
            employee: empDoc._id,
            payslipNumber,
            payMonth,
            paymentDate,
            ...(targetOrgId ? { organizationId: targetOrgId, companyId: targetOrgId } : {}),
            basicSalary: finalBaseSalary,
            baseSalary: finalBaseSalary,
            standardWorkingDays,
            dailySalaryRate,
            earnings: parsedEarnings,
            deductions: parsedDeductions,
            absentDaysDeduction: finalAbsentDeduction,
            latenessDeduction: finalLatenessDeduction,
            totalAttendanceDeductions,
            originalAbsenceDeduction: origAbsence,
            originalLatenessDeduction: origLateness,
            penaltyOverride: penaltyOverrideData,
            absenceDeductionDetails,
            latenessDeductionDetails,
            breakdown: breakdownSnapshot,
            allowances: totalCustomEarnings,
            netSalary: calculatedNetPay,
            netPay: calculatedNetPay,
            paymentMethod,
            remarks: newRecord.remarks,
            status: finalStatus,
          },
          { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
        ).populate("employee", "employeeId fullName email department position");

        newRecord._id = payroll._id;

        // Automated multi-tenant payslip distribution: link directly to target employee User account in workspace
        try {
          let targetUserId = null;
          if (empDoc.email) {
            const userMatch = await User.findOne({ email: empDoc.email.toLowerCase() }).select("_id").lean();
            if (userMatch) targetUserId = userMatch._id;
          }
          if (!targetUserId && isValidObjectId(empDoc._id)) {
            targetUserId = empDoc._id;
          }

          let periodMonth = "September";
          let periodYear = new Date().getFullYear();
          if (payMonth) {
            const parts = String(payMonth).trim().split("-");
            if (parts.length === 2) {
              const pYear = parseInt(parts[0], 10);
              const pMonth = parseInt(parts[1], 10) - 1;
              if (!isNaN(pYear)) periodYear = pYear;
              const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ];
              if (!isNaN(pMonth) && pMonth >= 0 && pMonth <= 11) {
                periodMonth = months[pMonth];
              }
            } else {
              const yearMatch = String(payMonth).match(/\b(20\d\d)\b/);
              if (yearMatch) periodYear = parseInt(yearMatch[1], 10);
              const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ];
              const found = months.find((m) => String(payMonth).toLowerCase().includes(m.toLowerCase()));
              if (found) periodMonth = found;
            }
          }

          const otherDeductions = (Number(finalAbsentDeduction) || 0) + (parsedDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0));
          const effectiveTax = parsedDeductions.find((d) => (d.name || d.title || "").toLowerCase().includes("tax"))?.amount || 0;
          const payslipOrgId = targetOrgId || req.organizationId || empDoc.organizationId || empDoc.companyId;

          if (targetUserId && payslipOrgId) {
            await Payslip.findOneAndUpdate(
              {
                $or: [{ organizationId: payslipOrgId }, { companyId: payslipOrgId }],
                employeeId: targetUserId,
                "payrollPeriod.month": periodMonth,
                "payrollPeriod.year": periodYear,
              },
              {
                $set: {
                  organizationId: payslipOrgId,
                  companyId: payslipOrgId,
                  employeeId: targetUserId,
                  payrollPeriod: {
                    month: periodMonth,
                    year: periodYear,
                  },
                  baseSalary: finalBaseSalary,
                  allowances: totalCustomEarnings || 0,
                  deductions: {
                    latenessDeductions: finalLatenessDeduction || 0,
                    tax: effectiveTax || 0,
                    other: otherDeductions || 0,
                  },
                  netPay: calculatedNetPay,
                  status: finalStatus === "Draft" ? "Draft" : finalStatus === "Paid" ? "Paid" : "Published",
                  generatedBy: req.admin?.id || req.admin?._id || req.user?._id || null,
                  generatedAt: new Date(),
                },
              },
              { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
            );
          }
        } catch (payslipErr) {
          console.warn("Automated Payslip distribution record creation error:", payslipErr.message);
        }
      } catch (dbErr) {
        console.warn("DB storage in generatePayroll:", dbErr.message);
      }
    }

    // Remove any existing in-memory entry for this employee and payMonth
    const existingIndex = livePayrollStore.findIndex((p) => {
      const pEmpId = String(p.employee?._id || p.employee || p.employeeId || "");
      const targetEmpId = String(empDoc._id || empDoc.employeeId || "");
      return (pEmpId === targetEmpId || p.employeeId === empDoc.employeeId) && (p.payMonth === payMonth || p.month === payMonth);
    });
    if (existingIndex !== -1) {
      livePayrollStore.splice(existingIndex, 1);
    }
    livePayrollStore.unshift(newRecord);

    // Write audit log if penalties were waived or overridden
    if (penaltyOverrideData?.isWaived) {
      try {
        await AuditLog.create({
          action: "WAIVE_ATTENDANCE_PENALTY",
          category: "Payroll",
          performedBy: {
            id: String(req.admin?.id || req.admin?._id || "admin_01"),
            name: req.admin?.fullName || req.admin?.full_name || "Administrator",
            email: req.admin?.email || "admin@eyenit.com",
            role: req.admin?.role || "admin",
          },
          target: `${empDoc.fullName} (${empDoc.employeeId})`,
          summary: `Waived GH₵${penaltyOverrideData.totalWaived} attendance deductions for ${empDoc.fullName} (${payMonth}). Reason: ${penaltyOverrideData.reason}`,
          changes: [
            { field: "waivedAbsenceDeduction", label: "Waived Absence Amount", oldValue: `GH₵${origAbsence}`, newValue: `GH₵${finalAbsentDeduction}` },
            { field: "waivedLatenessDeduction", label: "Waived Lateness Amount", oldValue: `GH₵${origLateness}`, newValue: `GH₵${finalLatenessDeduction}` },
          ],
          metadata: {
            employeeId: empDoc.employeeId,
            payMonth,
            reason: penaltyOverrideData.reason,
          },
          ipAddress: req.ip || "127.0.0.1",
        });
      } catch (auditErr) {
        console.warn("AuditLog creation error for penalty waiver:", auditErr.message);
      }
    }

    // Push automated in-app notification to the affected employee for payslip publication
    try {
      const targetEmpId = String(empDoc._id || empDoc.employeeId || empDoc.email || "");
      const formattedTotalDeduct = Number(totalAttendanceDeductions || 0);

      if (formattedTotalDeduct > 0) {
        const breakdownParts = [];
        if (finalAbsentDeduction > 0) {
          breakdownParts.push(`GH₵${finalAbsentDeduction.toFixed(2)} absence deduction`);
        }
        if (finalLatenessDeduction > 0) {
          breakdownParts.push(`GH₵${finalLatenessDeduction.toFixed(2)} lateness penalty`);
        }
        const detailStr = breakdownParts.length > 0 ? breakdownParts.join(" & ") : `GH₵${formattedTotalDeduct.toFixed(2)} penalty`;

        await createNotificationRecord({
          recipient_id: targetEmpId,
          recipient_role: "employee",
          sender_id: String(req.admin?.id || req.admin?._id || "admin"),
          sender_role: "admin",
          sender_name: req.admin?.fullName || "Payroll Administrator",
          title: "📄 Official Payslip Released (Attendance Deductions Applied)",
          message: `Your official payslip for ${payMonth} has been released. An attendance deduction of GH₵${formattedTotalDeduct.toFixed(2)} (${detailStr}) was applied. Net Take-Home: GH₵${calculatedNetPay.toFixed(2)}.`,
          type: "payroll_alert",
          category: "payroll",
          priority: "high",
          action_url: "/employee/dashboard/payslips",
          action_label: "View Payslip",
          metadata: {
            payMonth,
            payslipNumber,
            totalAttendanceDeductions: formattedTotalDeduct,
            absentDaysDeduction: finalAbsentDeduction,
            latenessDeduction: finalLatenessDeduction,
            netPay: calculatedNetPay,
            paymentDate,
          },
        });
      } else if (penaltyOverrideData?.isWaived && Number(penaltyOverrideData.totalWaived || 0) > 0) {
        await createNotificationRecord({
          recipient_id: targetEmpId,
          recipient_role: "employee",
          sender_id: String(req.admin?.id || req.admin?._id || "admin"),
          sender_role: "admin",
          sender_name: req.admin?.fullName || "Management",
          title: "✅ Official Payslip Released (Penalty Waived)",
          message: `Your official payslip for ${payMonth} has been released. Management approved a waiver of GH₵${Number(penaltyOverrideData.totalWaived).toFixed(2)} in attendance deductions. Net Take-Home: GH₵${calculatedNetPay.toFixed(2)}.`,
          type: "payroll_alert",
          category: "payroll",
          priority: "medium",
          action_url: "/employee/dashboard/payslips",
          action_label: "View Payslip",
          metadata: {
            payMonth,
            payslipNumber,
            waivedAmount: penaltyOverrideData.totalWaived,
            reason: penaltyOverrideData.reason,
          },
        });
      } else {
        await createNotificationRecord({
          recipient_id: targetEmpId,
          recipient_role: "employee",
          sender_id: String(req.admin?.id || req.admin?._id || "admin"),
          sender_role: "admin",
          sender_name: req.admin?.fullName || "Management",
          title: "🎉 Official Payslip Released",
          message: `Your official payslip for ${payMonth} has been generated and released upon payment. Net Take-Home: GH₵${calculatedNetPay.toFixed(2)}.`,
          type: "payroll_alert",
          category: "payroll",
          priority: "medium",
          action_url: "/employee/dashboard/payslips",
          action_label: "View Payslip",
          metadata: {
            payMonth,
            payslipNumber,
            netPay: calculatedNetPay,
            paymentDate,
          },
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create automated employee payslip notification:", notifErr.message);
    }

    // Record critical user action: Payroll Finalization
    try {
      await logAuditAction({
        req,
        action: "PAYROLL_FINALIZED",
        category: "Payroll",
        target: `${empDoc.fullName} (${empDoc.employeeId || payslipNumber})`,
        targetModel: "Payroll",
        summary: `Finalized and generated payroll for ${empDoc.fullName} (${payMonth}). Net Pay: GH₵${calculatedNetPay.toFixed(2)}, Status: ${finalStatus}.`,
        details: `Base Salary: GH₵${finalBaseSalary.toFixed(2)}, Allowances: GH₵${totalCustomEarnings.toFixed(2)}, Deductions: GH₵${(totalCustomDeductions + totalAttendanceDeductions).toFixed(2)}, Payment Method: ${paymentMethod}.`,
        metadata: {
          payslipNumber,
          employeeId: empDoc.employeeId,
          employeeName: empDoc.fullName,
          payMonth,
          paymentDate,
          paymentMethod,
          netPay: calculatedNetPay,
          status: finalStatus,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log notice in generatePayroll:", auditErr.message);
    }

    // Centralized Notification: Alert administrators about newly generated payroll record
    try {
      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(req.admin?.id || req.admin?._id || "system"),
        sender_role: req.admin ? "admin" : "system",
        sender_name: req.admin?.fullName || "Payroll Administrator",
        title: `💵 New Payroll Generated: ${empDoc.fullName} (${payMonth})`,
        message: `Payroll record generated for ${empDoc.fullName} (${payMonth}). Net Take-Home: GH₵${calculatedNetPay.toFixed(2)}. Status: ${finalStatus}.`,
        type: "payroll_status_update",
        category: "payroll",
        priority: "medium",
        action_url: "/admin/payroll",
        action_label: "View Payroll",
        organizationId: targetOrgId,
        companyId: targetOrgId,
        metadata: {
          payrollId: String(newRecord._id),
          payslipNumber,
          employeeId: empDoc.employeeId,
          employeeName: empDoc.fullName,
          payMonth,
          netSalary: calculatedNetPay,
          status: finalStatus,
        },
      });
    } catch (notifErr) {
      console.warn("Could not dispatch admin payroll generation notification:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Payroll generated successfully.",
      payroll: newRecord,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// Function to get all payslips for admin
export const allPayslips = async (req, res) => {
  try {
    const { month, payMonth, year, status } = req.query;
    let list = [];
    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    try {
      const payslips = await Payroll.find(orgQuery)
        .populate("employee", "fullName employeeId department position email bankName accountNumber salary baseSalary organizationId companyId")
        .sort({ createdAt: -1 })
        .lean();

      if (payslips && payslips.length > 0) {
        list = payslips;
      }
    } catch (err) {
      console.warn("DB payroll query in getAllPayslips:", err.message);
    }

    // Filter by month/payMonth if supplied (supports "YYYY-MM", "August 2026", "August")
    const targetMonthQuery = month || payMonth;
    if (targetMonthQuery && targetMonthQuery !== "All" && targetMonthQuery !== "All Months") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      let matchStrings = [targetMonthQuery.toLowerCase().trim()];

      // If format is YYYY-MM
      const ymMatch = targetMonthQuery.match(/^(\d{4})-(\d{1,2})$/);
      if (ymMatch) {
        const y = ymMatch[1];
        const mIdx = parseInt(ymMatch[2], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          matchStrings.push(`${monthNames[mIdx].toLowerCase()} ${y}`);
          matchStrings.push(monthNames[mIdx].toLowerCase());
        }
      }

      list = list.filter((item) => {
        const itemMonth = (item.payMonth || item.month || "").toLowerCase().trim();
        const itemDate = item.paymentDate ? String(item.paymentDate) : "";
        return matchStrings.some((mStr) => itemMonth.includes(mStr) || itemDate.startsWith(mStr));
      });
    }

    if (status && status !== "All") {
      list = list.filter((item) => (item.status || "").toLowerCase() === status.toLowerCase());
    }

    return res.status(200).json({
      success: true,
      list,
      records: list,
      payslips: list,
      totalCount: list.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Helper: Build complete, transparent, itemized payslip breakdown synced directly with live DB records
export const buildDetailedPayslipBreakdown = async (foundRecord, employeeId = null) => {
  if (!foundRecord) return null;

  const orgId = foundRecord.organizationId || foundRecord.companyId || foundRecord.employee?.organizationId || foundRecord.employee?.companyId;
  const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

  // 1. Resolve Employee record
  let emp = foundRecord.employee;
  if (!emp || typeof emp === "string" || !emp.fullName) {
    const lookupId = emp || employeeId || foundRecord.employeeId;
    if (isValidObjectId(lookupId)) {
      try {
        emp = await Employee.findOne({ _id: lookupId, ...orgScope }).lean();
      } catch (err) {
        console.warn("DB employee lookup in breakdown helper:", err.message);
      }
    } else if (lookupId) {
      try {
        emp = await Employee.findOne({
          $or: [{ employeeId: lookupId }, { email: lookupId }],
          ...orgScope,
        }).lean();
      } catch (err) {
        console.warn("DB employee search by id in breakdown helper:", err.message);
      }
    }
  }

  // 2. Fetch CompanySettings for penalty rates
  let settings = {
    workStartTime: "08:00",
    absenceDeductionRate: 10,
    lateTier1_amount: 0,
    lateTier2_amount: 0,
    lateTier3_amount: 0,
    lateTier4_amount: 0,
    lateTier5_amount: 0,
    lateTier6_amount: 0,
  };
  try {
    const dbSettings = await CompanySettings.findOne(orgScope).lean();
    if (dbSettings) {
      settings = { ...settings, ...dbSettings };
    }
  } catch (err) {
    console.warn("Error fetching company settings in breakdown helper:", err.message);
  }

  // 3. Fetch real Attendance records for employee
  let attendanceRecords = [];
  if (emp && isValidObjectId(emp._id)) {
    try {
      attendanceRecords = await Attendance.find({ employee: emp._id, ...orgScope }).lean();
    } catch (err) {
      console.warn("Error fetching attendance for payslip breakdown:", err.message);
    }
  }

  // Add active live clock-ins from memory store
  liveAttendanceStore.forEach((liveAtt) => {
    if (orgId) {
      const attOrg = liveAtt.organizationId ? String(liveAtt.organizationId) : (liveAtt.companyId ? String(liveAtt.companyId) : null);
      if (attOrg && attOrg !== String(orgId)) return;
    }
    if (emp && liveAtt.employee === String(emp._id)) {
      if (!attendanceRecords.some((a) => a.date === liveAtt.date)) {
        attendanceRecords.push(liveAtt);
      }
    }
  });

  // 4. Fetch real Leave records
  let leaveRecords = [];
  if (emp && isValidObjectId(emp._id)) {
    try {
      leaveRecords = await Leave.find({ employee: emp._id, status: "Approved", ...orgScope }).lean();
    } catch (err) {
      console.warn("Error fetching leaves for payslip breakdown:", err.message);
    }
  }

  // 5. Calculate base salary
  const baseSalary = Number(
    foundRecord.baseSalary !== undefined
      ? foundRecord.baseSalary
      : (foundRecord.basicSalary !== undefined
          ? foundRecord.basicSalary
          : (emp?.salary ? Number(emp.salary) : (emp?.baseSalary ? Number(emp.baseSalary) : 4000)))
  );

  // 6. Allowances: Array of dynamic admin-entered allowances [{ title, amount, description }]
  let allowances = [];
  if (Array.isArray(foundRecord.earnings) && foundRecord.earnings.length > 0) {
    allowances = foundRecord.earnings
      .filter((e) => e && (e.description || e.name || e.title))
      .map((e) => ({
        title: e.title || e.description || e.name || "Allowance",
        description: e.description || e.title || e.name || "Allowance",
        amount: Number(e.amount || 0),
      }));
  } else if (Number(foundRecord.allowances || 0) > 0) {
    allowances = [
      {
        title: "Allowances & Bonuses",
        description: "Allowances & Bonuses",
        amount: Number(foundRecord.allowances),
      },
    ];
  }
  const totalAllowances = allowances.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // 7. Custom Deductions: Array of extra admin adjustments [{ title, amount, description }]
  let customDeductions = [];
  if (Array.isArray(foundRecord.deductions) && foundRecord.deductions.length > 0) {
    customDeductions = foundRecord.deductions
      .filter((d) => d && (d.description || d.name || d.title))
      .map((d) => ({
        title: d.title || d.description || d.name || "Deduction",
        description: d.description || d.title || d.name || "Deduction",
        amount: Number(d.amount || 0),
      }));
  } else if (Array.isArray(foundRecord.customDeductions) && foundRecord.customDeductions.length > 0) {
    customDeductions = foundRecord.customDeductions
      .filter((d) => d && (d.description || d.name || d.title))
      .map((d) => ({
        title: d.title || d.description || d.name || "Deduction",
        description: d.description || d.title || d.name || "Deduction",
        amount: Number(d.amount || 0),
      }));
  } else if (typeof foundRecord.deductions === "number" && Number(foundRecord.deductions) > 0) {
    customDeductions = [
      {
        title: "Standard Deductions",
        description: "Standard Deductions",
        amount: Number(foundRecord.deductions),
      },
    ];
  }
  const totalCustomDeductions = customDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // 8. Dynamic Attendance & Lateness Breakdown Calculation
  let unexcusedAbsentDays = 0;
  let totalLateMinutes = 0;
  let lateDaysCount = 0;
  const tierBreakdown = [];
  let calculatedLatenessPenalties = 0;

  if (attendanceRecords.length > 0) {
    attendanceRecords.forEach((att) => {
      const st = (att.status || "").toLowerCase();
      if (st === "absent") {
        unexcusedAbsentDays++;
      } else {
        const checkInTimeValue = att.clockIn || att.clockInTime;
        const isLateStatus = st === "late" || (Number(att.lateMinutes || att.delayMinutes || 0) > 0) || (Number(att.latePenalty || 0) > 0);
        let penaltyResult = null;
        if (checkInTimeValue) {
          penaltyResult = evaluateLatenessPenalty(checkInTimeValue, settings.workStartTime, settings);
        }

        const isLate = isLateStatus || (penaltyResult && penaltyResult.minutesLate > 0);
        if (isLate) {
          lateDaysCount++;
          let mins = 0;
          let pen = 0;
          let tierName = "";
          let clockInTime = "--";

          if (att.latePenalty !== undefined && att.latePenalty !== null && att.latePenalty !== "" && !isNaN(Number(att.latePenalty))) {
            pen = Math.max(0, Number(att.latePenalty));
            mins = Number(att.lateMinutes || att.delayMinutes || (penaltyResult ? penaltyResult.minutesLate : 0));
            tierName = att.penaltyTier || (penaltyResult ? penaltyResult.tier : "Late Penalty");
            clockInTime = penaltyResult?.clockInFormatted || (checkInTimeValue ? new Date(checkInTimeValue).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "Late");
          } else if (penaltyResult && penaltyResult.isLate) {
            pen = penaltyResult.penalty;
            mins = penaltyResult.minutesLate;
            tierName = penaltyResult.tier;
            clockInTime = penaltyResult.clockInFormatted;
          } else {
            const fallbackCalc = calculateLatenessPenalty(att.lateMinutes || att.delayMinutes || 15, settings);
            pen = fallbackCalc.penalty;
            mins = fallbackCalc.minutesLate;
            tierName = fallbackCalc.tier;
            clockInTime = checkInTimeValue ? new Date(checkInTimeValue).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "Late";
          }

          totalLateMinutes += mins;
          calculatedLatenessPenalties += pen;

          tierBreakdown.push({
            date: att.date || new Date().toISOString().split("T")[0],
            clockIn: clockInTime,
            minutesLate: mins,
            delayMinutes: mins,
            tier: tierName,
            penalty: pen,
            latePenalty: pen,
            count: 1,
            total: pen,
          });
        }
      }
    });
  }

  // Rate per day from CompanySettings or stored
  const ratePerDay = Number(
    foundRecord.absenceDeductionDetails?.ratePerDay !== undefined
      ? foundRecord.absenceDeductionDetails.ratePerDay
      : (settings.absenceDeductionRate !== undefined ? settings.absenceDeductionRate : 10)
  );

  const isFinalizedRecord =
    foundRecord.netSalary !== undefined ||
    foundRecord.netPay !== undefined ||
    foundRecord.status === "Published" ||
    foundRecord.status === "published" ||
    foundRecord.status === "Paid" ||
    foundRecord.status === "paid";

  let finalAbsenceDaysCount = unexcusedAbsentDays;
  let finalAbsenceAmount = 0;

  if (foundRecord.absentDaysDeduction !== undefined && foundRecord.absentDaysDeduction !== null) {
    finalAbsenceAmount = Number(foundRecord.absentDaysDeduction);
    if (finalAbsenceAmount > 0 && finalAbsenceDaysCount === 0 && ratePerDay > 0) {
      finalAbsenceDaysCount = Math.round(finalAbsenceAmount / ratePerDay);
    }
  } else if (foundRecord.absenceDeductions !== undefined && foundRecord.absenceDeductions !== null) {
    finalAbsenceAmount = Number(foundRecord.absenceDeductions);
    if (finalAbsenceAmount > 0 && finalAbsenceDaysCount === 0 && ratePerDay > 0) {
      finalAbsenceDaysCount = Math.round(finalAbsenceAmount / ratePerDay);
    }
  } else if (foundRecord.absenceDeductionDetails?.totalAmount !== undefined) {
    finalAbsenceAmount = Number(foundRecord.absenceDeductionDetails.totalAmount);
    finalAbsenceDaysCount = Number(foundRecord.absenceDeductionDetails.daysCount || finalAbsenceDaysCount);
  } else if (isFinalizedRecord) {
    finalAbsenceAmount = 0;
  } else {
    finalAbsenceAmount = Number((finalAbsenceDaysCount * ratePerDay).toFixed(2));
  }

  let finalLatenessAmount = 0;
  if (foundRecord.latenessDeduction !== undefined && foundRecord.latenessDeduction !== null) {
    finalLatenessAmount = Number(foundRecord.latenessDeduction);
  } else if (foundRecord.latenessPenalties !== undefined && foundRecord.latenessPenalties !== null) {
    finalLatenessAmount = Number(foundRecord.latenessPenalties);
  } else if (foundRecord.latenessPenalty !== undefined && foundRecord.latenessPenalty !== null) {
    finalLatenessAmount = Number(foundRecord.latenessPenalty);
  } else if (foundRecord.latenessDeductionDetails?.totalAmount !== undefined) {
    finalLatenessAmount = Number(foundRecord.latenessDeductionDetails.totalAmount);
  } else if (isFinalizedRecord) {
    finalLatenessAmount = 0;
  } else {
    finalLatenessAmount = Number(calculatedLatenessPenalties.toFixed(2));
  }

  // Evaluate Penalty Waiver if applied
  if (foundRecord.penaltyOverride?.isWaived) {
    const waivedAbs = Number(foundRecord.penaltyOverride.waivedAbsenceDeduction || 0);
    const waivedLate = Number(foundRecord.penaltyOverride.waivedLatenessDeduction || 0);
    finalAbsenceAmount = Math.max(0, finalAbsenceAmount - waivedAbs);
    finalLatenessAmount = Math.max(0, finalLatenessAmount - waivedLate);
  }

  const absenceDeduction = {
    daysCount: finalAbsenceDaysCount,
    ratePerDay,
    totalAmount: finalAbsenceAmount,
  };

  const latenessDeduction = {
    totalLateMinutes: Number(foundRecord.latenessDeductionDetails?.totalLateMinutes || (isFinalizedRecord && finalLatenessAmount === 0 ? 0 : totalLateMinutes)),
    lateDaysCount: Number(foundRecord.latenessDeductionDetails?.lateDaysCount || (isFinalizedRecord && finalLatenessAmount === 0 ? 0 : lateDaysCount)),
    tierBreakdown: (foundRecord.latenessDeductionDetails?.tierBreakdown && foundRecord.latenessDeductionDetails.tierBreakdown.length > 0)
      ? foundRecord.latenessDeductionDetails.tierBreakdown
      : (isFinalizedRecord && finalLatenessAmount === 0 ? [] : tierBreakdown),
    totalAmount: finalLatenessAmount,
  };

  const totalAttendanceDeductions = Number(
    foundRecord.totalAttendanceDeductions !== undefined
      ? foundRecord.totalAttendanceDeductions
      : (absenceDeduction.totalAmount + latenessDeduction.totalAmount)
  );
  const totalDeductions = Number(
    foundRecord.totalDeductions !== undefined
      ? foundRecord.totalDeductions
      : (totalCustomDeductions + totalAttendanceDeductions)
  );
  const netSalary = Number(
    foundRecord.netSalary !== undefined && foundRecord.netSalary !== null
      ? foundRecord.netSalary
      : (foundRecord.netPay !== undefined && foundRecord.netPay !== null
          ? foundRecord.netPay
          : Math.max(0, parseFloat((baseSalary + totalAllowances - totalDeductions).toFixed(2))))
  );

  const payslipId = foundRecord.payslipNumber || foundRecord.id || (foundRecord._id ? `PAY-${String(foundRecord._id).slice(-6).toUpperCase()}` : "PAY-1001");

  const normalizedEmployee = {
    _id: emp?._id || "",
    fullName: emp?.fullName || foundRecord.employeeName || "Employee",
    employeeId: emp?.employeeId || foundRecord.employeeId || "",
    department: emp?.department || foundRecord.department || "Operations",
    position: emp?.position || foundRecord.position || "Staff Member",
    email: emp?.email || "",
    bankName: emp?.bankName || "",
    accountNumber: emp?.accountNumber || "",
    phone: emp?.phone || "",
  };

  return {
    ...foundRecord,
    _id: foundRecord._id || payslipId,
    id: payslipId,
    payslipNumber: payslipId,
    payMonth: foundRecord.payMonth || foundRecord.month || "August 2026",
    month: foundRecord.payMonth || foundRecord.month || "August 2026",
    paymentDate: foundRecord.paymentDate || new Date().toISOString().split("T")[0],
    paymentMethod: foundRecord.paymentMethod || "Bank Transfer",
    status: foundRecord.status || "Paid",
    remarks: foundRecord.remarks || "",
    employee: normalizedEmployee,
    employeeName: normalizedEmployee.fullName,
    employeeId: normalizedEmployee.employeeId,
    department: normalizedEmployee.department,
    position: normalizedEmployee.position,
    baseSalary,
    basicSalary: baseSalary,
    allowances,
    earnings: allowances,
    absenceDeduction,
    absentDaysDeduction: absenceDeduction.totalAmount,
    latenessDeduction,
    totalAttendanceDeductions,
    customDeductions,
    deductions: customDeductions,
    totalAllowances,
    totalCustomDeductions,
    totalDeductions,
    grossEarnings: baseSalary + totalAllowances,
    netSalary,
    netPay: netSalary,
    penaltyOverride: foundRecord.penaltyOverride || null,
    attendanceSummary: {
      standardWorkingDays: getWorkingDaysInMonth(2026, 7),
      presentDays: Math.max(0, attendanceRecords.length - finalAbsenceDaysCount),
      onTimeDays: Math.max(0, attendanceRecords.length - finalAbsenceDaysCount - lateDaysCount),
      lateDays: lateDaysCount,
      absentDays: finalAbsenceDaysCount,
      approvedPaidLeaveDays: leaveRecords.length,
    },
    breakdown: {
      baseSalary,
      grossEarnings: baseSalary + totalAllowances,
      allowances,
      absenceDeduction,
      latenessDeduction,
      customDeductions,
      totalAttendanceDeductions,
      totalDeductions,
      netSalary,
    },
  };
};

// GET /api/employee/payslips/latest or /api/payroll/payslips/latest
export const getEmployeeLatestPayslipBreakdown = async (req, res) => {
  try {
    const authEmp = req.employee;
    if (!authEmp && (!req.admin || req.admin.role === "employee")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Employee authentication token required.",
      });
    }

    const rawEmpId = req.query.employeeId || authEmp?.id || authEmp?._id || authEmp?.employeeId;
    let targetEmployee = null;

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    if (isValidObjectId(rawEmpId)) {
      try {
        targetEmployee = await Employee.findOne({ _id: rawEmpId, ...orgScope }).lean();
      } catch (err) {
        console.warn("DB find employee fallback:", err.message);
      }
    } else if (rawEmpId) {
      try {
        targetEmployee = await Employee.findOne({
          $or: [{ employeeId: rawEmpId }, { email: rawEmpId }],
          ...orgScope,
        }).lean();
      } catch (err) {
        console.warn("DB find employee by code fallback:", err.message);
      }
    }

    if (!targetEmployee && orgId) {
      try {
        targetEmployee = await Employee.findOne({ isActive: true, ...orgScope }).lean();
      } catch (err) {
        console.warn("DB find active employee fallback:", err.message);
      }
    }

    if (targetEmployee) {
      validateOrganizationAccess(targetEmployee, req);
    }

    let latestPayslip = null;

    // Try finding latest published payslip from MongoDB
    if (targetEmployee && isValidObjectId(targetEmployee._id)) {
      try {
        latestPayslip = await Payroll.findOne({
          employee: targetEmployee._id,
          status: { $in: ["Published", "published", "Paid", "paid"] },
          ...orgScope,
        })
          .sort({ paymentDate: -1, createdAt: -1 })
          .populate("employee", "fullName employeeId department position email bankName accountNumber phone")
          .lean();
      } catch (dbErr) {
        console.warn("DB find latest payslip fallback:", dbErr.message);
      }
    }

    // Check live in-memory store for published payslips
    if (!latestPayslip && targetEmployee) {
      const match = livePayrollStore.find((p) => {
        if (orgId) {
          const pOrg = p.organizationId ? String(p.organizationId) : (p.companyId ? String(p.companyId) : null);
          if (pOrg && pOrg !== String(orgId)) return false;
        }
        const pEmpId = String(p.employee?._id || p.employee || "");
        const status = String(p.status || "").toLowerCase();
        const isPublished = status === "published" || status === "paid";
        return isPublished && (pEmpId === String(targetEmployee._id) || p.employeeId === targetEmployee.employeeId);
      });
      if (match) latestPayslip = match;
    }

    if (latestPayslip) {
      validateOrganizationAccess(latestPayslip, req);
    }

    if (!latestPayslip) {
      return res.status(200).json({
        success: true,
        hasPublishedPayslip: false,
        payslip: null,
        breakdown: null,
        message: "Your official payslip for this period has not been released yet. Payslips are published by Admin at the end of the billing cycle.",
      });
    }

    const detailed = await buildDetailedPayslipBreakdown(latestPayslip, targetEmployee?._id);

    return res.status(200).json({
      success: true,
      hasPublishedPayslip: true,
      payslip: detailed,
      breakdown: detailed.breakdown,
    });
  } catch (error) {
    console.error("Error in getEmployeeLatestPayslipBreakdown:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve latest payslip breakdown."),
    });
  }
};

// GET /api/employee/payslip/:id or /api/payroll/payslip/:id
export const getEmployeePayslipBreakdownById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "latest") {
      return getEmployeeLatestPayslipBreakdown(req, res);
    }

    let foundRecord = null;

    // 1. Try finding in MongoDB if valid ObjectId
    if (isValidObjectId(id)) {
      try {
        foundRecord = await Payroll.findById(id)
          .populate("employee", "fullName employeeId department position email bankName accountNumber phone organizationId companyId")
          .lean();
      } catch (dbErr) {
        console.warn("DB search by ID fallback:", dbErr.message);
      }
    }

    // 2. Try finding by payslipNumber or employeeId in MongoDB
    if (!foundRecord) {
      try {
        foundRecord = await Payroll.findOne({
          $or: [{ payslipNumber: id }, { employeeId: id }],
        })
          .populate("employee", "fullName employeeId department position email bankName accountNumber phone organizationId companyId")
          .lean();
      } catch (dbErr) {
        console.warn("DB search by payslipNumber fallback:", dbErr.message);
      }
    }

    // 2.5 Try finding in Payslip collection if valid ObjectId
    if (!foundRecord && isValidObjectId(id)) {
      try {
        const pDoc = await Payslip.findById(id).populate("employeeId", "fullName employeeId department position email organizationId companyId").lean();
        if (pDoc) {
          foundRecord = {
            _id: pDoc._id,
            id: pDoc._id,
            organizationId: pDoc.organizationId,
            companyId: pDoc.companyId,
            payslipNumber: `PAY-${pDoc.payrollPeriod?.year || 2026}-${(pDoc.payrollPeriod?.month || "AUG").slice(0, 3).toUpperCase()}`,
            payMonth: pDoc.payrollPeriod ? `${pDoc.payrollPeriod.month} ${pDoc.payrollPeriod.year}` : "Current Month",
            paymentDate: pDoc.generatedAt || pDoc.createdAt,
            basicSalary: pDoc.baseSalary,
            baseSalary: pDoc.baseSalary,
            netSalary: pDoc.netPay,
            netPay: pDoc.netPay,
            status: pDoc.status,
            allowances: pDoc.allowances || 0,
            earnings: pDoc.allowances ? [{ name: "Allowances", amount: pDoc.allowances }] : [],
            deductions: [
              ...(pDoc.deductions?.latenessDeductions ? [{ name: "Lateness Deductions", amount: pDoc.deductions.latenessDeductions }] : []),
              ...(pDoc.deductions?.tax ? [{ name: "Tax", amount: pDoc.deductions.tax }] : []),
              ...(pDoc.deductions?.other ? [{ name: "Other Deductions", amount: pDoc.deductions.other }] : []),
            ],
            latenessDeduction: pDoc.deductions?.latenessDeductions || 0,
            payrollPeriod: pDoc.payrollPeriod,
            employee: pDoc.employeeId,
          };
        }
      } catch (dbErr) {
        console.warn("DB search in Payslip collection by ID fallback:", dbErr.message);
      }
    }

    // 3. Check in-memory store
    if (!foundRecord) {
      foundRecord = livePayrollStore.find(
        (p) =>
          String(p._id) === String(id) ||
          p.id === id ||
          p.payslipNumber === id ||
          p.employeeId === id
      );
    }

    if (!foundRecord) {
      return res.status(404).json({
        success: false,
        message: `Payroll record with ID ${id} not found.`,
      });
    }

    // Cross-tenant verification: Ensure record belongs to the requester's organization
    validateOrganizationAccess(foundRecord, req);

    // Role-based authorization: Standard employees are strictly restricted to their own payslip
    const authUser = req.user || req.employee || req.admin;
    const isEmployeeRole = (authUser?.role === "employee" || (!req.admin && req.employee) || (req.user && req.user.role === "employee"));
    if (isEmployeeRole && authUser) {
      const authEmpId = String(authUser.id || authUser._id || "");
      const authCode = String(authUser.employeeId || "");
      const recordEmpId = String(foundRecord.employee?._id || foundRecord.employee?.id || foundRecord.employee || "");
      const recordCode = String(foundRecord.employee?.employeeId || foundRecord.employeeId || "");

      const isOwner =
        (authEmpId && (recordEmpId === authEmpId || recordCode === authEmpId)) ||
        (authCode && (recordCode === authCode || recordEmpId === authCode));

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Access restricted: You are only authorized to view your own personal payslips.",
        });
      }
    }

    const detailed = await buildDetailedPayslipBreakdown(foundRecord);

    return res.status(200).json({
      success: true,
      payroll: detailed,
      payslip: detailed,
      breakdown: detailed.breakdown,
    });
  } catch (error) {
    console.error("Error in getEmployeePayslipBreakdownById:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve payslip details."),
    });
  }
};

// Function to get a single payroll/payslip record by ID or payslipNumber
export const getPayrollById = async (req, res) => {
  return getEmployeePayslipBreakdownById(req, res);
};

// Function to update payroll status (e.g. Paid, Pending, Failed)
export const updatePayrollStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    let updated = null;
    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    if (isValidObjectId(id)) {
      try {
        const existing = await Payroll.findOne({ _id: id, ...orgScope });
        if (existing) {
          validateOrganizationAccess(existing, req);
        }
        updated = await Payroll.findOneAndUpdate(
          { _id: id, ...orgScope },
          { status, ...(remarks && { remarks }) },
          { returnDocument: "after" },
        ).populate("employee", "fullName employeeId department position organizationId companyId");
      } catch (err) {
        if (err.message === "Unauthorized" || err.statusCode === 403) throw err;
        console.warn("DB update status fallback:", err.message);
      }
    }

    // Update in live memory store
    const inMem = livePayrollStore.find(
      (p) => {
        const matchesId = String(p._id) === String(id) || p.payslipNumber === id || p.id === id;
        if (!matchesId) return false;
        if (orgId) {
          const itemOrg = p.organizationId ? String(p.organizationId) : (p.companyId ? String(p.companyId) : null);
          if (itemOrg && itemOrg !== String(orgId)) return false;
        }
        return true;
      },
    );
    if (inMem) {
      validateOrganizationAccess(inMem, req);
      inMem.status = status;
      if (remarks) inMem.remarks = remarks;
      if (!updated) updated = inMem;
    }

    // Trigger in-app notification to employee if status is Published or Paid
    if (status === "Published" || status === "Paid") {
      try {
        const emp = updated?.employee;
        const targetEmpId = String(emp?._id || emp?.employeeId || updated?.employeeId || "");
        const payMonth = updated?.payMonth || updated?.month || "Current Month";
        const netTakeHome = Number(updated?.netSalary || updated?.netPay || 0);

        if (targetEmpId) {
          await createNotificationRecord({
            recipient_id: targetEmpId,
            recipient_role: "employee",
            sender_id: String(req.admin?.id || req.admin?._id || "admin"),
            sender_role: "admin",
            sender_name: req.admin?.fullName || req.admin?.full_name || "Payroll Administrator",
            title: status === "Paid" ? "💰 Salary Disbursement Completed" : "📄 New Payslip Published",
            message: status === "Paid"
              ? `Your salary for ${payMonth} (GH₵${netTakeHome.toFixed(2)}) has been processed and marked as Paid.`
              : `Your official payslip for ${payMonth} is now published and available to view. Net Take-Home: GH₵${netTakeHome.toFixed(2)}.`,
            type: "payroll_alert",
            category: "payroll",
            priority: "high",
            action_url: "/employee/dashboard/payslips",
            action_label: "View Payslip",
            metadata: {
              payMonth,
              payslipId: String(updated?._id || id),
              payslipNumber: updated?.payslipNumber || id,
              netPay: netTakeHome,
              status,
            },
          });
        }
      } catch (notifErr) {
        console.warn("Could not dispatch payslip status notification:", notifErr.message);
      }
    }

    // Centralized Notification: Alert administrators about payroll status update
    try {
      const empName = updated?.employee?.fullName || updated?.employeeName || "Staff Member";
      const pMonth = updated?.payMonth || updated?.month || "Current Period";
      const netTakeHome = Number(updated?.netSalary || updated?.netPay || 0);

      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(req.admin?.id || req.admin?._id || "system"),
        sender_role: req.admin ? "admin" : "system",
        sender_name: req.admin?.fullName || "Payroll System",
        title: `💳 Payroll Status Update: ${empName} (${status})`,
        message: `Payroll status for ${empName} (${pMonth}) has been updated to "${status}". Net salary: GH₵${netTakeHome.toFixed(2)}.`,
        type: "payroll_status_update",
        category: "payroll",
        priority: status === "Paid" ? "high" : "medium",
        action_url: "/admin/payroll",
        action_label: "View Payroll",
        organizationId: orgId,
        companyId: orgId,
        metadata: {
          payrollId: String(updated?._id || id),
          status,
          payMonth: pMonth,
          employeeName: empName,
          netSalary: netTakeHome,
        },
      });
    } catch (adminNotifErr) {
      console.warn("Could not dispatch admin payroll status notification:", adminNotifErr.message);
    }

    // Log payroll status update / finalization action
    try {
      const isFinalized = status === "Paid" || status === "Published";
      await logAuditAction({
        req,
        action: isFinalized ? "PAYROLL_FINALIZED" : `PAYROLL_STATUS_${status.toUpperCase()}`,
        category: "Payroll",
        target: `${updated?.employee?.fullName || updated?.employeeName || id}`,
        targetModel: "Payroll",
        summary: `Updated payroll status for ${updated?.employee?.fullName || updated?.employeeName || id} to "${status}".`,
        details: remarks ? `Status changed to ${status}. Note: ${remarks}` : `Status transitioned to ${status}.`,
        metadata: {
          payrollId: id,
          status,
          remarks,
          payMonth: updated?.payMonth || updated?.month,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log notice in updatePayrollStatus:", auditErr.message);
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Payroll status updated to ${status}.`,
      payroll: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update payroll status."),
    });
  }
};

// Function to delete a payroll record permanently
export const deletePayroll = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payroll ID is required.",
      });
    }

    let deletedFromDb = false;
    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    if (isValidObjectId(id)) {
      try {
        const existing = await Payroll.findOne({ _id: id, ...orgScope });
        if (existing) {
          validateOrganizationAccess(existing, req);
        }
        const deleted = await Payroll.findOneAndDelete({ _id: id, ...orgScope });
        if (deleted) deletedFromDb = true;
      } catch (err) {
        if (err.message === "Unauthorized" || err.statusCode === 403) throw err;
        console.warn("DB delete fallback:", err.message);
      }
    }

    if (!deletedFromDb) {
      try {
        const existing = await Payroll.findOne({ payslipNumber: id, ...orgScope });
        if (existing) {
          validateOrganizationAccess(existing, req);
        }
        const deleted = await Payroll.findOneAndDelete({
          payslipNumber: id,
          ...orgScope,
        });
        if (deleted) deletedFromDb = true;
      } catch (err) {
        if (err.message === "Unauthorized" || err.statusCode === 403) throw err;
        console.warn("DB delete by payslipNumber fallback:", err.message);
      }
    }

    const index = livePayrollStore.findIndex(
      (p) => {
        const matchesId = String(p._id) === String(id) || p.payslipNumber === id || p.id === id;
        if (!matchesId) return false;
        if (orgId) {
          const itemOrg = p.organizationId ? String(p.organizationId) : (p.companyId ? String(p.companyId) : null);
          if (itemOrg && itemOrg !== String(orgId)) return false;
        }
        return true;
      },
    );
    if (index !== -1) {
      validateOrganizationAccess(livePayrollStore[index], req);
      livePayrollStore.splice(index, 1);
    }

    if (!deletedFromDb && index === -1) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found or access denied.",
      });
    }

    // Log payroll deletion
    try {
      await logAuditAction({
        req,
        action: "PAYROLL_DELETED",
        category: "Payroll",
        target: `Payroll ID: ${id}`,
        targetModel: "Payroll",
        summary: `Deleted payroll record ID: ${id}.`,
        details: `Deleted from persistent storage by ${req.admin?.fullName || "Administrator"}.`,
        metadata: { id },
      });
    } catch (auditErr) {
      console.warn("Audit log notice in deletePayroll:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payroll record deleted successfully.",
      id,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete payroll record."),
    });
  }
};

// Function to export monthly payroll summary reports
export const exportPayrollReport = async (req, res) => {
  try {
    const { month, format } = req.query;
    let records = [];
    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    try {
      const dbRecords = await Payroll.find(orgQuery)
        .populate("employee", "fullName employeeId department position bankName accountNumber organizationId companyId")
        .lean();
      if (dbRecords && dbRecords.length > 0) {
        records = dbRecords;
      }
    } catch (err) {
      console.warn("DB export fallback:", err.message);
    }

    if (month && month !== "All" && month !== "All Months") {
      records = records.filter(
        (r) => (r.payMonth && r.payMonth.toLowerCase().includes(month.toLowerCase())) ||
               (r.month && r.month.toLowerCase().includes(month.toLowerCase())),
      );
    }

    const exportRows = records.map((r, i) => {
      const empName = r.employee?.fullName || r.employeeName || "Employee";
      const empId = r.employee?.employeeId || r.employeeId || `EMP00${i + 1}`;
      const dept = r.employee?.department || r.department || "Operations";
      const pos = r.employee?.position || r.position || "Staff Member";
      const basic = Number(r.basicSalary || 0);
      const allow = Number(r.allowances || 0);
      const deduct = Number(r.deductions || 0);
      const net = Number(r.netSalary || (basic + allow - deduct));
      const bank = r.employee?.bankName || r.bankName || "Ghana Commercial Bank";
      const account = r.employee?.accountNumber || r.accountNumber || "N/A";

      return {
        payslipNumber: r.payslipNumber || r.id || `PAY-${i + 1}`,
        employeeId: empId,
        employeeName: empName,
        department: dept,
        position: pos,
        payMonth: r.payMonth || r.month || "August 2026",
        paymentDate: r.paymentDate || "2026-08-25",
        basicSalary: basic,
        allowances: allow,
        grossSalary: basic + allow,
        deductions: deduct,
        netSalary: net,
        paymentMethod: r.paymentMethod || "Bank Transfer",
        status: r.status || "Paid",
        bankName: bank,
        accountNumber: account,
      };
    });

    if (format === "csv") {
      const headers = [
        "Payslip Number",
        "Employee ID",
        "Employee Name",
        "Department",
        "Position",
        "Pay Month",
        "Payment Date",
        "Basic Salary (GHS)",
        "Allowances (GHS)",
        "Gross Salary (GHS)",
        "Deductions (GHS)",
        "Net Salary (GHS)",
        "Payment Method",
        "Status",
        "Bank Name",
        "Account Number",
      ];
      const rows = exportRows.map((row) => [
        `"${row.payslipNumber}"`,
        `"${row.employeeId}"`,
        `"${row.employeeName}"`,
        `"${row.department}"`,
        `"${row.position}"`,
        `"${row.payMonth}"`,
        `"${row.paymentDate}"`,
        row.basicSalary.toFixed(2),
        row.allowances.toFixed(2),
        row.grossSalary.toFixed(2),
        row.deductions.toFixed(2),
        row.netSalary.toFixed(2),
        `"${row.paymentMethod}"`,
        `"${row.status}"`,
        `"${row.bankName}"`,
        `"${row.accountNumber}"`,
      ].join(","));

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const safeMonth = (month || "all-months").replace(/\s+/g, "_");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="Payroll_Report_${safeMonth}.csv"`);
      return res.status(200).send(csvContent);
    }

    return res.status(200).json({
      success: true,
      reportMonth: month || "All Months",
      totalCount: exportRows.length,
      totalDisbursement: exportRows.reduce((acc, r) => acc + r.netSalary, 0),
      totalBasic: exportRows.reduce((acc, r) => acc + r.basicSalary, 0),
      totalAllowances: exportRows.reduce((acc, r) => acc + r.allowances, 0),
      totalDeductions: exportRows.reduce((acc, r) => acc + r.deductions, 0),
      data: exportRows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to generate export report."),
    });
  }
};

// Each employee payslip
export const employeePayslips = async (req, res) => {
  try {
    const rawEmployeeId = req.employee?.id || req.employee?._id || req.employee?.employeeId;
    let validObjectId = null;

    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId;
    const orgScope = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : (orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {});

    if (isValidObjectId(rawEmployeeId)) {
      validObjectId = rawEmployeeId;
    } else if (rawEmployeeId) {
      try {
        const emp = await Employee.findOne({
          $or: [{ employeeId: rawEmployeeId }, { email: rawEmployeeId }],
          ...orgScope,
        }).select("_id").lean();
        if (emp) validObjectId = emp._id.toString();
      } catch (err) {
        console.warn("Could not find employee for payslips query:", err.message);
      }
    }

    let foundPayslips = [];

    if (validObjectId) {
      try {
        const payslips = await Payroll.find({
          employee: validObjectId,
          ...orgScope,
        })
          .populate("employee", "employeeId fullName department position email bankName accountNumber phone organizationId companyId")
          .sort({ paymentDate: -1, createdAt: -1 })
          .lean();

        if (payslips && payslips.length > 0) {
          foundPayslips = [...payslips];
        }
      } catch (dbErr) {
        console.warn("DB error for employeePayslips:", dbErr.message);
      }
    }

    // Also query the Payslip collection for distributed multi-tenant payslips
    try {
      const activeEmpIds = [validObjectId, rawEmployeeId, req.user?._id, req.user?.id].filter(Boolean);
      const payslipDocs = await Payslip.find({
        employeeId: { $in: activeEmpIds },
        status: { $in: ["Published", "Paid"] },
        ...orgScope,
      })
        .populate("organizationId", "name companyName")
        .sort({ "payrollPeriod.year": -1, createdAt: -1 })
        .lean();

      for (const doc of payslipDocs) {
        const payslipMonthStr = `${doc.payrollPeriod.month} ${doc.payrollPeriod.year}`;
        const exists = foundPayslips.some(
          (p) =>
            (p.payMonth && p.payMonth.toLowerCase().includes(doc.payrollPeriod.month.toLowerCase())) ||
            (p.payrollPeriod && p.payrollPeriod.month === doc.payrollPeriod.month && p.payrollPeriod.year === doc.payrollPeriod.year)
        );
        if (!exists) {
          foundPayslips.push({
            _id: doc._id,
            id: doc._id,
            payslipNumber: `PAY-${doc.payrollPeriod.year}-${doc.payrollPeriod.month.slice(0, 3).toUpperCase()}`,
            payMonth: payslipMonthStr,
            paymentDate: doc.generatedAt || doc.createdAt,
            basicSalary: doc.baseSalary,
            baseSalary: doc.baseSalary,
            netSalary: doc.netPay,
            netPay: doc.netPay,
            status: doc.status,
            allowances: doc.allowances || 0,
            earnings: doc.allowances ? [{ name: "Allowances", amount: doc.allowances }] : [],
            deductions: [
              ...(doc.deductions?.latenessDeductions ? [{ name: "Lateness Deductions", amount: doc.deductions.latenessDeductions }] : []),
              ...(doc.deductions?.tax ? [{ name: "Tax", amount: doc.deductions.tax }] : []),
              ...(doc.deductions?.other ? [{ name: "Other Deductions", amount: doc.deductions.other }] : []),
            ],
            latenessDeduction: doc.deductions?.latenessDeductions || 0,
            payrollPeriod: doc.payrollPeriod,
            employee: validObjectId,
          });
        }
      }
    } catch (payslipErr) {
      console.warn("Error querying Payslip model in employeePayslips:", payslipErr.message);
    }

    // Merge live generated store records matching this employee
    if (livePayrollStore.length > 0 && (rawEmployeeId || validObjectId)) {
      const liveMatches = livePayrollStore.filter((p) => {
        if (orgId) {
          const pOrg = p.organizationId ? String(p.organizationId) : (p.companyId ? String(p.companyId) : null);
          if (pOrg && pOrg !== String(orgId)) return false;
        }
        const pEmpId = String(p.employee?._id || p.employee || "");
        return pEmpId === String(validObjectId) || pEmpId === String(rawEmployeeId) || p.employeeId === rawEmployeeId;
      });

      liveMatches.forEach((p) => {
        if (!foundPayslips.some((f) => String(f._id) === String(p._id) || f.payslipNumber === p.payslipNumber)) {
          foundPayslips.unshift(p);
        }
      });
    }

    // Filter only officially published / paid payslips for the employee
    const publishedPayslips = foundPayslips.filter((p) => {
      const st = String(p.status || "").toLowerCase();
      return st === "published" || st === "paid";
    });

    // Format all published payslips with complete transparent itemized breakdowns
    const formattedPayslips = await Promise.all(
      publishedPayslips.map((p) => buildDetailedPayslipBreakdown(p, validObjectId)),
    );

    return res.status(200).json({
      success: true,
      isReleased: formattedPayslips.length > 0,
      hasPublishedPayslip: formattedPayslips.length > 0,
      totalCount: formattedPayslips.length,
      payslips: formattedPayslips,
      message:
        formattedPayslips.length === 0
          ? "Your official payslip for this period has not been released yet. Payslips are published by Admin at the end of the billing cycle."
          : "Official published payslips retrieved successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Function to calculate comprehensive payroll disbursements and tax deductions analytics for dashboard bar charts
export const getPayrollAnalytics = async (req, res) => {
  try {
    const targetYear = parseInt(req.query.year, 10) || 2026;
    const targetDept = req.query.department || "All";
    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    // 1. Fetch all employees to know active headcount and baseline salaries
    let employees = [];
    try {
      employees = await Employee.find({ isActive: { $ne: false }, ...orgQuery })
        .select("fullName employeeId department position salary organizationId companyId")
        .lean();
    } catch (err) {
      console.warn("DB employee query for analytics:", err.message);
    }

    const totalHeadcount = employees.length;
    const baseSalariesSum = employees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);

    // 2. Fetch all payroll documents
    let allRecords = [];
    try {
      const dbRecords = await Payroll.find(orgQuery)
        .populate("employee", "fullName employeeId department position salary organizationId companyId")
        .lean();
      if (dbRecords && dbRecords.length > 0) {
        allRecords = dbRecords;
      }
    } catch (err) {
      console.warn("DB payroll query for analytics:", err.message);
    }

    // Month labels for year
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthShorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Department list
    const departmentList = [
      "Engineering",
      "Sales & Marketing",
      "Human Resources",
      "Operations",
      "Finance & Accounting",
      "Customer Support",
      "Product & Design",
    ];

    // Compute monthly data
    const monthlyDisbursements = monthNames.map((mName, idx) => {
      const mShort = monthShorts[idx];
      const monthStr = `${mName} ${targetYear}`;

      // Filter actual payroll records for this month
      const matchingRecords = allRecords.filter((r) => {
        const pMonth = r.payMonth || r.month || "";
        const matchesMonth = pMonth.toLowerCase().includes(mName.toLowerCase()) || pMonth.includes(mShort);
        if (!matchesMonth) return false;
        if (targetDept && targetDept !== "All") {
          const dept = r.employee?.department || r.department || "";
          return dept.toLowerCase() === targetDept.toLowerCase();
        }
        return true;
      });

      let baseSalary = 0;
      let allowances = 0;
      let netSalary = 0;
      let taxDeductions = 0;
      let socialSecurity = 0;
      let healthInsurance = 0;
      let absenteeismDeductions = 0;
      let headcount = 0;

      if (matchingRecords.length > 0) {
        headcount = matchingRecords.length;
        matchingRecords.forEach((rec) => {
          const bSal = Number(rec.baseSalary !== undefined ? rec.baseSalary : (rec.basicSalary || 0));
          const allw = Number(rec.allowances || 0);
          const absD = Number(rec.absentDaysDeduction || 0);
          const net = Number(rec.netPay !== undefined ? rec.netPay : (rec.netSalary || (bSal + allw - absD)));

          baseSalary += bSal;
          allowances += allw;
          absenteeismDeductions += absD;
          netSalary += net;

          const gross = bSal + allw;
          const estimatedTax = parseFloat((gross * 0.11).toFixed(2));
          const estimatedSSNIT = parseFloat((gross * 0.055).toFixed(2));
          const estimatedNHIS = parseFloat((gross * 0.025).toFixed(2));

          taxDeductions += estimatedTax;
          socialSecurity += estimatedSSNIT;
          healthInsurance += estimatedNHIS;
        });
      } else if (totalHeadcount > 0 && baseSalariesSum > 0) {
        const seasonality = 1 + Math.sin((idx / 12) * Math.PI * 2) * 0.08 + (idx >= 7 ? 0.05 : 0);
        headcount = targetDept !== "All" ? Math.max(1, Math.round(totalHeadcount / 4)) : totalHeadcount;
        const deptRatio = targetDept !== "All" ? 0.25 : 1;

        baseSalary = Math.round(baseSalariesSum * deptRatio * seasonality);
        allowances = Math.round(baseSalary * (0.08 + (idx % 3) * 0.02));
        const gross = baseSalary + allowances;

        taxDeductions = Math.round(gross * 0.115);
        socialSecurity = Math.round(gross * 0.055);
        healthInsurance = Math.round(gross * 0.025);
        absenteeismDeductions = Math.round(baseSalary * 0.015 * ((idx % 2) + 0.5));

        const totalDeductions = taxDeductions + socialSecurity + healthInsurance + absenteeismDeductions;
        netSalary = gross - totalDeductions;
      }

      const grossSalary = baseSalary + allowances;
      const totalTaxAndStatutory = taxDeductions + socialSecurity + healthInsurance;
      const totalDeductions = totalTaxAndStatutory + absenteeismDeductions;

      return {
        month: mShort,
        monthFull: monthStr,
        monthIndex: idx,
        baseSalary: Math.round(baseSalary),
        allowances: Math.round(allowances),
        grossSalary: Math.round(grossSalary),
        netSalary: Math.round(netSalary),
        taxDeductions: Math.round(taxDeductions),
        socialSecurity: Math.round(socialSecurity),
        healthInsurance: Math.round(healthInsurance),
        absenteeismDeductions: Math.round(absenteeismDeductions),
        totalTaxAndStatutory: Math.round(totalTaxAndStatutory),
        totalDeductions: Math.round(totalDeductions),
        headcount,
        effectiveTaxRate: grossSalary > 0 ? parseFloat(((taxDeductions / grossSalary) * 100).toFixed(1)) : 0,
      };
    });

    // Compute Departmental Breakdown
    const departmentDisbursements = departmentList.map((deptName) => {
      const deptEmployees = employees.filter((e) => (e.department || "").toLowerCase().includes(deptName.toLowerCase()) || deptName.toLowerCase().includes((e.department || "").toLowerCase()));
      const count = deptEmployees.length;

      if (count === 0) {
        return {
          department: deptName,
          shortName: deptName.length > 12 ? deptName.split(" ")[0] : deptName,
          employeeCount: 0,
          baseSalary: 0,
          allowances: 0,
          grossSalary: 0,
          netSalary: 0,
          taxDeductions: 0,
          socialSecurity: 0,
          healthInsurance: 0,
          totalDeductions: 0,
          effectiveTaxRate: 0,
        };
      }

      const base = deptEmployees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
      const allow = Math.round(base * 0.12);
      const gross = base + allow;
      const tax = Math.round(gross * 0.115);
      const ssnit = Math.round(gross * 0.055);
      const health = Math.round(gross * 0.025);
      const totalDed = tax + ssnit + health;
      const net = gross - totalDed;

      return {
        department: deptName,
        shortName: deptName.length > 12 ? deptName.split(" ")[0] : deptName,
        employeeCount: count,
        baseSalary: base,
        allowances: allow,
        grossSalary: gross,
        netSalary: net,
        taxDeductions: tax,
        socialSecurity: ssnit,
        healthInsurance: health,
        totalDeductions: totalDed,
        effectiveTaxRate: gross > 0 ? parseFloat(((tax / gross) * 100).toFixed(1)) : 0,
      };
    });

    // Tax Deduction Categories Aggregation (YTD)
    const totalTaxPAYE = monthlyDisbursements.reduce((sum, m) => sum + m.taxDeductions, 0);
    const totalSSNIT = monthlyDisbursements.reduce((sum, m) => sum + m.socialSecurity, 0);
    const totalNHIS = monthlyDisbursements.reduce((sum, m) => sum + m.healthInsurance, 0);
    const totalAbsenceDeductions = monthlyDisbursements.reduce((sum, m) => sum + m.absenteeismDeductions, 0);
    const totalAllDeductions = totalTaxPAYE + totalSSNIT + totalNHIS + totalAbsenceDeductions;

    const taxCategoryBreakdown = [
      { name: "Income Tax (PAYE)", amount: totalTaxPAYE, percentage: totalAllDeductions > 0 ? parseFloat(((totalTaxPAYE / totalAllDeductions) * 100).toFixed(1)) : 0, fill: "#6366F1" },
      { name: "SSNIT / Pension (5.5%)", amount: totalSSNIT, percentage: totalAllDeductions > 0 ? parseFloat(((totalSSNIT / totalAllDeductions) * 100).toFixed(1)) : 0, fill: "#002185" },
      { name: "Health Insurance (NHIS)", amount: totalNHIS, percentage: totalAllDeductions > 0 ? parseFloat(((totalNHIS / totalAllDeductions) * 100).toFixed(1)) : 0, fill: "#06B6D4" },
      { name: "Absence Deductions", amount: totalAbsenceDeductions, percentage: totalAllDeductions > 0 ? parseFloat(((totalAbsenceDeductions / totalAllDeductions) * 100).toFixed(1)) : 0, fill: "#DC2626" },
    ];

    // Summary KPIs
    const currentMonthIndex = new Date().getMonth();
    const currentMonthData = monthlyDisbursements[currentMonthIndex] || monthlyDisbursements[0] || {
      netSalary: 0,
      taxDeductions: 0,
      grossSalary: 0,
      allowances: 0,
    };

    const totalNetDisbursedYear = monthlyDisbursements.reduce((sum, m) => sum + m.netSalary, 0);
    const totalTaxDeductedYear = totalTaxPAYE;
    const totalGrossYear = monthlyDisbursements.reduce((sum, m) => sum + m.grossSalary, 0);
    const totalAllowancesYear = monthlyDisbursements.reduce((sum, m) => sum + m.allowances, 0);
    const avgMonthlyNetDisbursement = Math.round(totalNetDisbursedYear / 12);
    const avgNetSalaryPerEmployee = totalHeadcount > 0 ? Math.round(currentMonthData.netSalary / totalHeadcount) : 0;
    const effectiveTaxRate = totalGrossYear > 0 ? parseFloat(((totalTaxDeductedYear / totalGrossYear) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      year: targetYear,
      department: targetDept,
      summaryCards: {
        totalNetDisbursedYear,
        totalNetDisbursedCurrentMonth: currentMonthData.netSalary,
        totalTaxDeductedYear,
        totalTaxCurrentMonth: currentMonthData.taxDeductions,
        totalGrossYear,
        totalGrossCurrentMonth: currentMonthData.grossSalary,
        totalAllowancesYear,
        totalAllowancesCurrentMonth: currentMonthData.allowances,
        avgMonthlyNetDisbursement,
        avgNetSalaryPerEmployee,
        effectiveTaxRate,
        totalHeadcount,
      },
      monthlyDisbursements,
      departmentDisbursements,
      taxCategoryBreakdown,
    });
  } catch (error) {
    console.error("Error in getPayrollAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate payroll analytics."),
    });
  }
};

// Retrieve Processed Payroll Cycle History with status, expenditure & penalty totals
export const getPayrollCycles = async (req, res) => {
  try {
    let allRecords = [];
    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    try {
      const dbRecords = await Payroll.find(orgQuery)
        .populate("employee", "fullName employeeId department position organizationId companyId")
        .sort({ paymentDate: -1, createdAt: -1 })
        .lean();
      if (dbRecords && dbRecords.length > 0) {
        allRecords = dbRecords;
      }
    } catch (err) {
      console.warn("DB query for payroll cycles fallback:", err.message);
    }

    // If no records exist in DB or live store, return empty cycles list
    if (allRecords.length === 0) {
      return res.status(200).json({
        success: true,
        cycles: [],
        totalCycles: 0,
      });
    }

    // Group records by payMonth
    const cycleMap = {};
    allRecords.forEach((rec) => {
      const rawMonth = rec.payMonth || rec.month || "August 2026";
      const monthKey = rawMonth.trim();

      if (!cycleMap[monthKey]) {
        cycleMap[monthKey] = {
          month: monthKey,
          generatedDate: rec.paymentDate ? (new Date(rec.paymentDate).toISOString().split("T")[0]) : new Date().toISOString().split("T")[0],
          lastUpdated: rec.updatedAt || rec.createdAt || new Date().toISOString(),
          employeeCount: 0,
          grossExpenditure: 0,
          netExpenditure: 0,
          totalAbsenceDeductions: 0,
          totalLatenessPenalties: 0,
          totalAttendancePenalties: 0,
          totalPenaltiesWaived: 0,
          totalAllowances: 0,
          paidCount: 0,
          pendingCount: 0,
          items: [],
        };
      }

      const bSal = Number(rec.baseSalary !== undefined ? rec.baseSalary : (rec.basicSalary || 0));
      const allw = Number(rec.allowances || 0);
      const absD = Number(rec.absentDaysDeduction || 0);
      const lateD = Number(rec.latenessDeduction || 0);
      const attD = Number(rec.totalAttendanceDeductions || (absD + lateD));
      const net = Number(rec.netPay !== undefined ? rec.netPay : (rec.netSalary !== undefined ? rec.netSalary : (bSal + allw - attD)));
      const waived = Number(rec.penaltyOverride?.totalWaived || (rec.penaltyOverride?.waivedAbsenceDeduction || 0) + (rec.penaltyOverride?.waivedLatenessDeduction || 0));
      const isPaid = (rec.status || "").toLowerCase() === "paid";

      cycleMap[monthKey].employeeCount += 1;
      cycleMap[monthKey].grossExpenditure += (bSal + allw);
      cycleMap[monthKey].netExpenditure += net;
      cycleMap[monthKey].totalAbsenceDeductions += absD;
      cycleMap[monthKey].totalLatenessPenalties += lateD;
      cycleMap[monthKey].totalAttendancePenalties += attD;
      cycleMap[monthKey].totalPenaltiesWaived += waived;
      cycleMap[monthKey].totalAllowances += allw;

      if (isPaid) {
        cycleMap[monthKey].paidCount += 1;
      } else {
        cycleMap[monthKey].pendingCount += 1;
      }

      cycleMap[monthKey].items.push(rec);
    });

    const cyclesList = Object.values(cycleMap).map((cycle) => {
      let cycleStatus = "Completed";
      if (cycle.pendingCount > 0 && cycle.paidCount > 0) {
        cycleStatus = "Partially Paid";
      } else if (cycle.pendingCount > 0 && cycle.paidCount === 0) {
        cycleStatus = "Pending";
      } else if (cycle.employeeCount === 0) {
        cycleStatus = "Draft";
      }

      return {
        ...cycle,
        status: cycleStatus,
        grossExpenditure: parseFloat(cycle.grossExpenditure.toFixed(2)),
        netExpenditure: parseFloat(cycle.netExpenditure.toFixed(2)),
        totalAbsenceDeductions: parseFloat(cycle.totalAbsenceDeductions.toFixed(2)),
        totalLatenessPenalties: parseFloat(cycle.totalLatenessPenalties.toFixed(2)),
        totalAttendancePenalties: parseFloat(cycle.totalAttendancePenalties.toFixed(2)),
        totalPenaltiesWaived: parseFloat(cycle.totalPenaltiesWaived.toFixed(2)),
        totalAllowances: parseFloat(cycle.totalAllowances.toFixed(2)),
      };
    });

    return res.status(200).json({
      success: true,
      cycles: cyclesList,
      totalCycles: cyclesList.length,
    });
  } catch (error) {
    console.error("Error in getPayrollCycles:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve payroll cycle history."),
    });
  }
};

/**
 * Salary Projection Calculator for Employees
 * Estimates end-of-month take-home pay based on attendance record, pending/approved leaves, and dynamic simulations
 */
export const getSalaryProjection = async (req, res) => {
  try {
    let {
      employeeId,
      month,
      year,
      simulatedRemainingDays,
      simulatedLateDays,
      simulatedOvertimeHours,
      simRemainingLateDays,
      simRemainingAvgMinutesLate,
      simRemainingUnexcusedAbsences,
      simOvertimeHours,
      simPendingLeaveApproved,
      pendingLeaveOutcome,
      customBaseSalary,
    } = { ...req.query, ...req.body };

    // Support both parameter naming conventions
    if (simRemainingLateDays !== undefined && simulatedLateDays === undefined) {
      simulatedLateDays = simRemainingLateDays;
    }
    if (simRemainingUnexcusedAbsences !== undefined && simulatedRemainingDays === undefined) {
      // Unexcused absences can adjust simulated missed days
    }
    if (simOvertimeHours !== undefined && simulatedOvertimeHours === undefined) {
      simulatedOvertimeHours = simOvertimeHours;
    }
    if (simPendingLeaveApproved !== undefined && !pendingLeaveOutcome) {
      pendingLeaveOutcome = simPendingLeaveApproved ? "approve_paid" : "reject_absent";
    }

    // Security & Scope: Extract token from header or cookies if not decoded by middleware
    if (!req.employee && !req.admin) {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
      const token =
        req.cookies?.employeeToken ||
        req.cookies?.token ||
        bearerToken ||
        req.headers["x-employee-token"] ||
        req.headers["x-admin-token"];

      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key_12345";
      if (token) {
        try {
          const decoded = jwt.verify(token, jwtSecret);
          if (decoded) {
            if (decoded.role === "admin") {
              req.admin = decoded;
            } else {
              req.employee = {
                _id: decoded.id || decoded._id,
                id: decoded.id || decoded._id,
                employeeId: decoded.employeeId,
                role: decoded.role || "employee",
              };
            }
          }
        } catch {
          // Silent catch
        }
      }
    }

    if (req.employee && (!req.admin || req.admin.role === "employee")) {
      employeeId = req.employee.id || req.employee._id || req.employee.employeeId;
    }

    const activeTenantId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId;
    const orgScope = activeTenantId
      ? { $or: [{ organizationId: activeTenantId }, { companyId: activeTenantId }] }
      : (activeTenantId ? { $or: [{ organizationId: activeTenantId }, { companyId: activeTenantId }] } : {});

    // Target employee lookup from Employee and User collections
    let targetEmployee = null;
    if (employeeId && employeeId !== "all") {
      try {
        if (isValidObjectId(employeeId)) {
          targetEmployee = await Employee.findOne({ _id: employeeId, ...orgScope }).lean();
        } else {
          targetEmployee = await Employee.findOne({
            $or: [{ employeeId }, { email: employeeId }],
            ...orgScope,
          }).lean();
        }
      } catch (err) {
        console.warn("Error querying employee in getSalaryProjection:", err.message);
      }
    }

    if (!targetEmployee && !employeeId) {
      targetEmployee = await Employee.findOne({ isActive: true, ...orgScope }).lean();
    }

    // If still not found, check User collection
    if (!targetEmployee && !employeeId) {
      try {
        const targetUser = await User.findOne({ role: "employee", ...orgScope }).lean();
        if (targetUser) {
          targetEmployee = {
            _id: targetUser._id,
            fullName: targetUser.fullName,
            employeeId: targetUser.employeeId || "EMP001",
            email: targetUser.email,
            department: targetUser.department || "Operations",
            position: targetUser.position || "Staff",
            baseSalary: targetUser.baseSalary || 2500,
            salary: targetUser.baseSalary || 2500,
            allowances: targetUser.allowances || 0,
          };
        }
      } catch (err) {
        console.warn("Error querying user fallback in getSalaryProjection:", err.message);
      }
    }

    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: "No active employee found for salary projection.",
      });
    }

    validateOrganizationAccess(targetEmployee, req);

    // Target Month / Year parsing
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const now = new Date();
    let targetYear = parseInt(year, 10) || now.getFullYear();
    let targetMonthIndex = now.getMonth();
    let targetMonthName = monthNames[targetMonthIndex];

    if (month) {
      const raw = String(month).trim();
      const yearMatch = raw.match(/\b(20\d\d)\b/);
      if (yearMatch) targetYear = parseInt(yearMatch[1], 10);
      const foundIdx = monthNames.findIndex((m) =>
        raw.toLowerCase().includes(m.toLowerCase())
      );
      if (foundIdx !== -1) {
        targetMonthIndex = foundIdx;
        targetMonthName = monthNames[foundIdx];
      } else {
        const num = parseInt(raw, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) {
          targetMonthIndex = num - 1;
          targetMonthName = monthNames[targetMonthIndex];
        }
      }
    }

    const formattedTargetMonth = `${targetMonthName} ${targetYear}`;
    const totalWorkingDays = getWorkingDaysInMonth(targetYear, targetMonthIndex);
    const totalDaysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    const isCurrentMonth = now.getFullYear() === targetYear && now.getMonth() === targetMonthIndex;
    const isPastMonth =
      targetYear < now.getFullYear() ||
      (targetYear === now.getFullYear() && targetMonthIndex < now.getMonth());
    const currentDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;

    // Elapsed vs Remaining workdays calculation
    let elapsedWorkDays = 0;
    let remainingWorkDays = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const curDate = new Date(targetYear, targetMonthIndex, day);
      if (isWorkingDay(curDate)) {
        if (isPastMonth) {
          elapsedWorkDays++;
        } else if (isCurrentMonth) {
          if (day <= now.getDate()) {
            elapsedWorkDays++;
          } else {
            remainingWorkDays++;
          }
        } else {
          remainingWorkDays++;
        }
      }
    }

    // Company Settings retrieval
    let companySettings = {
      workStartTime: "08:00",
      absenceDeductionRate: 10,
      lateTier1_amount: 10,
      lateTier2_amount: 30,
      lateTier3_amount: 50,
      lateTier4_amount: 75,
      lateTier5_amount: 100,
      lateTier6_amount: 150,
    };
    try {
      const dbSettings = await CompanySettings.getSingletonSettings();
      if (dbSettings) companySettings = { ...companySettings, ...(dbSettings.toObject ? dbSettings.toObject() : dbSettings) };
    } catch {
      try {
        const dbSettings = await CompanySettings.findOne().lean();
        if (dbSettings) companySettings = { ...companySettings, ...dbSettings };
      } catch (err) {
        console.warn("DB settings query in getSalaryProjection:", err.message);
      }
    }

    const rawBaseSalary =
      parseFloat(customBaseSalary) ||
      Number(targetEmployee.baseSalary || targetEmployee.salary || 0);
    const baseSalary = rawBaseSalary > 0 ? rawBaseSalary : 2500.0;
    const allowances = Number(targetEmployee.allowances || 0);

    const absenceRatePerDay = Number(
      companySettings.absenceDeductionRate !== undefined
        ? companySettings.absenceDeductionRate
        : 10.0
    );
    const dailyBaseRate = parseFloat((baseSalary / (totalWorkingDays || 22)).toFixed(2));
    const hourlyRate = parseFloat((dailyBaseRate / 8).toFixed(2));
    const overtimeHourlyRate = parseFloat((hourlyRate * 1.5).toFixed(2));

    // Attendance records query
    let attendanceRecords = [];
    if (isValidObjectId(targetEmployee._id)) {
      try {
        const dbAtt = await Attendance.find({ employee: targetEmployee._id, ...orgScope }).lean();
        if (dbAtt) attendanceRecords = dbAtt;
      } catch (err) {
        console.warn("DB attendance query in getSalaryProjection:", err.message);
      }
    }

    liveAttendanceStore.forEach((liveAtt) => {
      if (activeTenantId) {
        const attOrg = liveAtt.organizationId ? String(liveAtt.organizationId) : (liveAtt.companyId ? String(liveAtt.companyId) : null);
        if (attOrg && attOrg !== String(activeTenantId)) return;
      }
      if (String(liveAtt.employee) === String(targetEmployee._id)) {
        if (!attendanceRecords.some((a) => a.date === liveAtt.date)) {
          attendanceRecords.push(liveAtt);
        }
      }
    });

    const targetMonthPrefix = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}`;
    const monthAttendance = attendanceRecords.filter((rec) => {
      if (!rec) return false;
      if (typeof rec.date === "string" && rec.date.startsWith(targetMonthPrefix)) return true;
      const d = new Date(rec.date || rec.clockIn);
      return !isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonthIndex;
    });

    let presentDaysToDate = 0;
    let onTimeDaysToDate = 0;
    let lateDaysToDate = 0;
    let explicitAbsentDaysToDate = 0;
    let overtimeHoursToDate = 0;
    let totalWorkHoursToDate = 0;
    let latenessPenaltiesToDate = 0;
    let totalLateMinutes = 0;
    const latenessDetails = [];

    monthAttendance.forEach((rec) => {
      const hrs = Number(rec.workHours) || (rec.status !== "Absent" ? 8 : 0);
      totalWorkHoursToDate += hrs;
      if (rec.overtimeHours) overtimeHoursToDate += Number(rec.overtimeHours);
      else if (hrs > 8) overtimeHoursToDate += hrs - 8;

      const st = (rec.status || "").toLowerCase();
      if (st === "absent") {
        explicitAbsentDaysToDate++;
      } else {
        presentDaysToDate++;
        let isLate = st === "late";
        let penaltyObj = null;

        if (rec.clockIn) {
          penaltyObj = evaluateLatenessPenalty(rec.clockIn, companySettings.workStartTime, companySettings);
          if (penaltyObj.minutesLate > 0) isLate = true;
        } else if (rec.lateMinutes > 0 || rec.delayMinutes > 0) {
          isLate = true;
        }

        if (isLate) {
          lateDaysToDate++;
          const recLateMins = penaltyObj?.minutesLate || Number(rec.lateMinutes || rec.delayMinutes || 0);
          totalLateMinutes += recLateMins;
          let penaltyVal = 0;
          if (rec.latePenalty !== undefined && rec.latePenalty !== null && rec.latePenalty !== "" && !isNaN(Number(rec.latePenalty))) {
            penaltyVal = Math.max(0, Number(rec.latePenalty));
          } else if (penaltyObj && penaltyObj.isLate) {
            penaltyVal = penaltyObj.penalty;
          } else {
            const fallbackCalc = calculateLatenessPenalty(recLateMins, companySettings);
            penaltyVal = fallbackCalc.penalty;
          }
          latenessPenaltiesToDate += penaltyVal;
          latenessDetails.push({
            date: rec.date,
            clockIn: penaltyObj?.clockInFormatted || (rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Late"),
            minutesLate: recLateMins,
            tier: penaltyObj?.tier || rec.penaltyTier || "Late Penalty",
            penalty: penaltyVal,
          });
        } else {
          onTimeDaysToDate++;
        }
      }
    });

    // Leave Context: Approved & Pending
    let allEmployeeLeaves = [];
    if (isValidObjectId(targetEmployee._id)) {
      try {
        const dbLeaves = await Leave.find({ employee: targetEmployee._id, ...orgScope }).lean();
        if (dbLeaves) allEmployeeLeaves = dbLeaves;
      } catch (err) {
        console.warn("DB leave query in getSalaryProjection:", err.message);
      }
    }

    const monthStart = new Date(targetYear, targetMonthIndex, 1);
    const monthEnd = new Date(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999);

    let approvedPaidLeaveDays = 0;
    let approvedUnpaidLeaveDays = 0;
    const approvedLeavesList = [];
    const pendingLeavesList = [];
    let pendingPaidLeaveDays = 0;
    let pendingUnpaidLeaveDays = 0;

    allEmployeeLeaves.forEach((leave) => {
      const lStart = new Date(leave.startDate);
      const lEnd = new Date(leave.endDate || leave.startDate);
      if (isNaN(lStart.getTime())) return;

      const effStart = lStart < monthStart ? monthStart : lStart;
      const effEnd = lEnd > monthEnd ? monthEnd : lEnd;

      if (effStart <= effEnd) {
        let workDaysCount = 0;
        const cur = new Date(effStart);
        while (cur <= effEnd) {
          if (isWorkingDay(cur)) workDaysCount++;
          cur.setDate(cur.getDate() + 1);
        }

        if (workDaysCount > 0) {
          const statusLower = (leave.status || "pending").toLowerCase();
          const isUnpaid = (leave.leaveType || "").toLowerCase().includes("unpaid");

          if (statusLower === "approved") {
            if (isUnpaid) approvedUnpaidLeaveDays += workDaysCount;
            else approvedPaidLeaveDays += workDaysCount;
            approvedLeavesList.push({
              _id: leave._id,
              leaveType: leave.leaveType,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: workDaysCount,
              status: "Approved",
              isPaid: !isUnpaid,
            });
          } else if (statusLower === "pending") {
            if (isUnpaid) pendingUnpaidLeaveDays += workDaysCount;
            else pendingPaidLeaveDays += workDaysCount;
            pendingLeavesList.push({
              _id: leave._id,
              leaveType: leave.leaveType,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: workDaysCount,
              reason: leave.reason || "Personal Leave",
              status: "Pending",
              isPaid: !isUnpaid,
            });
          }
        }
      }
    });

    const totalPendingDays = pendingPaidLeaveDays + pendingUnpaidLeaveDays;
    const pendingLeavesCount = pendingLeavesList.length;

    // Actual Unexcused Absences to date:
    // Total business days elapsed minus attended days minus approved leaves
    const elapsedAccountedDays =
      presentDaysToDate +
      explicitAbsentDaysToDate +
      approvedPaidLeaveDays +
      approvedUnpaidLeaveDays;
    const unexplainedAbsencesToDate = Math.max(0, elapsedWorkDays - elapsedAccountedDays);
    const unexcusedAbsentDays = explicitAbsentDaysToDate + unexplainedAbsencesToDate;
    const monthToDateAbsenceDeductions = parseFloat((unexcusedAbsentDays * absenceRatePerDay).toFixed(2));
    const monthToDateLatenessPenalties = parseFloat(latenessPenaltiesToDate.toFixed(2));
    const totalMtdDeductions = parseFloat(
      (monthToDateLatenessPenalties + monthToDateAbsenceDeductions).toFixed(2)
    );

    // ==========================================
    // 1. BASELINE PROJECTION (100% On-Time Remaining Days)
    // ==========================================
    const baselinePresentDays = presentDaysToDate + remainingWorkDays;
    const baselineUnexcusedAbsences = unexcusedAbsentDays;
    const baselineAbsenceDeduction = monthToDateAbsenceDeductions;
    const baselineLatenessDeduction = monthToDateLatenessPenalties;
    const baselineOvertimePay = parseFloat(
      (overtimeHoursToDate * overtimeHourlyRate).toFixed(2)
    );
    const baselineGross = parseFloat((baseSalary + allowances + baselineOvertimePay).toFixed(2));
    const baselineDeductions = parseFloat(
      (baselineAbsenceDeduction + baselineLatenessDeduction).toFixed(2)
    );
    const baselineNetPay = parseFloat(Math.max(0, baselineGross - baselineDeductions).toFixed(2));

    // ==========================================
    // 2. TREND-BASED PROJECTION (Current Pace Projected Forward)
    // ==========================================
    const attendanceRateToDate = elapsedWorkDays > 0 ? presentDaysToDate / elapsedWorkDays : 1;
    const avgLatePenaltyPerDay = elapsedWorkDays > 0 ? monthToDateLatenessPenalties / elapsedWorkDays : 0;
    const avgOvertimePerDay = elapsedWorkDays > 0 ? overtimeHoursToDate / elapsedWorkDays : 0;
    const avgLateDaysPerDay = elapsedWorkDays > 0 ? lateDaysToDate / elapsedWorkDays : 0;

    const trendProjectedPresent = Math.round(
      presentDaysToDate + remainingWorkDays * attendanceRateToDate
    );
    const trendRemainingMissedDays = Math.max(
      0,
      remainingWorkDays - Math.round(remainingWorkDays * attendanceRateToDate)
    );
    const trendTotalAbsences = unexcusedAbsentDays + trendRemainingMissedDays;
    const trendAbsenceDeduction = parseFloat((trendTotalAbsences * absenceRatePerDay).toFixed(2));
    const trendLatenessDeduction = parseFloat(
      (monthToDateLatenessPenalties + remainingWorkDays * avgLatePenaltyPerDay).toFixed(2)
    );
    const trendProjectedOvertimeHours = parseFloat(
      (overtimeHoursToDate + remainingWorkDays * avgOvertimePerDay).toFixed(1)
    );
    const trendOvertimePay = parseFloat((trendProjectedOvertimeHours * overtimeHourlyRate).toFixed(2));
    const trendGross = parseFloat((baseSalary + allowances + trendOvertimePay).toFixed(2));
    const trendDeductions = parseFloat((trendAbsenceDeduction + trendLatenessDeduction).toFixed(2));
    const trendNetPay = parseFloat(Math.max(0, trendGross - trendDeductions).toFixed(2));
    const trendProjectedLateDays = Math.round(lateDaysToDate + remainingWorkDays * avgLateDaysPerDay);

    // ==========================================
    // 3. CUSTOM SIMULATION PROJECTION
    // ==========================================
    const simRemainingDays =
      simulatedRemainingDays !== undefined && !isNaN(Number(simulatedRemainingDays))
        ? Math.max(0, Math.min(remainingWorkDays, Number(simulatedRemainingDays)))
        : remainingWorkDays;

    const simLateDays =
      simulatedLateDays !== undefined && !isNaN(Number(simulatedLateDays))
        ? Math.max(0, Number(simulatedLateDays))
        : 0;

    const simExtraOvertime =
      simulatedOvertimeHours !== undefined && !isNaN(Number(simulatedOvertimeHours))
        ? Math.max(0, Number(simulatedOvertimeHours))
        : 0;

    const simUnexcused =
      simRemainingUnexcusedAbsences !== undefined && !isNaN(Number(simRemainingUnexcusedAbsences))
        ? Math.max(0, Number(simRemainingUnexcusedAbsences))
        : 0;

    let simPendingAbsenceDays = 0;
    if (pendingLeaveOutcome === "approve_unpaid" || pendingLeaveOutcome === "reject_absent" || pendingLeaveOutcome === "unpaid") {
      simPendingAbsenceDays = totalPendingDays;
    }

    const simMissedRemainingDays = Math.max(0, remainingWorkDays - simRemainingDays) + simUnexcused;
    const simTotalAbsences = unexcusedAbsentDays + simMissedRemainingDays + simPendingAbsenceDays;
    const simAbsenceDeduction = parseFloat((simTotalAbsences * absenceRatePerDay).toFixed(2));

    const avgTierLateCost = Number(companySettings.lateTier1_amount || 5);
    const simLatenessDeduction = parseFloat(
      (monthToDateLatenessPenalties + simLateDays * avgTierLateCost).toFixed(2)
    );

    const simTotalOvertimeHours = parseFloat((overtimeHoursToDate + simExtraOvertime).toFixed(1));
    const simOvertimePay = parseFloat((simTotalOvertimeHours * overtimeHourlyRate).toFixed(2));

    const simGross = parseFloat((baseSalary + allowances + simOvertimePay).toFixed(2));
    const simDeductions = parseFloat((simAbsenceDeduction + simLatenessDeduction).toFixed(2));
    const simNetPay = parseFloat(Math.max(0, simGross - simDeductions).toFixed(2));

    return res.status(200).json({
      success: true,
      month: formattedTargetMonth,
      targetYear,
      targetMonthIndex,
      targetMonthName,
      employee: {
        _id: targetEmployee._id,
        employeeId: targetEmployee.employeeId || "EMP001",
        fullName: targetEmployee.fullName || "Employee",
        department: targetEmployee.department || "Operations",
        position: targetEmployee.position || "Staff",
        baseSalary,
        salary: baseSalary,
        allowances,
        dailyRate: dailyBaseRate,
        hourlyRate,
      },
      calendar: {
        currentDay,
        totalDaysInMonth,
        totalWorkingDays,
        elapsedWorkdays: elapsedWorkDays,
        elapsedWorkDays,
        remainingWorkdays: remainingWorkDays,
        remainingWorkDays,
        monthName: targetMonthName,
        year: targetYear,
        isCurrentMonth,
        isPastMonth,
        progressLabel: `Day ${currentDay} / ${totalDaysInMonth} | ${elapsedWorkDays} workdays elapsed · ${remainingWorkDays} remaining`,
      },
      rates: {
        baseSalary,
        dailyBaseRate,
        hourlyRate,
        overtimeHourlyRate,
        absenceRatePerDay,
        allowances,
      },
      attendance: {
        daysWorked: presentDaysToDate,
        attendedDays: presentDaysToDate,
        onTimeCount: onTimeDaysToDate,
        onTimeDays: onTimeDaysToDate,
        lateDaysCount: lateDaysToDate,
        lateDays: lateDaysToDate,
        totalLateMinutes,
        unexcusedAbsentDays,
        explicitAbsentDays: explicitAbsentDaysToDate,
        attendanceRate: attendanceRateToDate,
      },
      deductions: {
        monthToDateLatenessPenalties,
        monthToDateAbsenceDeductions,
        totalMtdDeductions,
        latenessDeductions: monthToDateLatenessPenalties,
        absenceDeductions: monthToDateAbsenceDeductions,
        totalDeductionsToDate: totalMtdDeductions,
        latenessDetails,
      },
      currentMonthToDate: {
        daysWorked: presentDaysToDate,
        attendedDays: presentDaysToDate,
        onTimeCount: onTimeDaysToDate,
        onTimeDays: onTimeDaysToDate,
        lateDaysCount: lateDaysToDate,
        lateDays: lateDaysToDate,
        totalLateMinutes,
        unexcusedAbsentDays,
        accruedLatenessPenalties: monthToDateLatenessPenalties,
        accruedAbsenteeismDeduction: monthToDateAbsenceDeductions,
        accruedDeductionsTotal: totalMtdDeductions,
        totalMtdDeductions,
        presentDays: presentDaysToDate,
        totalWorkHours: totalWorkHoursToDate,
        overtimeHours: overtimeHoursToDate,
      },
      actualToDate: {
        daysWorked: presentDaysToDate,
        presentDays: presentDaysToDate,
        onTimeDays: onTimeDaysToDate,
        onTimeCount: onTimeDaysToDate,
        lateDays: lateDaysToDate,
        lateDaysCount: lateDaysToDate,
        totalLateMinutes,
        absentDays: unexcusedAbsentDays,
        unexcusedAbsentDays,
        totalWorkHours: totalWorkHoursToDate,
        overtimeHours: overtimeHoursToDate,
        latenessDeductions: monthToDateLatenessPenalties,
        absenceDeductions: monthToDateAbsenceDeductions,
        totalDeductionsToDate: totalMtdDeductions,
        latenessDetails,
      },
      pendingLeaves: {
        count: pendingLeavesCount,
        totalDays: totalPendingDays,
        pendingLeavesList,
        pendingPaidLeaveDays,
        pendingUnpaidLeaveDays,
      },
      pendingLeavesSummary: {
        count: pendingLeavesCount,
        totalDays: totalPendingDays,
        pendingPaidLeaveDays,
        pendingUnpaidLeaveDays,
        list: pendingLeavesList,
      },
      leaveContext: {
        approvedPaidLeaveDays,
        approvedUnpaidLeaveDays,
        approvedLeavesList,
        pendingPaidLeaveDays,
        pendingUnpaidLeaveDays,
        totalPendingDays,
        pendingLeavesList,
      },
      projections: {
        baseline: {
          title: "Best-Case (100% On-Time)",
          tag: "Optimal",
          description:
            "Zero further lateness or absences for the remaining workdays.",
          projectedPresentDays: baselinePresentDays,
          projectedAbsenceDays: baselineUnexcusedAbsences,
          totalMonthLateDays: lateDaysToDate,
          totalMonthAbsentDays: baselineUnexcusedAbsences,
          projectedOvertimeHours: overtimeHoursToDate,
          projectedOvertimePay: baselineOvertimePay,
          projectedGrossPay: baselineGross,
          projectedGrossSalary: baselineGross,
          projectedLatenessPenalties: baselineLatenessDeduction,
          projectedAbsenteeismDeductions: baselineAbsenceDeduction,
          projectedSSNIT: 0,
          projectedTax: 0,
          projectedDeductions: baselineDeductions,
          projectedTotalDeductions: baselineDeductions,
          projectedNetPay: baselineNetPay,
          projectedNetSalary: baselineNetPay,
          projectedTakeHomePay: baselineNetPay,
          deltaVsBaseSalary: parseFloat((baselineNetPay - baseSalary).toFixed(2)),
          absenceDeduction: baselineAbsenceDeduction,
          latenessDeduction: baselineLatenessDeduction,
        },
        trend: {
          title: "Current Trend (Pace)",
          tag: "Recommended",
          description:
            "Assumes your attendance and punctuality continue at your current month-to-date average.",
          projectedPresentDays: trendProjectedPresent,
          projectedAbsenceDays: trendTotalAbsences,
          totalMonthLateDays: trendProjectedLateDays,
          totalMonthAbsentDays: trendTotalAbsences,
          projectedOvertimeHours: trendProjectedOvertimeHours,
          projectedOvertimePay: trendOvertimePay,
          projectedGrossPay: trendGross,
          projectedGrossSalary: trendGross,
          projectedLatenessPenalties: trendLatenessDeduction,
          projectedAbsenteeismDeductions: trendAbsenceDeduction,
          projectedSSNIT: 0,
          projectedTax: 0,
          projectedDeductions: trendDeductions,
          projectedTotalDeductions: trendDeductions,
          projectedNetPay: trendNetPay,
          projectedNetSalary: trendNetPay,
          projectedTakeHomePay: trendNetPay,
          deltaVsBaseSalary: parseFloat((trendNetPay - baseSalary).toFixed(2)),
          absenceDeduction: trendAbsenceDeduction,
          latenessDeduction: trendLatenessDeduction,
        },
        simulation: {
          title: "Custom Simulation",
          tag: "Interactive",
          description:
            "Simulate remaining late days, overtime hours, and unexcused absences with sliders.",
          simulatedRemainingDays: simRemainingDays,
          simulatedLateDays: simLateDays,
          totalMonthLateDays: lateDaysToDate + simLateDays,
          totalMonthAbsentDays: simTotalAbsences,
          simulatedOvertimeHours: simTotalOvertimeHours,
          pendingLeaveOutcome: pendingLeaveOutcome || "approve_paid",
          projectedGrossPay: simGross,
          projectedGrossSalary: simGross,
          projectedLatenessPenalties: simLatenessDeduction,
          projectedAbsenteeismDeductions: simAbsenceDeduction,
          projectedSSNIT: 0,
          projectedTax: 0,
          projectedDeductions: simDeductions,
          projectedTotalDeductions: simDeductions,
          projectedNetPay: simNetPay,
          projectedNetSalary: simNetPay,
          projectedTakeHomePay: simNetPay,
          deltaVsBaseSalary: parseFloat((simNetPay - baseSalary).toFixed(2)),
          absenceDeduction: simAbsenceDeduction,
          latenessDeduction: simLatenessDeduction,
          overtimePay: simOvertimePay,
        },
        simulated: {
          title: "Custom Simulation",
          tag: "Interactive",
          description:
            "Simulate remaining late days, overtime hours, and unexcused absences with sliders.",
          simulatedRemainingDays: simRemainingDays,
          simulatedLateDays: simLateDays,
          totalMonthLateDays: lateDaysToDate + simLateDays,
          totalMonthAbsentDays: simTotalAbsences,
          simulatedOvertimeHours: simTotalOvertimeHours,
          pendingLeaveOutcome: pendingLeaveOutcome || "approve_paid",
          projectedGrossPay: simGross,
          projectedGrossSalary: simGross,
          projectedLatenessPenalties: simLatenessDeduction,
          projectedAbsenteeismDeductions: simAbsenceDeduction,
          projectedSSNIT: 0,
          projectedTax: 0,
          projectedDeductions: simDeductions,
          projectedTotalDeductions: simDeductions,
          projectedNetPay: simNetPay,
          projectedNetSalary: simNetPay,
          projectedTakeHomePay: simNetPay,
          deltaVsBaseSalary: parseFloat((simNetPay - baseSalary).toFixed(2)),
          absenceDeduction: simAbsenceDeduction,
          latenessDeduction: simLatenessDeduction,
          overtimePay: simOvertimePay,
        },
      },
    });
  } catch (error) {
    console.error("Error in getSalaryProjection:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate salary projection."),
    });
  }
};

// Retrieve 6-Month Attendance Penalty Impact Analytics on Total Payroll Cost & Current Month Lateness Deductions
export {
  getPenaltyImpactAnalytics,
  getCurrentMonthLatenessAnalytics,
} from "./analyticsController.js";

// Automated Live Monthly Payroll Calculation for Authenticated Employee
import {
  calculateEmployeeMonthPayroll,
  calculateAllEmployeesMonthlyRun,
} from "../services/payrollCalculationService.js";

export const getEmployeeLivePayrollSummary = async (req, res) => {
  try {
    let rawEmployeeId = req.employee?._id || req.employee?.id || req.user?._id || req.user?.id;
    const { month, year, employeeId } = req.query;

    if (employeeId && (req.admin || req.employee?.role === "admin")) {
      rawEmployeeId = employeeId;
    }

    if (!rawEmployeeId) {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
      const token =
        req.cookies?.employeeToken ||
        req.cookies?.token ||
        bearerToken ||
        req.headers["x-employee-token"];

      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key_12345";
      if (token) {
        try {
          const decoded = jwt.verify(token, jwtSecret);
          if (decoded) {
            rawEmployeeId = decoded.id || decoded._id || decoded.employeeId;
          }
        } catch {
          // invalid token
        }
      }
    }

    if (!rawEmployeeId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view payroll summary.",
      });
    }

    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId;
    const orgScope = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : (orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {});

    const calculation = await calculateEmployeeMonthPayroll({
      employeeInput: rawEmployeeId,
      month: month || req.query.monthStr,
      year,
      isFullMonthAudit: false,
    });

    // Check if an official published payslip exists in MongoDB for this employee
    let publishedPayslip = null;
    if (isValidObjectId(rawEmployeeId)) {
      try {
        publishedPayslip = await Payroll.findOne({
          employee: rawEmployeeId,
          status: { $in: ["Published", "published", "Paid", "paid"] },
          ...orgScope,
        })
          .sort({ paymentDate: -1, createdAt: -1 })
          .lean();
      } catch (pErr) {
        console.warn("DB payroll check in live summary:", pErr.message);
      }
    }

    if (!publishedPayslip && calculation.employee?._id) {
      try {
        publishedPayslip = await Payroll.findOne({
          employee: calculation.employee._id,
          status: { $in: ["Published", "published", "Paid", "paid"] },
          ...orgScope,
        })
          .sort({ paymentDate: -1, createdAt: -1 })
          .lean();
      } catch {
        // fallback
      }
    }

    if (!publishedPayslip) {
      const match = livePayrollStore.find((p) => {
        if (orgId) {
          const pOrg = p.organizationId ? String(p.organizationId) : (p.companyId ? String(p.companyId) : null);
          if (pOrg && pOrg !== String(orgId)) return false;
        }
        const pEmpId = String(p.employee?._id || p.employee || p.employeeId || "");
        const status = String(p.status || "").toLowerCase();
        const isPublished = status === "published" || status === "paid";
        const empIdStr = String(rawEmployeeId || calculation.employee?._id || "");
        const empCode = String(calculation.employee?.employeeId || "");
        return isPublished && (pEmpId === empIdStr || pEmpId === empCode || p.employeeId === empCode);
      });
      if (match) {
        publishedPayslip = match;
      }
    }

    const finalNetPay = publishedPayslip?.netSalary !== undefined
      ? publishedPayslip.netSalary
      : (publishedPayslip?.netPay !== undefined ? publishedPayslip.netPay : calculation.netTakeHomePay);

    const finalBaseSalary = publishedPayslip?.basicSalary || publishedPayslip?.baseSalary || calculation.baseSalary;
    const finalAbsenceDeductions = publishedPayslip?.absentDaysDeduction !== undefined
      ? publishedPayslip.absentDaysDeduction
      : calculation.absenceDeductions;
    const finalLatenessDeductions = publishedPayslip?.latenessDeduction !== undefined
      ? publishedPayslip.latenessDeduction
      : calculation.latenessDeductions;

    return res.status(200).json({
      success: true,
      hasPublishedPayslip: !!publishedPayslip,
      publishedPayslip,
      baseSalary: finalBaseSalary,
      workdaysElapsed: calculation.workdaysElapsed,
      attendedDays: calculation.attendedDays,
      lateDays: calculation.lateDays,
      onTimeDays: calculation.onTimeDays,
      approvedLeaveDays: calculation.approvedLeaveDays,
      totalLateMinutes: calculation.totalLateMinutes,
      latenessDeductions: finalLatenessDeductions,
      absentDays: calculation.absentDays,
      absenceDeductions: finalAbsenceDeductions,
      allowances: publishedPayslip?.allowances || calculation.allowances,
      otherCustomDeductions: calculation.otherCustomDeductions,
      netTakeHomePay: finalNetPay,
      netSalary: finalNetPay,
      employee: calculation.employee,
      month: calculation.month,
      monthName: calculation.monthName,
      companySettings: calculation.companySettings,
      calendar: calculation.calendar,
      dailyAudit: calculation.dailyAudit,
      summary: {
        ...calculation,
        netTakeHomePay: finalNetPay,
        netSalary: finalNetPay,
        baseSalary: finalBaseSalary,
        absenceDeductions: finalAbsenceDeductions,
        latenessDeductions: finalLatenessDeductions,
      },
    });
  } catch (error) {
    console.error("Error in getEmployeeLivePayrollSummary:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate live payroll summary."),
    });
  }
};

// Batch Monthly Payroll Run Aggregation across All Active Employees for Admin
export const getMonthlyPayrollRun = async (req, res) => {
  try {
    const { month, year } = req.query;
    const organizationId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;

    const runResult = await calculateAllEmployeesMonthlyRun({
      month,
      year,
      organizationId: organizationId || null,
    });

    return res.status(200).json({
      success: true,
      ...runResult,
    });
  } catch (error) {
    console.error("Error in getMonthlyPayrollRun:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate batch monthly payroll run."),
    });
  }
};



