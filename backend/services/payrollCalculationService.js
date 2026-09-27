import mongoose from "mongoose";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { Leave } from "../models/leaveModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { Payroll } from "../models/payrollModel.js";
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
export const evaluateLateness = evaluateLatenessPenalty;

const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Parses any month string ("2026-08", "August 2026", "08-2026", etc.) or defaults to current.
 */
export const parseMonthYear = (monthInput, yearInput) => {
  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth(); // 0-indexed

  if (monthInput) {
    const cleanStr = String(monthInput).trim();

    // Check YYYY-MM format
    const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      monthIndex = parseInt(isoMatch[2], 10) - 1;
    } else {
      // Check for Month Name (e.g., "August" or "August 2026")
      const foundIdx = MONTH_NAMES.findIndex(
        (m) => m.toLowerCase() === cleanStr.toLowerCase() || cleanStr.toLowerCase().startsWith(m.toLowerCase())
      );
      if (foundIdx !== -1) {
        monthIndex = foundIdx;
        const yMatch = cleanStr.match(/(\d{4})/);
        if (yMatch) {
          year = parseInt(yMatch[1], 10);
        }
      }
    }
  }

  if (yearInput && !isNaN(Number(yearInput))) {
    year = parseInt(yearInput, 10);
  }

  const monthNumber = monthIndex + 1;
  const monthStr = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const monthName = `${MONTH_NAMES[monthIndex]} ${year}`;

  return { year, monthIndex, monthNumber, monthStr, monthName };
};

/**
 * Returns all business days in a month (the admin's working days), optionally up to an asOfDate.
 */
export const getMonthlyBusinessDays = (year, monthIndex, auditThroughDate = null) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const allBusinessDays = [];
  const elapsedBusinessDays = [];

  const maxDay = auditThroughDate ? Math.min(daysInMonth, auditThroughDate.getDate()) : daysInMonth;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    const dayOfWeek = d.getDay();

    if (isWorkingDay(d)) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayObj = {
        dateStr,
        dayNumber: day,
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        date: d,
        isElapsed: day <= maxDay,
        isFuture: day > maxDay,
      };

      allBusinessDays.push(dayObj);
      if (day <= maxDay) {
        elapsedBusinessDays.push(dayObj);
      }
    }
  }

  return {
    totalBusinessDaysInMonth: allBusinessDays.length || 22,
    allBusinessDays,
    elapsedBusinessDays,
    totalElapsedDays: elapsedBusinessDays.length,
    futureBusinessDays: allBusinessDays.filter((b) => b.dayNumber > maxDay),
    totalFutureDays: allBusinessDays.filter((b) => b.dayNumber > maxDay).length,
  };
};

/**
 * Retrieves the singleton company settings with standard defaults.
 */
export const getActiveCompanySettings = async () => {
  let settings = {
    workStartTime: "08:00",
    absenceDeductionRate: 15,
    lateTier1_amount: 5,
    lateTier2_amount: 10,
    lateTier3_amount: 20,
    lateTier4_amount: 30,
    lateTier5_amount: 50,
    lateTier6_amount: 75,
  };

  try {
    if (typeof CompanySettings.getSingletonSettings === "function") {
      const doc = await CompanySettings.getSingletonSettings();
      if (doc) {
        settings = { ...settings, ...(doc.toObject ? doc.toObject() : doc) };
      }
    } else {
      const doc = await CompanySettings.findOne().lean();
      if (doc) {
        settings = { ...settings, ...doc };
      }
    }
  } catch (err) {
    console.warn("Could not query CompanySettings:", err.message);
  }

  // Ensure default tier amounts if 0 or undefined
  if (!settings.lateTier1_amount) settings.lateTier1_amount = 5;
  if (!settings.lateTier2_amount) settings.lateTier2_amount = 10;
  if (!settings.lateTier3_amount) settings.lateTier3_amount = 20;
  if (!settings.lateTier4_amount) settings.lateTier4_amount = 30;
  if (!settings.lateTier5_amount) settings.lateTier5_amount = 50;
  if (!settings.lateTier6_amount) settings.lateTier6_amount = 75;
  if (!settings.absenceDeductionRate) settings.absenceDeductionRate = 15;

  return settings;
};

/**
 * Audits a single employee for a specific month across all business days.
 * Evaluates workdays, lateness fines, and unexcused absences.
 */
export const calculateEmployeeMonthPayroll = async ({
  employeeInput,
  month = null,
  year = null,
  isFullMonthAudit = false,
  companySettings = null,
}) => {
  const settings = companySettings || (await getActiveCompanySettings());
  const { year: parsedYear, monthIndex, monthStr, monthName } = parseMonthYear(month, year);

  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === parsedYear && now.getMonth() === monthIndex;

  // If in current month and not full month closure audit, audit up to today
  const auditThroughDate = isCurrentMonth && !isFullMonthAudit ? now : null;
  const { allBusinessDays, elapsedBusinessDays, totalBusinessDaysInMonth, totalElapsedDays } =
    getMonthlyBusinessDays(parsedYear, monthIndex, auditThroughDate);

  const daysToAudit = isFullMonthAudit ? allBusinessDays : elapsedBusinessDays;
  const workdaysElapsed = daysToAudit.length;

  // 1. Resolve Employee record
  let employee = null;
  let employeeIdStr = "";
  let validObjectId = null;

  if (typeof employeeInput === "object" && employeeInput !== null) {
    employee = employeeInput;
    employeeIdStr = employee._id ? employee._id.toString() : String(employee.id || employee.employeeId);
    if (isValidObjectId(employeeIdStr)) validObjectId = employeeIdStr;
  } else if (typeof employeeInput === "string") {
    employeeIdStr = employeeInput;
    if (isValidObjectId(employeeIdStr)) {
      validObjectId = employeeIdStr;
      employee = await Employee.findById(employeeIdStr).lean();
    } else {
      employee = await Employee.findOne({
        $or: [{ employeeId: employeeIdStr }, { email: employeeIdStr }],
      }).lean();
      if (employee && employee._id) validObjectId = employee._id.toString();
    }
  }

  if (!employee && validObjectId) {
    const userDoc = await User.findById(validObjectId).lean();
    if (userDoc) {
      employee = {
        _id: userDoc._id,
        fullName: userDoc.fullName,
        email: userDoc.email,
        employeeId: userDoc.employeeId || "EMP-001",
        role: userDoc.role || "employee",
        baseSalary: userDoc.baseSalary || 2500,
        department: userDoc.department || "Engineering",
        position: userDoc.position || "Staff",
        status: userDoc.status || "active",
        isActive: userDoc.isActive !== false,
      };
    }
  }

  if (!employee) {
    throw Object.assign(new Error(`Employee not found for payroll calculation: ${employeeIdStr || "unknown"}`), { statusCode: 404 });
  }

  const baseSalary = Number(employee.baseSalary ?? employee.salary ?? 0);

  // 2. Fetch Employee Attendance Records for the month
  let attendanceRecords = [];
  if (validObjectId || employee.employeeId) {
    try {
      const orClauses = [];
      if (validObjectId) orClauses.push({ employee: validObjectId });
      if (employee._id) orClauses.push({ employee: employee._id });
      if (employee.employeeId) orClauses.push({ employeeId: employee.employeeId });

      const dbAtt = await Attendance.find({
        $and: [
          { $or: orClauses },
          {
            $or: [
              { date: { $regex: `^${monthStr}` } },
              {
                clockIn: {
                  $gte: new Date(parsedYear, monthIndex, 1),
                  $lte: new Date(parsedYear, monthIndex + 1, 0, 23, 59, 59),
                },
              },
            ],
          },
        ],
      }).lean();

      if (dbAtt && dbAtt.length > 0) {
        attendanceRecords = dbAtt;
      }
    } catch (err) {
      console.warn("Error querying MongoDB attendance records:", err.message);
    }
  }

  // Merge live attendance store
  if (liveAttendanceStore) {
    liveAttendanceStore.forEach((liveAtt) => {
      const matchEmp =
        String(liveAtt.employee) === String(validObjectId) ||
        String(liveAtt.employee?._id) === String(validObjectId) ||
        String(liveAtt.employee) === String(employee._id) ||
        liveAtt.employee?.employeeId === employee.employeeId;

      if (matchEmp && liveAtt.date && liveAtt.date.startsWith(monthStr)) {
        const existingIdx = attendanceRecords.findIndex((a) => a.date === liveAtt.date);
        if (existingIdx >= 0) {
          attendanceRecords[existingIdx] = { ...attendanceRecords[existingIdx], ...liveAtt };
        } else {
          attendanceRecords.push(liveAtt);
        }
      }
    });
  }

  // 3. Fetch Approved Leaves for Employee strictly overlapping target month
  let approvedLeaves = [];
  const monthStartDate = new Date(parsedYear, monthIndex, 1);
  const monthEndDate = new Date(parsedYear, monthIndex + 1, 0, 23, 59, 59, 999);
  if (validObjectId || employee._id) {
    try {
      const dbLeaves = await Leave.find({
        $and: [
          { $or: [{ employee: validObjectId }, { employee: employee._id }] },
          { status: "Approved" },
          {
            $or: [
              { startDate: { $lte: monthEndDate }, endDate: { $gte: monthStartDate } },
              { startDate: { $gte: monthStartDate, $lte: monthEndDate } },
            ],
          },
        ],
      }).lean();
      if (dbLeaves && dbLeaves.length > 0) {
        approvedLeaves = dbLeaves;
      }
    } catch (err) {
      console.warn("Error querying MongoDB approved leaves:", err.message);
    }
  }

  // Merge live leave store
  if (liveLeaveStore && liveLeaveStore.length > 0) {
    const matchingLiveLeaves = liveLeaveStore.filter(
      (l) =>
        l.status === "Approved" &&
        (String(l.employee?._id) === String(validObjectId) ||
          String(l.employee?._id) === String(employee._id) ||
          l.employee?.employeeId === employee.employeeId)
    );
    matchingLiveLeaves.forEach((liveL) => {
      if (!approvedLeaves.some((r) => String(r._id) === String(liveL._id))) {
        approvedLeaves.push(liveL);
      }
    });
  }

  // 4. Perform Day-by-Day Workday Audit
  const dailyAudit = [];
  let attendedDays = 0;
  let lateDays = 0;
  let onTimeDays = 0;
  let totalLateMinutes = 0;
  let totalLatenessDeductions = 0;
  let approvedLeaveDays = 0;
  let absentDays = 0;

  // Dynamic Daily Salary Rate = Base Salary / Total Business Days in Month (Rule 3)
  const dailySalaryRate = totalBusinessDaysInMonth > 0
    ? parseFloat((baseSalary / totalBusinessDaysInMonth).toFixed(2))
    : 0;
  const absenceDeductionRate = dailySalaryRate > 0 ? dailySalaryRate : Number(settings.absenceDeductionRate || 15);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  daysToAudit.forEach((businessDay) => {
    const { dateStr, dayName, dayNumber } = businessDay;
    const bDate = new Date(parsedYear, monthIndex, dayNumber);
    const isFutureDay = isCurrentMonth && bDate > todayStart;

    // RULE 1: Future / Unelapsed Days Are Never Counted as Absent
    if (!isFullMonthAudit && isFutureDay) {
      dailyAudit.push({
        date: dateStr,
        dayName,
        status: "Unelapsed / Future",
        isAttended: false,
        isOnTime: false,
        isLate: false,
        isApprovedLeave: false,
        isAbsent: false,
        clockIn: null,
        lateMinutes: 0,
        tier: "N/A",
        penalty: 0,
        reason: "Future day - strictly excluded from absences",
      });
      return;
    }

    // Check Attendance check-in on this date
    const attRecord = attendanceRecords.find((a) => a.date === dateStr);
    const isExplicitAbsent = attRecord && (attRecord.status || "").toLowerCase() === "absent";
    const hasCheckIn = attRecord && (attRecord.clockIn || (attRecord.status && attRecord.status !== "Absent" && !isExplicitAbsent));

    // Check if covered by Approved Leave
    const isApprovedLeave = approvedLeaves.some((leave) => {
      const s = new Date(leave.startDate);
      const e = new Date(leave.endDate || leave.startDate);
      const d = new Date(dateStr);
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      d.setHours(12, 0, 0, 0);
      return d >= s && d <= e;
    });

    if (hasCheckIn && !isExplicitAbsent) {
      // Attended
      attendedDays++;
      const latenessEval = evaluateLateness(attRecord.clockIn, settings.workStartTime, settings);

      if (latenessEval.isLate || attRecord.status === "Late" || (attRecord.lateMinutes && attRecord.lateMinutes > 0)) {
        lateDays++;
        const lateMins = latenessEval.minutesLate || Number(attRecord.lateMinutes || attRecord.delayMinutes || 15);
        totalLateMinutes += lateMins;

        // Custom penalty override or calculated
        const latePenalty = attRecord.latePenalty !== undefined && attRecord.latePenalty > 0
          ? Number(attRecord.latePenalty)
          : latenessEval.penalty;

        totalLatenessDeductions += latePenalty;

        dailyAudit.push({
          date: dateStr,
          dayName,
          status: "Late",
          isAttended: true,
          isOnTime: false,
          isLate: true,
          isApprovedLeave: false,
          isAbsent: false,
          clockIn: latenessEval.clockInFormatted !== "--" ? latenessEval.clockInFormatted : (attRecord.clockIn ? new Date(attRecord.clockIn).toLocaleTimeString() : "08:30 AM"),
          lateMinutes: lateMins,
          tier: latenessEval.tier,
          penalty: latePenalty,
          reason: `Clocked in late (${lateMins} mins delay)`,
        });
      } else {
        onTimeDays++;
        dailyAudit.push({
          date: dateStr,
          dayName,
          status: "On Time",
          isAttended: true,
          isOnTime: true,
          isLate: false,
          isApprovedLeave: false,
          isAbsent: false,
          clockIn: latenessEval.clockInFormatted !== "--" ? latenessEval.clockInFormatted : (attRecord.clockIn ? new Date(attRecord.clockIn).toLocaleTimeString() : "08:00 AM"),
          lateMinutes: 0,
          tier: "On Time",
          penalty: 0,
          reason: "Clocked in on time",
        });
      }
    } else if (isApprovedLeave) {
      // Approved Leave -> Excused, 0 penalty
      approvedLeaveDays++;
      dailyAudit.push({
        date: dateStr,
        dayName,
        status: "Approved Leave",
        isAttended: false,
        isOnTime: false,
        isLate: false,
        isApprovedLeave: true,
        isAbsent: false,
        clockIn: null,
        lateMinutes: 0,
        tier: "N/A",
        penalty: 0,
        reason: "Excused Approved Leave (0 penalty)",
      });
    } else {
      // Unworked business day -> Automatic Unexcused Absence
      absentDays++;
      const penalty = absenceDeductionRate;
      dailyAudit.push({
        date: dateStr,
        dayName,
        status: "Unexcused Absent",
        isAttended: false,
        isOnTime: false,
        isLate: false,
        isApprovedLeave: false,
        isAbsent: true,
        clockIn: null,
        lateMinutes: 0,
        tier: "Absence Rate",
        penalty,
        reason: "Unexcused Absence (No clock-in or approved leave recorded)",
      });
    }
  });

  // 5. Compute Deductions & Net Take-Home Pay
  const totalAbsenceDeductions = parseFloat((absentDays * absenceDeductionRate).toFixed(2));
  const finalLatenessDeductions = parseFloat(totalLatenessDeductions.toFixed(2));
  const totalAttendanceDeductions = parseFloat((totalAbsenceDeductions + finalLatenessDeductions).toFixed(2));

  // Dynamic Allowances / Custom Earnings & Other Deductions
  const allowances = Number(employee.allowances || employee.totalAllowances || 0);
  const otherCustomDeductions = Number(employee.customDeductions || employee.otherDeductions || 0);

  const calculatedNetTakeHome = Math.max(
    0,
    parseFloat((baseSalary + allowances - totalAttendanceDeductions - otherCustomDeductions).toFixed(2))
  );

  return {
    employee: {
      _id: employee._id || validObjectId,
      employeeId: employee.employeeId || "EMP-001",
      fullName: employee.fullName || "Mohammed Awal",
      email: employee.email,
      department: employee.department || "General",
      position: employee.position || "Staff",
      status: employee.status || "active",
      isActive: employee.isActive !== false,
      baseSalary,
    },
    month: monthStr,
    monthName,
    companySettings: {
      workStartTime: settings.workStartTime,
      absenceDeductionRate,
      lateTier1_amount: settings.lateTier1_amount,
      lateTier2_amount: settings.lateTier2_amount,
      lateTier3_amount: settings.lateTier3_amount,
      lateTier4_amount: settings.lateTier4_amount,
      lateTier5_amount: settings.lateTier5_amount,
      lateTier6_amount: settings.lateTier6_amount,
    },
    calendar: {
      totalBusinessDaysInMonth,
      workdaysElapsed,
      auditThroughDate: auditThroughDate ? auditThroughDate.toISOString().split("T")[0] : null,
      isFullMonthAudit,
    },
    // Required output fields matching the prompt specification
    baseSalary,
    workdaysElapsed,
    attendedDays,
    lateDays,
    onTimeDays,
    approvedLeaveDays,
    totalLateMinutes,
    dailySalaryRate,
    dailyRate: dailySalaryRate,
    latenessDeductions: finalLatenessDeductions,
    absentDays,
    absenceDeductions: totalAbsenceDeductions,
    totalAttendanceDeductions,
    allowances,
    otherCustomDeductions,
    netTakeHomePay: calculatedNetTakeHome,
    dailyAudit,
  };
};

/**
 * Runs batch monthly payroll calculation across all active employees in MongoDB.
 */
export const calculateAllEmployeesMonthlyRun = async ({ month = null, year = null, organizationId = null }) => {
  const settings = await getActiveCompanySettings();
  const { year: parsedYear, monthIndex, monthStr, monthName } = parseMonthYear(month, year);

  const tenantFilter = organizationId
    ? { $or: [{ organizationId }, { companyId: organizationId }] }
    : {};

  // Fetch all active employees from MongoDB Employee and User collections
  let activeEmployees = [];
  try {
    const dbEmps = await Employee.find({ ...tenantFilter, isActive: { $ne: false }, status: { $ne: "Terminated" } }).lean();
    if (dbEmps && dbEmps.length > 0) {
      activeEmployees = dbEmps;
    }
  } catch (err) {
    console.warn("DB employee find in monthly run:", err.message);
  }

  // Also merge any users with employee role not yet in employees list
  try {
    const dbUsers = await User.find({ ...tenantFilter, role: "employee", status: "active" }).lean();
    dbUsers.forEach((u) => {
      if (!activeEmployees.some((e) => String(e._id) === String(u._id) || e.email === u.email)) {
        activeEmployees.push({
          _id: u._id,
          fullName: u.fullName,
          email: u.email,
          employeeId: u.employeeId || `EMP-${String(activeEmployees.length + 1).padStart(3, "0")}`,
          department: u.department || "Engineering",
          position: u.position || "Staff",
          baseSalary: u.baseSalary || 2500,
          status: "active",
          isActive: true,
        });
      }
    });
  } catch (uErr) {
    console.warn("DB users query in monthly run:", uErr.message);
  }

  if (activeEmployees.length === 0) {
    return {
      month: monthStr,
      monthName,
      totalEmployees: 0,
      totalPayrollCost: 0,
      totalBaseSalary: 0,
      totalAllowances: 0,
      totalAbsenceDeductions: 0,
      totalLatenessDeductions: 0,
      companySettings: {
        workStartTime: settings.workStartTime,
        absenceDeductionRate: settings.absenceDeductionRate,
      },
      employees: [],
    };
  }

  const employeeResults = [];
  let aggregateTotalPayrollCost = 0;
  let aggregateTotalBaseSalary = 0;
  let aggregateTotalAllowances = 0;
  let aggregateTotalAbsenceDeductions = 0;
  let aggregateTotalLatenessDeductions = 0;

  for (const emp of activeEmployees) {
    const result = await calculateEmployeeMonthPayroll({
      employeeInput: emp,
      month: monthStr,
      year: parsedYear,
      isFullMonthAudit: false,
      companySettings: settings,
    });

    aggregateTotalPayrollCost += result.netTakeHomePay;
    aggregateTotalBaseSalary += result.baseSalary;
    aggregateTotalAllowances += result.allowances;
    aggregateTotalAbsenceDeductions += result.absenceDeductions;
    aggregateTotalLatenessDeductions += result.latenessDeductions;

    employeeResults.push({
      employeeId: result.employee._id,
      employeeCode: result.employee.employeeId,
      fullName: result.employee.fullName,
      email: result.employee.email,
      department: result.employee.department,
      position: result.employee.position,
      baseSalary: result.baseSalary,
      workdaysElapsed: result.workdaysElapsed,
      attendedDays: result.attendedDays,
      lateDays: result.lateDays,
      onTimeDays: result.onTimeDays,
      approvedLeaveDays: result.approvedLeaveDays,
      absentDays: result.absentDays,
      totalLateMinutes: result.totalLateMinutes,
      latenessDeductions: result.latenessDeductions,
      absenceDeductions: result.absenceDeductions,
      totalAttendanceDeductions: result.totalAttendanceDeductions,
      allowances: result.allowances,
      otherDeductions: result.otherCustomDeductions,
      netTakeHomePay: result.netTakeHomePay,
      payrollStatus: "Pending",
      dailyAudit: result.dailyAudit,
    });
  }

  return {
    month: monthStr,
    monthName,
    companySettings: {
      workStartTime: settings.workStartTime,
      absenceDeductionRate: settings.absenceDeductionRate,
      lateTier1_amount: settings.lateTier1_amount,
      lateTier2_amount: settings.lateTier2_amount,
      lateTier3_amount: settings.lateTier3_amount,
      lateTier4_amount: settings.lateTier4_amount,
      lateTier5_amount: settings.lateTier5_amount,
      lateTier6_amount: settings.lateTier6_amount,
    },
    workdaysInMonth: employeeResults[0]?.calendar?.totalBusinessDaysInMonth || 22,
    workdaysElapsed: employeeResults[0]?.workdaysElapsed || 18,
    totalEmployees: employeeResults.length,
    totalPayrollCost: parseFloat(aggregateTotalPayrollCost.toFixed(2)),
    totalBaseSalary: parseFloat(aggregateTotalBaseSalary.toFixed(2)),
    totalAllowances: parseFloat(aggregateTotalAllowances.toFixed(2)),
    totalAbsenceDeductions: parseFloat(aggregateTotalAbsenceDeductions.toFixed(2)),
    totalLatenessDeductions: parseFloat(aggregateTotalLatenessDeductions.toFixed(2)),
    employees: employeeResults,
  };
};
