import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Filter,
  Activity,
  Layers,
  ArrowRight,
  X,
  Briefcase,
  Palmtree,
  AlertTriangle,
  Award,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useWorkSchedule } from "../utils/workSchedule";

// Month names list
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const AttendanceMonthlyCalendar = ({
  attendanceLogs = [],
  employeesList = [],
  leaveRequests = [],
  onSelectDate,
  onOpenOverride,
}) => {
  // Current view year & month state (default to current local date)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'heatmap'
  const [isExporting, setIsExporting] = useState(false);

  // Day detail drilldown modal
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  // Departments list computed from employees & logs
  const departments = useMemo(() => {
    const set = new Set();
    employeesList.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    attendanceLogs.forEach((log) => {
      if (log.employee?.department) set.add(log.employee.department);
    });
    return Array.from(set);
  }, [employeesList, attendanceLogs]);

  // Unique employees list for filter dropdown
  const filteredEmployeesList = useMemo(() => {
    if (selectedDepartment === "All") return employeesList;
    return employeesList.filter((emp) => emp.department === selectedDepartment);
  }, [employeesList, selectedDepartment]);

  // Helper to normalize status into standard categories: 'Present', 'Absent', 'Half-day', 'Leave', 'Late'
  const normalizeStatus = (record) => {
    if (!record) return "Absent";
    const status = (record.status || "").trim().toLowerCase();

    if (
      status.includes("half") ||
      status === "half-day" ||
      status === "half day" ||
      status === "halfday" ||
      (Number(record.workHours) > 0 && Number(record.workHours) <= 4.5 && !record.isLate)
    ) {
      return "Half-day";
    }

    if (
      status.includes("leave") ||
      status === "on leave" ||
      status === "vacation" ||
      status === "sick leave"
    ) {
      return "Leave";
    }

    if (status === "late" || record.isLate) {
      return "Late";
    }

    if (status === "absent") {
      return "Absent";
    }

    if (
      status === "present" ||
      status === "on time" ||
      (record.clockIn && status !== "absent")
    ) {
      return "Present";
    }

    return "Present";
  };

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const { isWorkingDay } = useWorkSchedule();

  // Build calendar matrix data for current month
  const calendarData = useMemo(() => {
    const year = currentYear;
    const month = currentMonth;

    // Total days in month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    // First day of month (0 = Sun, 1 = Mon, etc.)
    const firstDayIndex = new Date(year, month, 1).getDay();

    // Total days in previous month for padding
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Map logs for the month by date string YYYY-MM-DD
    const logsByDate = {};
    attendanceLogs.forEach((log) => {
      if (!log.date) return;
      const [y, m] = log.date.split("-").map(Number);
      if (y === year && m === month + 1) {
        // Apply employee/department filter if active
        if (
          selectedDepartment !== "All" &&
          log.employee?.department !== selectedDepartment
        ) {
          return;
        }
        if (
          selectedEmployeeId !== "All" &&
          log.employee?._id !== selectedEmployeeId &&
          log.employee?.employeeId !== selectedEmployeeId &&
          log.employee?.id !== selectedEmployeeId
        ) {
          return;
        }

        if (!logsByDate[log.date]) {
          logsByDate[log.date] = [];
        }
        logsByDate[log.date].push(log);
      }
    });

    const activeHeadcount =
      selectedEmployeeId !== "All"
        ? 1
        : selectedDepartment !== "All"
        ? Math.max(
            1,
            employeesList.filter((e) => e.department === selectedDepartment)
              .length
          )
        : Math.max(1, employeesList.length || 6);

    const days = [];

    // Leading padding days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonthNum = month === 0 ? 12 : month;
      const prevYearNum = month === 0 ? year - 1 : year;
      const dateStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

      days.push({
        dayNumber: dayNum,
        dateString: dateStr,
        isCurrentMonth: false,
        isPrevMonth: true,
        isWeekend: false,
        records: [],
      });
    }

    // Days of current month
    const todayStr = new Date().toISOString().split("T")[0];

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      const isWeekend = !isWorkingDay(new Date(year, month, d)); // rest day per the admin's working days
      const isToday = dateStr === todayStr;

      const records = logsByDate[dateStr] || [];

      // Calculate categorized statistics for this day
      let presentCount = 0;
      let halfDayCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let explicitAbsentCount = 0;

      records.forEach((r) => {
        const norm = normalizeStatus(r);
        if (norm === "Half-day") {
          halfDayCount += 1;
        } else if (norm === "Leave") {
          leaveCount += 1;
        } else if (norm === "Late") {
          lateCount += 1;
          presentCount += 1;
        } else if (norm === "Absent") {
          explicitAbsentCount += 1;
        } else {
          presentCount += 1;
        }
      });

      const totalHours = records.reduce(
        (sum, r) => sum + (Number(r.workHours) || 0),
        0
      );

      const targetHeadcount = isWeekend ? 0 : activeHeadcount;
      const totalLoggedStaff = presentCount + halfDayCount + leaveCount + explicitAbsentCount;
      const unloggedAbsentCount = isWeekend
        ? 0
        : Math.max(0, targetHeadcount - totalLoggedStaff);
      const absentCount = explicitAbsentCount + unloggedAbsentCount;

      const dailyRate =
        targetHeadcount > 0
          ? Math.min(
              100,
              Math.round(((presentCount + halfDayCount * 0.5) / targetHeadcount) * 100)
            )
          : 0;

      days.push({
        dayNumber: d,
        dateString: dateStr,
        dayOfWeek,
        isWeekend,
        isToday,
        isCurrentMonth: true,
        records,
        presentCount,
        halfDayCount,
        lateCount,
        leaveCount,
        absentCount,
        totalHours: Number(totalHours.toFixed(1)),
        dailyRate,
        targetHeadcount,
      });
    }

    // Trailing padding days to fill 7x5 or 7x6 grid (multiples of 7)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let j = 1; j <= remainingCells; j++) {
      const nextMonthNum = month === 11 ? 1 : month + 2;
      const nextYearNum = month === 11 ? year + 1 : year;
      const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, "0")}-${String(j).padStart(2, "0")}`;

      days.push({
        dayNumber: j,
        dateString: dateStr,
        isCurrentMonth: false,
        isNextMonth: true,
        isWeekend: false,
        records: [],
      });
    }

    return days;
  }, [
    currentYear,
    currentMonth,
    attendanceLogs,
    employeesList,
    selectedDepartment,
    selectedEmployeeId,
    isWorkingDay,
  ]);

  // Compute Comprehensive Summary Statistics for the Selected Month
  const monthlySummaryStats = useMemo(() => {
    const year = currentYear;
    const month = currentMonth;
    const currentMonthDays = calendarData.filter(
      (d) => d.isCurrentMonth && !d.isWeekend
    );
    const totalWorkingDays = currentMonthDays.length;

    // Filter relevant attendance logs for this month
    const monthLogs = attendanceLogs.filter((log) => {
      if (!log.date) return false;
      const [y, m] = log.date.split("-").map(Number);
      if (y !== year || m !== month + 1) return false;
      if (
        selectedDepartment !== "All" &&
        log.employee?.department !== selectedDepartment
      ) {
        return false;
      }
      if (
        selectedEmployeeId !== "All" &&
        log.employee?._id !== selectedEmployeeId &&
        log.employee?.employeeId !== selectedEmployeeId &&
        log.employee?.id !== selectedEmployeeId
      ) {
        return false;
      }
      return true;
    });

    // 1. WORK HOURS & STATUS METRICS
    let totalWorkHours = 0;
    let standardHours = 0;
    let overtimeHours = 0;
    let lateCount = 0;
    let presentCount = 0;
    let halfDayCount = 0;
    let explicitAbsentCount = 0;

    const employeeBreakdownMap = {};

    monthLogs.forEach((log) => {
      const hours = Number(log.workHours) || (log.clockIn && log.clockOut ? 8 : 0);
      totalWorkHours += hours;

      if (hours > 8) {
        standardHours += 8;
        overtimeHours += hours - 8;
      } else {
        standardHours += hours;
      }

      const norm = normalizeStatus(log);
      if (norm === "Half-day") {
        halfDayCount += 1;
      } else if (norm === "Late") {
        lateCount += 1;
        presentCount += 1;
      } else if (norm === "Absent") {
        explicitAbsentCount += 1;
      } else if (norm !== "Leave") {
        presentCount += 1;
      }

      // Group per employee
      const empId = log.employee?._id || log.employee?.employeeId || "unknown";
      const empName = log.employee?.fullName || log.employee?.name || "Employee";
      const empDept = log.employee?.department || "General";

      if (!employeeBreakdownMap[empId]) {
        employeeBreakdownMap[empId] = {
          id: empId,
          name: empName,
          department: empDept,
          hours: 0,
          overtime: 0,
          presentDays: 0,
          halfDays: 0,
          leaveDays: 0,
          lateDays: 0,
          absentDays: 0,
        };
      }
      employeeBreakdownMap[empId].hours += hours;
      if (hours > 8) employeeBreakdownMap[empId].overtime += hours - 8;
      if (norm === "Late") employeeBreakdownMap[empId].lateDays += 1;
      if (norm === "Half-day") employeeBreakdownMap[empId].halfDays += 1;
      if (norm === "Leave") {
        employeeBreakdownMap[empId].leaveDays += 1;
      } else if (norm === "Absent") {
        employeeBreakdownMap[empId].absentDays += 1;
      } else {
        employeeBreakdownMap[empId].presentDays += 1;
      }
    });

    const activeHeadcount =
      selectedEmployeeId !== "All"
        ? 1
        : selectedDepartment !== "All"
        ? Math.max(
            1,
            employeesList.filter((e) => e.department === selectedDepartment)
              .length
          )
        : Math.max(1, employeesList.length || 6);

    const targetCapacityHours = totalWorkingDays * 8 * activeHeadcount;
    const hoursCompletionRate =
      targetCapacityHours > 0
        ? Math.min(100, Math.round((totalWorkHours / targetCapacityHours) * 100))
        : 0;

    const avgHoursPerDay =
      totalWorkingDays > 0
        ? Number((totalWorkHours / totalWorkingDays).toFixed(1))
        : 0;

    const totalPresentEntries = presentCount + halfDayCount;
    const avgDailyHoursPerStaff =
      totalPresentEntries > 0
        ? Number((totalWorkHours / totalPresentEntries).toFixed(1))
        : 0;

    // 2. LEAVE DAYS METRICS
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    let approvedLeaveDays = 0;
    let pendingLeaveDays = 0;
    const leaveTypesDistribution = {
      Annual: 0,
      Sick: 0,
      Casual: 0,
      Maternity: 0,
      Paternity: 0,
      Bereavement: 0,
      Other: 0,
    };

    // Tally from official leave requests
    const countedEmployeeLeaveDates = new Set();

    leaveRequests.forEach((req) => {
      // Filter by department or employee if active
      if (
        selectedDepartment !== "All" &&
        req.employee?.department !== selectedDepartment
      ) {
        return;
      }
      if (
        selectedEmployeeId !== "All" &&
        req.employee?._id !== selectedEmployeeId &&
        req.employee?.employeeId !== selectedEmployeeId &&
        req.employee?.id !== selectedEmployeeId
      ) {
        return;
      }

      if (!req.startDate || !req.endDate) return;

      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);

      // Check overlap with current month
      const overlapStart = new Date(Math.max(monthStart, reqStart));
      const overlapEnd = new Date(Math.min(monthEnd, reqEnd));

      if (overlapStart <= overlapEnd) {
        // Calculate days in this month
        let overlapDays = 0;
        const cur = new Date(overlapStart);
        while (cur <= overlapEnd) {
          // Count workdays
          if (isWorkingDay(cur)) {
            overlapDays++;
            const dateStr = cur.toISOString().split("T")[0];
            const empKey = `${req.employee?._id || req.employee?.employeeId}_${dateStr}`;
            countedEmployeeLeaveDates.add(empKey);
          }
          cur.setDate(cur.getDate() + 1);
        }

        const typeKey =
          Object.keys(leaveTypesDistribution).find((k) =>
            req.leaveType?.toLowerCase().includes(k.toLowerCase())
          ) || "Other";

        if (req.status?.toLowerCase() === "approved") {
          approvedLeaveDays += overlapDays;
          leaveTypesDistribution[typeKey] =
            (leaveTypesDistribution[typeKey] || 0) + overlapDays;
        } else if (req.status?.toLowerCase() === "pending") {
          pendingLeaveDays += overlapDays;
        }
      }
    });

    // Also account for logs with status 'On Leave' that were not captured in leave requests
    monthLogs.forEach((log) => {
      const norm = normalizeStatus(log);
      if (norm === "Leave") {
        const empKey = `${log.employee?._id || log.employee?.employeeId}_${log.date}`;
        if (!countedEmployeeLeaveDates.has(empKey)) {
          countedEmployeeLeaveDates.add(empKey);
          approvedLeaveDays += 1;
          leaveTypesDistribution["Annual"] =
            (leaveTypesDistribution["Annual"] || 0) + 1;
        }
      }
    });

    // Tally monthly unexcused absences
    let totalUnexcusedAbsences = 0;
    currentMonthDays.forEach((d) => {
      totalUnexcusedAbsences += d.absentCount;
    });

    const totalStaffDays = totalWorkingDays * activeHeadcount;
    const leaveUtilizationRate =
      totalStaffDays > 0
        ? Number(((approvedLeaveDays / totalStaffDays) * 100).toFixed(1))
        : 0;

    // Top employees by hours logged
    const topEmployees = Object.values(employeeBreakdownMap)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 4);

    const punctualityRate =
      presentCount + lateCount > 0
        ? Math.round(
            ((presentCount - lateCount) / (presentCount || 1)) * 100
          )
        : 100;

    return {
      totalWorkingDays,
      activeHeadcount,
      targetCapacityHours: Math.round(targetCapacityHours),
      totalWorkHours: Number(totalWorkHours.toFixed(1)),
      standardHours: Number(standardHours.toFixed(1)),
      overtimeHours: Number(overtimeHours.toFixed(1)),
      hoursCompletionRate,
      avgHoursPerDay,
      avgDailyHoursPerStaff,
      presentCount,
      halfDayCount,
      lateCount,
      explicitAbsentCount,
      approvedLeaveDays,
      pendingLeaveDays,
      leaveTypesDistribution,
      totalUnexcusedAbsences,
      leaveUtilizationRate,
      punctualityRate,
      topEmployees,
      monthLogs,
    };
  }, [
    calendarData,
    attendanceLogs,
    leaveRequests,
    employeesList,
    currentYear,
    currentMonth,
    selectedDepartment,
    selectedEmployeeId,
    isWorkingDay,
  ]);

  // Helper for heatmap cell color calculation
  const getHeatmapColor = (day) => {
    if (!day.isCurrentMonth) return "bg-[#F8FAFC]/40 opacity-30 border-[#F1F5F9]";
    if (day.isWeekend) return "bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]";

    if (day.records.length === 0) {
      return "bg-white border-[#E2E8F0] hover:border-[#002185]/40";
    }

    const rate = day.dailyRate;
    if (rate >= 90) return "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]";
    if (rate >= 70) return "bg-[#DCFCE7] border-[#4ADE80] text-[#15803D]";
    if (rate >= 50) return "bg-[#FEF9C3] border-[#FDE047] text-[#854D0E]";
    if (rate >= 25) return "bg-[#FFEDD5] border-[#FDBA74] text-[#9A3412]";
    return "bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]";
  };

  // Helper for formatting time
  const formatTimeStr = (timeString) => {
    if (!timeString) return "-";
    try {
      if (
        typeof timeString === "string" &&
        timeString.includes(":") &&
        !timeString.includes("T")
      ) {
        return timeString;
      }
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return timeString;
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString || "-";
    }
  };

  // Export Calendar Attendance Data & Summary Statistics to CSV
  const handleExportCSV = () => {
    try {
      setIsExporting(true);

      const monthName = MONTH_NAMES[currentMonth];
      const selectedEmpObj =
        selectedEmployeeId !== "All"
          ? employeesList.find(
              (e) => (e._id || e.employeeId || e.id) === selectedEmployeeId
            )
          : null;
      const employeeNameText = selectedEmpObj
        ? selectedEmpObj.fullName || selectedEmpObj.name || selectedEmployeeId
        : "All Staff Members";

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = [];

      // SECTION 1: REPORT METADATA & EXECUTIVE SUMMARY
      rows.push(["=== MONTHLY ATTENDANCE AND WORKFORCE REPORT ==="]);
      rows.push(["Report Month", `${monthName} ${currentYear}`]);
      rows.push(["Department Filter", selectedDepartment]);
      rows.push(["Employee Filter", employeeNameText]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push([""]);

      rows.push(["--- MONTHLY SUMMARY STATISTICS ---"]);
      rows.push(["Metric Name", "Value", "Unit / Context"]);
      rows.push(["Total Working Days", monthlySummaryStats.totalWorkingDays, "days in month"]);
      rows.push(["Active Headcount Scope", monthlySummaryStats.activeHeadcount, "employees"]);
      rows.push(["Total Work Hours Logged", monthlySummaryStats.totalWorkHours, "hours"]);
      rows.push(["Target Work Hours Capacity", monthlySummaryStats.targetCapacityHours, "hours"]);
      rows.push(["Standard Shift Hours (<= 8h/day)", monthlySummaryStats.standardHours, "hours"]);
      rows.push(["Overtime Work Hours (> 8h/day)", monthlySummaryStats.overtimeHours, "hours"]);
      rows.push(["Hours Capacity Completion Rate", `${monthlySummaryStats.hoursCompletionRate}%`, "target %"]);
      rows.push(["Daily Average Hours per Staff", `${monthlySummaryStats.avgDailyHoursPerStaff} hrs/day`, "productivity"]);
      rows.push(["Daily Average Team Total Hours", `${monthlySummaryStats.avgHoursPerDay} hrs/day`, "output"]);
      rows.push(["Total Approved Leave Days", monthlySummaryStats.approvedLeaveDays, "days"]);
      rows.push(["Total Pending Leave Days", monthlySummaryStats.pendingLeaveDays, "requests pending"]);
      rows.push(["Leave Capacity Utilization Rate", `${monthlySummaryStats.leaveUtilizationRate}%`, "workforce days"]);
      rows.push(["Total Unexcused Absences", monthlySummaryStats.totalUnexcusedAbsences, "days"]);
      rows.push(["Total Half-Day Instances", monthlySummaryStats.halfDayCount, "shifts"]);
      rows.push(["Workforce Punctuality Rate", `${monthlySummaryStats.punctualityRate}%`, "on-time %"]);
      rows.push([""]);

      // LEAVE BREAKDOWN BY TYPE
      rows.push(["--- LEAVE BREAKDOWN BY CATEGORY ---"]);
      rows.push(["Category", "Approved Days"]);
      Object.entries(monthlySummaryStats.leaveTypesDistribution).forEach(([cat, count]) => {
        rows.push([cat, count]);
      });
      rows.push([""]);

      // SECTION 2: DAILY CALENDAR MATRIX BREAKDOWN
      rows.push(["--- DAILY ATTENDANCE CALENDAR MATRIX ---"]);
      rows.push([
        "Date",
        "Day of Week",
        "Type",
        "Present Staff",
        "Half-day Staff",
        "Late Staff",
        "On Leave Staff",
        "Absent Staff",
        "Total Hours Logged",
        "Daily Presence Rate (%)",
      ]);

      calendarData
        .filter((d) => d.isCurrentMonth)
        .forEach((day) => {
          rows.push([
            day.dateString,
            DAYS_OF_WEEK[day.dayOfWeek] || "",
            day.isWeekend ? "Weekend" : "Workday",
            day.presentCount,
            day.halfDayCount,
            day.lateCount,
            day.leaveCount,
            day.absentCount,
            day.totalHours,
            `${day.dailyRate}%`,
          ]);
        });

      rows.push([""]);

      // SECTION 3: DETAILED TIMECARD ROSTER RECORDS
      rows.push(["--- DETAILED EMPLOYEE TIMECARD LOGS ---"]);
      rows.push([
        "Date",
        "Employee Code",
        "Full Name",
        "Department",
        "Status Badge",
        "Clock In",
        "Clock Out",
        "Work Hours (hrs)",
        "Is Late",
      ]);

      if (monthlySummaryStats.monthLogs.length > 0) {
        // Sort chronologically and by employee name
        const sortedLogs = [...monthlySummaryStats.monthLogs].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          const nameA = a.employee?.fullName || a.employee?.name || "";
          const nameB = b.employee?.fullName || b.employee?.name || "";
          return nameA.localeCompare(nameB);
        });

        sortedLogs.forEach((log) => {
          const empName = log.employee?.fullName || log.employee?.name || "Employee";
          const empCode = log.employee?.employeeId || log.employee?._id || "EMP";
          const empDept = log.employee?.department || "General";
          const normStatus = normalizeStatus(log);
          const inTime = formatTimeStr(log.clockIn || log.checkIn);
          const outTime = formatTimeStr(log.clockOut || log.checkOut);
          const hours = Number(log.workHours) || (log.clockIn && log.clockOut ? 8 : 0);
          const isLateText = log.isLate || normStatus === "Late" ? "Yes" : "No";

          rows.push([
            log.date,
            empCode,
            empName,
            empDept,
            normStatus,
            inTime,
            outTime,
            hours,
            isLateText,
          ]);
        });
      } else {
        rows.push(["No individual timecard records logged for this month range."]);
      }

      // Convert rows to CSV content
      const csvString = rows
        .map((row) => row.map((cell) => escapeCSV(cell)).join(","))
        .join("\r\n");

      // Add UTF-8 BOM for Excel compatibility
      const blob = new Blob(["\uFEFF" + csvString], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanDept = selectedDepartment.replace(/[^a-zA-Z0-9]/g, "_");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Attendance_Report_${monthName}_${currentYear}_${cleanDept}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export attendance CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render uniform Color-Coded Status Badge component
  const renderStatusBadge = (statusStr, size = "md", customHours = null) => {
    const norm = statusStr ? statusStr.toLowerCase() : "absent";

    if (norm.includes("half") || norm === "half-day") {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${
            size === "sm"
              ? "px-1.5 py-0.2 text-[9px] bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]"
              : "px-2.5 py-1 text-xs bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <span>Half-day</span>
          {customHours !== null && (
            <span className="tabular-nums font-semibold opacity-80">({customHours}h)</span>
          )}
        </span>
      );
    }

    if (norm.includes("leave")) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${
            size === "sm"
              ? "px-1.5 py-0.2 text-[9px] bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD]"
              : "px-2.5 py-1 text-xs bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
          <span>Leave</span>
        </span>
      );
    }

    if (norm.includes("late")) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${
            size === "sm"
              ? "px-1.5 py-0.2 text-[9px] bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
              : "px-2.5 py-1 text-xs bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
          <span>Late</span>
          {customHours !== null && (
            <span className="tabular-nums font-semibold opacity-80">({customHours}h)</span>
          )}
        </span>
      );
    }

    if (norm.includes("absent")) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${
            size === "sm"
              ? "px-1.5 py-0.2 text-[9px] bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
              : "px-2.5 py-1 text-xs bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
          <span>Absent</span>
        </span>
      );
    }

    // Default: Present
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs ${
          size === "sm"
            ? "px-1.5 py-0.2 text-[9px] bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
            : "px-2.5 py-1 text-xs bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] shrink-0" />
        <span>Present</span>
        {customHours !== null && (
          <span className="tabular-nums font-semibold opacity-80">({customHours}h)</span>
        )}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Calendar Top Header with Controls, Filters & CSV Export */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        {/* Title & Description without decorative icon */}
        <div>
          <div>
            <h2 className="text-base sm:text-xl font-bold text-[#0B1E48] dark:text-white flex items-center gap-2">
              Monthly Attendance Pattern & Hours Analysis
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Manager View
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
              Track workforce presence, color-coded statuses, monthly total work hours, and export CSV reports
            </p>
          </div>
        </div>

        {/* Action Controls, Navigation & CSV Download Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export CSV Report Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3 py-2 text-xs font-bold text-white bg-[#002185] hover:bg-[#001861] active:scale-98 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download Monthly Attendance & Statistics as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? <><WorkspaceLoader inline /> Exporting...</> : "Export CSV"}</span>
          </button>

          {/* Month & Year Stepper */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer py-1"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer py-1"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>Today</span>
          </button>

          {/* Department Filter */}
          {departments.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedEmployeeId("All");
                }}
                className="bg-transparent text-xs font-medium text-slate-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">All Depts</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Individual Employee Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 max-w-[160px] sm:max-w-xs">
            <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-white focus:outline-none cursor-pointer truncate w-full"
            >
              <option value="All" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">All Staff Roster</option>
              {filteredEmployeesList.map((emp) => (
                <option key={emp._id || emp.employeeId} value={emp._id || emp.employeeId} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
                  {emp.fullName || emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Grid vs Heatmap */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-[#0B1E48] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-white"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("heatmap")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "heatmap"
                  ? "bg-[#0B1E48] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-white"
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Heatmap</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN LAYOUT: Calendar on Left, Summary Statistics Panel on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Calendar Matrix (xl:col-span-8) */}
        <div className="xl:col-span-8 space-y-4">
          {/* Quick Context Sub-header & Status Badges Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-slate-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#0B1E48] dark:text-white text-sm">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="text-slate-600 dark:text-slate-300">{monthlySummaryStats.totalWorkingDays} Working Days</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {monthlySummaryStats.punctualityRate}% Punctual
              </span>
            </div>

            {/* Glanceable Status Badges Indicator Bar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F0FDF4] dark:bg-emerald-950/50 text-[#15803D] dark:text-emerald-300 border border-[#86EFAC] dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] dark:bg-emerald-400" />
                Present
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF7ED] dark:bg-amber-950/50 text-[#C2410C] dark:text-amber-300 border border-[#FDBA74] dark:border-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C] dark:bg-amber-400" />
                Half-day
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-blue-950/50 text-[#1D4ED8] dark:text-blue-300 border border-[#93C5FD] dark:border-blue-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] dark:bg-blue-400" />
                Leave
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FEF2F2] dark:bg-rose-950/50 text-[#B91C1C] dark:text-rose-300 border border-[#FCA5A5] dark:border-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] dark:bg-rose-400" />
                Absent
              </span>
            </div>
          </div>

          {/* Calendar Frame */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-center">
              {DAYS_OF_WEEK.map((day, idx) => (
                <div
                  key={day}
                  className={`py-2.5 text-xs font-bold uppercase tracking-wider ${
                    idx === 0 || idx === 6
                      ? "text-slate-400 dark:text-slate-500 font-semibold"
                      : "text-[#0B1E48] dark:text-slate-300 font-semibold"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Day Matrix */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#111927]">
              {calendarData.map((day, index) => {
                const hasRecords = day.records && day.records.length > 0;
                const isSingleEmp = selectedEmployeeId !== "All";

                return (
                  <div
                    key={`cal-day-${index}`}
                    onClick={() => {
                      if (day.isCurrentMonth) {
                        setSelectedDayDetail(day);
                      }
                    }}
                    className={`min-h-[92px] sm:min-h-[104px] p-2 transition-all flex flex-col justify-between relative group ${
                      day.isCurrentMonth
                        ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:shadow-inner"
                        : "bg-slate-50/40 dark:bg-slate-900/40 opacity-40 select-none cursor-default"
                    } ${day.isToday ? "bg-blue-50/40 dark:bg-blue-950/40 ring-1.5 ring-inset ring-blue-600 dark:ring-blue-400" : ""} ${
                      viewMode === "heatmap" ? getHeatmapColor(day) : ""
                    }`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs w-5 h-5 flex items-center justify-center rounded-full ${
                            day.isToday
                              ? "bg-[#0B1E48] text-white font-bold shadow-xs"
                              : day.isWeekend
                              ? "text-slate-400 dark:text-slate-500 font-medium"
                              : day.isCurrentMonth
                              ? "text-slate-800 dark:text-white font-bold"
                              : "text-slate-400 dark:text-slate-500 font-medium"
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {day.isToday && (
                          <span className="hidden sm:inline-block text-[8px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded-xs">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Daily Presence Ratio Pill */}
                      {viewMode === "grid" &&
                        day.isCurrentMonth &&
                        !day.isWeekend &&
                        hasRecords && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              day.dailyRate >= 80
                                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300"
                                : day.dailyRate >= 50
                                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300"
                                : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300"
                            }`}
                          >
                            {day.dailyRate}%
                          </span>
                        )}
                    </div>

                    {/* Middle Content: Color-Coded Status Indicators */}
                    <div className="my-1 space-y-1">
                      {day.isCurrentMonth && !day.isWeekend ? (
                        hasRecords ? (
                          isSingleEmp ? (
                            /* Single Employee Individual Status Badge */
                            <div className="space-y-1">
                              {day.records.map((rec, rIdx) => {
                                const norm = normalizeStatus(rec);
                                return (
                                  <div key={rIdx} className="flex items-center justify-between">
                                    {renderStatusBadge(norm, "sm", rec.workHours)}
                                  </div>
                                );
                              })}
                            </div>
                          ) : viewMode === "grid" ? (
                            /* Team Aggregated Color-Coded Status Badges & Distribution Bar */
                            <div className="space-y-1">
                              {/* Segmented status distribution bar */}
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden flex">
                                {day.presentCount > 0 && (
                                  <div
                                    style={{
                                      width: `${Math.round((day.presentCount / (day.targetHeadcount || 1)) * 100)}%`,
                                    }}
                                    className="bg-[#16A34A] h-full"
                                    title={`Present: ${day.presentCount}`}
                                  />
                                )}
                                {day.halfDayCount > 0 && (
                                  <div
                                    style={{
                                      width: `${Math.round((day.halfDayCount / (day.targetHeadcount || 1)) * 100)}%`,
                                    }}
                                    className="bg-[#EA580C] h-full"
                                    title={`Half-day: ${day.halfDayCount}`}
                                  />
                                )}
                                {day.leaveCount > 0 && (
                                  <div
                                    style={{
                                      width: `${Math.round((day.leaveCount / (day.targetHeadcount || 1)) * 100)}%`,
                                    }}
                                    className="bg-[#2563EB] h-full"
                                    title={`Leave: ${day.leaveCount}`}
                                  />
                                )}
                                {day.absentCount > 0 && (
                                  <div
                                    style={{
                                      width: `${Math.round((day.absentCount / (day.targetHeadcount || 1)) * 100)}%`,
                                    }}
                                    className="bg-[#DC2626] h-full"
                                    title={`Absent: ${day.absentCount}`}
                                  />
                                )}
                              </div>

                              {/* Color-Coded Status Badge Chips */}
                              <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold">
                                {day.presentCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                    title={`${day.presentCount} Staff Present`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                                    <span>{day.presentCount}P</span>
                                  </span>
                                )}
                                {day.halfDayCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                    title={`${day.halfDayCount} Staff Half-day`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                                    <span>{day.halfDayCount}HD</span>
                                  </span>
                                )}
                                {day.leaveCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                    title={`${day.leaveCount} Staff on Leave`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                                    <span>{day.leaveCount}L</span>
                                  </span>
                                )}
                                {day.absentCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                    title={`${day.absentCount} Staff Absent`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                                    <span>{day.absentCount}A</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Heatmap Compact Density Indicator */
                            <div className="text-center py-0.5">
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">
                                {day.presentCount + day.halfDayCount} logged
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 italic py-0.5">
                            No logs
                          </div>
                        )
                      ) : day.isWeekend && day.isCurrentMonth ? (
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium py-0.5">
                          Weekend
                        </div>
                      ) : null}
                    </div>

                    {/* Bottom Row: Hours & Drilldown Prompt */}
                    <div className="flex items-center justify-between pt-0.5 text-[9px] text-slate-500 dark:text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-800">
                      {day.isCurrentMonth && !day.isWeekend && hasRecords ? (
                        <>
                          <span className="truncate font-medium text-slate-600 dark:text-slate-300">{day.totalHours} hrs</span>
                          <span className="text-[#0B1E48] dark:text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            View <ArrowRight className="w-2 h-2" />
                          </span>
                        </>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color-Coded Status Legend & Export Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
            {/* 4 Status Badges Legend */}
            <div className="flex items-center gap-2.5 flex-wrap text-[11px]">
              <span className="font-bold text-[#0B1E48] dark:text-white">Legend:</span>
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <span>Present (P)</span>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
                <span>Half-day (HD)</span>
              </div>
              <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span>Leave (L)</span>
              </div>
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                <span>Absent (A)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={handleExportCSV}
                className="text-[#0B1E48] dark:text-blue-400 hover:text-amber-500 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
                <span>Download Report (.csv)</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DEDICATED SUMMARY STATISTICS PANEL (xl:col-span-4) */}
        <div className="xl:col-span-4 space-y-4">
          {/* Panel Top Header Card */}
          <div className="bg-slate-50 dark:bg-[#162033] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Monthly Summary Statistics
                </span>
                <h3 className="text-base font-bold text-[#0B1E48] dark:text-white flex items-center gap-1.5 mt-0.5">
                  <Briefcase className="w-4 h-4 text-amber-500" />
                  <span>{MONTH_NAMES[currentMonth]} {currentYear}</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B1E48] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Download CSV"
              >
                <Download className="w-3 h-3 text-amber-500" />
                <span>CSV</span>
              </button>
            </div>

            {/* 1. TOTAL WORK HOURS STATISTIC CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Total Work Hours</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Logged hours across workforce</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {monthlySummaryStats.hoursCompletionRate}% of target
                </span>
              </div>

              {/* Work Hours Big Display */}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#0B1E48] dark:text-white tracking-tight">
                    {monthlySummaryStats.totalWorkHours}
                  </span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">hrs</span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Target Capacity</span>
                  <span className="font-bold text-slate-800 dark:text-white">{monthlySummaryStats.targetCapacityHours} hrs</span>
                </div>
              </div>

              {/* Progress Bar: Standard vs Overtime Hours */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        monthlySummaryStats.targetCapacityHours > 0
                          ? (monthlySummaryStats.standardHours / monthlySummaryStats.targetCapacityHours) * 100
                          : 0
                      )}%`,
                    }}
                    className="bg-blue-600 dark:bg-blue-500 h-full"
                    title={`Standard Hours: ${monthlySummaryStats.standardHours}h`}
                  />
                  {monthlySummaryStats.overtimeHours > 0 && (
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          monthlySummaryStats.targetCapacityHours > 0
                            ? (monthlySummaryStats.overtimeHours / monthlySummaryStats.targetCapacityHours) * 100
                            : 0
                        )}%`,
                      }}
                      className="bg-amber-500 h-full"
                      title={`Overtime Hours: ${monthlySummaryStats.overtimeHours}h`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                    Regular: {monthlySummaryStats.standardHours}h
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Overtime: {monthlySummaryStats.overtimeHours}h
                  </span>
                </div>
              </div>

              {/* Quick Hours Averages Mini-Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-[#162033] p-2 rounded-lg text-center border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Daily Avg / Staff</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{monthlySummaryStats.avgDailyHoursPerStaff} hrs/day</span>
                </div>
                <div className="bg-slate-50 dark:bg-[#162033] p-2 rounded-lg text-center border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Daily Team Total</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{monthlySummaryStats.avgHoursPerDay} hrs/day</span>
                </div>
              </div>
            </div>

            {/* 2. TOTAL LEAVE DAYS STATISTIC CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Palmtree className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Total Leave Days</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Approved leaves in {MONTH_NAMES[currentMonth]}</p>
                  </div>
                </div>

                {monthlySummaryStats.pendingLeaveDays > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    {monthlySummaryStats.pendingLeaveDays} pending
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    All Reviewed
                  </span>
                )}
              </div>

              {/* Leave Days Big Display */}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {monthlySummaryStats.approvedLeaveDays}
                  </span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">days</span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Leave Utilization</span>
                  <span className="font-bold text-slate-800 dark:text-white">{monthlySummaryStats.leaveUtilizationRate}%</span>
                </div>
              </div>

              {/* Leave Types Breakdown List */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Leave Breakdown by Category
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">Annual</span>
                    <span className="font-bold text-[#0B1E48] dark:text-white">
                      {monthlySummaryStats.leaveTypesDistribution.Annual || 0}d
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">Sick</span>
                    <span className="font-bold text-[#0B1E48] dark:text-white">
                      {monthlySummaryStats.leaveTypesDistribution.Sick || 0}d
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">Casual</span>
                    <span className="font-bold text-[#0B1E48] dark:text-white">
                      {monthlySummaryStats.leaveTypesDistribution.Casual || 0}d
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">Other/Special</span>
                    <span className="font-bold text-[#0B1E48] dark:text-white">
                      {(monthlySummaryStats.leaveTypesDistribution.Maternity || 0) +
                        (monthlySummaryStats.leaveTypesDistribution.Paternity || 0) +
                        (monthlySummaryStats.leaveTypesDistribution.Bereavement || 0) +
                        (monthlySummaryStats.leaveTypesDistribution.Other || 0)}d
                    </span>
                  </div>
                </div>
              </div>

              {/* Absence vs Half-Day Summary Badges */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px]">
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Half-days:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {monthlySummaryStats.halfDayCount}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px]">
                  <span className="font-semibold text-rose-700 dark:text-rose-300">Absences:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {monthlySummaryStats.totalUnexcusedAbsences}d
                  </span>
                </div>
              </div>
            </div>

            {/* 3. TOP STAFF HOURS CONTRIBUTORS THIS MONTH */}
            {monthlySummaryStats.topEmployees.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-[#0B1E48] dark:text-white">
                      Top Staff Hours Logged
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {MONTH_NAMES[currentMonth]}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {monthlySummaryStats.topEmployees.map((emp, idx) => (
                    <div
                      key={emp.id || idx}
                      className="py-1.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[9px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-white truncate">
                          {emp.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {emp.leaveDays > 0 && (
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                            {emp.leaveDays}d leave
                          </span>
                        )}
                        <span className="font-bold text-[#0B1E48] dark:text-white tabular-nums">
                          {emp.hours} hrs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DAY DRILLDOWN MODAL */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111927] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162033] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B1E48] text-white flex items-center justify-center font-bold">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B1E48] dark:text-white">
                    Attendance Detail for {selectedDayDetail.dateString}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {new Date(
                      selectedDayDetail.dateString + "T00:00:00"
                    ).toLocaleDateString("en-GH", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayDetail(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Day Summary Stats Bar with Color Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-white dark:bg-[#111927] border-b border-slate-200 dark:border-slate-800 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">
                  Present
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-300">
                  {selectedDayDetail.presentCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold block">
                  Half-day
                </span>
                <span className="text-base font-black text-amber-600 dark:text-amber-300">
                  {selectedDayDetail.halfDayCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold block">
                  Leave
                </span>
                <span className="text-base font-black text-blue-600 dark:text-blue-300">
                  {selectedDayDetail.leaveCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold block">
                  Absent
                </span>
                <span className="text-base font-black text-rose-600 dark:text-rose-300">
                  {selectedDayDetail.absentCount}
                </span>
              </div>
            </div>

            {/* Records Roster List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-white dark:bg-[#111927]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#0B1E48] dark:text-white uppercase tracking-wider">
                  Employee Logs ({selectedDayDetail.records.length})
                </h4>
                {onSelectDate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(selectedDayDetail.dateString);
                      setSelectedDayDetail(null);
                    }}
                    className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Filter Main Table to this Date</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {selectedDayDetail.records.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {selectedDayDetail.records.map((record, rIdx) => {
                    const empName = record.employee?.fullName || record.employee?.name || "Employee";
                    const empDept = record.employee?.department || "General";
                    const empCode =
                      record.employee?.employeeId ||
                      record.employee?._id?.slice(-6) ||
                      "EMP";
                    const normStatus = normalizeStatus(record);

                    return (
                      <div
                        key={rIdx}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B1E48] dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                            {empName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800 dark:text-white">
                                {empName}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {empCode}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {empDept}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {/* Clock In / Out & Hours */}
                          <div className="text-right text-xs">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-medium">
                              <span>In: {formatTimeStr(record.clockIn || record.checkIn)}</span>
                              <span>•</span>
                              <span>Out: {formatTimeStr(record.clockOut || record.checkOut)}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {record.workHours ? `${record.workHours} hours` : "Standard shift"}
                            </span>
                          </div>

                          {/* Color-Coded Status Badge */}
                          {renderStatusBadge(normStatus, "md", null)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    No attendance records logged for this day
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    This day may be a weekend, holiday, or before clock-in records were initiated.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-[#162033] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedDayDetail.records.length} records retrieved
              </span>
              <div className="flex items-center gap-2">
                {onOpenOverride && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenOverride(selectedDayDetail.dateString);
                      setSelectedDayDetail(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-[#0B1E48] dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Adjust / Override Record
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#0B1E48] dark:bg-blue-600 rounded-xl hover:bg-[#00175f] dark:hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceMonthlyCalendar;
