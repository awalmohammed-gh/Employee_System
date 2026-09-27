import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Clock,
  TrendingDown,
  Calendar,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Banknote,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { getMonthlyLatenessAnalytics } from "../apis/fontApis";

// Currency formatter for Ghana Cedis
const formatGHS = (amount) => {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Custom interactive Tooltip displaying specific date, total minutes late, and penalty amount
const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload || {};
  const dateStr = row.date || "";

  // Format specific date: e.g. "Saturday, Sep 5, 2026"
  const formattedDate = (() => {
    if (!dateStr) return row.label || label || "Selected Date";
    try {
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-GH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  })();

  const totalMinutesLate = Number(row.totalMinutesLate ?? row.lateMinutes ?? 0);
  const penaltyAmount = Number(row.penaltyAmount ?? row.dailyDeductions ?? 0);
  const cumulativeAmount = Number(row.cumulativeDeductions ?? 0);
  const isLate = totalMinutesLate > 0 || penaltyAmount > 0 || row.lateCount > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 rounded-xl shadow-xl dark:shadow-2xl text-xs space-y-2.5 min-w-[240px] select-none">
      {/* Header: Specific Date & Status Badge */}
      <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400 shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white truncate">
            {formattedDate}
          </span>
        </div>
        {isLate ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50 shrink-0">
            Late
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/50 shrink-0">
            On Time
          </span>
        )}
      </div>

      {/* Primary Metrics */}
      <div className="space-y-1.5 pt-0.5">
        {/* Total Minutes Late */}
        <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${isLate ? "text-amber-500" : "text-slate-400"}`} />
            <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
              Total Minutes Late:
            </span>
          </div>
          <span className={`font-bold text-xs ${isLate ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}`}>
            {totalMinutesLate > 0 ? `${totalMinutesLate} min${totalMinutesLate === 1 ? "" : "s"}` : "0 mins"}
          </span>
        </div>

        {/* Penalty Amount */}
        <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Banknote className={`w-3.5 h-3.5 ${penaltyAmount > 0 ? "text-rose-500" : "text-slate-400"}`} />
            <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
              Penalty Amount:
            </span>
          </div>
          <span className={`font-bold text-xs ${penaltyAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}`}>
            {formatGHS(penaltyAmount)}
          </span>
        </div>

        {/* Cumulative Total */}
        <div className="flex items-center justify-between gap-3 px-2 pt-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#002185] dark:bg-blue-400 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Cumulative Total:
            </span>
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {formatGHS(cumulativeAmount)}
          </span>
        </div>
      </div>

      {/* Incidents & Waived Section */}
      {(row.lateCount > 0 || row.waivedDeductions > 0) && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2 space-y-1 text-[10px]">
          {row.lateCount > 0 && (
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Late Incidents:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {row.lateCount} {row.lateCount === 1 ? "incident" : "incidents"}
              </span>
            </div>
          )}
          {row.waivedDeductions > 0 && (
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Excused / Waived:
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatGHS(row.waivedDeductions)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LatenessDeductionsLineChart = ({
  employeeId = null,
  title = "Monthly Lateness Deductions Trend",
  subtitle = "Daily and cumulative lateness penalty deductions over the current payroll month",
  refreshKey = 0,
  onThresholdChange = null,
}) => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lateEntries, setLateEntries] = useState([]);
  const [thresholdInfo, setThresholdInfo] = useState(null);
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 5;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [viewMode, setViewMode] = useState("both"); // 'both' | 'cumulative' | 'daily'
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const params = { month: selectedMonth };
      if (employeeId) params.employeeId = employeeId;

      const res = await getMonthlyLatenessAnalytics(params);
      if (res?.data?.success) {
        setData(res.data.dailySeries || []);
        setSummary(res.data.summary || null);
        const entries = res.data.lateEntries || [];
        setLateEntries(entries);
        const tInfo = res.data.thresholdInfo || res.data.summary?.thresholdInfo || null;
        setThresholdInfo(tInfo);
        if (typeof onThresholdChange === "function") {
          onThresholdChange(tInfo);
        }
      } else {
        setData([]);
        setLateEntries([]);
        setThresholdInfo(null);
        if (typeof onThresholdChange === "function") {
          onThresholdChange(null);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch monthly lateness deductions analytics:", err);
      setIsError(true);
      setData([]);
      setLateEntries([]);
      setThresholdInfo(null);
      if (typeof onThresholdChange === "function") {
        onThresholdChange(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, employeeId, onThresholdChange]);

  useEffect(() => {
    fetchAnalytics();

    // Real-Time Revalidation: Listen for attendance clock-ins, penalty notifications, and tab focus
    const handleInvalidate = () => {
      fetchAnalytics();
    };

    window.addEventListener("attendance-updated", handleInvalidate);
    window.addEventListener("lateness-analytics-invalidate", handleInvalidate);
    window.addEventListener("focus", handleInvalidate);

    let bc = null;
    try {
      bc = new BroadcastChannel("eyenit_attendance_sync");
      bc.onmessage = (msg) => {
        if (
          msg.data?.type === "clock_in" ||
          msg.data?.type === "clock_out" ||
          msg.data?.type === "attendance_change"
        ) {
          fetchAnalytics();
        }
      };
    } catch {
      // BroadcastChannel unavailable
    }

    return () => {
      window.removeEventListener("attendance-updated", handleInvalidate);
      window.removeEventListener("lateness-analytics-invalidate", handleInvalidate);
      window.removeEventListener("focus", handleInvalidate);
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
    };
  }, [fetchAnalytics, refreshKey]);

  // Navigate between months
  const handlePrevMonth = () => {
    setTablePage(1);
    const [year, month] = selectedMonth.split("-").map(Number);
    const prev = new Date(year, month - 2, 1);
    setSelectedMonth(
      `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const handleNextMonth = () => {
    setTablePage(1);
    const [year, month] = selectedMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    setSelectedMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const handleCurrentMonth = () => {
    setTablePage(1);
    const now = new Date();
    setSelectedMonth(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return selectedMonth === currentKey;
  }, [selectedMonth]);

  // Max deduction value for scaling Y-axis safely
  const maxYValue = useMemo(() => {
    if (!data.length) return 100;
    const maxVal = Math.max(
      ...data.map((d) =>
        viewMode === "daily"
          ? d.dailyDeductions
          : viewMode === "cumulative"
          ? d.cumulativeDeductions
          : Math.max(d.cumulativeDeductions, d.dailyDeductions)
      )
    );
    return Math.max(10, Math.ceil(maxVal * 1.15));
  }, [data, viewMode]);

  const formatEntryDate = (dateStr) => {
    if (!dateStr) return "--";
    try {
      const parts = String(dateStr).split("-");
      if (parts.length < 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getFallbackTier = (minutes) => {
    const m = Number(minutes || 0);
    if (m <= 0) return "On Time";
    if (m <= 30) return "Tier 1 (1–30 mins)";
    if (m <= 60) return "Tier 2 (31–60 mins)";
    if (m <= 120) return "Tier 3 (1–2 hrs)";
    if (m <= 180) return "Tier 4 (2–3 hrs)";
    if (m <= 240) return "Tier 5 (3–4 hrs)";
    return "Tier 6 (4+ hrs)";
  };

  const totalPages = Math.max(1, Math.ceil(lateEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return lateEntries.slice(start, start + pageSize);
  }, [lateEntries, tablePage, pageSize]);

  const isLimitExceeded = Boolean(thresholdInfo?.isLimitExceeded);
  const isWarningExceeded = Boolean(thresholdInfo?.isWarningExceeded);

  const containerBorderClass = isLimitExceeded
    ? "border-rose-300 dark:border-rose-800/90 ring-1 ring-rose-500/20"
    : isWarningExceeded
    ? "border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20"
    : "border-slate-200/70 dark:border-slate-800";

  return (
    <motion.div
      id="lateness-deductions-line-chart-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`bg-white dark:bg-[#111927] border rounded-2xl p-5 sm:p-6 shadow-none space-y-6 transition-colors ${containerBorderClass}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
                {isCurrentMonth && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                    Current Payroll Month
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar & Month Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Selector */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "both"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-none"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cumulative")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "cumulative"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-none"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Cumulative
            </button>
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "daily"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-none"
                  : "hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Daily
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/60 rounded-xl p-1 border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2 min-w-[90px] text-center">
              {summary?.month || selectedMonth}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition cursor-pointer"
            >
              Today
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            title="Refresh chart data"
            className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 shadow-none"
          >
            {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Visual Threshold Warning Indicator Banner */}
      {thresholdInfo && (isWarningExceeded || isLimitExceeded) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-none ${
            isLimitExceeded
              ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                isLimitExceeded
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
              }`}
            >
              {isLimitExceeded ? (
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              ) : (
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                  {isLimitExceeded
                    ? "CRITICAL: Monthly Lateness Penalty Limit Exceeded (100%+)"
                    : "POLICY WARNING: 80%+ Lateness Penalty Threshold Exceeded"}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    isLimitExceeded
                      ? "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                      : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                  }`}
                >
                  {thresholdInfo.usagePercent}% Used
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-95">
                Total monthly lateness penalties have reached{" "}
                <strong>{formatGHS(thresholdInfo.currentDeductions)}</strong>, exceeding the predefined company threshold (
                <strong>{thresholdInfo.warningThresholdPercent}%</strong> warning limit at{" "}
                <strong>{formatGHS(thresholdInfo.warningThresholdAmount)}</strong>
                {thresholdInfo.hasBaseSalary
                  ? ` of the ${thresholdInfo.maxPenaltyPercent}% basic salary cap of ${formatGHS(thresholdInfo.penaltyLimit)}`
                  : ` of the ${formatGHS(thresholdInfo.penaltyLimit)} monthly cap`}
                ). Further late clock-ins directly impact upcoming net salary payouts.
              </p>
            </div>
          </div>

          {/* Progress Bar & Numerical Metrics */}
          <div className="w-full md:w-64 shrink-0 bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span>Threshold Usage</span>
              <span className={isLimitExceeded ? "text-rose-600 dark:text-rose-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
                {thresholdInfo.usagePercent}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isLimitExceeded ? "bg-rose-600" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, thresholdInfo.usagePercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span>Limit: {formatGHS(thresholdInfo.penaltyLimit)}</span>
              <span>
                {isLimitExceeded
                  ? "Cap reached"
                  : `${formatGHS(thresholdInfo.remainingBeforeLimit)} left`}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Deductions */}
        <div
          className={`p-3.5 sm:p-4 rounded-xl border shadow-none transition-colors ${
            isLimitExceeded
              ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
              : isWarningExceeded
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
              : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Deductions
            </span>
            <Clock
              className={`w-4 h-4 ${
                isLimitExceeded
                  ? "text-rose-500"
                  : isWarningExceeded
                  ? "text-amber-500"
                  : "text-amber-500"
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
            <p
              className={`text-lg sm:text-xl font-bold ${
                isLimitExceeded
                  ? "text-rose-700 dark:text-rose-400"
                  : isWarningExceeded
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {formatGHS(summary?.totalLatenessDeductions || 0)}
            </p>
            {(isLimitExceeded || isWarningExceeded) && (
              <span
                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                  isLimitExceeded
                    ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700"
                    : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700"
                }`}
              >
                {isLimitExceeded ? "Cap Exceeded" : "80%+ Limit"}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
            {thresholdInfo
              ? `${thresholdInfo.usagePercent}% of monthly cap`
              : `For ${summary?.month || "current month"}`}
          </span>
        </div>

        {/* Late Incidents */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Late Incidents
            </span>
            <AlertCircle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {summary?.totalLateIncidents || 0}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {summary?.totalLateMinutes || 0} total delay mins
          </span>
        </div>

        {/* Average per Late */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Avg / Incident
            </span>
            <Award className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {formatGHS(summary?.averageDeductionPerLate || 0)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Mean penalty impact
          </span>
        </div>

        {/* Peak Deduction Day */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Highest Day
            </span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {formatGHS(summary?.highestDeductionDay?.amount || 0)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {summary?.highestDeductionDay?.amount > 0
              ? summary?.highestDeductionDay?.label || `Day ${summary?.highestDeductionDay?.day}`
              : "No deductions recorded"}
          </span>
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div className="w-full">
        {isLoading ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2">
            <WorkspaceLoader compact title="" />
            <p className="text-xs font-medium">Loading lateness deductions timeline...</p>
          </div>
        ) : isError ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200/70 dark:border-slate-800 rounded-xl">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Unable to load lateness deductions
            </p>
            <button
              onClick={fetchAnalytics}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200/70 dark:border-slate-800 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Zero Lateness Deductions
            </p>
            <p className="text-xs text-slate-500">
              No lateness penalties have been applied for this payroll month.
            </p>
          </div>
        ) : (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="dayStr"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#475569", opacity: 0.3 }}
                  tickFormatter={(val) => `${val}`}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, maxYValue]}
                  tickFormatter={(val) => `GH₵${val}`}
                />
                <Tooltip
                  content={<CustomLineTooltip />}
                  cursor={{ stroke: "#94A3B8", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingBottom: "12px",
                  }}
                />

                {/* Cumulative Total Line */}
                {(viewMode === "both" || viewMode === "cumulative") && (
                  <Line
                    type="monotone"
                    dataKey="cumulativeDeductions"
                    name="Cumulative Total (GH₵)"
                    stroke="#002185"
                    strokeWidth={2.5}
                    dot={{
                      r: 2.5,
                      fill: "#002185",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 5.5,
                      stroke: "#002185",
                      strokeWidth: 2,
                      fill: "#FFFFFF",
                    }}
                  />
                )}

                {/* Daily Deductions Line */}
                {(viewMode === "both" || viewMode === "daily") && (
                  <Line
                    type="monotone"
                    dataKey="dailyDeductions"
                    name="Daily Deductions (GH₵)"
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray={viewMode === "both" ? "4 4" : undefined}
                    dot={{
                      r: 3,
                      fill: "#D97706",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 5.5,
                      stroke: "#D97706",
                      strokeWidth: 2,
                      fill: "#FFFFFF",
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Insights Footnote */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>Cumulative Line tracks total lateness penalty deductions incurred month-to-date.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Dashed Gold Line captures specific daily check-in penalty occurrences.</span>
        </div>
      </div>

      {/* Detailed Table of Individual Late-Clock-in Entries */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        {/* Table Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Individual Late Clock-In Log
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {lateEntries.length} {lateEntries.length === 1 ? "incident" : "incidents"}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed audit list of individual late check-ins and calculated penalty amounts
              </p>
            </div>
          </div>

          {/* Calculation transparency badge */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800 self-start sm:self-auto">
            <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              Total Penalties:{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {formatGHS(summary?.totalLatenessDeductions || 0)}
              </strong>
            </span>
          </div>
        </div>

        {/* Table Content or Empty State */}
        {lateEntries.length === 0 ? (
          <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20 text-center flex flex-col items-center justify-center gap-1.5">
            <div className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              No Late Clock-Ins Recorded
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
              All recorded check-ins for {summary?.month || "this month"} were on time or excused. Zero lateness penalties accrued.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Clock-In</th>
                    {!employeeId && <th className="py-2.5 px-3.5">Employee</th>}
                    <th className="py-2.5 px-3.5">Minutes Late</th>
                    <th className="py-2.5 px-3.5">Applied Tier</th>
                    <th className="py-2.5 px-3.5">Reason for Lateness</th>
                    <th className="py-2.5 px-3.5 text-right">Penalty Amount</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {paginatedEntries.map((entry, idx) => (
                    <tr
                      key={entry.id || `${entry.date}-${idx}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatEntryDate(entry.date)}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {entry.date}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Clock In Time */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {entry.clockInTime || "--:--"}
                      </td>

                      {/* Employee (for Admin / Company-wide view) */}
                      {!employeeId && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {entry.employeeName}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {entry.employeeId}
                          </span>
                        </td>
                      )}

                      {/* Minutes Late */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3 h-3" />
                          {entry.minutesLate} mins late
                        </span>
                      </td>

                      {/* Applied Tier */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {entry.penaltyTier || getFallbackTier(entry.minutesLate)}
                      </td>

                      {/* Reason for Lateness */}
                      <td className="py-2.5 px-3.5 max-w-[200px]">
                        {entry.lateReason || entry.notes ? (
                          <div className="flex items-start gap-1.5" title={entry.lateReason || entry.notes}>
                            <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                              {entry.lateReason || entry.notes}
                            </span>
                          </div>
                        ) : entry.isExcused && entry.excuseReason ? (
                          <div className="flex items-start gap-1.5" title={entry.excuseReason}>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 italic line-clamp-2">
                              {entry.excuseReason}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                            No reason provided
                          </span>
                        )}
                      </td>

                      {/* Penalty Amount */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                        {entry.isExcused ? (
                          <div>
                            <span className="line-through text-slate-400 text-[11px] mr-1">
                              {formatGHS(entry.rawPenalty)}
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              GH₵0.00
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatGHS(entry.penaltyAmount)}
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                        {entry.isExcused ? (
                          <span
                            title={entry.excuseReason || "Excused by management"}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            Excused
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800">
                            Deducted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Table Summary Footer */}
                <tfoot>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <td colSpan={employeeId ? 2 : 3} className="py-2.5 px-3.5 font-bold">
                      Total Month-to-Date Lateness Calculation
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        {summary?.totalLateMinutes || 0} mins delay
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 text-[11px]">
                      {lateEntries.length} {lateEntries.length === 1 ? "entry" : "entries"}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-400 text-[11px] italic">
                      —
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-extrabold text-rose-600 dark:text-rose-400">
                      {formatGHS(summary?.totalLatenessDeductions || 0)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-[10px] text-slate-400">
                      Single Source
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination controls if more than 5 entries */}
            {lateEntries.length > pageSize && (
              <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <span>
                  Showing {(tablePage - 1) * pageSize + 1} to{" "}
                  {Math.min(tablePage * pageSize, lateEntries.length)} of {lateEntries.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={tablePage === 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {tablePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={tablePage === totalPages}
                    onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default memo(LatenessDeductionsLineChart);
