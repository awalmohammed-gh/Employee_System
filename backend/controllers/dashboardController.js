import mongoose from "mongoose";
import { Attendance } from "../models/attendanceModel.js";
import { Employee } from "../models/employeeModel.js";
import { Leave } from "../models/leaveModel.js";
import { Payroll } from "../models/payrollModel.js";
import { User } from "../models/userModel.js";
import CompanySettings from "../models/CompanySettings.js";
import { evaluateLatenessPenalty, calculateLatenessPenalty } from "../utils/latenessPenaltyCalculator.js";
import { livePayrollStore } from "./payrollController.js";
import { computeNetSalary } from "../services/payrollEngine.js";
import {
  getEmployeeLiveToday,
  liveAttendanceStore,
} from "./employeeAttendance.js";
import { liveLeaveStore } from "./leaveController.js";
import { getNotifications } from "./notificationController.js";
import { buildTenantScope, combineTenantScope, getTenantId } from "../utils/tenantScope.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { isWorkingDay, getCachedWorkingDays } from "../utils/workSchedule.js";

const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

// Admin dashboard overview
export const getDashboardOverview = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const tenantId = null;
    const tenantScope = {};
    const userId = req.user?._id || req.user?.id || req.admin?._id || req.admin?.id || "unknown";
    const userOrgId = "global";

    let totalEmployees = 0;
    let dbActiveCount = 0;
    let dbInactiveCount = 0;
    let dbSuspendedCount = 0;
    let totalActive = 0;
    let totalInactive = 0;
    let totalSuspended = 0;
    let presentToday = 0;
    let lateToday = 0;
    let onLeave = 0;
    let absentToday = 0;
    let totalRequests = 0;
    let approvedLeaves = 0;
    let pendingLeaves = 0;
    let rejectedLeaves = 0;
    let pendingCount = 0;
    let totalPayrollDisbursed = 0;
    let pendingDisbursements = 0;
    let totalPayrollAmount = 0;
    let employeesPaidCount = 0;
    let payrollRecords = [];
    let allEmployees = [];
    let payroll = {
      totalPayroll: 0,
      paidPayroll: 0,
      pendingPayroll: 0,
    };
    let departments = [];
    let attendanceTrends = [
      { day: "Mon", present: 0, late: 0, absent: 0, onLeave: 0 },
      { day: "Tue", present: 0, late: 0, absent: 0, onLeave: 0 },
      { day: "Wed", present: 0, late: 0, absent: 0, onLeave: 0 },
      { day: "Thu", present: 0, late: 0, absent: 0, onLeave: 0 },
      { day: "Fri", present: 0, late: 0, absent: 0, onLeave: 0 },
    ];
    let leaveTypeDistribution = [];
    let pendingApprovalsList = [];
    let departmentDistribution = [];
    let employeeStatusDistribution = [
      { name: "Active", value: 0, fill: "#16A34A" },
      { name: "Inactive", value: 0, fill: "#F59E0B" },
      { name: "Suspended", value: 0, fill: "#DC2626" },
    ];

    try {
      totalEmployees = await Employee.countDocuments(tenantScope);

      if (totalEmployees === 0) {
        dbActiveCount = 0;
        dbInactiveCount = 0;
        dbSuspendedCount = 0;
        presentToday = 0;
        lateToday = 0;
        onLeave = 0;
        absentToday = 0;
      } else {
        dbActiveCount = await Employee.countDocuments(
          combineTenantScope(tenantScope, {
            $or: [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }],
          })
        );
        dbInactiveCount = await Employee.countDocuments(
          combineTenantScope(tenantScope, { status: "inactive" })
        );
        dbSuspendedCount = await Employee.countDocuments(
          combineTenantScope(tenantScope, { status: "suspended" })
        );
        dbActiveCount = Math.min(totalEmployees, dbActiveCount);

        presentToday = await Attendance.countDocuments(
          combineTenantScope(tenantScope, {
            date: today,
            clockIn: { $ne: null },
          })
        );
        lateToday = await Attendance.countDocuments(
          combineTenantScope(tenantScope, {
            date: today,
            status: "Late",
          })
        );

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        onLeave = await Leave.countDocuments(
          combineTenantScope(tenantScope, {
            status: { $in: ["Approved", "approved"] },
            startDate: { $lte: endOfToday },
            endDate: { $gte: startOfToday },
          })
        );

        presentToday = Math.min(totalEmployees, presentToday);
        lateToday = Math.min(totalEmployees, lateToday);
        onLeave = Math.min(totalEmployees, onLeave);
        absentToday = Math.max(0, (dbActiveCount || totalEmployees) - presentToday - onLeave);
      }

      totalRequests = await Leave.countDocuments(tenantScope);
      approvedLeaves = await Leave.countDocuments(
        combineTenantScope(tenantScope, { status: { $in: ["Approved", "approved"] } })
      );
      pendingLeaves = await Leave.countDocuments(
        combineTenantScope(tenantScope, { status: { $in: ["Pending", "pending"] } })
      );
      rejectedLeaves = await Leave.countDocuments(
        combineTenantScope(tenantScope, { status: { $in: ["Rejected", "rejected"] } })
      );

      attendanceTrends = [
        { day: "Mon", present: presentToday, late: lateToday, absent: absentToday, onLeave },
        { day: "Tue", present: presentToday, late: lateToday, absent: absentToday, onLeave },
        { day: "Wed", present: presentToday, late: lateToday, absent: absentToday, onLeave },
        { day: "Thu", present: presentToday, late: lateToday, absent: absentToday, onLeave },
        { day: "Fri", present: presentToday, late: lateToday, absent: absentToday, onLeave },
      ];

      // Gather real pending leaves for visual approvals tracker
      const dbPendingLeaves = await Leave.find(
        combineTenantScope(tenantScope, { status: "Pending" })
      )
        .populate("employee", "fullName department position employeeId")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      if (dbPendingLeaves && dbPendingLeaves.length > 0) {
        pendingApprovalsList = dbPendingLeaves;
      }

      // Group leave by type - Ensure pipeline starts with organizationId filter using authenticated user's organization
      const rawUserOrgId = req.user?.organizationId || req.admin?.organizationId || req.employee?.organizationId || getTenantId(req);
      const orgFilterStage = {
        $match: rawUserOrgId
          ? {
              $or: [
                { organizationId: String(rawUserOrgId) },
                ...(isValidObjectId(rawUserOrgId) ? [{ organizationId: new mongoose.Types.ObjectId(rawUserOrgId) }] : []),
                { companyId: String(rawUserOrgId) },
                ...(isValidObjectId(rawUserOrgId) ? [{ companyId: new mongoose.Types.ObjectId(rawUserOrgId) }] : []),
              ],
            }
          : tenantScope,
      };
      const leaveTypeCounts = await Leave.aggregate([
        orgFilterStage,
        { $group: { _id: "$leaveType", count: { $sum: 1 } } },
      ]);
      if (leaveTypeCounts.length > 0) {
        const colors = ["#002185", "#ff5500", "#16A34A", "#8B5CF6", "#F59E0B", "#06B6D4"];
        leaveTypeDistribution = leaveTypeCounts.map((item, idx) => ({
          name: item._id || "Other",
          value: item.count,
          fill: colors[idx % colors.length],
        }));
      }

      totalPayrollDisbursed = 0;
      pendingDisbursements = 0;
      totalPayrollAmount = 0;
      employeesPaidCount = 0;
      pendingCount = 0;

      payrollRecords = await Payroll.find(tenantScope).lean() || [];
      if (payrollRecords && payrollRecords.length > 0) {
        payrollRecords.forEach((rec) => {
          const amount = Number(
            rec.netPay !== undefined
              ? rec.netPay
              : rec.netSalary !== undefined
              ? rec.netSalary
              : rec.basicSalary || 0
          );
          const st = (rec.status || "").toLowerCase().trim();
          totalPayrollAmount += amount;
          if (st === "paid") {
            totalPayrollDisbursed += amount;
            employeesPaidCount += 1;
          } else if (st === "pending" || st === "draft" || st === "unpaid") {
            pendingDisbursements += amount;
            pendingCount += 1;
          }
        });
      }

      payroll = {
        totalPayroll: parseFloat(totalPayrollAmount.toFixed(2)),
        totalPayrollDisbursed: parseFloat(totalPayrollDisbursed.toFixed(2)),
        monthlyPayrollTotal: parseFloat(totalPayrollDisbursed.toFixed(2)),
        paidPayroll: parseFloat(totalPayrollDisbursed.toFixed(2)),
        paid: parseFloat(totalPayrollDisbursed.toFixed(2)),
        pendingPayroll: parseFloat(pendingDisbursements.toFixed(2)),
        pending: parseFloat(pendingDisbursements.toFixed(2)),
        pendingDisbursements: parseFloat(pendingDisbursements.toFixed(2)),
        employeesPaidCount,
        totalEmployeesPaid: employeesPaidCount,
        totalEmployees: dbActiveCount || totalEmployees,
      };

      const empOrgFilterStage = {
        $match: rawUserOrgId
          ? {
              $or: [
                { organizationId: String(rawUserOrgId) },
                ...(isValidObjectId(rawUserOrgId) ? [{ organizationId: new mongoose.Types.ObjectId(rawUserOrgId) }] : []),
                { companyId: String(rawUserOrgId) },
                ...(isValidObjectId(rawUserOrgId) ? [{ companyId: new mongoose.Types.ObjectId(rawUserOrgId) }] : []),
              ],
            }
          : tenantScope,
      };
      const dbDepartments = await Employee.aggregate([
        empOrgFilterStage,
        { $group: { _id: "$department", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]);
      if (dbDepartments.length > 0) {
        departments = dbDepartments;
      }

      // Detailed Department & Status Breakdown Aggregation
      allEmployees = (await Employee.find(tenantScope)
        .select("department status isActive salary basicSalary baseSalary")
        .lean()) || [];

      const deptMap = {};
      totalActive = 0;
      totalInactive = 0;
      totalSuspended = 0;

      (allEmployees || []).forEach((emp) => {
        const dept = emp.department || "General";
        const rawStatus = (
          emp.status || (emp.isActive !== false ? "active" : "inactive")
        )
          .toLowerCase()
          .trim();
        const status =
          rawStatus === "suspended" || rawStatus === "inactive"
            ? rawStatus
            : "active";

        if (!deptMap[dept]) {
          deptMap[dept] = {
            department: dept,
            active: 0,
            inactive: 0,
            suspended: 0,
            total: 0,
          };
        }

        if (status === "active") {
          deptMap[dept].active += 1;
          totalActive += 1;
        } else if (status === "inactive") {
          deptMap[dept].inactive += 1;
          totalInactive += 1;
        } else if (status === "suspended") {
          deptMap[dept].suspended += 1;
          totalSuspended += 1;
        }
        deptMap[dept].total += 1;
      });

      departmentDistribution = Object.values(deptMap).sort(
        (a, b) => b.total - a.total
      );

      employeeStatusDistribution = [
        { name: "Active", value: totalActive, fill: "#16A34A" },
        { name: "Inactive", value: totalInactive, fill: "#F59E0B" },
        { name: "Suspended", value: totalSuspended, fill: "#DC2626" },
      ];
    } catch (dbErr) {
      console.warn("DB query for admin dashboard:", dbErr.message);
    }

    // Merge in-memory pending leaves if not in list (strictly scoped to active tenant)
    const tenantIdStr = tenantId ? String(tenantId).trim() : null;
    const scopedLiveLeaves = (liveLeaveStore || []).filter((l) => {
      if (!tenantIdStr) return false;
      const lTenant = String(
        l.organizationId ||
        l.companyId ||
        l.employee?.organizationId ||
        l.employee?.companyId ||
        ""
      );
      return lTenant === tenantIdStr;
    });

    if (scopedLiveLeaves.length > 0) {
      const inMemoryPending = scopedLiveLeaves.filter((l) => l.status === "Pending");
      inMemoryPending.forEach((item) => {
        if (!pendingApprovalsList.some((p) => String(p._id) === String(item._id))) {
          pendingApprovalsList.unshift(item);
        }
      });
      pendingLeaves = scopedLiveLeaves.filter((l) => l.status === "Pending").length || pendingLeaves;
      totalRequests = Math.max(totalRequests, scopedLiveLeaves.length);
      approvedLeaves = scopedLiveLeaves.filter((l) => l.status === "Approved").length || approvedLeaves;
      rejectedLeaves = scopedLiveLeaves.filter((l) => l.status === "Rejected").length || rejectedLeaves;
    }

    // Dynamic leave status breakdown for charts
    const leaveStatusData = [
      { name: "Approved", value: approvedLeaves, fill: "#16A34A" },
      { name: "Pending", value: pendingLeaves, fill: "#ff5500" },
      { name: "Rejected", value: rejectedLeaves, fill: "#DC2626" },
    ];

    // Rolling 12 months workforce health trends: attendance & payroll
    const now = new Date();
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthNamesFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mIdx = d.getMonth();
      const mShort = monthNamesShort[mIdx];
      const mFull = `${monthNamesFull[mIdx]} ${yr}`;
      const yyyyMm = `${yr}-${String(mIdx + 1).padStart(2, "0")}`;

      monthlyTrends.push({
        month: mShort,
        monthFull: mFull,
        year: yr,
        key: yyyyMm,
        monthIndex: mIdx,
      });
    }

    const startPeriod = `${monthlyTrends[0].key}-01`;
    const endPeriod = `${monthlyTrends[monthlyTrends.length - 1].key}-31`;

    let historicalAttendance = [];
    try {
      historicalAttendance = await Attendance.find(
        combineTenantScope(tenantScope, {
          date: { $gte: startPeriod, $lte: endPeriod },
        })
      ).select("date status isExcused latePenalty clockIn clockOut clockOutTime workHours delayMinutes").lean() || [];
    } catch (e) {
      console.warn("Could not load historical attendance for trends:", e.message);
    }

    // Hours actually worked on a record: stored workHours, else clock-in → clock-out. 0 when the
    // shift has no clock-out yet (it is not counted as a completed shift).
    const recordedShiftHours = (log) => {
      let hours = Number(log.workHours || 0);
      const inAt = log.clockIn || log.clockInTime;
      const outAt = log.clockOut || log.clockOutTime;
      if (hours <= 0 && inAt && outAt) {
        hours = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3600000;
      }
      return hours > 0 && Number.isFinite(hours) ? hours : 0;
    };

    const attByMonth = new Map();
    historicalAttendance.forEach((att) => {
      if (!att?.date) return;
      const key = String(att.date).substring(0, 7);
      if (!attByMonth.has(key)) attByMonth.set(key, []);
      attByMonth.get(key).push(att);
    });

    const activeHeadcount = dbActiveCount || totalEmployees || 0;
    const activeEmployees = (allEmployees || []).filter((e) => {
      const st = String(e.status || "active").toLowerCase().trim();
      return st === "active" && e.isActive !== false;
    });
    const activeBaseSalaryEst = activeEmployees.length > 0
      ? activeEmployees.reduce((sum, e) => {
          const s = Number(e.salary || e.basicSalary || e.baseSalary || 0);
          return sum + (isNaN(s) ? 0 : s);
        }, 0)
      : 0;

    const monthlyWorkforceTrends = monthlyTrends.map((m) => {
      const monthAtt = attByMonth.get(m.key) || [];
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let onLeaveCount = 0;

      monthAtt.forEach((a) => {
        const st = String(a.status || "").toLowerCase();
        if (st === "present" || st === "ontime" || st === "on-time") presentCount++;
        else if (st === "late") lateCount++;
        else if (st === "absent") absentCount++;
        else if (st.includes("leave")) onLeaveCount++;
        else presentCount++;
      });

      const totalLogs = presentCount + lateCount + absentCount + onLeaveCount;

      let grossPayroll = 0;
      let netPayroll = 0;
      let penaltiesDeductions = 0;
      let baseSalaryTotal = 0;
      let allowancesTotal = 0;
      let matchCount = 0;

      if (payrollRecords && payrollRecords.length > 0) {
        payrollRecords.forEach((pr) => {
          const pm = String(pr.payMonth || "").toLowerCase();
          const matches = pm.includes(m.month.toLowerCase()) ||
                          pm.includes(monthNamesFull[m.monthIndex].toLowerCase()) ||
                          pm === m.key;
          if (matches) {
            matchCount++;
            const basic = Number(pr.baseSalary || pr.basicSalary || 0);
            const allow = Number(pr.allowances || 0);
            const net = Number(pr.netPay !== undefined ? pr.netPay : (pr.netSalary !== undefined ? pr.netSalary : basic));
            const pen = Number(pr.absentDaysDeduction || pr.absenceDeductions || 0) +
                        Number(pr.latenessDeduction || pr.latenessPenalties || 0);
            grossPayroll += (basic + allow);
            baseSalaryTotal += basic;
            allowancesTotal += allow;
            netPayroll += net;
            penaltiesDeductions += pen;
          }
        });
      }

      // Live aggregations with safe zero defaults
      const effectiveGross = grossPayroll;
      const effectivePenalties = penaltiesDeductions;
      const effectiveNet = netPayroll;

      const effectivePresent = presentCount;
      const effectiveLate = lateCount;
      const effectiveAbsent = absentCount;
      const effectiveOnLeave = onLeaveCount;
      const effectiveTotalAtt = totalLogs;

      const attendanceRate = effectiveTotalAtt > 0
        ? parseFloat(((effectivePresent / effectiveTotalAtt) * 100).toFixed(1))
        : 0;

      const punctualityRate = (effectivePresent + effectiveLate) > 0
        ? parseFloat(((effectivePresent / (effectivePresent + effectiveLate)) * 100).toFixed(1))
        : 0;

      // Weighted from recorded attendance only; 0 for a month with no attendance records.
      const healthScore = effectiveTotalAtt > 0 ? Math.min(100, Math.max(0, Math.round(
        (attendanceRate * 0.6) + (punctualityRate * 0.4)
      ))) : 0;

      return {
        month: m.month,
        monthFull: m.monthFull,
        year: m.year,
        key: m.key,
        present: effectivePresent,
        late: effectiveLate,
        absent: effectiveAbsent,
        onLeave: effectiveOnLeave,
        totalLogs: effectiveTotalAtt,
        attendanceRate,
        punctualityRate,
        grossPayroll: parseFloat(effectiveGross.toFixed(2)),
        netPayroll: parseFloat(effectiveNet.toFixed(2)),
        penaltiesDeductions: parseFloat(effectivePenalties.toFixed(2)),
        baseSalaryTotal: parseFloat(baseSalaryTotal.toFixed(2)),
        allowancesTotal: parseFloat(allowancesTotal.toFixed(2)),
        healthScore,
        headcount: matchCount > 0 ? matchCount : activeHeadcount,
      };
    });

    // Payroll distribution over time (by month)
    const payrollDistributionTrends = monthlyWorkforceTrends.map((item) => {
      const gross = item.grossPayroll;
      const baseSalary = item.baseSalaryTotal;
      const allowances = item.allowancesTotal;
      const deductions = item.penaltiesDeductions;
      const netDisbursed = item.netPayroll;
      const headcount = item.headcount || activeHeadcount || 0;
      const avgNetPerEmployee = headcount > 0 ? parseFloat((netDisbursed / headcount).toFixed(2)) : 0;
      return {
        month: item.month,
        monthFull: item.monthFull,
        year: item.year,
        key: item.key,
        baseSalary,
        allowances,
        deductions,
        grossPayroll: gross,
        netDisbursed,
        headcount,
        avgNetPerEmployee,
      };
    });

    // Group attendance records by date for shift completion times and daily trends
    const shiftRecordsByDate = new Map();
    historicalAttendance.forEach((att) => {
      if (!att?.date) return;
      if (!shiftRecordsByDate.has(att.date)) shiftRecordsByDate.set(att.date, []);
      shiftRecordsByDate.get(att.date).push(att);
    });

    // Recent 14 work days for granular daily attendance and shift completion
    const recentWorkDays = [];
    for (let d = 13; d >= 0; d--) {
      const targetDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      if (!isWorkingDay(targetDate)) continue; // skip rest days (admin's working days)
      const dStr = targetDate.toISOString().split("T")[0];
      const dayShort = targetDate.toLocaleDateString("en-US", { weekday: "short" });
      const dayFull = targetDate.toLocaleDateString("en-US", { weekday: "long" });

      const dayLogs = shiftRecordsByDate.get(dStr) || [];
      let totalWorkHours = 0;
      let validShiftCount = 0;
      let onTimeCount = 0;
      let overtimeCount = 0;
      let earlyCount = 0;
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let onLeaveCount = 0;

      dayLogs.forEach((log) => {
        const st = String(log.status || "").toLowerCase();
        if (st === "present" || st === "ontime" || st === "on-time") presentCount++;
        else if (st === "late") lateCount++;
        else if (st === "absent") absentCount++;
        else if (st.includes("leave")) onLeaveCount++;
        else presentCount++;

        const hours = st === "absent" || st.includes("leave") ? 0 : recordedShiftHours(log);

        if (hours > 0) {
          totalWorkHours += hours;
          validShiftCount++;
          if (hours >= 7.8 && hours <= 8.5) onTimeCount++;
          else if (hours > 8.5) overtimeCount++;
          else earlyCount++;
        }
      });

      // Recorded values only; a day without records shows zeros rather than estimates.
      const effectiveP = presentCount;
      const effectiveL = lateCount;
      const effectiveA = absentCount;
      const effectiveOl = onLeaveCount;

      const avgShiftHours = validShiftCount > 0
        ? parseFloat((totalWorkHours / validShiftCount).toFixed(2))
        : 0;
      const targetHours = activeHeadcount > 0 ? 8.0 : 0;
      const completionRate = validShiftCount > 0
        ? Math.min(100, Math.round((onTimeCount / validShiftCount) * 100))
        : 0;

      recentWorkDays.push({
        date: dStr,
        day: dayShort,
        dayFull,
        label: `${dayShort} ${dStr.substring(8)}`,
        avgShiftHours,
        targetHours,
        completedShifts: validShiftCount,
        onTimeCount,
        overtimeCount,
        earlyCount,
        completionRate,
        hasShiftData: validShiftCount > 0,
        present: effectiveP,
        late: effectiveL,
        absent: effectiveA,
        onLeave: effectiveOl,
        total: activeHeadcount,
        turnoutRate: activeHeadcount > 0 ? Math.min(100, Math.round(((effectiveP + effectiveL) / activeHeadcount) * 100)) : 0,
      });
    }

    // Weekly day-of-week aggregated shift completion averages (Mon-Fri)
    const weekdayNames = getCachedWorkingDays().map((name) => name.slice(0, 3));
    const weekdayShiftAverages = weekdayNames.map((wName) => {
      const matchingDays = recentWorkDays.filter((r) => r.day === wName && r.hasShiftData);
      if (matchingDays.length > 0) {
        const sumHours = matchingDays.reduce((acc, curr) => acc + curr.avgShiftHours, 0);
        const avgHours = parseFloat((sumHours / matchingDays.length).toFixed(2));
        const sumCompleted = matchingDays.reduce((acc, curr) => acc + curr.completedShifts, 0);
        const avgRate = Math.round(matchingDays.reduce((acc, curr) => acc + curr.completionRate, 0) / matchingDays.length);
        const sumOnTime = matchingDays.reduce((acc, curr) => acc + curr.onTimeCount, 0);
        const sumOvertime = matchingDays.reduce((acc, curr) => acc + curr.overtimeCount, 0);
        const sumEarly = matchingDays.reduce((acc, curr) => acc + curr.earlyCount, 0);
        return {
          day: wName,
          avgShiftHours: avgHours,
          targetHours: activeHeadcount > 0 ? 8.0 : 0,
          completedShifts: Math.round(sumCompleted / matchingDays.length),
          completionRate: avgRate,
          onTimeCount: Math.round(sumOnTime / matchingDays.length),
          overtimeCount: Math.round(sumOvertime / matchingDays.length),
          earlyCount: Math.round(sumEarly / matchingDays.length),
        };
      }
      return {
        day: wName,
        avgShiftHours: 0,
        targetHours: activeHeadcount > 0 ? 8.0 : 0,
        completedShifts: 0,
        completionRate: 0,
        onTimeCount: 0,
        overtimeCount: 0,
        earlyCount: 0,
      };
    });

    // Monthly average shift completion trends
    const monthlyShiftCompletion = monthlyWorkforceTrends.map((m) => {
      let hoursSum = 0;
      let shifts = 0;
      let standardShifts = 0;
      (attByMonth.get(m.key) || []).forEach((log) => {
        const st = String(log.status || "").toLowerCase();
        if (st === "absent" || st.includes("leave")) return;
        const hours = recordedShiftHours(log);
        if (hours <= 0) return;
        hoursSum += hours;
        shifts++;
        if (hours >= 7.8 && hours <= 8.5) standardShifts++;
      });
      return {
        month: m.month,
        monthFull: m.monthFull,
        year: m.year,
        avgShiftHours: shifts > 0 ? parseFloat((hoursSum / shifts).toFixed(2)) : 0,
        targetHours: 8.0,
        completedShifts: shifts,
        completionRate: shifts > 0 ? Math.min(100, Math.round((standardShifts / shifts) * 100)) : 0,
      };
    });

    const shiftDaysWithData = weekdayShiftAverages.filter((w) => w.completedShifts > 0);
    const shiftCompletionTrends = {
      daily: recentWorkDays.slice(-7),
      weekdays: weekdayShiftAverages,
      monthly: monthlyShiftCompletion,
      overallAvgHours: shiftDaysWithData.length > 0
        ? parseFloat((shiftDaysWithData.reduce((acc, c) => acc + c.avgShiftHours, 0) / shiftDaysWithData.length).toFixed(2))
        : 0,
      standardShiftHours: 8.0,
      overallCompletionRate: shiftDaysWithData.length > 0
        ? Math.round(shiftDaysWithData.reduce((acc, c) => acc + c.completionRate, 0) / shiftDaysWithData.length)
        : 0,
    };

    // If recentWorkDays has records, use the last 7 working days for attendanceTrends
    if (recentWorkDays.length >= 5) {
      attendanceTrends = recentWorkDays.slice(-7).map((r) => ({
        day: r.day,
        date: r.date,
        label: r.label,
        present: r.present,
        late: r.late,
        absent: r.absent,
        onLeave: r.onLeave,
        turnoutRate: r.turnoutRate,
      }));
    }

    // Department Expense Distribution for Payroll visualization
    const deptExpenseMap = {};
    (allEmployees || []).forEach((emp) => {
      const dept = emp.department || "General";
      const sal = Number(emp.salary || emp.basicSalary || emp.baseSalary || 0);
      const validSal = isNaN(sal) || sal <= 0 ? 0 : sal;
      if (!deptExpenseMap[dept]) {
        deptExpenseMap[dept] = {
          name: dept,
          department: dept,
          totalExpense: 0,
          headcount: 0,
        };
      }
      deptExpenseMap[dept].totalExpense += validSal;
      deptExpenseMap[dept].headcount += 1;
    });

    const deptPalette = ["#002185", "#2563EB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];
    const totalCompanyExpense = Object.values(deptExpenseMap).reduce((sum, d) => sum + d.totalExpense, 0);

    const departmentExpenseDistribution = Object.values(deptExpenseMap)
      .sort((a, b) => b.totalExpense - a.totalExpense)
      .map((d, i) => ({
        name: d.name,
        department: d.department,
        value: d.totalExpense,
        totalExpense: d.totalExpense,
        headcount: d.headcount,
        percentage: totalCompanyExpense > 0 ? Math.round((d.totalExpense / totalCompanyExpense) * 100) : 0,
        fill: deptPalette[i % deptPalette.length],
      }));

    // 30-Day Employee Performance Scores
    const employeePerformance30Days = [];
    for (let d = 29; d >= 0; d--) {
      const targetDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dStr = targetDate.toISOString().split("T")[0];
      const isWeekend = !isWorkingDay(targetDate);
      const monthShort = targetDate.toLocaleDateString("en-US", { month: "short" });
      const dayNum = targetDate.getDate();
      const label = `${monthShort} ${dayNum}`;

      const dayLogs = shiftRecordsByDate.get(dStr) || [];
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let onLeaveCount = 0;

      dayLogs.forEach((log) => {
        const st = String(log.status || "").toLowerCase();
        if (st === "present" || st === "ontime" || st === "on-time") presentCount++;
        else if (st === "late") lateCount++;
        else if (st === "absent") absentCount++;
        else if (st.includes("leave")) onLeaveCount++;
        else presentCount++;
      });

      // Scores come only from that day's attendance records; a day with none has no score (null)
      // rather than an estimate, so the chart never shows invented performance.
      const dayTurnout = presentCount + lateCount;
      const expectedStaff = Math.max(dayTurnout + absentCount, (activeHeadcount || 0) - onLeaveCount);
      const hasData = dayLogs.length > 0 && expectedStaff > 0;
      const completedShifts = dayLogs.filter((log) => {
        const st = String(log.status || "").toLowerCase();
        return st !== "absent" && !st.includes("leave") && (log.clockOut || log.clockOutTime);
      }).length;

      const punctualityScore = hasData && dayTurnout > 0 ? Math.round((presentCount / dayTurnout) * 100) : null;
      const turnoutRate = hasData ? Math.min(100, Math.round((dayTurnout / expectedStaff) * 100)) : null;
      const overallScore = hasData ? Math.round(((punctualityScore ?? 0) + turnoutRate) / 2) : null;
      const shiftCompletionScore = hasData && dayTurnout > 0 ? Math.round((completedShifts / dayTurnout) * 100) : null;

      employeePerformance30Days.push({
        date: dStr,
        label,
        dayNumber: 30 - d,
        overallScore,
        punctualityScore,
        shiftCompletionScore,
        turnoutRate,
        hasData,
        isWeekend,
        presentStaff: presentCount,
        lateStaff: lateCount,
        absentStaff: absentCount,
        onLeaveStaff: onLeaveCount,
      });
    }

    // Current Month Detailed Analytics for Attendance & Payroll Expenditure
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentMonthPrefix = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
    const currentMonthName = monthNamesFull[currentMonthIdx];
    const currentMonthShort = monthNamesShort[currentMonthIdx];
    const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const currentDayNum = now.getDate();

    // 1. Current Month Daily Attendance Trends (All days of current month)
    const currentMonthAttendanceTrends = [];
    let currentMonthTotalPresent = 0;
    let currentMonthTotalLate = 0;
    let currentMonthTotalAbsent = 0;
    let currentMonthTotalOnLeave = 0;

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dDate = new Date(currentYear, currentMonthIdx, day);
      const dStr = `${currentMonthPrefix}-${String(day).padStart(2, "0")}`;
      const dayNameShort = dDate.toLocaleDateString("en-US", { weekday: "short" });
      const isWeekend = !isWorkingDay(dDate);
      const isFuture = day > currentDayNum;

      const dayRecords = shiftRecordsByDate.get(dStr) || [];
      let p = 0, l = 0, a = 0, ol = 0;

      dayRecords.forEach((rec) => {
        const st = String(rec.status || "").toLowerCase();
        if (st === "present" || st === "ontime" || st === "on-time") p++;
        else if (st === "late") l++;
        else if (st === "absent") a++;
        else if (st.includes("leave")) ol++;
        else p++;
      });

      const totalTeam = activeHeadcount || totalEmployees || 0;
      const effPresent = p;
      const effLate = l;
      const effAbsent = a;
      const effOnLeave = ol;

      if (!isFuture && !isWeekend && totalTeam > 0) {
        currentMonthTotalPresent += effPresent;
        currentMonthTotalLate += effLate;
        currentMonthTotalAbsent += effAbsent;
        currentMonthTotalOnLeave += effOnLeave;
      }

      const turnout = effPresent + effLate;
      const turnoutRate = totalTeam > 0 ? Math.min(100, Math.round((turnout / totalTeam) * 100)) : 0;
      const punctualityRate = turnout > 0 ? Math.min(100, Math.round((effPresent / turnout) * 100)) : 0;

      currentMonthAttendanceTrends.push({
        dayNumber: day,
        date: dStr,
        dayName: dayNameShort,
        label: `${currentMonthShort} ${day}`,
        isWeekend,
        isFuture,
        present: effPresent,
        late: effLate,
        absent: effAbsent,
        onLeave: effOnLeave,
        turnoutRate: isWeekend || isFuture ? 0 : turnoutRate,
        punctualityRate: isWeekend || isFuture ? 0 : punctualityRate,
        totalEmployees: totalTeam,
      });
    }

    // 2. Current Month Payroll Expenditure Breakdown
    let currentMonthGross = 0;
    let currentMonthNet = 0;
    let currentMonthBasic = 0;
    let currentMonthAllowances = 0;
    let currentMonthDeductions = 0;
    let currentMonthPenalties = 0;
    let currentMonthPaid = 0;
    let currentMonthPending = 0;
    let currentMonthPaidCount = 0;
    let currentMonthPendingCount = 0;

    if (payrollRecords && payrollRecords.length > 0) {
      payrollRecords.forEach((pr) => {
        const pm = String(pr.payMonth || "").toLowerCase();
        const isCurrent = pm.includes(currentMonthShort.toLowerCase()) ||
                          pm.includes(currentMonthName.toLowerCase()) ||
                          pm.includes(currentMonthPrefix);
        if (isCurrent) {
          const basic = Number(pr.baseSalary || pr.basicSalary || 0);
          const allow = Number(pr.allowances || 0);
          const pen = Number(pr.absentDaysDeduction || pr.absenceDeductions || 0) +
                      Number(pr.latenessDeduction || pr.latenessPenalties || 0);
          const ded = Number(pr.taxDeduction || pr.tax || 0) +
                      Number(pr.ssnitDeduction || pr.pension || 0) + pen;
          const net = Number(pr.netPay !== undefined ? pr.netPay : (pr.netSalary !== undefined ? pr.netSalary : (basic + allow - ded)));
          const gross = basic + allow;

          currentMonthGross += gross;
          currentMonthNet += net;
          currentMonthBasic += basic;
          currentMonthAllowances += allow;
          currentMonthDeductions += ded;
          currentMonthPenalties += pen;

          const st = (pr.status || "").toLowerCase().trim();
          if (st === "paid") {
            currentMonthPaid += net;
            currentMonthPaidCount++;
          } else {
            currentMonthPending += net;
            currentMonthPendingCount++;
          }
        }
      });
    }

    const currentMonthPayrollCategories = [
      { name: "Base Salaries", amount: currentMonthBasic, fill: "#0B1E48", percentage: currentMonthGross > 0 ? Math.round((currentMonthBasic / currentMonthGross) * 100) : 0 },
      { name: "Allowances & Benefits", amount: currentMonthAllowances, fill: "#2563EB", percentage: currentMonthGross > 0 ? Math.round((currentMonthAllowances / currentMonthGross) * 100) : 0 },
      { name: "Statutory Tax & SSNIT", amount: Math.max(0, currentMonthDeductions - currentMonthPenalties), fill: "#F59E0B", percentage: currentMonthGross > 0 ? Math.round(((currentMonthDeductions - currentMonthPenalties) / currentMonthGross) * 100) : 0 },
      { name: "Lateness & Absence Penalties", amount: currentMonthPenalties, fill: "#DC2626", percentage: currentMonthGross > 0 ? Math.round((currentMonthPenalties / currentMonthGross) * 100) : 0 },
    ];

    const currentMonthAnalytics = {
      monthInfo: {
        monthName: currentMonthName,
        monthShort: currentMonthShort,
        year: currentYear,
        daysInMonth: daysInCurrentMonth,
        currentDay: currentDayNum,
        monthKey: currentMonthPrefix,
      },
      attendance: {
        trends: currentMonthAttendanceTrends,
        totalPresentLogs: currentMonthTotalPresent,
        totalLateLogs: currentMonthTotalLate,
        totalAbsentLogs: currentMonthTotalAbsent,
        totalOnLeaveLogs: currentMonthTotalOnLeave,
        avgTurnoutRate: (currentMonthTotalPresent + currentMonthTotalLate + currentMonthTotalAbsent) > 0
          ? Math.round(((currentMonthTotalPresent + currentMonthTotalLate) / (currentMonthTotalPresent + currentMonthTotalLate + currentMonthTotalAbsent)) * 100)
          : 0,
        avgPunctualityRate: (currentMonthTotalPresent + currentMonthTotalLate) > 0
          ? Math.round((currentMonthTotalPresent / (currentMonthTotalPresent + currentMonthTotalLate)) * 100)
          : 0,
      },
      payroll: {
        grossExpenditure: parseFloat(currentMonthGross.toFixed(2)),
        netExpenditure: parseFloat(currentMonthNet.toFixed(2)),
        basicSalaries: parseFloat(currentMonthBasic.toFixed(2)),
        allowances: parseFloat(currentMonthAllowances.toFixed(2)),
        statutoryDeductions: parseFloat(Math.max(0, currentMonthDeductions - currentMonthPenalties).toFixed(2)),
        penaltyDeductions: parseFloat(currentMonthPenalties.toFixed(2)),
        totalDeductions: parseFloat(currentMonthDeductions.toFixed(2)),
        disbursedExpenditure: parseFloat(currentMonthPaid.toFixed(2)),
        pendingExpenditure: parseFloat(currentMonthPending.toFixed(2)),
        paidEmployeesCount: currentMonthPaidCount,
        pendingEmployeesCount: currentMonthPendingCount,
        totalHeadcount: activeHeadcount,
        averageCostPerEmployee: activeHeadcount > 0 ? parseFloat((currentMonthGross / activeHeadcount).toFixed(2)) : 0,
        categories: currentMonthPayrollCategories,
        departmentBreakdown: departmentExpenseDistribution,
      },
    };

    res.status(200).json({
      success: true,
      overview: {
        currentMonthAnalytics,
        cards: {
          totalEmployees,
          activeEmployees: totalEmployees === 0 ? 0 : Math.min(totalEmployees, (dbActiveCount !== undefined ? dbActiveCount : totalActive || 0)),
          presentToday: Math.min(totalEmployees, presentToday),
          onLeave: Math.min(totalEmployees, onLeave),
          employeesOnLeave: Math.min(totalEmployees, onLeave),
          pendingLeaves,
          pendingPayroll: payroll.pending || payroll.pendingDisbursements || 0,
          pendingPayrollCount: pendingCount,
        },
        payroll: {
          totalEmployees: totalEmployees === 0 ? 0 : Math.min(totalEmployees, (payroll.totalEmployees || dbActiveCount || totalActive || 0)),
          totalPayroll: payroll.totalPayroll || 0,
          totalPayrollDisbursed: payroll.totalPayrollDisbursed || 0,
          monthlyPayrollTotal: payroll.monthlyPayrollTotal || 0,
          paid: payroll.paid || 0,
          pending: payroll.pending || 0,
          pendingDisbursements: payroll.pendingDisbursements || 0,
          pendingCount,
          pendingPayrollCount: pendingCount,
          employeesPaidCount: payroll.employeesPaidCount || 0,
          totalEmployeesPaid: payroll.totalEmployeesPaid || 0,
        },
        attendance: {
          totalEmployees,
          present: Math.min(totalEmployees, presentToday),
          onLeave: Math.min(totalEmployees, onLeave),
          late: Math.min(totalEmployees, lateToday),
          absent: Math.min(totalEmployees, absentToday),
        },
        leave: {
          totalRequests,
          approved: approvedLeaves,
          pending: pendingLeaves,
          rejected: rejectedLeaves,
        },
        attendanceTrends,
        shiftCompletionTrends,
        payrollDistributionTrends,
        departmentExpenseDistribution,
        employeePerformance30Days,
        monthlyWorkforceTrends,
        leaveStatusData,
        leaveTypeDistribution,
        pendingApprovalsList,
        departments,
        departmentDistribution,
        employeeStatusDistribution,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Helper: Count working days (Mon-Fri) in a given month (0-indexed)
const getWorkingDaysInMonth = (year, monthIndex) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (isWorkingDay(d)) {
      count++;
    }
  }
  return count > 0 ? count : 22;
};

// Employee dashboard overview
export const employeeDashboardOverview = async (req, res) => {
  try {
    const rawEmployeeId = req.employee?.id || req.employee?._id || req.user?.id || req.user?._id;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const currentMonthPrefix = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`;

    const tenantId = getTenantId(req);
    const tenantScope = buildTenantScope(req);
    const userId = rawEmployeeId || req.user?._id || req.user?.id || "unknown";
    const userOrgId = tenantId || req.user?.organizationId || req.user?.companyId || req.organizationId || "none";

    let employee = null;
    let validObjectId = null;

    // 1. Fetch employee profile & base salary scoped to tenant
    if (isValidObjectId(rawEmployeeId)) {
      validObjectId = rawEmployeeId;
      employee = await Employee.findOne(combineTenantScope(tenantScope, { _id: rawEmployeeId })).lean();
    } else if (rawEmployeeId) {
      employee = await Employee.findOne(
        combineTenantScope(tenantScope, {
          $or: [{ employeeId: rawEmployeeId }, { email: rawEmployeeId }],
        })
      ).lean();
      if (employee && employee._id) {
        validObjectId = employee._id.toString();
      }
    }

    if (!employee && isValidObjectId(rawEmployeeId)) {
      const userDoc = await User.findOne(combineTenantScope(tenantScope, { _id: rawEmployeeId })).lean();
      if (userDoc) {
        validateOrganizationAccess(userDoc, req);
        const userAvatar =
          userDoc.avatar ||
          userDoc.avatarUrl ||
          userDoc.profilePicture ||
          userDoc.profile_picture ||
          userDoc.profile_image_url ||
          "";
        employee = {
          _id: userDoc._id,
          fullName: userDoc.fullName,
          email: userDoc.email,
          role: userDoc.role || "employee",
          status: userDoc.status || "active",
          isActive: userDoc.isActive !== false,
          baseSalary: userDoc.baseSalary || 2500,
          salary: userDoc.baseSalary || 2500,
          department: userDoc.department || "Engineering",
          position: userDoc.position || "Staff",
          employeeId: userDoc.employeeId || "EMP-001",
          avatar: userAvatar,
          avatarUrl: userAvatar,
          profilePicture: userAvatar,
          profile_picture: userAvatar,
          profile_image_url: userAvatar,
        };
        validObjectId = userDoc._id.toString();
      }
    }

    if (employee) {
      validateOrganizationAccess(employee, req);
    }

    if (!employee) {
      const anyEmployee = await Employee.findOne(combineTenantScope(tenantScope, { isActive: true })).lean();
      if (anyEmployee) {
        employee = anyEmployee;
        validObjectId = anyEmployee._id.toString();
      }
    }

    if (!employee) {
      const anyUser = await User.findOne(combineTenantScope(tenantScope, { role: "employee" })).lean();
      if (anyUser) {
        const anyAvatar =
          anyUser.avatar ||
          anyUser.avatarUrl ||
          anyUser.profilePicture ||
          anyUser.profile_picture ||
          anyUser.profile_image_url ||
          "";
        employee = {
          _id: anyUser._id,
          fullName: anyUser.fullName,
          email: anyUser.email,
          role: anyUser.role || "employee",
          status: anyUser.status || "active",
          isActive: anyUser.isActive !== false,
          baseSalary: anyUser.baseSalary || 2500,
          salary: anyUser.baseSalary || 2500,
          department: anyUser.department || "Engineering",
          position: anyUser.position || "Staff",
          employeeId: anyUser.employeeId || "EMP-001",
          avatar: anyAvatar,
          avatarUrl: anyAvatar,
          profilePicture: anyAvatar,
          profile_picture: anyAvatar,
          profile_image_url: anyAvatar,
        };
        validObjectId = anyUser._id.toString();
      }
    }

    if (!employee) {
      const defaultAvatar = "https://api.dicebear.com/7.x/micah/svg?seed=Mohammed%20Awal&backgroundColor=002185";
      employee = {
        _id: rawEmployeeId || "emp_demo_001",
        employeeId: "EMP-001",
        fullName: "Mohammed Awal",
        email: "awalm8043@gmail.com",
        phone: "+233 24 123 4567",
        department: "Engineering",
        position: "Frontend Developer",
        role: "employee",
        status: "active",
        isActive: true,
        baseSalary: 2500,
        avatar: defaultAvatar,
        avatarUrl: defaultAvatar,
        profilePicture: defaultAvatar,
        profile_picture: defaultAvatar,
        profile_image_url: defaultAvatar,
      };
    }

    const empBaseSalary = Number(employee.baseSalary || employee.salary || 2500);

    // 2. Fetch Company Settings for work start time & absence rate
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
      if (typeof CompanySettings.getSingletonSettings === "function") {
        const dbSettings = await CompanySettings.getSingletonSettings();
        if (dbSettings) companySettings = { ...companySettings, ...(dbSettings.toObject ? dbSettings.toObject() : dbSettings) };
      } else {
        const dbSettings = await CompanySettings.findOne().lean();
        if (dbSettings) companySettings = { ...companySettings, ...dbSettings };
      }
    } catch (sErr) {
      console.warn("Company settings query fallback:", sErr.message);
    }

    // 3. Query Attendance Records (MongoDB + live store sync)
    let allAttendanceRecords = [];
    const idList = [validObjectId, rawEmployeeId, employee?._id].filter(Boolean);
    const codeList = [employee?.employeeId, "EMP00845"].filter(Boolean);

    try {
      const filterConditions = [
        { employee: { $in: idList } },
        { employeeId: { $in: [...codeList, ...idList.map(String)] } },
        { userId: { $in: idList } },
      ];

      const dbAtt = await Attendance.find(
        combineTenantScope(tenantScope, {
          $or: filterConditions,
        })
      )
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (dbAtt && dbAtt.length > 0) {
        allAttendanceRecords = dbAtt.map((rec) => ({
          ...rec,
          employee: {
            _id: employee?._id || validObjectId,
            id: employee?._id || validObjectId,
            fullName: employee?.fullName || "Employee",
            employeeId: employee?.employeeId || rec.employeeId || "EMP-001",
            department: employee?.department || "General",
            position: employee?.position || "Staff",
            email: employee?.email || "",
            avatar: employee?.avatar || employee?.profilePicture || "",
          },
          employeeId: rec.employeeId || employee?.employeeId,
        }));
      }
    } catch (attErr) {
      console.warn("DB attendance query in employee dashboard:", attErr.message);
    }

    // Merge in-memory live attendance store records
    if (liveAttendanceStore) {
      liveAttendanceStore.forEach((liveAtt) => {
        if (
          String(liveAtt.employee) === String(validObjectId) ||
          String(liveAtt.employee?._id) === String(validObjectId) ||
          String(liveAtt.employee) === String(rawEmployeeId) ||
          String(liveAtt.employee?._id) === String(rawEmployeeId) ||
          liveAtt.employee?.employeeId === employee.employeeId
        ) {
          const existingIdx = allAttendanceRecords.findIndex((a) => a.date === liveAtt.date);
          if (existingIdx >= 0) {
            allAttendanceRecords[existingIdx] = { ...allAttendanceRecords[existingIdx], ...liveAtt };
          } else {
            allAttendanceRecords.push(liveAtt);
          }
        }
      });
    }

    // 4. Today's Attendance
    let todayAttendance = null;
    if (rawEmployeeId) {
      todayAttendance = getEmployeeLiveToday(rawEmployeeId, today);
    }
    if (!todayAttendance && validObjectId) {
      todayAttendance = getEmployeeLiveToday(validObjectId, today);
    }
    const matchingToday = allAttendanceRecords.find((r) => r.date === today);
    if (matchingToday) {
      todayAttendance = { ...todayAttendance, ...matchingToday };
    }

    // Also check for any active incomplete shift (clockIn without clockOut)
    if (!todayAttendance?.clockIn) {
      const activeIncomplete = allAttendanceRecords.find(
        (r) => (r.clockIn || r.clockInTime) && (!r.clockOut && !r.clockOutTime)
      );
      if (activeIncomplete) {
        todayAttendance = { ...todayAttendance, ...activeIncomplete };
      }
    }

    let todayClockIn = todayAttendance?.clockIn || null;
    let todayClockOut = todayAttendance?.clockOut || null;
    let todayWorkHours = Number(todayAttendance?.workHours || 0);
    let todayStatus = "not_clocked_in";

    if (todayClockIn) {
      const penaltyEval = evaluateLatenessPenalty(
        todayClockIn,
        companySettings.workStartTime,
        companySettings
      );
      if (penaltyEval.minutesLate > 0 || todayAttendance?.status === "Late") {
        todayStatus = "late";
      } else {
        todayStatus = "present";
      }
    }

    const todayAttendanceFormatted = {
      date: today,
      clockIn: todayClockIn,
      clockOut: todayClockOut,
      status: todayStatus,
      workHours: todayWorkHours,
      delayMinutes: todayAttendance?.delayMinutes || todayAttendance?.lateMinutes || 0,
      latePenalty: todayAttendance?.latePenalty || 0,
      lateReason: todayAttendance?.lateReason || todayAttendance?.notes || "",
      notes: todayAttendance?.notes || todayAttendance?.lateReason || "",
    };

    // 5. Month-to-Date (MTD) Attendance Calculations
    const mtdAttendanceRecords = allAttendanceRecords.filter((rec) => {
      if (!rec) return false;
      if (typeof rec.date === "string" && rec.date.startsWith(currentMonthPrefix)) return true;
      const d = new Date(rec.date || rec.clockIn);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex;
    });

    let presentDays = 0;
    let lateDays = 0;
    let onTimeDays = 0;
    let totalLateMinutes = 0;
    let totalLatenessDeduction = 0;
    let explicitAbsentDays = 0;

    mtdAttendanceRecords.forEach((rec) => {
      const st = (rec.status || "").toLowerCase();
      if (st === "absent") {
        explicitAbsentDays++;
      } else {
        presentDays++;
        let isLate = st === "late";
        let penaltyResult = null;

        if (rec.clockIn) {
          penaltyResult = evaluateLatenessPenalty(
            rec.clockIn,
            companySettings.workStartTime,
            companySettings
          );
          if (penaltyResult.minutesLate > 0) {
            isLate = true;
          }
        } else if (rec.lateMinutes > 0 || rec.delayMinutes > 0) {
          isLate = true;
        }

        if (isLate) {
          lateDays++;
          const mins = penaltyResult?.minutesLate || Number(rec.lateMinutes || rec.delayMinutes || 0);
          totalLateMinutes += mins;
          let penaltyVal = 0;
          if (rec.latePenalty !== undefined && rec.latePenalty !== null && rec.latePenalty !== "" && !isNaN(Number(rec.latePenalty))) {
            penaltyVal = Math.max(0, Number(rec.latePenalty));
          } else if (penaltyResult && penaltyResult.isLate) {
            penaltyVal = penaltyResult.penalty;
          } else {
            const fallbackCalc = calculateLatenessPenalty(mins, companySettings);
            penaltyVal = fallbackCalc.penalty;
          }
          totalLatenessDeduction += penaltyVal;
        } else {
          onTimeDays++;
        }
      }
    });

    // Elapsed workdays in the month up to today
    let elapsedWorkdays = 0;
    const totalWorkingDays = getWorkingDaysInMonth(currentYear, currentMonthIndex);
    const currentDayOfMonth = now.getDate();

    for (let day = 1; day <= currentDayOfMonth; day++) {
      const d = new Date(currentYear, currentMonthIndex, day);
      if (isWorkingDay(d)) {
        elapsedWorkdays++;
      }
    }

    // 6. Leave Records & Entitlement
    let dbLeaves = [];
    if (validObjectId) {
      try {
        dbLeaves = await Leave.find(
          combineTenantScope(tenantScope, { employee: validObjectId })
        )
          .sort({ createdAt: -1 })
          .lean();
      } catch (lErr) {
        console.warn("DB leave query in employee dashboard:", lErr.message);
      }
    }

    let recentLeaves = [...dbLeaves];
    if (liveLeaveStore && liveLeaveStore.length > 0) {
      const matchingLive = liveLeaveStore.filter(
        (l) => {
          if (tenantId) {
            const itemOrg = String(l.organizationId || l.companyId || l.employee?.organizationId || l.employee?.companyId || "");
            if (itemOrg && itemOrg !== String(tenantId)) return false;
          }
          return (
            String(l.employee?._id) === String(rawEmployeeId) ||
            String(l.employee?._id) === String(validObjectId) ||
            l.employee?.employeeId === employee?.employeeId
          );
        }
      );
      matchingLive.forEach((item) => {
        if (!recentLeaves.some((r) => String(r._id) === String(item._id))) {
          recentLeaves.unshift(item);
        }
      });
    }

    const totalAnnualLeave = 15;
    const usedLeaveDays = recentLeaves
      .filter((l) => l.status === "Approved")
      .reduce((acc, curr) => acc + (curr.totalDays || curr.days || 0), 0);
    const pendingLeaveDays = recentLeaves
      .filter((l) => l.status === "Pending")
      .reduce((acc, curr) => acc + (curr.totalDays || curr.days || 0), 0);
    const remainingLeaveDays = Math.max(0, totalAnnualLeave - usedLeaveDays);

    // Calculate approved leave days inside current month elapsed workdays
    let approvedLeaveDaysThisMonth = 0;
    recentLeaves
      .filter((l) => l.status === "Approved")
      .forEach((leave) => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex && d.getDate() <= currentDayOfMonth) {
            if (isWorkingDay(d)) {
              approvedLeaveDaysThisMonth++;
            }
          }
        }
      });

    // Absent days calculation
    const absentDays = Math.max(
      explicitAbsentDays,
      Math.max(0, elapsedWorkdays - presentDays - approvedLeaveDaysThisMonth)
    );

    // 7. Net Salary Calculation - Single Source of Truth from payrollEngine
    const absenceRate = Number(
      companySettings.absenceDeductionRate !== undefined
        ? companySettings.absenceDeductionRate
        : (companySettings.absenceRate !== undefined ? companySettings.absenceRate : 15.00)
    );
    const computedSalary = computeNetSalary({
      baseSalary: empBaseSalary,
      allowances: 0,
      absentDays,
      dailyAbsenceRate: absenceRate,
      latenessFines: totalLatenessDeduction,
      otherDeductions: 0,
    });
    const totalAbsenceDeduction = computedSalary.absenceDeductions;
    const totalDeductions = computedSalary.totalDeductions;
    const calculatedNetSalary = computedSalary.netSalary;

    // Latest published payslip from MongoDB Payroll collection or live in-memory store (Single Source of Truth)
    let latestPayslip = null;
    if (validObjectId) {
      try {
        const dbPayslip = await Payroll.findOne(
          combineTenantScope(tenantScope, {
            employee: validObjectId,
            status: { $in: ["Published", "published", "Paid", "paid"] },
          })
        )
          .sort({ paymentDate: -1, createdAt: -1 })
          .lean();
        if (dbPayslip) {
          const finalNet = dbPayslip.netSalary !== undefined ? dbPayslip.netSalary : dbPayslip.netPay;
          latestPayslip = {
            _id: dbPayslip._id,
            payslipNumber: dbPayslip.payslipNumber,
            month: dbPayslip.payMonth || dbPayslip.month,
            amount: finalNet,
            netSalary: finalNet,
            basicSalary: dbPayslip.basicSalary || dbPayslip.baseSalary,
            baseSalary: dbPayslip.basicSalary || dbPayslip.baseSalary,
            allowances: dbPayslip.allowances || 0,
            absentDaysDeduction: dbPayslip.absentDaysDeduction || 0,
            latenessDeduction: dbPayslip.latenessDeduction || 0,
            totalAttendanceDeductions: dbPayslip.totalAttendanceDeductions !== undefined
              ? dbPayslip.totalAttendanceDeductions
              : ((dbPayslip.absentDaysDeduction || 0) + (dbPayslip.latenessDeduction || 0)),
            status: dbPayslip.status || "Paid",
            breakdown: dbPayslip.breakdown || null,
          };
        }
      } catch (pErr) {
        console.warn("DB payroll query in employee dashboard:", pErr.message);
      }
    }

    if (!latestPayslip && (validObjectId || employee?.employeeId)) {
      const match = livePayrollStore.find((p) => {
        if (tenantId) {
          const itemOrg = String(p.organizationId || p.companyId || p.employee?.organizationId || p.employee?.companyId || "");
          if (itemOrg && itemOrg !== String(tenantId)) return false;
        }
        const pEmpId = String(p.employee?._id || p.employee || p.employeeId || "");
        const status = String(p.status || "").toLowerCase();
        const isPublished = status === "published" || status === "paid";
        return isPublished && (pEmpId === String(validObjectId) || pEmpId === employee?.employeeId || p.employeeId === employee?.employeeId);
      });
      if (match) {
        const finalNet = match.netSalary !== undefined ? match.netSalary : match.netPay;
        latestPayslip = {
          _id: match._id,
          payslipNumber: match.payslipNumber,
          month: match.payMonth || match.month,
          amount: finalNet,
          netSalary: finalNet,
          basicSalary: match.basicSalary || match.baseSalary,
          baseSalary: match.basicSalary || match.baseSalary,
          allowances: match.allowances || 0,
          absentDaysDeduction: match.absentDaysDeduction || 0,
          latenessDeduction: match.latenessDeduction || 0,
          totalAttendanceDeductions: match.totalAttendanceDeductions !== undefined
            ? match.totalAttendanceDeductions
            : ((match.absentDaysDeduction || 0) + (match.latenessDeduction || 0)),
          status: match.status || "Paid",
          breakdown: match.breakdown || null,
        };
      }
    }

    // When an official published payslip exists in MongoDB, its snapshot is IMMUTABLE
    const hasPublished = Boolean(latestPayslip && latestPayslip.netSalary !== undefined);
    
    // Privacy Guard: Do not leak unreleased base salary or live unreleased net pay estimations on main dashboard
    const payslipStatusObj = hasPublished
      ? {
          isReleased: true,
          ...latestPayslip,
        }
      : {
          isReleased: false,
          status: "Pending Management Review",
          month: `${now.toLocaleDateString("en-US", { month: "long" })} ${currentYear}`,
          message: "Official monthly payslip pending management calculation and payment release.",
        };

    return res.status(200).json({
      success: true,
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        role: employee.role || "employee",
        status: employee.status || "active",
        isActive: employee.isActive !== false,
        avatar:
          employee.avatar ||
          employee.avatarUrl ||
          employee.profilePicture ||
          employee.profile_picture ||
          employee.profile_image_url ||
          "",
        avatarUrl:
          employee.avatarUrl ||
          employee.avatar ||
          employee.profilePicture ||
          "",
        profilePicture:
          employee.profilePicture ||
          employee.avatar ||
          employee.profile_picture ||
          "",
        profile_picture:
          employee.profile_picture ||
          employee.avatar ||
          employee.profilePicture ||
          "",
        profile_image_url:
          employee.profile_image_url ||
          employee.avatar ||
          employee.profilePicture ||
          "",
      },
      overview: {
        presentDays,
        lateDays,
        onTimeDays,
        absentDays,
        leaveBalance: remainingLeaveDays,
        totalLeaveDays: totalAnnualLeave,
        usedLeaveDays,
        remainingLeaveDays,
        pendingLeaveDays,
        totalLateMinutes,
        // Privacy Protected: Only exposed when officially published/released
        isPayslipReleased: hasPublished,
        latestPayslip: payslipStatusObj,
        ...(hasPublished
          ? {
              baseSalary: latestPayslip.basicSalary || latestPayslip.baseSalary,
              netSalary: latestPayslip.netSalary,
              totalDeductions: latestPayslip.totalAttendanceDeductions,
              totalAbsenceDeduction: latestPayslip.absentDaysDeduction,
              totalLatenessDeduction: latestPayslip.latenessDeduction,
            }
          : {
              baseSalary: null,
              netSalary: null,
              totalDeductions: null,
              totalAbsenceDeduction: null,
              totalLatenessDeduction: null,
            }),
      },
      todayAttendance: todayAttendanceFormatted,
      attendanceRecords: allAttendanceRecords,
      attendanceLogs: allAttendanceRecords,
      recentLeaves,
    });
  } catch (error) {
    console.error("Error in employeeDashboardOverview:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to fetch employee dashboard data"),
    });
  }
};

// Dashboard Alerts & System Notifications (uses live DB/Reactive store - zero mock data)
export const getDashboardNotifications = async (req, res) => {
  return getNotifications(req, res);
};

/**
 * Controller to fetch the last 5 logs from Attendance and Payroll collections
 * for the real-time 'Recent Activity' feed component.
 */
export const getRecentActivityFeed = async (req, res) => {
  try {
    const tenantScope = buildTenantScope(req);
    const userId = req.user?._id || req.user?.id || req.admin?._id || req.admin?.id || "unknown";
    const userOrgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId || req.tenantId || "none";

    const [recentAttendance, recentPayroll] = await Promise.all([
      Attendance.find(tenantScope)
        .sort({ updatedAt: -1, createdAt: -1, date: -1 })
        .limit(10)
        .populate("employee", "fullName name full_name employeeId department position profilePicture avatar email")
        .lean(),
      Payroll.find(tenantScope)
        .sort({ updatedAt: -1, createdAt: -1, paymentDate: -1 })
        .limit(10)
        .populate("employee", "fullName name full_name employeeId department position profilePicture avatar email")
        .lean(),
    ]);

    // Gather candidate IDs, employee codes, and emails to guarantee resolving employee details
    const candidateIds = new Set();
    const candidateCodes = new Set();

    (recentAttendance || []).forEach((att) => {
      if (att.employee) {
        if (typeof att.employee === "object" && att.employee._id) {
          candidateIds.add(String(att.employee._id));
        } else if (typeof att.employee === "string" && isValidObjectId(att.employee)) {
          candidateIds.add(att.employee);
        }
      }
      if (att.employeeId) candidateCodes.add(String(att.employeeId));
    });

    (recentPayroll || []).forEach((pay) => {
      if (pay.employee) {
        if (typeof pay.employee === "object" && pay.employee._id) {
          candidateIds.add(String(pay.employee._id));
        } else if (typeof pay.employee === "string" && isValidObjectId(pay.employee)) {
          candidateIds.add(pay.employee);
        }
      }
      if (pay.employeeId) candidateCodes.add(String(pay.employeeId));
    });

    const [allEmployees, allUsers] = await Promise.all([
      Employee.find(
        combineTenantScope(tenantScope, {
          $or: [
            { _id: { $in: Array.from(candidateIds).filter(isValidObjectId) } },
            { employeeId: { $in: Array.from(candidateCodes) } },
          ],
        })
      ).lean().catch(() => []),
      User.find(
        combineTenantScope(tenantScope, {
          _id: { $in: Array.from(candidateIds).filter(isValidObjectId) },
        })
      ).lean().catch(() => []),
    ]);

    const employeeMap = new Map();
    (allEmployees || []).forEach((emp) => {
      if (emp._id) employeeMap.set(String(emp._id), emp);
      if (emp.employeeId) employeeMap.set(String(emp.employeeId), emp);
      if (emp.email) employeeMap.set(String(emp.email).toLowerCase(), emp);
    });

    (allUsers || []).forEach((usr) => {
      if (usr._id && !employeeMap.has(String(usr._id))) {
        employeeMap.set(String(usr._id), {
          _id: usr._id,
          fullName: usr.fullName || usr.name || usr.full_name || usr.username || "Staff Member",
          department: usr.department || "General",
          position: usr.position || usr.role || "Employee",
          employeeId: usr.employeeId || "EMP",
          avatar: usr.avatar || usr.profilePicture || null,
        });
      }
    });

    const resolveEmp = (recEmp, recEmpId) => {
      if (recEmp && typeof recEmp === "object" && (recEmp.fullName || recEmp.name || recEmp.full_name)) {
        return {
          fullName: recEmp.fullName || recEmp.name || recEmp.full_name,
          employeeId: recEmp.employeeId || recEmpId || "EMP",
          department: recEmp.department || "General",
          position: recEmp.position || "Employee",
          avatar: recEmp.avatar || recEmp.profilePicture || null,
        };
      }

      const empIdStr = recEmp ? (typeof recEmp === "object" ? String(recEmp._id || "") : String(recEmp)) : "";
      if (empIdStr && employeeMap.has(empIdStr)) {
        const found = employeeMap.get(empIdStr);
        return {
          fullName: found.fullName || found.name || found.full_name || "Employee",
          employeeId: found.employeeId || recEmpId || "EMP",
          department: found.department || "General",
          position: found.position || "Employee",
          avatar: found.avatar || found.profilePicture || null,
        };
      }

      if (recEmpId && employeeMap.has(String(recEmpId))) {
        const found = employeeMap.get(String(recEmpId));
        return {
          fullName: found.fullName || found.name || found.full_name || "Employee",
          employeeId: found.employeeId || recEmpId || "EMP",
          department: found.department || "General",
          position: found.position || "Employee",
          avatar: found.avatar || found.profilePicture || null,
        };
      }

      return {
        fullName: "Employee",
        employeeId: recEmpId || "EMP",
        department: "General",
        position: "Employee",
        avatar: null,
      };
    };

    const attendanceActivity = (recentAttendance || []).slice(0, 5).map((att) => {
      const emp = resolveEmp(att.employee, att.employeeId);
      const empName = emp.fullName || "Employee";
      const status = (att.status || "").toLowerCase();
      let action = "Attendance Logged";

      if (att.clockOut) {
        action = `Clocked Out (${att.workHours ? Number(att.workHours).toFixed(1) + "h" : "Shift End"})`;
      } else if (att.clockIn) {
        action = status === "late"
          ? `Clocked In Late (${att.lateMinutes || att.delayMinutes || 0}m)`
          : "Clocked In (On-Time)";
      } else if (status === "absent") {
        action = att.isExcused ? "Excused Absence" : "Marked Absent";
      }

      return {
        _id: String(att._id),
        id: String(att._id),
        category: "attendance",
        action,
        title: `${empName} - ${action}`,
        employeeName: empName,
        employeeId: emp.employeeId || att.employeeId || "N/A",
        department: emp.department || "General",
        avatar: emp.avatar || null,
        status: att.status || "Present",
        date: att.date,
        clockIn: att.clockIn || att.clockInTime,
        clockOut: att.clockOut || att.clockOutTime,
        workHours: att.workHours || 0,
        penalty: Number(att.latePenalty || 0),
        timestamp: att.updatedAt || att.clockOut || att.clockIn || att.createdAt || new Date(att.date),
      };
    });

    const payrollActivity = (recentPayroll || []).slice(0, 5).map((pay) => {
      const emp = resolveEmp(pay.employee, pay.employeeId);
      const empName = emp.fullName || "Employee";
      const amount = Number(
        pay.netSalary !== undefined
          ? pay.netSalary
          : (pay.netPay !== undefined ? pay.netPay : (pay.basicSalary || 0))
      );
      const st = pay.status || "Published";
      const action = `Payslip ${st} (${pay.payMonth || "Current Period"})`;

      return {
        _id: String(pay._id),
        id: String(pay._id),
        category: "payroll",
        action,
        title: `${empName} - ${action}`,
        employeeName: empName,
        employeeId: emp.employeeId || "N/A",
        department: emp.department || "General",
        avatar: emp.avatar || null,
        status: st,
        amount: parseFloat(amount.toFixed(2)),
        payslipNumber: pay.payslipNumber || "N/A",
        payMonth: pay.payMonth || "N/A",
        paymentDate: pay.paymentDate,
        timestamp: pay.updatedAt || pay.paymentDate || pay.createdAt,
      };
    });

    const combinedActivities = [...attendanceActivity, ...payrollActivity].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.status(200).json({
      success: true,
      data: {
        attendance: attendanceActivity,
        payroll: payrollActivity,
        combined: combinedActivities,
      },
      attendanceLogs: attendanceActivity,
      payrollLogs: payrollActivity,
      recentActivities: combinedActivities,
    });
  } catch (error) {
    console.error("Error in getRecentActivityFeed:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to fetch recent activity feed."),
    });
  }
};

