import mongoose from "mongoose";
import { Payroll } from "../models/payrollModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Leave, LeaveRequest } from "../models/leaveModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { evaluateLatenessPenalty } from "./payrollController.js";
import { logErrorToFile } from "../utils/logger.js";
import { buildTenantScope, combineTenantScope } from "../utils/tenantScope.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * Controller for Attendance Penalties & Payroll Cost Impact Analytics
 * Aggregates live data across the last 6 rolling months directly from MongoDB.
 * Optimized with defensive aggregation pipelines and null-safety for zero-state empty databases.
 */
export const getPenaltyImpactAnalytics = async (req, res) => {
  try {
    // 1. Establish the exact 6 rolling months timeline (starting 5 months prior up to current month)
    const now = new Date();
    const refDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const mShort = monthNamesShort[mIdx];
      const mFull = `${monthNamesFull[mIdx]} ${yr}`;
      const yyyyMm = `${yr}-${String(mIdx + 1).padStart(2, "0")}`;

      months.push({
        year: yr,
        monthIndex: mIdx,
        short: mShort,
        full: mFull,
        key: yyyyMm,
        startDate: new Date(yr, mIdx, 1, 0, 0, 0, 0),
        endDate: new Date(yr, mIdx + 1, 0, 23, 59, 59, 999),
      });
    }

    // 2. Fetch company penalty settings from DB
    const tenantScope = buildTenantScope(req);
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.user?.organizationId;

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
    try {
      const settingsDoc = tenantId ? (await CompanySettings.findById(tenantId).lean() || await CompanySettings.findOne(tenantScope).lean()) : await CompanySettings.findOne(tenantScope).lean();
      if (settingsDoc) {
        companySettings = { ...companySettings, ...settingsDoc };
      }
    } catch (err) {
      console.warn("Could not fetch company settings for analytics:", err?.message || err);
    }

    const dailyAbsenceRate = Number(companySettings.absenceDeductionRate || 10);

    // 3. Fetch active employees headcount & baseline salary scoped to tenant
    let activeEmployees = [];
    let totalActiveBaseSalary = 0;
    try {
      activeEmployees = await Employee.find(
        combineTenantScope(tenantScope, {
          $or: [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }],
        })
      ).lean() || [];

      totalActiveBaseSalary = activeEmployees.reduce((sum, e) => {
        const sal = Number(e?.salary !== undefined ? e.salary : (e?.basicSalary !== undefined ? e.basicSalary : (e?.baseSalary || 0)));
        return sum + (isNaN(sal) ? 0 : sal);
      }, 0);
    } catch (err) {
      console.warn("Could not fetch employees for analytics:", err?.message || err);
    }

    // 4. Perform efficient MongoDB aggregation on Payroll records grouped by month
    const startPeriodKey = months[0].key;
    const endPeriodKey = months[months.length - 1].key;

    let payrollAggregations = [];
    try {
      const userOrgId = req.user?.organizationId || req.admin?.organizationId || req.organizationId;
      const orgMatch = {
        $match: userOrgId
          ? {
              $or: [
                { organizationId: String(userOrgId) },
                ...(mongoose.isValidObjectId(userOrgId) ? [{ organizationId: new mongoose.Types.ObjectId(userOrgId) }] : []),
                { companyId: String(userOrgId) },
                ...(mongoose.isValidObjectId(userOrgId) ? [{ companyId: new mongoose.Types.ObjectId(userOrgId) }] : []),
              ],
            }
          : tenantScope,
      };
      const startMatch = [orgMatch];
      payrollAggregations = await Payroll.aggregate([
        ...startMatch,
        {
          $project: {
            payMonth: { $ifNull: ["$payMonth", ""] },
            paymentDate: "$paymentDate",
            baseSalary: { $ifNull: ["$baseSalary", { $ifNull: ["$basicSalary", 0] }] },
            allowances: { $ifNull: ["$allowances", 0] },
            absentDaysDeduction: {
              $ifNull: [
                "$absentDaysDeduction",
                { $ifNull: ["$absenceDeductions", { $ifNull: ["$absenceDeductionDetails.totalAmount", 0] }] }
              ]
            },
            latenessDeduction: {
              $ifNull: [
                "$latenessDeduction",
                { $ifNull: ["$latenessPenalties", { $ifNull: ["$latenessDeductionDetails.totalAmount", 0] }] }
              ]
            },
            waivedTotal: {
              $ifNull: [
                "$penaltyOverride.totalWaived",
                {
                  $add: [
                    { $ifNull: ["$penaltyOverride.waivedAbsenceDeduction", 0] },
                    { $ifNull: ["$penaltyOverride.waivedLatenessDeduction", 0] }
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: "$payMonth",
            headcount: { $sum: 1 },
            totalGross: { $sum: { $add: ["$baseSalary", "$allowances"] } },
            totalAbsence: { $sum: "$absentDaysDeduction" },
            totalLateness: { $sum: "$latenessDeduction" },
            totalWaived: { $sum: "$waivedTotal" },
            paymentDates: { $push: "$paymentDate" }
          }
        }
      ]) || [];
    } catch (err) {
      console.warn("Payroll aggregation query failed, will fallback gracefully:", err?.message || err);
      payrollAggregations = [];
    }

    // 5. Query attendance logs for 6-month window scoped to tenant
    let attendanceRecords = [];
    try {
      attendanceRecords = await Attendance.find(
        combineTenantScope(tenantScope, {
          date: { $gte: `${startPeriodKey}-01`, $lte: `${endPeriodKey}-31` },
        })
      )
      .select("employee date status isExcused latePenalty clockIn")
      .lean() || [];
    } catch (err) {
      console.warn("Could not query attendance collection:", err?.message || err);
      attendanceRecords = [];
    }

    // Group attendance records by month key (YYYY-MM) in memory for O(1) monthly lookup
    const attendanceByMonth = new Map();
    for (const att of attendanceRecords) {
      if (!att || !att.date) continue;
      const monthPrefix = String(att.date).substring(0, 7);
      if (!attendanceByMonth.has(monthPrefix)) {
        attendanceByMonth.set(monthPrefix, []);
      }
      attendanceByMonth.get(monthPrefix).push(att);
    }

    // 6. Aggregate metrics dynamically for each of the 6 rolling months
    const monthlySeries = months.map((m) => {
      // Check for aggregated payroll entry matching month name or key
      const matchingPayrollAgg = payrollAggregations.find((p) => {
        if (!p || !p._id) return false;
        const pMonth = String(p._id).toLowerCase().trim();
        const matchesName = pMonth.includes(m.short.toLowerCase()) || pMonth.includes(monthNamesFull[m.monthIndex].toLowerCase());
        const matchesYear = pMonth.includes(String(m.year));
        if (matchesName && matchesYear) return true;

        if (p.paymentDates && Array.isArray(p.paymentDates)) {
          const matchedDate = p.paymentDates.some((pd) => {
            if (!pd) return false;
            const parsed = new Date(pd);
            return parsed.getFullYear() === m.year && parsed.getMonth() === m.monthIndex;
          });
          if (matchedDate) return true;
        }

        return matchesName;
      });

      const matchingAttendance = attendanceByMonth.get(m.key) || [];

      let absenceDeductions = 0;
      let latenessPenalties = 0;
      let penaltiesWaived = 0;
      let totalGrossPayroll = 0;
      let headcount = 0;

      if (matchingPayrollAgg && matchingPayrollAgg.headcount > 0) {
        headcount = matchingPayrollAgg.headcount || 0;
        totalGrossPayroll = Number(matchingPayrollAgg.totalGross || 0);
        absenceDeductions = Number(matchingPayrollAgg.totalAbsence || 0);
        latenessPenalties = Number(matchingPayrollAgg.totalLateness || 0);
        penaltiesWaived = Number(matchingPayrollAgg.totalWaived || 0);
      } else if (matchingAttendance.length > 0) {
        const uniqueEmpMap = new Map();

        for (const att of matchingAttendance) {
          if (!att) continue;
          const empId = String(att.employee?._id || att.employee || "");
          if (empId) uniqueEmpMap.set(empId, true);

          const status = String(att.status || "").toLowerCase();
          const isExcused = Boolean(att.isExcused);

          if (isExcused) {
            const excusedAmount = Number(att.latePenalty || 0) || (status === "absent" ? dailyAbsenceRate : 0);
            penaltiesWaived += (isNaN(excusedAmount) ? 0 : excusedAmount);
          } else {
            if (status === "absent") {
              absenceDeductions += dailyAbsenceRate;
            } else if (att.latePenalty && Number(att.latePenalty) > 0) {
              latenessPenalties += Number(att.latePenalty);
            } else if (att.clockIn) {
              const evalRes = evaluateLatenessPenalty(
                att.clockIn,
                companySettings.workStartTime || "08:00",
                companySettings
              );
              if (evalRes && evalRes.penalty > 0) {
                latenessPenalties += Number(evalRes.penalty);
              }
            }
          }
        }

        headcount = uniqueEmpMap.size || activeEmployees.length || 0;
        totalGrossPayroll = totalActiveBaseSalary > 0 ? totalActiveBaseSalary : 0;
      }

      // Safe bounds math
      absenceDeductions = Math.max(0, isNaN(absenceDeductions) ? 0 : absenceDeductions);
      latenessPenalties = Math.max(0, isNaN(latenessPenalties) ? 0 : latenessPenalties);
      penaltiesWaived = Math.max(0, isNaN(penaltiesWaived) ? 0 : penaltiesWaived);
      totalGrossPayroll = Math.max(0, isNaN(totalGrossPayroll) ? 0 : totalGrossPayroll);

      const grossPenalties = absenceDeductions + latenessPenalties;
      const netPenalties = Math.max(0, grossPenalties - penaltiesWaived);
      const netPayroll = Math.max(0, totalGrossPayroll - netPenalties);
      const penaltyImpactPercentage = totalGrossPayroll > 0
        ? parseFloat(((netPenalties / totalGrossPayroll) * 100).toFixed(2))
        : 0;

      return {
        month: m.short,
        monthFull: m.full,
        absenceDeductions: parseFloat(absenceDeductions.toFixed(2)),
        latenessPenalties: parseFloat(latenessPenalties.toFixed(2)),
        penaltiesWaived: parseFloat(penaltiesWaived.toFixed(2)),
        netPenalties: parseFloat(netPenalties.toFixed(2)),
        totalNetPenalties: parseFloat(netPenalties.toFixed(2)),
        totalPenalties: parseFloat(netPenalties.toFixed(2)),
        absencePenalties: parseFloat(absenceDeductions.toFixed(2)),
        grossPayroll: parseFloat(totalGrossPayroll.toFixed(2)),
        totalGrossPayroll: parseFloat(totalGrossPayroll.toFixed(2)),
        netPayroll: parseFloat(netPayroll.toFixed(2)),
        penaltyImpactPercentage: isNaN(penaltyImpactPercentage) ? 0 : penaltyImpactPercentage,
        headcount,
      };
    });

    // 7. Aggregate Top 5 Metric Cards Mathematical Formulas across the full 6 months
    const total6MoPenalties = monthlySeries.reduce((sum, m) => sum + (m.netPenalties || 0), 0);
    const totalAbsenceDeductions = monthlySeries.reduce((sum, m) => sum + (m.absenceDeductions || 0), 0);
    const totalLatenessPenalties = monthlySeries.reduce((sum, m) => sum + (m.latenessPenalties || 0), 0);
    const totalPenaltiesWaived = monthlySeries.reduce((sum, m) => sum + (m.penaltiesWaived || 0), 0);
    const total6MoGrossPayroll = monthlySeries.reduce((sum, m) => sum + (m.totalGrossPayroll || 0), 0);

    const avgImpactRate = total6MoGrossPayroll > 0
      ? parseFloat(((total6MoPenalties / total6MoGrossPayroll) * 100).toFixed(2))
      : 0;

    const summary = {
      total6MoPenalties: parseFloat(total6MoPenalties.toFixed(2)),
      totalNetPenalties6Mo: parseFloat(total6MoPenalties.toFixed(2)),
      totalPenalties6Mo: parseFloat(total6MoPenalties.toFixed(2)),
      totalAbsenceDeductions: parseFloat(totalAbsenceDeductions.toFixed(2)),
      totalAbsencePenalties6Mo: parseFloat(totalAbsenceDeductions.toFixed(2)),
      totalLatenessPenalties: parseFloat(totalLatenessPenalties.toFixed(2)),
      totalLatenessPenalties6Mo: parseFloat(totalLatenessPenalties.toFixed(2)),
      totalPenaltiesWaived: parseFloat(totalPenaltiesWaived.toFixed(2)),
      totalWaived6Mo: parseFloat(totalPenaltiesWaived.toFixed(2)),
      total6MoGrossPayroll: parseFloat(total6MoGrossPayroll.toFixed(2)),
      totalGross6Mo: parseFloat(total6MoGrossPayroll.toFixed(2)),
      totalGrossPayroll: parseFloat(total6MoGrossPayroll.toFixed(2)),
      avgImpactRate: isNaN(avgImpactRate) ? 0 : avgImpactRate,
      avgPenaltyImpactRate: isNaN(avgImpactRate) ? 0 : avgImpactRate,
      hasLiveRecords: total6MoGrossPayroll > 0 || total6MoPenalties > 0,
    };

    return res.status(200).json({
      success: true,
      data: monthlySeries,
      summary,
    });
  } catch (error) {
    console.error("Error in getPenaltyImpactAnalytics controller:", error);
    logErrorToFile({
      route: "/api/admin/analytics/penalties-impact",
      statusCode: 500,
      error,
      req,
      details: "Failure in MongoDB aggregation pipeline or processing in getPenaltyImpactAnalytics",
    });
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to calculate live penalty impact analytics.",
    });
  }
};

/**
 * Controller to fetch daily and cumulative lateness deductions for the current payroll month.
 * Optimized for Recharts line chart visualization.
 */
export const getCurrentMonthLatenessAnalytics = async (req, res) => {
  try {
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-11

    if (req.query.month && typeof req.query.month === "string") {
      const parts = req.query.month.trim().split("-");
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
          targetYear = y;
          targetMonth = m;
        }
      }
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthKey = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
    const monthName = monthNames[targetMonth];
    const monthShort = monthNamesShort[targetMonth];
    const monthFull = `${monthName} ${targetYear}`;

    const totalDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    const startDateStr = `${monthKey}-01`;
    const endDateStr = `${monthKey}-${String(totalDays).padStart(2, "0")}`;

    const tenantScope = buildTenantScope(req);
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.user?.organizationId;

    // Fetch company settings for accurate fallback calculation
    let companySettings = {
      workStartTime: "08:00",
      workEndTime: "19:00",
      latenessTiers: [],
    };
    try {
      const settingsDoc = tenantId ? await CompanySettings.findById(tenantId).lean() : await CompanySettings.findOne(tenantScope).lean();
      if (settingsDoc) {
        companySettings = { ...companySettings, ...settingsDoc };
      }
    } catch (err) {
      console.warn("Could not fetch company settings for lateness analytics:", err?.message || err);
    }

    // Build query filter: include all records for this month, including today's live records scoped to tenant
    const dateConditions = [
      { date: { $gte: startDateStr, $lte: endDateStr } },
      { date: { $regex: `^${monthKey}` } },
    ];

    let baseFilter = {
      $or: dateConditions,
    };

    if (req.query.employeeId) {
      const empId = req.query.employeeId;
      const orConditions = [{ employeeId: empId }];
      if (mongoose.Types.ObjectId.isValid(empId)) {
        orConditions.push({ employee: new mongoose.Types.ObjectId(empId) });
        orConditions.push({ employee: empId });
      }
      baseFilter = {
        $and: [{ $or: dateConditions }, { $or: orConditions }],
      };
    } else if (req.user && req.user.role === "employee") {
      const uId = req.user._id || req.user.id;
      const orConditions = [];
      if (uId) {
        if (mongoose.Types.ObjectId.isValid(uId)) {
          orConditions.push({ employee: new mongoose.Types.ObjectId(uId) });
        }
        orConditions.push({ employee: uId });
      }
      if (req.user.employeeId) {
        orConditions.push({ employeeId: req.user.employeeId });
      }
      if (orConditions.length > 0) {
        baseFilter = {
          $and: [{ $or: dateConditions }, { $or: orConditions }],
        };
      }
    }

    const query = combineTenantScope(tenantScope, baseFilter);

    let attendanceList = [];
    try {
      attendanceList = await Attendance.find(query)
        .populate("employee", "fullName employeeId department position baseSalary")
        .lean() || [];
    } catch (err) {
      console.warn("Attendance query failed in getCurrentMonthLatenessAnalytics:", err?.message || err);
      attendanceList = [];
    }

    // Retrieve target employee to evaluate salary-based penalty threshold if applicable
    let targetEmployee = null;
    try {
      const empIdParam = req.query.employeeId;
      if (empIdParam) {
        if (mongoose.Types.ObjectId.isValid(empIdParam)) {
          targetEmployee = await Employee.findOne(combineTenantScope(tenantScope, { _id: empIdParam })).lean();
        }
        if (!targetEmployee) {
          targetEmployee = await Employee.findOne(combineTenantScope(tenantScope, { employeeId: empIdParam })).lean();
        }
        if (targetEmployee) {
          validateOrganizationAccess(targetEmployee, req);
        }
      } else if (req.user && req.user.role === "employee") {
        const uId = req.user._id || req.user.id;
        if (uId && mongoose.Types.ObjectId.isValid(uId)) {
          targetEmployee = await Employee.findOne(combineTenantScope(tenantScope, { _id: uId })).lean();
        }
        if (!targetEmployee && req.user.employeeId) {
          targetEmployee = await Employee.findOne(combineTenantScope(tenantScope, { employeeId: req.user.employeeId })).lean();
        }
        if (targetEmployee) {
          validateOrganizationAccess(targetEmployee, req);
        }
      }
    } catch (empErr) {
      console.warn("Could not query target employee for lateness threshold:", empErr?.message || empErr);
    }

    // Initialize daily buckets (Day 1 through Day N)
    const dayBuckets = new Map();
    for (let d = 1; d <= totalDays; d++) {
      dayBuckets.set(d, {
        day: d,
        dayStr: String(d).padStart(2, "0"),
        date: `${monthKey}-${String(d).padStart(2, "0")}`,
        label: `${monthShort} ${String(d).padStart(2, "0")}`,
        dailyDeductions: 0,
        lateCount: 0,
        lateMinutes: 0,
        waivedDeductions: 0,
        employees: [],
      });
    }

    let totalMonthDeductions = 0;
    let totalLateIncidents = 0;
    let totalLateMinutes = 0;
    let totalWaivedDeductions = 0;
    const lateEntries = [];

    for (const record of attendanceList) {
      if (!record || !record.date) continue;
      const dateParts = String(record.date).split("-");
      if (dateParts.length < 3) continue;
      const dayNum = parseInt(dateParts[2].slice(0, 2), 10);
      if (isNaN(dayNum) || !dayBuckets.has(dayNum)) continue;

      const bucket = dayBuckets.get(dayNum);
      const isExcused = Boolean(record.isExcused || record.isWaived);
      const delayMinutes = Math.max(
        Number(record.delayMinutes || 0),
        Number(record.lateMinutes || 0)
      );

      // Single Source of Truth: directly sum the stored attendance.latePenalty field
      // Do NOT recalculate lateness on the fly with separate tier logic
      const rawPenalty = record.latePenalty !== undefined && record.latePenalty !== null ? Number(record.latePenalty) : 0;
      const storedPenalty = isNaN(rawPenalty) ? 0 : Math.max(0, rawPenalty);
      const penalty = isExcused ? 0 : storedPenalty;
      const waivedPenalty = isExcused ? storedPenalty : 0;

      if (isExcused) {
        bucket.waivedDeductions += waivedPenalty;
        totalWaivedDeductions += waivedPenalty;
      } else {
        bucket.dailyDeductions += penalty;
        totalMonthDeductions += penalty;
      }

      if (delayMinutes > 0 || storedPenalty > 0 || String(record.status || "").toLowerCase() === "late") {
        bucket.lateCount += 1;
        bucket.lateMinutes += delayMinutes;
        totalLateIncidents += 1;
        totalLateMinutes += delayMinutes;

        const clockInDate = record.clockIn ? new Date(record.clockIn) : null;
        const clockInTimeStr = clockInDate && !isNaN(clockInDate.getTime())
          ? clockInDate.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })
          : "--:--";

        lateEntries.push({
          id: record._id,
          date: record.date,
          dayNumber: dayNum,
          clockIn: record.clockIn,
          clockInTime: clockInTimeStr,
          minutesLate: delayMinutes,
          delayMinutes: delayMinutes,
          penaltyAmount: penalty,
          rawPenalty: storedPenalty,
          isExcused,
          isWaived: Boolean(record.isWaived),
          excuseReason: record.excuseReason || record.notes || "",
          lateReason: record.lateReason || record.notes || "",
          notes: record.notes || record.lateReason || "",
          status: isExcused ? "Excused" : "Late",
          penaltyTier: record.penaltyTier || "",
          employeeName: record.employee?.fullName || targetEmployee?.fullName || "Employee",
          employeeId: record.employee?.employeeId || targetEmployee?.employeeId || record.employeeId || "",
        });

        if (record.employee) {
          bucket.employees.push({
            name: record.employee.fullName || "Employee",
            employeeId: record.employee.employeeId || record.employeeId || "",
            delayMinutes,
            deduction: penalty,
          });
        }
      }
    }

    // Sort late entries descending by date (most recent first)
    lateEntries.sort((a, b) => {
      const cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
      return cmp !== 0 ? cmp : b.dayNumber - a.dayNumber;
    });

    // Compute cumulative running totals and track peak deduction day
    let runningCumulative = 0;
    const dailySeries = [];
    let highestDay = { day: 1, date: `${monthKey}-01`, label: `${monthShort} 01`, amount: 0, lateCount: 0 };

    for (let d = 1; d <= totalDays; d++) {
      const bucket = dayBuckets.get(d);
      const dailyAmt = parseFloat(bucket.dailyDeductions.toFixed(2));
      runningCumulative = parseFloat((runningCumulative + dailyAmt).toFixed(2));

      if (dailyAmt > highestDay.amount) {
        highestDay = {
          day: d,
          date: bucket.date,
          label: bucket.label,
          amount: dailyAmt,
          lateCount: bucket.lateCount,
        };
      }

      dailySeries.push({
        day: d,
        dayNumber: d,
        dayStr: bucket.dayStr,
        date: bucket.date,
        label: bucket.label,
        dailyDeductions: dailyAmt,
        penaltyAmount: dailyAmt,
        cumulativeDeductions: runningCumulative,
        lateCount: bucket.lateCount,
        lateMinutes: bucket.lateMinutes,
        totalMinutesLate: bucket.lateMinutes,
        waivedDeductions: parseFloat(bucket.waivedDeductions.toFixed(2)),
      });
    }

    const avgDeductionPerLate = totalLateIncidents > 0
      ? parseFloat((totalMonthDeductions / totalLateIncidents).toFixed(2))
      : 0;

    const baseSalary = Number(targetEmployee?.baseSalary || 0);
    const maxPenaltyPercent = Number(companySettings?.maxLatenessPenaltyDeductionPercent || 15);
    const warningThresholdPercent = Number(companySettings?.latenessWarningThresholdPercent || 80);
    const defaultMonthlyCap = Number(companySettings?.defaultMonthlyPenaltyCap || 200);

    // Predefined company penalty threshold:
    // If employee base salary is set, max penalty limit is maxPenaltyPercent of basic salary (e.g. 15%).
    // Warning indicator triggers when penalties reach warningThresholdPercent (e.g. 80%) of this salary limit.
    // If base salary is 0/unspecified, cleanly falls back to predefined company standard limit (e.g. GH₵200).
    const penaltyLimit = baseSalary > 0
      ? parseFloat(((baseSalary * maxPenaltyPercent) / 100).toFixed(2))
      : defaultMonthlyCap;

    const warningThresholdAmount = parseFloat(((penaltyLimit * warningThresholdPercent) / 100).toFixed(2));
    const totalDeductions = parseFloat(totalMonthDeductions.toFixed(2));
    const usagePercent = penaltyLimit > 0
      ? parseFloat(((totalDeductions / penaltyLimit) * 100).toFixed(1))
      : 0;

    const isWarningExceeded = totalDeductions >= warningThresholdAmount;
    const isLimitExceeded = totalDeductions >= penaltyLimit;
    const thresholdStatus = isLimitExceeded
      ? "limit_exceeded"
      : isWarningExceeded
      ? "warning_exceeded"
      : "normal";

    const thresholdInfo = {
      baseSalary,
      hasBaseSalary: baseSalary > 0,
      penaltyLimit,
      warningThresholdPercent,
      warningThresholdAmount,
      currentDeductions: totalDeductions,
      usagePercent,
      isWarningExceeded,
      isLimitExceeded,
      status: thresholdStatus,
      maxPenaltyPercent,
      remainingBeforeWarning: Math.max(0, parseFloat((warningThresholdAmount - totalDeductions).toFixed(2))),
      remainingBeforeLimit: Math.max(0, parseFloat((penaltyLimit - totalDeductions).toFixed(2))),
    };

    const summary = {
      month: monthFull,
      monthKey,
      totalDays,
      totalLatenessDeductions: totalDeductions,
      totalLateIncidents,
      totalLateMinutes,
      totalWaivedDeductions: parseFloat(totalWaivedDeductions.toFixed(2)),
      averageDeductionPerLate: avgDeductionPerLate,
      highestDeductionDay: highestDay,
      currentDay: now.getMonth() === targetMonth && now.getFullYear() === targetYear ? now.getDate() : totalDays,
      thresholdInfo,
      lateEntriesCount: lateEntries.length,
    };

    return res.status(200).json({
      success: true,
      month: monthFull,
      monthKey,
      dailySeries,
      lateEntries,
      summary,
      thresholdInfo,
    });
  } catch (error) {
    console.error("Error in getCurrentMonthLatenessAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to retrieve monthly lateness deductions analytics.",
    });
  }
};

/**
 * Live Dashboard Analytics & KPI Statistics Endpoint: GET /api/admin/dashboard-stats
 * Real-time counts and MongoDB aggregations with safe defaults to 0 and GH₵0.00 for empty states.
 * Strictly returns 0 for all counts and financial totals if database is empty.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Accurate Mongoose queries to count actual employee records in database
    const employeeCountFromUsers = await User.countDocuments({ role: "employee" });
    const staffCountFromUsers = await User.countDocuments({ role: "staff" });
    const userEmployeeCount = employeeCountFromUsers + staffCountFromUsers;
    const employeeDocsCount = await Employee.countDocuments();
    const totalEmployeesCount = Math.max(userEmployeeCount, employeeDocsCount);

    const activeUserEmployees = await User.countDocuments({
      role: { $in: ["employee", "staff"] },
      status: "active",
    });
    const activeEmployeeDocs = await Employee.countDocuments({
      $or: [
        { status: "active" },
        { status: { $exists: false }, isActive: { $ne: false } },
      ],
    });
    const activeEmployeesCount = Math.max(activeUserEmployees, activeEmployeeDocs);

    const inactiveEmployeesCount = await Employee.countDocuments({ status: "inactive" });
    const suspendedEmployeesCount = await Employee.countDocuments({ status: "suspended" });

    // 2. Live Leave counts & active today logic
    let leaveCount = 0;
    if (totalEmployeesCount > 0) {
      leaveCount = await (LeaveRequest || Leave).countDocuments({
        status: { $regex: /^approved$/i },
        startDate: { $lte: endOfToday },
        endDate: { $gte: startOfToday },
      });
    }

    const pendingLeaveCount = await (LeaveRequest || Leave).countDocuments({
      status: { $regex: /^pending$/i },
    });
    const approvedLeaves = await (LeaveRequest || Leave).countDocuments({
      status: { $regex: /^approved$/i },
    });
    const rejectedLeaves = await (LeaveRequest || Leave).countDocuments({
      status: { $regex: /^rejected$/i },
    });
    const totalLeaveRequests = pendingLeaveCount + approvedLeaves + rejectedLeaves;

    // 3. Live Pending Payroll aggregation
    const payrollAgg = await Payroll.aggregate([
      {
        $match: {
          status: { $in: ["pending", "Pending", "draft", "Draft", "unpaid", "Unpaid"] },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: [
                "$amount",
                { $ifNull: ["$netPay", { $ifNull: ["$netSalary", "$basicSalary"] }] },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const pendingPayrollAmount =
      payrollAgg.length > 0 && payrollAgg[0].total != null
        ? parseFloat(Number(payrollAgg[0].total).toFixed(2))
        : 0;
    const pendingPayrollCount =
      payrollAgg.length > 0 && payrollAgg[0].count != null ? payrollAgg[0].count : 0;

    // Total & Disbursed Payroll Aggregations
    const totalPayrollAgg = await Payroll.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: [
                "$amount",
                { $ifNull: ["$netPay", { $ifNull: ["$netSalary", "$basicSalary"] }] },
              ],
            },
          },
          paid: {
            $sum: {
              $cond: [
                { $in: ["$status", ["paid", "Paid", "completed", "Completed"]] },
                {
                  $ifNull: [
                    "$amount",
                    { $ifNull: ["$netPay", { $ifNull: ["$netSalary", "$basicSalary"] }] },
                  ],
                },
                0,
              ],
            },
          },
          paidCount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["paid", "Paid", "completed", "Completed"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const totalPayrollAmount =
      totalPayrollAgg.length > 0 && totalPayrollAgg[0].total != null
        ? parseFloat(Number(totalPayrollAgg[0].total).toFixed(2))
        : 0;
    const totalPayrollDisbursed =
      totalPayrollAgg.length > 0 && totalPayrollAgg[0].paid != null
        ? parseFloat(Number(totalPayrollAgg[0].paid).toFixed(2))
        : 0;
    const employeesPaidCount =
      totalPayrollAgg.length > 0 && totalPayrollAgg[0].paidCount != null
        ? totalPayrollAgg[0].paidCount
        : 0;

    // 4. Live Attendance
    const presentToday =
      totalEmployeesCount === 0
        ? 0
        : await Attendance.countDocuments({
            date: today,
            clockIn: { $ne: null },
          });

    const lateToday =
      totalEmployeesCount === 0
        ? 0
        : await Attendance.countDocuments({
            date: today,
            $or: [
              { status: { $regex: /late/i } },
              { lateMinutes: { $gt: 0 } },
              { delayMinutes: { $gt: 0 } },
            ],
          });

    const onTimeToday = Math.max(0, presentToday - lateToday);
    const absentToday = Math.max(0, totalEmployeesCount - (presentToday + leaveCount));
    const turnoutRate =
      totalEmployeesCount > 0 ? Math.round((presentToday / totalEmployeesCount) * 100) : 0;

    // 5. Department Breakdown from live Employee records
    const deptAgg =
      totalEmployeesCount === 0
        ? []
        : await Employee.aggregate([
            {
              $group: {
                _id: { $ifNull: ["$department", "General"] },
                count: { $sum: 1 },
                active: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "active"] }, 1, 0],
                  },
                },
              },
            },
            { $sort: { count: -1 } },
          ]);
    const departmentDistribution = (deptAgg || []).map((d) => ({
      _id: d._id,
      name: d._id,
      department: d._id,
      total: d.count,
      count: d.count,
      active: d.active,
    }));

    // 6. Recent records with zero fallbacks
    const recentEmployees =
      totalEmployeesCount === 0
        ? []
        : await Employee.find()
            .select("-password")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

    const rawRecentAttendance =
      totalEmployeesCount === 0
        ? []
        : await Attendance.find()
            .sort({ date: -1, createdAt: -1 })
            .limit(10)
            .populate("userId", "fullName department position employeeId email avatar profilePicture")
            .populate("employee", "fullName department position employeeId email avatar profilePicture")
            .lean();

    const recentAttendance = (rawRecentAttendance || []).map((rec) => {
      const staff = rec.employee || rec.userId || {};
      return {
        ...rec,
        userId: staff,
        employee: staff,
      };
    });

    const pendingApprovalsList =
      pendingLeaveCount === 0
        ? []
        : await (LeaveRequest || Leave).find({ status: { $regex: /^pending$/i } })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate("employee", "fullName department position employeeId avatar profilePicture")
            .lean();

    return res.status(200).json({
      success: true,
      activeEmployees: activeEmployeesCount,
      activeEmployeesCount,
      employeesOnLeave: leaveCount,
      leaveCount,
      pendingLeaveRequests: pendingLeaveCount,
      pendingLeaveCount,
      pendingPayroll: pendingPayrollAmount,
      pendingPayrollAmount,
      totalEmployees: totalEmployeesCount,
      inactiveEmployees: inactiveEmployeesCount,
      suspendedEmployees: suspendedEmployeesCount,
      presentToday,
      onTimeToday,
      lateToday,
      absentToday,
      turnoutRate,
      pendingLeaves: pendingLeaveCount,
      approvedLeaves,
      rejectedLeaves,
      totalLeaveRequests,
      totalPayroll: totalPayrollAmount,
      totalPayrollDisbursed,
      monthlyPayrollTotal: totalPayrollDisbursed,
      pendingDisbursements: pendingPayrollAmount,
      employeesPaidCount,
      totalEmployeesPaid: employeesPaidCount,
      recentAttendance,
      recentEmployees,
      pendingApprovalsList,
      departments: departmentDistribution,
      departmentDistribution,
      cards: {
        activeEmployees: activeEmployeesCount,
        totalEmployees: totalEmployeesCount,
        presentToday,
        lateToday,
        onLeave: leaveCount,
        employeesOnLeave: leaveCount,
        pendingLeaves: pendingLeaveCount,
        pendingLeaveRequests: pendingLeaveCount,
        pendingPayroll: pendingPayrollAmount,
        pendingPayrollCount,
        totalPayroll: totalPayrollAmount,
      },
      attendance: {
        totalEmployees: totalEmployeesCount,
        present: presentToday,
        onTime: onTimeToday,
        late: lateToday,
        onLeave: leaveCount,
        absent: absentToday,
        turnoutRate,
      },
      payroll: {
        totalPayroll: totalPayrollAmount,
        paid: totalPayrollDisbursed,
        totalPayrollDisbursed,
        pending: pendingPayrollAmount,
        pendingDisbursements: pendingPayrollAmount,
        pendingCount: pendingPayrollCount,
        employeesPaidCount,
        totalEmployeesPaid: employeesPaidCount,
      },
      leave: {
        totalRequests: totalLeaveRequests,
        approved: approvedLeaves,
        pending: pendingLeaveCount,
        rejected: rejectedLeaves,
      },
      leaveStatusData: [
        { name: "Approved", value: approvedLeaves, fill: "#16A34A" },
        { name: "Pending", value: pendingLeaveCount, fill: "#ff5500" },
        { name: "Rejected", value: rejectedLeaves, fill: "#DC2626" },
      ],
      employeeStatusDistribution: [
        { name: "Active", value: activeEmployeesCount, fill: "#16A34A" },
        { name: "Inactive", value: inactiveEmployeesCount, fill: "#F59E0B" },
        { name: "Suspended", value: suspendedEmployeesCount, fill: "#DC2626" },
      ],
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to fetch dashboard stats."),
    });
  }
};

export default {
  getPenaltyImpactAnalytics,
  getCurrentMonthLatenessAnalytics,
  getDashboardStats,
};
