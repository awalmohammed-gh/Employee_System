import { useState, useMemo } from "react";
import {
  Flame,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  Sparkles,
  Info,
  Timer,
  Zap,
} from "lucide-react";
import { useWorkSchedule } from "../utils/workSchedule";

export const AttendanceIntensityHeatmap = ({
  attendanceLogs = [],
  title = "Attendance Intensity",
  subtitle = "Daily check-in density, work hours volume, and habit consistency throughout the month",
  selectedMonthYear,
  onMonthChange,
  showSummaryStats = true,
  onSelectDay,
}) => {
  // Current view month/year state
  const [internalDate, setInternalDate] = useState(() => new Date());
  const [hoveredDay, setHoveredDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Active month and year
  const activeDate = selectedMonthYear || internalDate;
  const currentYear = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth(); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    const prev = new Date(currentYear, currentMonth - 1, 1);
    if (onMonthChange) {
      onMonthChange(prev);
    } else {
      setInternalDate(prev);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    const next = new Date(currentYear, currentMonth + 1, 1);
    if (onMonthChange) {
      onMonthChange(next);
    } else {
      setInternalDate(next);
    }
    setSelectedDay(null);
  };

  const handleTodayMonth = () => {
    const today = new Date();
    if (onMonthChange) {
      onMonthChange(today);
    } else {
      setInternalDate(today);
    }
    setSelectedDay(null);
  };

  const monthLabel = useMemo(() => {
    return activeDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [activeDate]);

  // Index attendance logs by date string (YYYY-MM-DD)
  const logsByDate = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(attendanceLogs)) return map;

    attendanceLogs.forEach((log) => {
      if (!log || !log.date) return;
      let dateKey = "";
      try {
        if (typeof log.date === "string") {
          dateKey = log.date.split("T")[0];
        } else if (log.date instanceof Date) {
          dateKey = log.date.toISOString().split("T")[0];
        }
      } catch {
        dateKey = String(log.date);
      }

      if (dateKey) {
        // If multiple logs exist on same day, accumulate or prefer latest
        const existing = map.get(dateKey);
        if (!existing) {
          map.set(dateKey, log);
        } else {
          // If existing is present/late, keep or merge
          const existingHrs = Number(existing.workHours || 0);
          const newHrs = Number(log.workHours || 0);
          if (newHrs > existingHrs) {
            map.set(dateKey, log);
          }
        }
      }
    });
    return map;
  }, [attendanceLogs]);

  const { isWorkingDay } = useWorkSchedule();

  // Generate all days in the active month
  const monthDaysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // Monday as first day of week (0=Mon, 1=Tue, ..., 6=Sun)
    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    // Convert so Monday is 0, Sunday is 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];

    // Prepend empty padding days for previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({
        isPadding: true,
        key: `pad-prev-${i}`,
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Populate actual days of the current month
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dayDate = new Date(currentYear, currentMonth, dayNum);
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const isWeekend = !isWorkingDay(dayDate); // rest day per the admin's working days
      const isToday = dateKey === todayStr;
      const isFuture = dayDate > new Date();

      const log = logsByDate.get(dateKey);

      let intensityLevel = 0; // 0=None/Weekend, 1=Partial/Late, 2=Regular (6-8h), 3=High Intensity (8h+)
      let statusType = "unrecorded";
      let workHours = 0;
      let lateMinutes = 0;
      let latePenalty = 0;
      let clockIn = null;
      let clockOut = null;

      if (log) {
        const s = String(log.status || "").toLowerCase();
        workHours = Number(log.workHours || 0);
        lateMinutes = Number(log.lateMinutes ?? log.delayMinutes ?? 0);
        latePenalty = Number(log.latePenalty || 0);
        clockIn = log.clockIn || log.clockInTime || null;
        clockOut = log.clockOut || log.clockOutTime || null;

        if (s === "absent") {
          statusType = "absent";
          intensityLevel = -1; // special absent marker
        } else if (s === "leave" || s === "on leave") {
          statusType = "leave";
          intensityLevel = -2; // special leave marker
        } else if (clockIn || workHours > 0 || s === "present" || s === "on time" || s === "late") {
          if (s === "late" || lateMinutes > 0) {
            statusType = "late";
            intensityLevel = 1; // Partial/Late level
          } else if (workHours >= 8.5) {
            statusType = "high_intensity";
            intensityLevel = 3; // High intensity (overtime / full shift)
          } else if (workHours >= 6) {
            statusType = "present";
            intensityLevel = 2; // Regular full day
          } else {
            statusType = "partial";
            intensityLevel = 1; // Partial shift
          }
        }
      } else if (isWeekend) {
        statusType = "weekend";
      } else if (isFuture) {
        statusType = "future";
      }

      days.push({
        isPadding: false,
        key: dateKey,
        dateKey,
        dayNum,
        dayDate,
        isWeekend,
        isToday,
        isFuture,
        intensityLevel,
        statusType,
        workHours,
        lateMinutes,
        latePenalty,
        clockIn,
        clockOut,
        log,
      });
    }

    // Append remaining days to complete the 7-column grid cleanly
    const totalCells = days.length;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      const paddingNeeded = 7 - remainder;
      for (let i = 0; i < paddingNeeded; i++) {
        days.push({
          isPadding: true,
          key: `pad-next-${i}`,
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, logsByDate, isWorkingDay]);

  // Compute month summary statistics
  const monthStats = useMemo(() => {
    let activeDays = 0;
    let highIntensityDays = 0;
    let standardDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let totalWorkHours = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    monthDaysGrid.forEach((day) => {
      if (day.isPadding || day.isFuture) return;

      if (day.intensityLevel > 0) {
        activeDays += 1;
        totalWorkHours += day.workHours;
        tempStreak += 1;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }

        if (day.intensityLevel === 3) highIntensityDays += 1;
        if (day.intensityLevel === 2) standardDays += 1;
        if (day.statusType === "late") lateDays += 1;
      } else if (day.statusType === "absent") {
        absentDays += 1;
        tempStreak = 0;
      } else if (!day.isWeekend) {
        tempStreak = 0;
      }
    });

    const currentStreak = tempStreak;

    const workingDaysCount = monthDaysGrid.filter(
      (d) => !d.isPadding && !d.isWeekend && !d.isFuture
    ).length;

    const attendanceRate =
      workingDaysCount > 0 ? Math.min(100, Math.round((activeDays / workingDaysCount) * 100)) : 0;

    return {
      activeDays,
      highIntensityDays,
      standardDays,
      lateDays,
      absentDays,
      totalWorkHours: Number(totalWorkHours.toFixed(1)),
      averageDailyHours: activeDays > 0 ? (totalWorkHours / activeDays).toFixed(1) : 0,
      currentStreak,
      longestStreak,
      attendanceRate,
    };
  }, [monthDaysGrid]);

  // Time formatter helper
  const formatTime = (timeStr) => {
    if (!timeStr) return "--:--";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeStr;
    }
  };

  // Cell style resolver based on intensity level
  const getCellClasses = (day) => {
    if (day.isPadding) {
      return "opacity-0 pointer-events-none";
    }

    const isSelected = selectedDay?.dateKey === day.dateKey;
    let base =
      "relative aspect-square min-h-[38px] sm:min-h-[46px] rounded-xl flex flex-col items-center justify-between p-1.5 transition-all duration-150 cursor-pointer border ";

    if (isSelected) {
      base += "ring-2 ring-[#002185] dark:ring-blue-400 ring-offset-2 dark:ring-offset-slate-900 scale-105 z-10 ";
    } else {
      base += "hover:scale-105 hover:shadow-sm hover:z-10 ";
    }

    if (day.isToday) {
      base += "ring-2 ring-blue-500/60 ring-offset-1 dark:ring-offset-slate-900 ";
    }

    // Intensity styling matrix
    switch (day.intensityLevel) {
      case 3: // High Intensity (8.5h+ or Overtime / High Focus)
        return (
          base +
          "bg-[#002185] dark:bg-blue-600 border-[#001760] dark:border-blue-500 text-white font-bold shadow-xs"
        );
      case 2: // Standard Full Shift (6h - 8.5h On-Time)
        return (
          base +
          "bg-emerald-500 dark:bg-emerald-600 border-emerald-600 dark:border-emerald-500 text-white font-bold"
        );
      case 1: // Late Arrival or Partial Shift (< 6h)
        return (
          base +
          "bg-amber-200 dark:bg-amber-900/70 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold"
        );
      case -1: // Absent
        return (
          base +
          "bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-medium"
        );
      case -2: // Approved Leave
        return (
          base +
          "bg-purple-100 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-medium"
        );
      default: // 0 - Weekend or Unrecorded day
        if (day.isWeekend) {
          return (
            base +
            "bg-slate-50/70 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
          );
        }
        if (day.isFuture) {
          return (
            base +
            "bg-slate-50/40 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800/60 text-slate-300 dark:text-slate-600"
          );
        }
        return (
          base +
          "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
        );
    }
  };

  const dayOfWeekHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      id="attendance-intensity-heatmap"
      className="w-full rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-sm p-5 sm:p-6 lg:p-7 space-y-6 overflow-hidden"
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B1E48] dark:text-blue-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0B1E48] dark:text-white tracking-tight">
              {title}
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Flame className="w-3 h-3 text-amber-500" />
              {monthStats.currentStreak > 0
                ? `${monthStats.currentStreak}-Day Habit Streak`
                : "Live Matrix"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {subtitle}
          </p>
        </div>

        {/* Month Selector Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="min-w-[130px] sm:min-w-[150px] text-center text-xs sm:text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTodayMonth}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-[#0B1E48] dark:text-white bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 border border-blue-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Current Month
          </button>
        </div>
      </div>

      {/* Top Quick Metrics Summary Strip */}
      {showSummaryStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#162033] border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0B1E48] dark:bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                High-Intensity (8h+)
              </p>
              <p className="text-base font-bold text-[#0B1E48] dark:text-white">
                {monthStats.highIntensityDays} Days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Standard (6-8h)
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {monthStats.standardDays} Days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Month Hours
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {monthStats.totalWorkHours} hrs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Consistency Rate
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {monthStats.attendanceRate}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Heatmap Square Grid */}
      <div className="space-y-2">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 sm:gap-2.5 text-center">
          {dayOfWeekHeaders.map((dayName, idx) => (
            <span
              key={dayName}
              className={`text-[11px] font-bold uppercase tracking-wider py-1 ${
                idx >= 5
                  ? "text-slate-400 dark:text-slate-500"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {dayName}
            </span>
          ))}
        </div>

        {/* Square Tiles Grid */}
        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {monthDaysGrid.map((day) => {
            if (day.isPadding) {
              return <div key={day.key} className="aspect-square min-h-[38px] sm:min-h-[46px]" />;
            }

            return (
              <button
                key={day.key}
                type="button"
                id={`heatmap-tile-${day.dateKey}`}
                onClick={() => {
                  setSelectedDay(day);
                  if (onSelectDay) onSelectDay(day.dateKey, day.log);
                }}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={getCellClasses(day)}
              >
                {/* Day Number Header */}
                <div className="w-full flex items-center justify-between text-[11px]">
                  <span className="font-semibold leading-none">
                    {day.dayNum}
                  </span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  )}
                  {day.intensityLevel === 3 && (
                    <Zap className="w-2.5 h-2.5 opacity-90" />
                  )}
                </div>

                {/* Sub-label showing hours or status badge */}
                <div className="text-[10px] leading-tight truncate w-full text-center">
                  {day.workHours > 0 ? (
                    <span className="tabular-nums font-mono opacity-95">
                      {day.workHours}h
                    </span>
                  ) : day.statusType === "absent" ? (
                    <span className="font-semibold text-[9px] uppercase">Abs</span>
                  ) : day.statusType === "late" ? (
                    <span className="font-semibold text-[9px] uppercase">Late</span>
                  ) : day.isWeekend ? (
                    <span className="opacity-40 text-[9px]">Off</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Hover / Selected Day Telemetry Panel */}
      {(hoveredDay || selectedDay) && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-800 animate-in fade-in duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {(() => {
            const active = hoveredDay || selectedDay;
            const formattedLongDate = active.dayDate?.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[#0B1E48] dark:text-blue-400" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {formattedLongDate}
                    </span>
                    {active.isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-[#0B1E48] dark:text-blue-300">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                      In: <strong className="text-slate-700 dark:text-white">{formatTime(active.clockIn)}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      Out: <strong className="text-slate-700 dark:text-white">{formatTime(active.clockOut)}</strong>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#0B1E48] dark:text-blue-400" />
                      Duration: <strong className="text-slate-700 dark:text-white">{active.workHours || 0} hrs</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {active.intensityLevel === 3 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0B1E48] dark:bg-blue-600 text-white flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      High Intensity (8h+)
                    </span>
                  )}
                  {active.intensityLevel === 2 && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Full On-Time Shift
                    </span>
                  )}
                  {active.statusType === "late" && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Late ({active.lateMinutes}m delay)
                    </span>
                  )}
                  {active.statusType === "absent" && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                      Unexcused Absence
                    </span>
                  )}
                  {active.isWeekend && active.intensityLevel === 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Weekend / Scheduled Rest Day
                    </span>
                  )}
                  {!active.isWeekend && !active.isFuture && active.intensityLevel === 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      No Records
                    </span>
                  )}
                  {active.isFuture && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                      Upcoming Day
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Intensity Legend */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Click any square to inspect recorded punch stamps & shift metrics</span>
        </div>

        {/* Color Matrix Scale */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-300">Intensity:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 mr-0.5">Less</span>
            
            {/* Level 0 */}
            <div
              className="w-4 h-4 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="0h / Rest Day / No Record"
            />
            {/* Level 1: Late / Partial */}
            <div
              className="w-4 h-4 rounded-md bg-amber-200 dark:bg-amber-900/70 border border-amber-300 dark:border-amber-700"
              title="Late Arrival / Partial (<6h)"
            />
            {/* Level 2: Standard On-Time */}
            <div
              className="w-4 h-4 rounded-md bg-emerald-500 dark:bg-emerald-600 border border-emerald-600 text-white"
              title="Standard On-Time Shift (6h - 8.5h)"
            />
            {/* Level 3: High Intensity */}
            <div
              className="w-4 h-4 rounded-md bg-[#0B1E48] dark:bg-blue-600 border border-[#001760] dark:border-blue-500 text-white"
              title="High Intensity / Overtime (8.5h+)"
            />

            <span className="text-[10px] text-slate-400 ml-0.5">More</span>

            <span className="mx-1.5 text-slate-300 dark:text-slate-700">|</span>

            {/* Absent */}
            <div
              className="w-4 h-4 rounded-md bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800"
              title="Absent"
            />
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Absent</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceIntensityHeatmap;
