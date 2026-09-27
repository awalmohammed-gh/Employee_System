import { useState, useMemo, useEffect, useCallback } from "react";
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
} from "lucide-react";

// Helper to generate 12 months for current year
const getMonthsOptions = (year = new Date().getFullYear()) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months.map((name, idx) => {
    const monthNum = String(idx + 1).padStart(2, "0");
    return {
      value: `${year}-${monthNum}`,
      label: `${name} ${year}`,
      name,
      index: idx,
    };
  });
};

// Helper to compute weeks within a month "YYYY-MM"
const getWeeksInMonth = (monthStr) => {
  if (!monthStr || !monthStr.includes("-")) {
    const now = new Date();
    monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthNumStr, 10) - 1;
  const totalDays = new Date(year, monthIdx + 1, 0).getDate();
  const shortMonth = new Date(year, monthIdx, 1).toLocaleDateString("en-US", { month: "short" });

  const weeks = [];
  let startDay = 1;

  while (startDay <= totalDays) {
    const endDay = Math.min(startDay + 6, totalDays);
    const startIso = `${yearStr}-${monthNumStr}-${String(startDay).padStart(2, "0")}`;
    const endIso = `${yearStr}-${monthNumStr}-${String(endDay).padStart(2, "0")}`;

    weeks.push({
      weekNumber: weeks.length + 1,
      startDay,
      endDay,
      startLabel: `${shortMonth} ${startDay}`,
      endLabel: `${shortMonth} ${endDay}`,
      startDate: startIso,
      endDate: endIso,
    });

    startDay = endDay + 1;
  }

  return weeks;
};

/**
 * AttendancePeriodFilter / GlobalDateRangePicker
 * Clean 3-mode segmented filter: Day | Week | Month
 * Eliminates overflowing horizontal scrollbars and cluttered preset pills.
 */
export const AttendancePeriodFilter = ({
  startDate = "",
  endDate = "",
  preset = "month",
  onRangeChange = () => {},
  className = "",
  title = "Attendance Period Filter",
}) => {
  const currentYear = new Date().getFullYear();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Determine initial mode from preset or date range
  const getInitialMode = () => {
    if (preset === "day" || (startDate && endDate && startDate === endDate)) return "day";
    if (preset === "week" || preset === "last_7") return "week";
    if (preset === "all") return "all";
    return "month";
  };

  const [viewMode, setViewMode] = useState(getInitialMode);
  const [selectedDate, setSelectedDate] = useState(startDate || todayStr);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (startDate && startDate.length >= 7) return startDate.slice(0, 7);
    return currentMonthStr;
  });
  const [selectedWeek, setSelectedWeek] = useState("1");

  const monthsList = useMemo(() => getMonthsOptions(currentYear), [currentYear]);
  const weeksList = useMemo(() => getWeeksInMonth(selectedMonth), [selectedMonth]);

  // Synchronize internal state when props change externally
  useEffect(() => {
    if (startDate && endDate && startDate === endDate) {
      setSelectedDate(startDate);
    }
    if (startDate && startDate.length >= 7) {
      setSelectedMonth(startDate.slice(0, 7));
    }
  }, [startDate, endDate]);

  // Emit changes based on current mode
  const applyDateRange = useCallback((mode, sDate, sMonth, sWeek) => {
    if (mode === "day") {
      const d = sDate || todayStr;
      onRangeChange({
        startDate: d,
        endDate: d,
        preset: "day",
      });
    } else if (mode === "week") {
      const weeks = getWeeksInMonth(sMonth || currentMonthStr);
      if (sWeek === "all") {
        const [y, m] = (sMonth || currentMonthStr).split("-");
        const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
        onRangeChange({
          startDate: `${sMonth}-01`,
          endDate: `${sMonth}-${String(lastDay).padStart(2, "0")}`,
          preset: "month",
        });
      } else {
        const idx = parseInt(sWeek, 10) - 1;
        const targetWeek = weeks[idx] || weeks[0];
        if (targetWeek) {
          onRangeChange({
            startDate: targetWeek.startDate,
            endDate: targetWeek.endDate,
            preset: "week",
          });
        }
      }
    } else if (mode === "month") {
      const monthToUse = sMonth || currentMonthStr;
      const [y, m] = monthToUse.split("-");
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      onRangeChange({
        startDate: `${monthToUse}-01`,
        endDate: `${monthToUse}-${String(lastDay).padStart(2, "0")}`,
        preset: "month",
      });
    } else if (mode === "all") {
      onRangeChange({
        startDate: "",
        endDate: "",
        preset: "all",
      });
    }
  }, [onRangeChange, todayStr, currentMonthStr]);

  // Mode change handler
  const handleModeChange = (mode) => {
    setViewMode(mode);
    applyDateRange(mode, selectedDate, selectedMonth, selectedWeek);
  };

  // Day picker handlers
  const handleDateChange = (val) => {
    setSelectedDate(val);
    applyDateRange("day", val, selectedMonth, selectedWeek);
  };

  const handleStepDay = (step) => {
    const current = new Date(selectedDate || todayStr);
    current.setDate(current.getDate() + step);
    const newDate = current.toISOString().split("T")[0];
    setSelectedDate(newDate);
    applyDateRange("day", newDate, selectedMonth, selectedWeek);
  };

  const handleTodayClick = () => {
    setSelectedDate(todayStr);
    applyDateRange("day", todayStr, selectedMonth, selectedWeek);
  };

  // Month picker handlers
  const handleMonthChange = (val) => {
    setSelectedMonth(val);
    setSelectedWeek("1");
    if (viewMode === "month") {
      applyDateRange("month", selectedDate, val, selectedWeek);
    } else if (viewMode === "week") {
      applyDateRange("week", selectedDate, val, "1");
    }
  };

  // Week picker handler
  const handleWeekChange = (val) => {
    setSelectedWeek(val);
    applyDateRange("week", selectedDate, selectedMonth, val);
  };

  // Reset to all time
  const handleResetAll = () => {
    setViewMode("all");
    applyDateRange("all", "", "", "");
  };

  // Format active summary label
  const activeSummary = useMemo(() => {
    if (!startDate && !endDate) return "All Records (No Date Filter)";
    if (startDate && endDate && startDate === endDate) {
      if (startDate === todayStr) return "Today";
      return new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (startDate && endDate) {
      const s = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const e = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${s} – ${e}`;
    }
    return "Custom Date Window";
  }, [startDate, endDate, todayStr]);

  const hasActiveFilter = Boolean(startDate || endDate);

  return (
    <div
      id="attendance-period-filter-card"
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-black/20 space-y-4 transition-all ${className}`}
    >
      {/* Top Header Row (Pure Typography, No Decorative Calendar Icon) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0B1E48] dark:text-blue-100 tracking-tight">
              {title}
            </h2>
            {hasActiveFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Check className="w-3 h-3" />
                Active Range
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Select an inspection window to recalculate attendance logs, work hours, and compliance rates
          </p>
        </div>

        {/* Current Active Window Pill & Reset */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 text-[#002185] dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <span className="text-slate-500 dark:text-slate-400 font-normal mr-1.5">Period:</span>
            <span>{activeSummary}</span>
          </div>

          {hasActiveFilter && (
            <button
              id="btn-attendance-period-reset"
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title="Clear date filter and view all records"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>All Time</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Filter Controls Row: 3-Mode Segmented Selector + Contextual Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Segmented Mode Switcher (Day | Week | Month | All) */}
        <div className="grid grid-cols-4 sm:inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-2xs w-full sm:w-auto">
          <button
            type="button"
            id="tab-mode-day"
            onClick={() => handleModeChange("day")}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
              viewMode === "day"
                ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            id="tab-mode-week"
            onClick={() => handleModeChange("week")}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
              viewMode === "week"
                ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            id="tab-mode-month"
            onClick={() => handleModeChange("month")}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
              viewMode === "month"
                ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            id="tab-mode-all"
            onClick={() => handleModeChange("all")}
            className={`px-2 sm:px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer text-center truncate ${
              viewMode === "all"
                ? "bg-[#0B1E48] dark:bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All
          </button>
        </div>

        {/* Dynamic Contextual Date Selectors based on Active Mode */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* DAY MODE CONTROLS */}
          {viewMode === "day" && (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => handleStepDay(-1)}
                  className="px-2 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  id="period-filter-day-input"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[#0B1E48] dark:text-blue-100 px-2 py-2 focus:outline-none cursor-pointer w-full"
                />
                <button
                  type="button"
                  onClick={() => handleStepDay(1)}
                  className="px-2 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleTodayClick}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Today
              </button>
            </div>
          )}

          {/* WEEK MODE CONTROLS */}
          {viewMode === "week" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
              {/* Month Selector */}
              <select
                id="period-filter-week-month-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1E48] dark:text-blue-100 rounded-xl px-2.5 sm:px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer truncate w-full"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Week Selector */}
              <select
                id="period-filter-week-select"
                value={selectedWeek}
                onChange={(e) => handleWeekChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1E48] dark:text-blue-100 rounded-xl px-2.5 sm:px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer truncate w-full"
              >
                <option value="all">Full Month (All Weeks)</option>
                {weeksList.map((w, idx) => (
                  <option key={idx} value={idx + 1}>
                    Week {idx + 1} ({w.startLabel} – {w.endLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MONTH MODE CONTROLS */}
          {viewMode === "month" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                id="period-filter-month-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1E48] dark:text-blue-100 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline whitespace-nowrap">
                (Full 1st – End of Month)
              </span>
            </div>
          )}

          {/* ALL TIME MODE */}
          {viewMode === "all" && (
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Unfiltered historical attendance timeline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePeriodFilter;
