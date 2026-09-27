import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo, useEffect, useCallback, memo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  UserCheck,
  Palmtree,
  Coffee,
  Info,
  Users,
  Eye,
  RefreshCw,
} from "lucide-react";
import { getEmployeeAttendance, getAllAttendance } from "../apis/fontApis";
import { useWorkSchedule } from "../utils/workSchedule";

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

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_MINI = ["S", "M", "T", "W", "T", "F", "S"];

const MonthlyAttendanceCalendarCardComponent = ({
  attendanceLogs = [],
  employeeId = null,
  role = "employee",
  title = "Monthly Attendance Calendar",
  subtitle = "Visual calendar tracking monthly attendance status (Present, Late, Absent) at a glance",
  refreshKey = 0,
}) => {
  const today = new Date();
  const todayDateString = today.toISOString().split("T")[0];

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState(employeeId || "all");
  const [employeesList, setEmployeesList] = useState([]);
  const [fetchedLogs, setFetchedLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
    setSelectedDayDetail(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
    setSelectedDayDetail(null);
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDayDetail(null);
  };

  // Fetch attendance records if not provided or to ensure live synchronization
  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      if (role === "admin") {
        const { data } = await getAllAttendance();
        if (data && data.success && Array.isArray(data.attendance)) {
          setFetchedLogs(data.attendance);

          // Extract unique employees
          const empMap = new Map();
          data.attendance.forEach((item) => {
            const emp = item.employee;
            if (emp && (emp._id || emp.id || emp.employeeId)) {
              const id = emp._id || emp.id || emp.employeeId;
              if (!empMap.has(id)) {
                empMap.set(id, {
                  id,
                  name: emp.fullName || emp.name || "Employee",
                  department: emp.department || "General",
                });
              }
            }
          });
          setEmployeesList(Array.from(empMap.values()));
        }
      } else {
        const { data } = await getEmployeeAttendance();
        if (data && data.success) {
          if (Array.isArray(data.attendance)) {
            setFetchedLogs(data.attendance);
          } else if (data.attendance && typeof data.attendance === "object") {
            setFetchedLogs([data.attendance]);
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch attendance in calendar component:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, refreshKey]);

  // Real-time synchronization listeners
  useEffect(() => {
    const handleSync = () => {
      fetchRecords();
    };

    window.addEventListener("attendance-updated", handleSync);
    let bc = null;
    try {
      bc = new BroadcastChannel("eyenit_attendance_sync");
      bc.onmessage = handleSync;
    } catch {
      // BroadcastChannel unsupported fallback
    }

    return () => {
      window.removeEventListener("attendance-updated", handleSync);
      if (bc) bc.close();
    };
  }, [fetchRecords]);

  // Merged logs (prefer prop attendanceLogs if provided, merged with fetched)
  const activeLogs = useMemo(() => {
    const combined = [...(attendanceLogs || []), ...fetchedLogs];
    const map = new Map();
    combined.forEach((item) => {
      if (!item) return;
      const key = `${item._id || item.id || ""}_${item.date || ""}_${item.employee?._id || item.employee?.id || item.employeeId || ""}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [attendanceLogs, fetchedLogs]);

  // Normalize single record status into standard string: "Present", "Late", "Absent", "Leave", "Half-day"
  const normalizeStatus = (rec) => {
    if (!rec) return "Absent";
    const status = (rec.status || "").toLowerCase();

    if (
      status.includes("half") ||
      status === "half-day" ||
      status === "half day" ||
      (Number(rec.workHours) > 0 && Number(rec.workHours) <= 4.5 && !rec.isLate)
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

    if (
      status === "late" ||
      rec.isLate ||
      Number(rec.lateMinutes || rec.delayMinutes || 0) > 0
    ) {
      return "Late";
    }

    if (status === "absent") {
      return "Absent";
    }

    if (
      status === "present" ||
      status === "on time" ||
      Boolean(rec.clockIn)
    ) {
      return "Present";
    }

    return "Present";
  };

  // Build calendar matrix data for current month & year
  const { isWorkingDay } = useWorkSchedule();
  const calendarData = useMemo(() => {
    const year = currentYear;
    const month = currentMonth;

    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Map logs for the month by date string YYYY-MM-DD
    const logsByDate = {};
    activeLogs.forEach((log) => {
      if (!log) return;
      let dateKey = log.date;
      if (!dateKey && (log.clockIn || log.createdAt)) {
        try {
          dateKey = new Date(log.clockIn || log.createdAt).toISOString().split("T")[0];
        } catch {
          dateKey = "";
        }
      }
      if (!dateKey) return;
      if (typeof dateKey === "string" && dateKey.includes("T")) {
        dateKey = dateKey.split("T")[0];
      }
      const parts = String(dateKey).split("-");
      if (parts.length < 3) return;
      const y = Number(parts[0]);
      const m = Number(parts[1]);

      if (y === year && m === month + 1) {
        // Filter by employee only in admin mode or when specifically required
        if (role !== "employee") {
          if (selectedEmployeeFilter !== "all") {
            const empId =
              log.employee?._id ||
              log.employee?.id ||
              log.employee?.employeeId ||
              log.employeeId ||
              log.userId;
            if (empId !== selectedEmployeeFilter) {
              return;
            }
          } else if (employeeId) {
            const matches =
              log.employee?._id === employeeId ||
              log.employee?.id === employeeId ||
              log.employee?.employeeId === employeeId ||
              log.employeeId === employeeId ||
              log.userId === employeeId;
            if (!matches) {
              return;
            }
          }
        }

        if (!logsByDate[dateKey]) {
          logsByDate[dateKey] = [];
        }
        logsByDate[dateKey].push(log);
      }
    });

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
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      const isWeekend = !isWorkingDay(new Date(year, month, d)); // rest day per the admin's working days
      const isToday = dateStr === todayDateString;
      const isFuture = dateStr > todayDateString;

      const records = logsByDate[dateStr] || [];

      // Status breakdown
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;
      let totalWorkHours = 0;

      records.forEach((r) => {
        const norm = normalizeStatus(r);
        const hrs = Number(r.workHours) || (r.clockIn && r.clockOut ? 8 : 0);
        totalWorkHours += hrs;

        if (norm === "Present") presentCount++;
        else if (norm === "Late") lateCount++;
        else if (norm === "Absent") absentCount++;
        else if (norm === "Leave") leaveCount++;
        else if (norm === "Half-day") halfDayCount++;
      });

      // Individual primary status calculation
      let primaryStatus;
      let primaryRecord = null;

      if (records.length > 0) {
        // Prioritize Late (with minutes) or Leave or Present over absent
        primaryRecord =
          records.find((r) => normalizeStatus(r) === "Late") ||
          records.find((r) => normalizeStatus(r) === "Leave") ||
          records.find((r) => normalizeStatus(r) === "Present") ||
          records[0];
        primaryStatus = normalizeStatus(primaryRecord);
      } else if (isWeekend) {
        primaryStatus = "Weekend";
      } else if (isFuture) {
        primaryStatus = "Upcoming";
      } else if (isToday) {
        primaryStatus = "Pending Clock-In";
      } else {
        // Past weekday without any attendance record: classified as absent
        primaryStatus = "Absent";
      }

      days.push({
        dayNumber: d,
        dateString: dateStr,
        dayOfWeek,
        isWeekend,
        isToday,
        isFuture,
        isCurrentMonth: true,
        records,
        primaryStatus,
        primaryRecord,
        presentCount,
        lateCount,
        absentCount,
        leaveCount,
        halfDayCount,
        totalWorkHours: Number(totalWorkHours.toFixed(1)),
      });
    }

    // Trailing padding days to finish the week grid
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
    activeLogs,
    selectedEmployeeFilter,
    employeeId,
    todayDateString,
    isWorkingDay,
  ]);

  // Aggregate monthly statistics for summary KPIs
  const monthlyStats = useMemo(() => {
    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let totalWorkHours = 0;
    let totalLateMinutes = 0;
    let workingDaysCount = 0;

    calendarData.forEach((day) => {
      if (!day.isCurrentMonth || day.isWeekend || day.isFuture) return;
      workingDaysCount++;

      if (role === "admin" && selectedEmployeeFilter === "all") {
        presentDays += day.presentCount;
        lateDays += day.lateCount;
        absentDays += day.absentCount;
        leaveDays += day.leaveCount;
        totalWorkHours += day.totalWorkHours;
      } else {
        if (day.primaryStatus === "Present") {
          presentDays++;
          totalWorkHours += day.totalWorkHours || 8;
        } else if (day.primaryStatus === "Late") {
          lateDays++;
          presentDays++; // Late employees are physically present
          totalWorkHours += day.totalWorkHours || 8;
          const mins = Number(
            day.primaryRecord?.lateMinutes || day.primaryRecord?.delayMinutes || 0
          );
          totalLateMinutes += mins;
        } else if (day.primaryStatus === "Absent") {
          absentDays++;
        } else if (day.primaryStatus === "Leave") {
          leaveDays++;
        }
      }
    });

    const activeDays = presentDays + absentDays;
    const punctualityRate =
      presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 100;
    const attendanceRate =
      activeDays > 0 ? Math.round((presentDays / activeDays) * 100) : 100;

    return {
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      totalWorkHours: Number(totalWorkHours.toFixed(1)),
      totalLateMinutes,
      punctualityRate: Math.max(0, punctualityRate),
      attendanceRate: Math.max(0, attendanceRate),
      workingDaysCount,
    };
  }, [calendarData, role, selectedEmployeeFilter]);

  // Status visual styles mapper
  const getStatusBadge = (status, record = null) => {
    switch (status) {
      case "Present":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
          pill: "bg-emerald-500 text-white",
          dot: "bg-emerald-500",
          label: "Present",
          icon: CheckCircle2,
        };
      case "Late":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
          pill: "bg-amber-500 text-white",
          dot: "bg-amber-500",
          label: record?.lateMinutes || record?.delayMinutes ? `Late (+${record.lateMinutes || record.delayMinutes}m)` : "Late",
          icon: Clock,
        };
      case "Absent":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
          pill: "bg-rose-500 text-white",
          dot: "bg-rose-500",
          label: "Absent",
          icon: XCircle,
        };
      case "Leave":
        return {
          bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
          pill: "bg-blue-500 text-white",
          dot: "bg-blue-500",
          label: "On Leave",
          icon: Palmtree,
        };
      case "Half-day":
        return {
          bg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
          pill: "bg-indigo-500 text-white",
          dot: "bg-indigo-500",
          label: "Half-Day",
          icon: Coffee,
        };
      case "Weekend":
        return {
          bg: "bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800/60",
          pill: "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
          dot: "bg-slate-400",
          label: "Weekend",
          icon: Coffee,
        };
      case "Pending Clock-In":
        return {
          bg: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
          pill: "bg-sky-500 text-white",
          dot: "bg-sky-500",
          label: "Pending Clock-In",
          icon: Clock,
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500 border-dashed border-slate-200 dark:border-slate-800",
          pill: "bg-slate-200 dark:bg-slate-800 text-slate-500",
          dot: "bg-slate-300",
          label: "Upcoming",
          icon: CalendarIcon,
        };
    }
  };

  const isTeamView = role === "admin" && selectedEmployeeFilter === "all";

  return (
    <div
      id="monthly-attendance-visual-calendar-card"
      className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 transition-all"
    >
      {/* Top Header Row with Title, Controls & Month Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        {/* Action Controls: Employee Filter (if admin) + Month Steppers */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Employee Filter Dropdown */}
          {role === "admin" && employeesList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedEmployeeFilter}
                onChange={(e) => {
                  setSelectedEmployeeFilter(e.target.value);
                  setSelectedDayDetail(null);
                }}
                className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Workforce</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-2">
              <select
                value={currentMonth}
                onChange={(e) => {
                  setCurrentMonth(Number(e.target.value));
                  setSelectedDayDetail(null);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer py-1"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option
                    key={name}
                    value={idx}
                    className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                  >
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => {
                  setCurrentYear(Number(e.target.value));
                  setSelectedDayDetail(null);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer py-1"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                  <option
                    key={yr}
                    value={yr}
                    className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                  >
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Jump to Today Button */}
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Today
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchRecords}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh Attendance Status"
          >
            {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Monthly Metric Badges Strip (At a glance) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Present Metric Card */}
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Present Days
            </span>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
              {monthlyStats.presentDays}
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
            {monthlyStats.attendanceRate}% Rate
          </span>
        </div>

        {/* Late Check-in Metric Card */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Late Arrivals
            </span>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
              {monthlyStats.lateDays}
            </div>
          </div>
          {monthlyStats.totalLateMinutes > 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
              {monthlyStats.totalLateMinutes}m Total
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              Punctual
            </span>
          )}
        </div>

        {/* Absent Metric Card */}
        <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50/60 dark:bg-rose-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Absent Days
            </span>
            <div className="text-xl font-bold text-rose-900 dark:text-rose-100">
              {monthlyStats.absentDays}
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              monthlyStats.absentDays === 0
                ? "bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200"
            }`}
          >
            {monthlyStats.absentDays === 0 ? "Perfect" : `${monthlyStats.absentDays} Unlogged`}
          </span>
        </div>

        {/* Total Work Hours Metric Card */}
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-950/20 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Total Hours
            </span>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {monthlyStats.totalWorkHours}h
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
            {monthlyStats.punctualityRate}% On-Time
          </span>
        </div>
      </div>

      {/* 7-Day Visual Calendar Grid Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
            {DAYS_SHORT.map((dayName, idx) => {
              const isWeekendHeader = idx === 0 || idx === 6;
              return (
                <div
                  key={dayName}
                  className={`text-center py-2 text-xs font-bold rounded-lg border ${
                    isWeekendHeader
                      ? "bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800/50"
                      : "bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span className="hidden sm:inline">{dayName}</span>
                  <span className="sm:hidden">{DAYS_MINI[idx]}</span>
                </div>
              );
            })}
          </div>

          {/* Calendar Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarData.map((day, idx) => {
              if (!day.isCurrentMonth) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="min-h-[76px] sm:min-h-[92px] p-2 rounded-xl bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200/50 dark:border-slate-800/40 opacity-40 select-none flex flex-col justify-between"
                  >
                    <span className="text-xs font-medium text-slate-400">
                      {day.dayNumber}
                    </span>
                  </div>
                );
              }

              const isSelected =
                selectedDayDetail && selectedDayDetail.dateString === day.dateString;
              const badgeStyle = getStatusBadge(day.primaryStatus, day.primaryRecord);
              const BadgeIcon = badgeStyle.icon;

              return (
                <div
                  key={day.dateString}
                  onClick={() => setSelectedDayDetail(day)}
                  className={`min-h-[76px] sm:min-h-[92px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none relative group ${
                    isSelected
                      ? "ring-2 ring-blue-500 border-blue-500 shadow-md bg-blue-50/30 dark:bg-blue-950/30"
                      : day.isToday
                      ? "border-blue-400 dark:border-blue-500 shadow-xs " + badgeStyle.bg
                      : badgeStyle.bg
                  }`}
                >
                  {/* Day Header with Day Number & Today indicator */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold ${
                        day.isToday
                          ? "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {day.isToday && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Body Content: Status Indicator Pill */}
                  <div className="mt-1 space-y-1">
                    {/* Team View Multi-Badge Breakdown */}
                    {isTeamView ? (
                      <div className="space-y-0.5">
                        {day.isWeekend ? (
                          <span className="text-[10px] font-medium text-slate-400 block text-center">
                            Weekend
                          </span>
                        ) : day.records.length > 0 ? (
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            {day.presentCount > 0 && (
                              <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                {day.presentCount} Pres
                              </span>
                            )}
                            {day.lateCount > 0 && (
                              <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                {day.lateCount} Late
                              </span>
                            )}
                            {day.absentCount > 0 && (
                              <span className="flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                {day.absentCount} Abs
                              </span>
                            )}
                          </div>
                        ) : day.isFuture ? (
                          <span className="text-[10px] text-slate-400 block text-center">
                            Upcoming
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block text-center">
                            Unlogged
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Individual View: Single Status Chip */
                      <div>
                        {day.primaryStatus === "Weekend" ? (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block text-center py-1">
                            Rest Day
                          </span>
                        ) : day.primaryStatus === "Upcoming" ? (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block text-center py-1">
                            Upcoming
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <div
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs ${
                                day.primaryStatus === "Present"
                                  ? "bg-emerald-600 text-white"
                                  : day.primaryStatus === "Late"
                                  ? "bg-amber-500 text-white"
                                  : day.primaryStatus === "Absent"
                                  ? "bg-rose-600 text-white"
                                  : day.primaryStatus === "Leave"
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-600 text-white"
                              }`}
                            >
                              <BadgeIcon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{badgeStyle.label}</span>
                            </div>

                            {/* Work Hours Subtitle */}
                            {day.primaryRecord?.workHours && (
                              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 text-center truncate">
                                {Number(day.primaryRecord.workHours).toFixed(1)}h logged
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Day Inspector / Audit Drawer */}
      {selectedDayDetail && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 space-y-3 transition-all animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Daily Attendance Detail:{" "}
                <span className="text-blue-600 dark:text-blue-400">
                  {new Date(selectedDayDetail.dateString + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </span>
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDayDetail(null)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Records List for Selected Day */}
          {selectedDayDetail.records && selectedDayDetail.records.length > 0 ? (
            <div className="space-y-2">
              {selectedDayDetail.records.map((rec, rIdx) => {
                const norm = normalizeStatus(rec);
                const badge = getStatusBadge(norm, rec);
                const ClockIcon = badge.icon;
                const empName =
                  rec.employee?.fullName || rec.employee?.name || "Employee";

                return (
                  <div
                    key={rec._id || rIdx}
                    className="p-3 rounded-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          norm === "Present"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : norm === "Late"
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-rose-500/15 text-rose-600"
                        }`}
                      >
                        <ClockIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {empName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              norm === "Present"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : norm === "Late"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {norm}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>
                            Clock In:{" "}
                            <strong>
                              {rec.clockIn
                                ? new Date(rec.clockIn).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </strong>
                          </span>
                          <span>
                            Clock Out:{" "}
                            <strong>
                              {rec.clockOut
                                ? new Date(rec.clockOut).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "In Progress"}
                            </strong>
                          </span>
                          <span>
                            Work Hours:{" "}
                            <strong>
                              {Number(rec.workHours || 0).toFixed(1)} hrs
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delay or Notes badge */}
                    <div className="text-right sm:text-right text-xs">
                      {norm === "Late" && (
                        <div className="text-amber-700 dark:text-amber-400 font-bold">
                          Delay: +{rec.lateMinutes || rec.delayMinutes || 0} mins
                          {rec.latePenalty > 0 && (
                            <span className="block text-[11px] text-rose-600 dark:text-rose-400">
                              Deduction: GH₵{Number(rec.latePenalty).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                      {(rec.lateReason || rec.notes) && (
                        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 italic max-w-[200px] text-right ml-auto">
                          Reason: "{rec.lateReason || rec.notes}"
                        </div>
                      )}
                      {rec.isExcused && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Excused by Management
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {selectedDayDetail.isWeekend
                  ? "Company rest day. No shift clock-in required."
                  : selectedDayDetail.isFuture
                  ? "Future scheduled workday. Attendance will be recorded upon shift arrival."
                  : "No attendance clock-in recorded for this scheduled workday (Marked as Absent)."}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend & Visual Guide Bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Attendance Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Present (On-Time)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>Late Arrival</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span>Approved Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            <span>Rest Day / Weekend</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Click on any day cell to view detailed shift timestamps &amp; audit status
        </div>
      </div>
    </div>
  );
};

export const MonthlyAttendanceCalendarCard = memo(MonthlyAttendanceCalendarCardComponent);
export default MonthlyAttendanceCalendarCard;
