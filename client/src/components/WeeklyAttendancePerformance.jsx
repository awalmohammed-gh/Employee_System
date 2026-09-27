import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  Target,
  Award,
} from "lucide-react";
import axios from "axios";
import { useWorkSchedule } from "../utils/workSchedule";

// Helper to generate the 12 calendar months for the given year
const generateMonthsList = (year = new Date().getFullYear()) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months.map((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, "0");
    return {
      value: `${year}-${monthNum}`,
      label: `${name} ${year}`,
      monthName: name,
      monthIndex: idx,
    };
  });
};

// Helper to calculate exact weeks in a given month string ("YYYY-MM")
const calculateWeeksInMonth = (monthStr) => {
  if (!monthStr || !monthStr.includes("-")) {
    const now = new Date();
    monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthNumStr, 10) - 1;

  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const shortMonth = new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "short" });

  const weeks = [];
  let dayStart = 1;

  while (dayStart <= totalDays) {
    const dayEnd = Math.min(dayStart + 6, totalDays);
    const startIso = `${yearStr}-${monthNumStr}-${String(dayStart).padStart(2, "0")}`;
    const endIso = `${yearStr}-${monthNumStr}-${String(dayEnd).padStart(2, "0")}`;

    weeks.push({
      weekNumber: weeks.length + 1,
      startDay: dayStart,
      endDay: dayEnd,
      startLabel: `${shortMonth} ${dayStart}`,
      endLabel: `${shortMonth} ${dayEnd}`,
      startDate: startIso,
      endDate: endIso,
    });

    dayStart = dayEnd + 1;
  }

  return weeks;
};

// Custom Tooltip for Attendance Patterns
const AttendanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload || {};
    const totalHeadcount = (data.present || 0) + (data.late || 0) + (data.absent || 0);
    const attendanceRate = totalHeadcount > 0 ? Math.round(((data.present || 0) / totalHeadcount) * 100) : 0;

    return (
      <div className="bg-[#0B1E48] dark:bg-slate-900 text-white p-3 rounded-xl shadow-md dark:shadow-none border border-blue-900/40 dark:border-slate-800 text-xs min-w-[200px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <span className="font-semibold text-xs text-white">
            {data.fullDay || data.fullWeek || label}
          </span>
          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-500/30">
            {data.rate !== undefined ? data.rate : attendanceRate}% Rate
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              On Time / Present:
            </span>
            <span className="font-bold text-white">{data.present || 0}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Late Arrival:
            </span>
            <span className="font-bold text-white">{data.late || 0}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              Absent / Leave:
            </span>
            <span className="font-bold text-white">{data.absent || 0}</span>
          </div>

          {data.totalHours !== undefined && (
            <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-slate-300">
              <span>Worked Hours:</span>
              <span className="font-semibold text-white">{data.totalHours} hrs</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Hours Worked vs Shift Requirements
const HoursTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload || {};
    const target = data.targetHours || 8;
    const actual = data.totalHours || 0;
    const diff = Math.round((actual - target) * 10) / 10;
    const compliance = target > 0 ? Math.min(150, Math.round((actual / target) * 100)) : (actual > 0 ? 100 : 0);

    return (
      <div className="bg-[#0B1E48] dark:bg-slate-900 text-white p-3 rounded-xl shadow-md dark:shadow-none border border-blue-900/40 dark:border-slate-800 text-xs min-w-[210px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <span className="font-semibold text-xs text-white">
            {data.fullDay || data.fullWeek || label}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
              actual >= target
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
          >
            {compliance}% of Shift
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3 h-3 text-blue-400" />
              Hours Worked:
            </span>
            <span className="font-bold text-white">{actual} hrs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Target className="w-3 h-3 text-slate-400" />
              Shift Target:
            </span>
            <span className="font-semibold text-white">{target} hrs</span>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
            <span className="text-slate-300">Variance:</span>
            <span
              className={`font-bold ${
                diff >= 0 ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {diff >= 0 ? `+${diff} hrs (Met)` : `${diff} hrs (Deficit)`}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const WeeklyAttendancePerformance = ({
  attendanceLogs = [],
  title = "Weekly Attendance & Shift Performance",
  subtitle = "Visualize attendance patterns and total hours worked against shift requirements",
  employeeId = null,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedWeek, setSelectedWeek] = useState("all");
  const [metricMode, setMetricMode] = useState("hours"); // 'hours' | 'attendance'
  const [fetchedMetrics, setFetchedMetrics] = useState(null);

  const monthsList = useMemo(() => generateMonthsList(currentYear), [currentYear]);
  const weeksInMonth = useMemo(() => calculateWeeksInMonth(selectedMonth), [selectedMonth]);

  // Handle Month Selection
  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    setSelectedWeek("all");
  };

  // Handle Week Selection
  const handleWeekChange = (newWeek) => {
    setSelectedWeek(newWeek);
  };

  // Compute selected date boundaries
  const activeDateBounds = useMemo(() => {
    if (selectedWeek === "all") {
      const [y, m] = selectedMonth.split("-");
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${String(lastDay).padStart(2, "0")}`,
        isFullMonth: true,
      };
    }
    const weekIdx = parseInt(selectedWeek, 10) - 1;
    const weekObj = weeksInMonth[weekIdx] || weeksInMonth[0];
    return {
      startDate: weekObj?.startDate || `${selectedMonth}-01`,
      endDate: weekObj?.endDate || `${selectedMonth}-07`,
      isFullMonth: false,
      weekObj,
    };
  }, [selectedMonth, selectedWeek, weeksInMonth]);

  // Optional live query to backend performance metrics endpoint with fallback
  const fetchBackendPerformance = useCallback(async () => {
    try {
      const params = {
        month: selectedMonth,
        week: selectedWeek,
        startDate: activeDateBounds.startDate,
        endDate: activeDateBounds.endDate,
      };
      if (employeeId) params.employeeId = employeeId;

      const res = await axios.get("/api/attendance/performance-metrics", {
        withCredentials: true,
        params,
        timeout: 4000,
      });
      if (res.data?.success && res.data?.data) {
        setFetchedMetrics(res.data.data);
      }
    } catch {
      // Graceful fallback to client-side computation from props
      setFetchedMetrics(null);
    }
  }, [selectedMonth, selectedWeek, activeDateBounds, employeeId]);

  useEffect(() => {
    fetchBackendPerformance();
  }, [fetchBackendPerformance]);

  // Filter attendance logs for the active date bounds
  const filteredLogs = useMemo(() => {
    if (!attendanceLogs || !Array.isArray(attendanceLogs) || attendanceLogs.length === 0) {
      return fetchedMetrics?.records || [];
    }

    const { startDate, endDate } = activeDateBounds;
    return attendanceLogs.filter((log) => {
      let dStr = "";
      if (log.date) {
        dStr = String(log.date).split("T")[0];
      } else if (log.createdAt) {
        dStr = String(log.createdAt).split("T")[0];
      }
      if (!dStr) return false;
      return dStr >= startDate && dStr <= endDate;
    });
  }, [attendanceLogs, activeDateBounds, fetchedMetrics]);

  // Dynamically recalculate the 4 Performance Cards
  const performanceCardMetrics = useMemo(() => {
    let hoursWorked = 0;
    let onTimeCheckIns = 0;
    let lateCheckIns = 0;
    let absentDays = 0;
    let activeDays = 0;

    filteredLogs.forEach((log) => {
      const status = (log.status || "").toLowerCase();
      const hrs = parseFloat(log.workHours) || (log.checkOut && log.checkIn ? 8 : (log.status === "Present" ? 8 : 0));
      hoursWorked += hrs;

      if (status.includes("late")) {
        lateCheckIns++;
        activeDays++;
      } else if (status.includes("absent") || status.includes("leave")) {
        absentDays++;
      } else if (status.includes("present") || hrs > 0) {
        onTimeCheckIns++;
        activeDays++;
      }
    });

    const isWeek = selectedWeek !== "all";
    const requiredHours = isWeek ? 40 : 160;
    const roundedHoursWorked = Math.round(hoursWorked * 10) / 10;
    const shiftCompliance = requiredHours > 0 ? Math.min(100, Math.round((hoursWorked / requiredHours) * 100)) : 100;
    const punctualityRate = activeDays > 0 ? Math.round((onTimeCheckIns / activeDays) * 100) : 100;

    return {
      hoursWorked: roundedHoursWorked,
      requiredHours,
      shiftCompliance,
      punctualityRate,
      activeDays,
      onTimeCheckIns,
      lateCheckIns,
      absentDays,
    };
  }, [filteredLogs, selectedWeek]);

  // Generate chart data series based on selectedWeek ('all' vs specific week index)
  const { isWorkingDay } = useWorkSchedule();
  const chartData = useMemo(() => {
    if (selectedWeek === "all") {
      // Monthly view broken down by weeks
      return weeksInMonth.map((w) => {
        let present = 0;
        let late = 0;
        let absent = 0;
        let totalHours = 0;

        filteredLogs.forEach((log) => {
          const dStr = log.date ? String(log.date).split("T")[0] : "";
          if (dStr >= w.startDate && dStr <= w.endDate) {
            const status = (log.status || "").toLowerCase();
            const hrs = parseFloat(log.workHours) || (log.checkOut && log.checkIn ? 8 : (log.status === "Present" ? 8 : 0));
            totalHours += hrs;

            if (status.includes("late")) {
              late++;
            } else if (status.includes("absent") || status.includes("leave")) {
              absent++;
            } else {
              present++;
            }
          }
        });

        const total = present + late + absent;
        return {
          key: `Week ${w.weekNumber}`,
          label: `Week ${w.weekNumber}`,
          fullWeek: `Week ${w.weekNumber} (${w.startLabel} – ${w.endLabel})`,
          present,
          late,
          absent,
          totalHours: Math.round(totalHours * 10) / 10,
          targetHours: 40,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      });
    }

    // Specific Week Selected: 7 individual days
    const weekIdx = parseInt(selectedWeek, 10) - 1;
    const currentWeek = weeksInMonth[weekIdx] || weeksInMonth[0];
    const days = [];

    for (let day = currentWeek.startDay; day <= currentWeek.endDay; day++) {
      const [y, m] = selectedMonth.split("-");
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, day);
      const dayIso = `${selectedMonth}-${String(day).padStart(2, "0")}`;
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const fullDay = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const isWeekend = !isWorkingDay(dateObj);

      let present = 0;
      let late = 0;
      let absent = 0;
      let totalHours = 0;

      const matchedLog = filteredLogs.find((l) => {
        const dStr = l.date ? String(l.date).split("T")[0] : "";
        return dStr === dayIso;
      });

      if (matchedLog) {
        const status = (matchedLog.status || "").toLowerCase();
        const hrs = parseFloat(matchedLog.workHours) || (matchedLog.checkOut && matchedLog.checkIn ? 8 : (matchedLog.status === "Present" ? 8 : 0));
        totalHours = hrs;

        if (status.includes("late")) {
          late = 1;
        } else if (status.includes("absent") || status.includes("leave")) {
          absent = 1;
        } else {
          present = 1;
        }
      }

      days.push({
        key: `${dayName} ${day}`,
        label: `${dayName} ${day}`,
        fullDay,
        present,
        late,
        absent,
        totalHours: Math.round(totalHours * 10) / 10,
        targetHours: isWeekend ? 0 : 8,
        rate: present + late > 0 ? (present > 0 ? 100 : 0) : 0,
      });
    }

    return days;
  }, [selectedWeek, weeksInMonth, filteredLogs, selectedMonth, isWorkingDay]);

  const targetReferenceHour = selectedWeek === "all" ? 40 : 8;

  return (
    <motion.div
      id="weekly-attendance-trends-chart-container"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-none space-y-4 sm:space-y-6 max-w-full overflow-hidden"
    >
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 sm:pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-xl font-bold text-[#0B1E48] dark:text-white tracking-tight">
              {title}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-[#0B1E48] dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60">
              Shift Target: 8h/day (40h/wk)
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-300 mt-0.5 sm:mt-1">
            {subtitle}
          </p>
        </div>

        {/* Dynamic Selectors & View Switchers */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            {/* Month Selector */}
            <select
              id="attendance-performance-month-select"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-[#162033] border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-[#0B1E48] dark:text-white rounded-xl px-2.5 sm:px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer truncate shadow-none"
            >
              {monthsList.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Week Selector */}
            <select
              id="attendance-performance-week-select"
              value={selectedWeek}
              onChange={(e) => handleWeekChange(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-[#162033] border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-[#0B1E48] dark:text-white rounded-xl px-2.5 sm:px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer truncate shadow-none"
            >
              <option value="all">Full Month (All)</option>
              {weeksInMonth.map((w, index) => (
                <option key={index} value={index + 1}>
                  Week {index + 1} ({w.startLabel} – {w.endLabel})
                </option>
              ))}
            </select>
          </div>

          {/* Metric Mode Switcher: Hours vs Attendance */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-[#162033] p-1 rounded-xl text-xs font-semibold w-full sm:w-auto border border-slate-200/70 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setMetricMode("hours")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs ${
                metricMode === "hours"
                  ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-none font-bold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hours vs Shift</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("attendance")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs ${
                metricMode === "attendance"
                  ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-none font-bold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Pattern</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Performance Highlights Ribbon (4 Dynamic Cards with Vertical Stacking on Mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Hours Worked */}
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 sm:p-4 transition shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#0B1E48] dark:text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              Hours Worked
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 whitespace-nowrap shadow-none">
              Req: {performanceCardMetrics.requiredHours}h
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0B1E48] dark:text-white mt-2 tracking-tight">
            {performanceCardMetrics.hoursWorked}{" "}
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">hrs</span>
          </p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-[#0B1E48] dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  (performanceCardMetrics.hoursWorked / (performanceCardMetrics.requiredHours || 1)) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Shift Compliance */}
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 sm:p-4 transition shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Target className="w-3.5 h-3.5" />
              Shift Compliance
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shadow-none ${
                performanceCardMetrics.shiftCompliance >= 100
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/70 dark:border-amber-800"
              }`}
            >
              {performanceCardMetrics.shiftCompliance >= 100 ? "Completed" : "In Progress"}
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0B1E48] dark:text-white mt-2 tracking-tight">
            {performanceCardMetrics.shiftCompliance}%
          </p>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">
            Against required schedule
          </span>
        </div>

        {/* Card 3: Punctuality Rate */}
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 sm:p-4 transition shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Punctuality Rate
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 whitespace-nowrap shadow-none">
              {performanceCardMetrics.lateCheckIns} Late
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0B1E48] dark:text-white mt-2 tracking-tight">
            {performanceCardMetrics.punctualityRate}%
          </p>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">
            On-time arrival rate
          </span>
        </div>

        {/* Card 4: Active Days */}
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 sm:p-4 transition shadow-none">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Award className="w-3.5 h-3.5 text-[#0B1E48] dark:text-blue-400" />
              Active Days
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 whitespace-nowrap shadow-none">
              {performanceCardMetrics.absentDays} Absent
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#0B1E48] dark:text-white mt-2 tracking-tight">
            {performanceCardMetrics.activeDays}{" "}
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">days</span>
          </p>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">
            Recorded check-ins this period
          </span>
        </div>
      </div>

      {/* Interactive Recharts Visualization with Zero-Overflow Responsive Margins */}
      <div className="h-64 sm:h-72 w-full pt-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {metricMode === "hours" ? (
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 6, left: -22, bottom: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tick={{ fill: "#64748b", fontSize: 10 }}
                unit="h"
                width={28}
                domain={[0, selectedWeek === "all" ? 50 : 12]}
              />
              <Tooltip content={<HoursTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.5 }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 8, fontSize: "11px" }}
              />
              {/* Target Reference Line */}
              <ReferenceLine
                y={targetReferenceHour}
                stroke="#002185"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Target (${targetReferenceHour}h)`,
                  position: "insideTopRight",
                  fill: "#002185",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <Bar
                dataKey="totalHours"
                name="Hours Worked"
                radius={[5, 5, 0, 0]}
              >
                {chartData.map((entry, index) => {
                  const target = entry.targetHours || targetReferenceHour;
                  const isMet = (entry.totalHours || 0) >= target;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isMet ? "#059669" : "#0B1E48"}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 6, left: -22, bottom: 0 }}
              barCategoryGap="24%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tick={{ fill: "#64748b", fontSize: 10 }}
                width={28}
                allowDecimals={false}
              />
              <Tooltip content={<AttendanceTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.5 }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 8, fontSize: "11px" }}
              />
              <Bar
                dataKey="present"
                name="On Time"
                fill="#059669"
                stackId="attendance"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="late"
                name="Late"
                fill="#d97706"
                stackId="attendance"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="absent"
                name="Absent"
                fill="#dc2626"
                stackId="attendance"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Benchmarks & Indicator Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {metricMode === "hours"
              ? `Dashed line shows ${targetReferenceHour}h shift benchmark. Green indicates target met.`
              : "Calculated dynamically for selected date window."}
          </span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {metricMode === "hours" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" /> Target Met (≥{targetReferenceHour}h)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0B1E48] dark:bg-blue-500" /> In Progress (&lt;{targetReferenceHour}h)
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> On Time
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Late
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600" /> Absent
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default memo(WeeklyAttendancePerformance);
