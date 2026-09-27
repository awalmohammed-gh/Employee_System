import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  LineChart,
  PieChart,
  Pie,
  Cell,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Clock,
  Banknote,
  CheckCircle2,
  BarChart3,
  Award,
  PieChart as PieChartIcon,
  FileDown,
} from "lucide-react";
import DashboardDateRangePicker from "./DashboardDateRangePicker";
import { exportDashboardAnalyticsReportPdf } from "../utils/exportDashboardAnalyticsReportPdf";
import { useBranding } from "../context/BrandingContext";

// Currency formatter for GH₵
const formatGHSCurrency = (val) => {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return `GH₵${num.toLocaleString("en-GH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

// Department palette for Pie Chart
const DEPARTMENT_COLORS = [
  "#0B1E48", // Navy
  "#2563EB", // Royal Blue
  "#0EA5E9", // Sky Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#64748B", // Slate
];

// Custom Tooltip for Attendance Trends
const AttendanceTrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[210px] space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-bold text-sm text-blue-300">{data?.label || label}</span>
        {data?.turnoutRate != null && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
            {data.turnoutRate}% Turnout
          </span>
        )}
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Present:
          </span>
          <span className="font-bold">{data?.present ?? 0} staff</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Late Arrivals:
          </span>
          <span className="font-bold">{data?.late ?? 0} staff</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Absent:
          </span>
          <span className="font-bold">{data?.absent ?? 0} staff</span>
        </div>
        {data?.onLeave > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              On Leave:
            </span>
            <span className="font-bold">{data.onLeave} staff</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom Tooltip for Shift Completion Times
const ShiftCompletionTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[220px] space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-bold text-sm text-sky-300">{data?.dayFull || data?.label || label}</span>
        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[11px] border border-sky-500/30">
          Target: 8.0h
        </span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Average Duration:</span>
          <span className="font-bold text-amber-300 text-sm">
            {data?.avgShiftHours || data?.avgHours || 0} hrs
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Completed Shifts:</span>
          <span className="font-bold text-white">{data?.completedShifts || 0} shifts</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Completion Compliance:</span>
          <span className="font-bold text-emerald-400">{data?.completionRate ?? 0}%</span>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip for 30-Day Employee Performance Scores
const PerformanceScoreTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  const pct = (v) => (v == null ? "—" : `${v}%`);
  if (data?.overallScore == null) {
    return (
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-xl text-xs text-white">
        <span className="font-bold text-blue-300">{data?.label || label}</span>
        <p className="text-slate-400 mt-1">No attendance recorded</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[220px] space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-bold text-sm text-blue-300">{data?.label || label}</span>
        <span
          className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${
            data.overallScore >= 90
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-amber-500/20 text-amber-300 border-amber-500/30"
          }`}
        >
          {data.overallScore}% Score
        </span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Overall Performance:
          </span>
          <span className="font-bold text-sm text-white">{data.overallScore}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Punctuality Index:
          </span>
          <span className="font-bold">{pct(data.punctualityScore)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Shift Completion:
          </span>
          <span className="font-bold">{pct(data.shiftCompletionScore)}</span>
        </div>
        {data?.turnoutRate != null && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-300">
            <span>Workforce Turnout:</span>
            <span className="font-semibold text-emerald-400">{data.turnoutRate}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom Tooltip for Department Expense Pie Chart
const DepartmentPieTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[210px] space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-bold text-sm text-white">{data?.department || data?.name}</span>
        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[11px] border border-blue-500/30">
          {data?.percentage ?? 0}% Share
        </span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Payroll Expenditure:</span>
          <span className="font-bold text-sm text-emerald-300">
            {formatGHSCurrency(data?.totalExpense || data?.value || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Department Headcount:</span>
          <span className="font-semibold text-slate-100">{data?.headcount || 1} Staff</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Avg Cost per Staff:</span>
          <span className="font-semibold text-sky-300">
            {formatGHSCurrency(
              Math.round((data?.totalExpense || data?.value || 0) / Math.max(1, data?.headcount || 1))
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

// Custom Tooltip for Payroll Distribution
const PayrollDistributionTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[230px] space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-bold text-sm text-blue-300">{data?.monthFull || label}</span>
        {data?.headcount && (
          <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold border border-slate-700">
            {data.headcount} Staff
          </span>
        )}
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2 h-2 rounded-sm bg-blue-500" />
            Base Salaries:
          </span>
          <span className="font-bold">{formatGHSCurrency(data?.baseSalary || 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2 h-2 rounded-sm bg-cyan-500" />
            Allowances / Bonuses:
          </span>
          <span className="font-bold">{formatGHSCurrency(data?.allowances || 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-sm bg-rose-500" />
            Penalties / Deductions:
          </span>
          <span className="font-bold text-rose-300">-{formatGHSCurrency(data?.deductions || 0)}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-700 text-emerald-400">
          <span className="font-semibold">Net Disbursed:</span>
          <span className="font-bold text-sm">{formatGHSCurrency(data?.netDisbursed || 0)}</span>
        </div>
      </div>
    </div>
  );
};

export const WorkforceAnalyticsDashboard = ({ dashboardData }) => {
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState("all"); // "all", "attendance", "shift", "performance", "payroll"
  const [attendanceTimeframe, setAttendanceTimeframe] = useState("daily"); // "daily", "monthly"
  const [shiftTimeframe, setShiftTimeframe] = useState("weekdays"); // "weekdays", "daily", "monthly"
  const [payrollTimeframe, setPayrollTimeframe] = useState("6months"); // "6months", "12months"
  const [performanceMetric, setPerformanceMetric] = useState("all"); // "all", "overall", "punctuality", "completion"
  const [payrollViewMode, setPayrollViewMode] = useState("both"); // "both", "trend", "departments"
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Date Range Picker State
  const [dateRangeFilter, setDateRangeFilter] = useState({
    preset: "last_30",
    startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    label: "Last 30 Days",
  });

  const handleRangeChange = (newRange) => {
    setDateRangeFilter(newRange);
  };

  // PDF Export Handler
  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportDashboardAnalyticsReportPdf({
        dashboardData,
        dateRangeFilter,
        organizationName: branding?.companyName || "WorkPulse Enterprise",
        logoUrl: branding?.logoUrl,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 1. Process Attendance Trends
  const rawAttendance = useMemo(() => {
    if (attendanceTimeframe === "daily") {
      if (dashboardData?.attendanceTrends && dashboardData.attendanceTrends.length > 0) {
        return dashboardData.attendanceTrends;
      }
      return [];
    }
    if (dashboardData?.monthlyWorkforceTrends && dashboardData.monthlyWorkforceTrends.length > 0) {
      return dashboardData.monthlyWorkforceTrends.slice(-6).map((m) => ({
        day: m.month,
        date: m.month,
        label: m.monthFull || m.month,
        present: m.present || 0,
        late: m.late || 0,
        absent: m.absent || 0,
        onLeave: m.onLeave || 0,
        turnoutRate: m.attendanceRate || 0,
      }));
    }
    return [];
  }, [dashboardData, attendanceTimeframe]);

  // Filter attendance data by date range if custom or daily
  const attendanceChartData = useMemo(() => {
    if (attendanceTimeframe === "daily" && dateRangeFilter?.startDate && dateRangeFilter?.endDate) {
      const filtered = rawAttendance.filter((r) => {
        if (!r.date) return true;
        return r.date >= dateRangeFilter.startDate && r.date <= dateRangeFilter.endDate;
      });
      return filtered;
    }
    return rawAttendance;
  }, [rawAttendance, attendanceTimeframe, dateRangeFilter]);

  // Attendance metrics summary
  const attendanceSummary = useMemo(() => {
    const totalPresent = attendanceChartData.reduce((acc, c) => acc + (c.present || 0), 0);
    const totalTurnoutRate =
      attendanceChartData.length > 0
        ? Math.round(
            attendanceChartData.reduce((acc, c) => acc + (c.turnoutRate || 0), 0) /
              attendanceChartData.length
          )
        : 0;
    const totalLate = attendanceChartData.reduce((acc, c) => acc + (c.late || 0), 0);
    return {
      avgTurnout: totalTurnoutRate,
      totalLate,
      avgPresent: attendanceChartData.length > 0 ? Math.round(totalPresent / attendanceChartData.length) : 0,
    };
  }, [attendanceChartData]);

  // 2. Process Average Shift Completion Times
  const shiftChartData = useMemo(() => {
    if (shiftTimeframe === "weekdays") {
      return dashboardData?.shiftCompletionTrends?.weekdays || [];
    }
    if (shiftTimeframe === "daily") {
      const dailyData = dashboardData?.shiftCompletionTrends?.daily || [];
      if (dateRangeFilter?.startDate && dateRangeFilter?.endDate) {
        const filtered = dailyData.filter((d) => {
          if (!d.date) return true;
          return d.date >= dateRangeFilter.startDate && d.date <= dateRangeFilter.endDate;
        });
        return filtered;
      }
      return dailyData;
    }
    if (shiftTimeframe === "monthly") {
      return dashboardData?.shiftCompletionTrends?.monthly || [];
    }
    return [];
  }, [dashboardData, shiftTimeframe, dateRangeFilter]);

  const shiftSummary = useMemo(() => {
    const avgHours =
      shiftChartData.length > 0
        ? parseFloat(
            (
              shiftChartData.reduce((acc, c) => acc + (c.avgShiftHours || c.avgHours || 0), 0) /
              shiftChartData.length
            ).toFixed(2)
          )
        : 0;
    const avgCompletion =
      shiftChartData.length > 0
        ? Math.round(
            shiftChartData.reduce((acc, c) => acc + (c.completionRate || 0), 0) /
              shiftChartData.length
          )
        : 0;
    const totalCompleted = shiftChartData.reduce((acc, c) => acc + (c.completedShifts || 0), 0);

    return {
      avgHours,
      completionRate: avgCompletion,
      totalCompleted,
      targetHours: shiftChartData.length > 0 ? 8.0 : 0,
    };
  }, [shiftChartData]);

  // 3. Process 30-Day Employee Performance Scores
  const performanceChartData = useMemo(() => {
    const source = dashboardData?.employeePerformance30Days || [];
    if (!source || source.length === 0) {
      return [];
    }

    // Apply date filtering if applicable
    if (dateRangeFilter?.startDate && dateRangeFilter?.endDate) {
      const filtered = source.filter(
        (p) => p.date >= dateRangeFilter.startDate && p.date <= dateRangeFilter.endDate
      );
      return filtered.length > 0 ? filtered : source;
    }
    return source;
  }, [dashboardData, dateRangeFilter]);

  // Performance summary KPIs
  const performanceSummary = useMemo(() => {
    if (!performanceChartData.length) {
      return { avgScore: 0, peakScore: 0, lowScore: 0, compliancePct: 0 };
    }
    // Days without any attendance records carry no score and are left out of the averages.
    const scores = performanceChartData.map((p) => p.overallScore).filter((s) => s != null);
    if (!scores.length) {
      return { avgScore: 0, peakScore: 0, lowScore: 0, compliancePct: 0 };
    }
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const peakScore = Math.max(...scores);
    const lowScore = Math.min(...scores);
    const above80 = scores.filter((s) => s >= 80).length;
    const compliancePct = Math.round((above80 / scores.length) * 100);

    return { avgScore, peakScore, lowScore, compliancePct };
  }, [performanceChartData]);

  // 4. Process Payroll Distribution & Department Expenses
  const payrollChartData = useMemo(() => {
    const source =
      dashboardData?.payrollDistributionTrends ||
      dashboardData?.monthlyWorkforceTrends ||
      [];

    if (payrollTimeframe === "6months") {
      return source.slice(-6);
    }
    return source.slice(-12);
  }, [dashboardData, payrollTimeframe]);

  const payrollSummary = useMemo(() => {
    const totalDisbursed = payrollChartData.reduce((acc, c) => acc + (c.netDisbursed || c.baseSalary || 0), 0);
    const totalDeductions = payrollChartData.reduce((acc, c) => acc + (c.deductions || 0), 0);
    const totalAllowances = payrollChartData.reduce((acc, c) => acc + (c.allowances || 0), 0);
    const totalHeadcountSum = payrollChartData.reduce((acc, c) => acc + (c.headcount || 0), 0);
    const avgHeadcount = payrollChartData.length > 0
      ? Math.round(totalHeadcountSum / payrollChartData.length)
      : 0;
    const avgPerStaff = avgHeadcount > 0 ? Math.round(totalDisbursed / Math.max(1, payrollChartData.length) / avgHeadcount) : 0;

    return {
      totalDisbursed,
      totalDeductions,
      totalAllowances,
      avgHeadcount,
      avgPerStaff,
    };
  }, [payrollChartData]);

  // 5. Department Expense Distribution for the PIE CHART segment
  const departmentExpenseData = useMemo(() => {
    if (
      dashboardData?.departmentExpenseDistribution &&
      dashboardData.departmentExpenseDistribution.length > 0
    ) {
      return dashboardData.departmentExpenseDistribution;
    }
    return [];
  }, [dashboardData]);

  const totalDepartmentExpenditure = useMemo(() => {
    return departmentExpenseData.reduce((sum, d) => sum + (d.totalExpense || d.value || 0), 0);
  }, [departmentExpenseData]);

  return (
    <div id="workforce-analytics-dashboard" className="space-y-6">
      {/* 0. DATE RANGE PICKER & REPORT EXPORT BAR */}
      <DashboardDateRangePicker
        selectedPreset={dateRangeFilter.preset}
        startDate={dateRangeFilter.startDate}
        endDate={dateRangeFilter.endDate}
        onRangeChange={handleRangeChange}
        onDownloadReport={handleDownloadPdf}
        isDownloading={isExportingPdf}
      />

      {/* EXECUTIVE HEADER & TELEMETRY NAV TABS */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002185] dark:bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Workforce Intelligence & Telemetry
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-dimensional Recharts telemetry tracking attendance turnout, shift completion compliance, 30-day performance scores, and payroll distribution
              </p>
            </div>
          </div>

          {/* Quick PDF export trigger */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-quick-download-report"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isExportingPdf ? <><WorkspaceLoader inline /> Generating...</> : "Download Report"}</span>
            </button>
          </div>
        </div>

        {/* Segmented Tab Navigation for Analytics */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-[#0B1E48] text-white shadow-xs"
                : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>All Visualizations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "attendance"
                ? "bg-[#002185] dark:bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Attendance Trends</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shift")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "shift"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift Completion Times</span>
          </button>

          <button
            type="button"
            id="tab-performance-scores"
            onClick={() => setActiveTab("performance")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "performance"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Employee Performance (30 Days)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "payroll"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Payroll & Expense Distribution</span>
          </button>
        </div>
      </div>

      {/* 1. ATTENDANCE TRENDS VISUALIZATION */}
      {(activeTab === "all" || activeTab === "attendance") && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Attendance Trends Over Time
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Workforce presence, punctual check-ins, late arrivals, and absences across selected time horizons
              </p>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#162033] p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceTimeframe("daily")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  attendanceTimeframe === "daily"
                    ? "bg-white dark:bg-[#111927] text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Working Days
              </button>
              <button
                type="button"
                onClick={() => setAttendanceTimeframe("monthly")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  attendanceTimeframe === "monthly"
                    ? "bg-white dark:bg-[#111927] text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                6-Month Trend
              </button>
            </div>
          </div>

          {/* Quick Attendance KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Workforce Turnout Rate
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {attendanceSummary.avgTurnout}%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Average across period
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Average Present Staff
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                {attendanceSummary.avgPresent} Employees
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Punctual & excused attendance
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Late Clock-ins
              </span>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                {attendanceSummary.totalLate} Delays
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Arrived after 08:15 AM grace cutoff
              </span>
            </div>
          </div>

          {/* Recharts Composed Area & Bar Chart */}
          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={attendanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<AttendanceTrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                <Area type="monotone" dataKey="present" name="Present Staff" stroke="#10B981" strokeWidth={2.5} fill="url(#presentGrad)" />
                <Area type="monotone" dataKey="late" name="Late Arrivals" stroke="#F59E0B" strokeWidth={2} fill="url(#lateGrad)" />
                <Bar dataKey="absent" name="Unexcused Absent" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. AVERAGE SHIFT COMPLETION TIMES VISUALIZATION */}
      {(activeTab === "all" || activeTab === "shift") && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Average Shift Completion Times Over Time
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily and weekly average hours to complete shifts compared against the standard 8.0h shift baseline
              </p>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#162033] p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setShiftTimeframe("weekdays")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  shiftTimeframe === "weekdays"
                    ? "bg-white dark:bg-[#111927] text-sky-600 dark:text-sky-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Weekday Average
              </button>
              <button
                type="button"
                onClick={() => setShiftTimeframe("daily")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  shiftTimeframe === "daily"
                    ? "bg-white dark:bg-[#111927] text-sky-600 dark:text-sky-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Daily Logs
              </button>
              <button
                type="button"
                onClick={() => setShiftTimeframe("monthly")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  shiftTimeframe === "monthly"
                    ? "bg-white dark:bg-[#111927] text-sky-600 dark:text-sky-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Monthly Trend
              </button>
            </div>
          </div>

          {/* Quick Shift Completion KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Avg Shift Duration
              </span>
              <span className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">
                {shiftSummary.avgHours} Hours
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                vs {shiftSummary.targetHours}h standard shift
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                On-Time Shift Rate
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {shiftSummary.completionRate}%
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Completed full shift length
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Standard Benchmark
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">
                8.00 Hours
              </span>
              <span className="text-[11px] text-slate-400">
                Daily regulatory baseline
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Completed Shifts Logged
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">
                {shiftSummary.totalCompleted}
              </span>
              <span className="text-[11px] text-slate-400">
                Full clock-in &amp; clock-out cycles
              </span>
            </div>
          </div>

          {/* Recharts Composed Chart with Reference Line for 8.0h target */}
          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={shiftChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis
                  yAxisId="hours"
                  domain={[6.5, 9.5]}
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}h`}
                />
                <Tooltip content={<ShiftCompletionTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                
                {/* 8.0h Reference Line */}
                <ReferenceLine
                  yAxisId="hours"
                  y={8.0}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "Standard 8.0h Target",
                    fill: "#EF4444",
                    fontSize: 11,
                    position: "insideTopRight",
                  }}
                />

                <Bar
                  yAxisId="hours"
                  dataKey="avgShiftHours"
                  name="Average Shift (Hours)"
                  fill="#0284C7"
                  radius={[6, 6, 0, 0]}
                  barSize={24}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. NEW RECHARTS LINE CHART: EMPLOYEE PERFORMANCE SCORES OVER THE LAST 30 DAYS */}
      {(activeTab === "all" || activeTab === "performance") && (
        <div id="employee-performance-line-chart-card" className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Employee Performance Scores Over Last 30 Days
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Recharts line chart tracking workforce performance indices, punctuality ratings, and shift completion quality over the past 30 days
              </p>
            </div>

            {/* Performance line metric toggles */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#162033] p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPerformanceMetric("all")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  performanceMetric === "all"
                    ? "bg-white dark:bg-[#111927] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setPerformanceMetric("overall")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  performanceMetric === "overall"
                    ? "bg-white dark:bg-[#111927] text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Overall Score
              </button>
              <button
                type="button"
                onClick={() => setPerformanceMetric("punctuality")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  performanceMetric === "punctuality"
                    ? "bg-white dark:bg-[#111927] text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Punctuality
              </button>
            </div>
          </div>

          {/* Quick Performance KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                30-Day Avg Score
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                {performanceSummary.avgScore}%
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Exceeds 90% benchmark
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Peak Performance Day
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {performanceSummary.peakScore}%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Highest single-day workforce rating
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Lowest Operational Day
              </span>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                {performanceSummary.lowScore}%
              </span>
              <span className="text-[11px] text-slate-400">
                Above 80% minimum threshold
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Standard Compliance Rate
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">
                {performanceSummary.compliancePct}%
              </span>
              <span className="text-[11px] text-slate-400">
                Days scoring above standard
              </span>
            </div>
          </div>

          {/* Recharts LineChart for 30-Day Performance Scores */}
          <div className="w-full h-72 sm:h-84">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  interval={Math.ceil(performanceChartData.length / 10)}
                />
                <YAxis
                  domain={[65, 100]}
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<PerformanceScoreTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />

                {/* 90% Excellence Reference Line */}
                <ReferenceLine
                  y={90}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "90% Excellence Benchmark",
                    fill: "#10B981",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />

                {/* 80% Threshold Reference Line */}
                <ReferenceLine
                  y={80}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: "80% Threshold",
                    fill: "#F59E0B",
                    fontSize: 10,
                    position: "insideBottomRight",
                  }}
                />

                {/* Overall Score Line */}
                {(performanceMetric === "all" || performanceMetric === "overall") && (
                  <Line
                    type="monotone"
                    dataKey="overallScore"
                    connectNulls
                    name="Overall Performance Score (%)"
                    stroke="#2563EB"
                    strokeWidth={2.8}
                    dot={{ r: 2.5, fill: "#2563EB" }}
                    activeDot={{ r: 6, stroke: "#1D4ED8", strokeWidth: 2 }}
                  />
                )}

                {/* Punctuality Line */}
                {(performanceMetric === "all" || performanceMetric === "punctuality") && (
                  <Line
                    type="monotone"
                    dataKey="punctualityScore"
                    connectNulls
                    name="Punctuality Index (%)"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                )}

                {/* Shift Completion Line */}
                {performanceMetric === "all" && (
                  <Line
                    type="monotone"
                    dataKey="shiftCompletionScore"
                    connectNulls
                    name="Shift Completion Rate (%)"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. PAYROLL DISTRIBUTION OVER TIME & DEPARTMENT EXPENSES PIE CHART VISUALIZATION */}
      {(activeTab === "all" || activeTab === "payroll") && (
        <div id="payroll-department-distribution-card" className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Banknote className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Payroll Distribution &amp; Department Expense Allocation
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monthly historical compensation allocations combined with departmental expense breakdown across company divisions
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#162033] p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPayrollViewMode("both")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  payrollViewMode === "both"
                    ? "bg-white dark:bg-[#111927] text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Combined View
              </button>
              <button
                type="button"
                onClick={() => setPayrollViewMode("trend")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  payrollViewMode === "trend"
                    ? "bg-white dark:bg-[#111927] text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Monthly Trend
              </button>
              <button
                type="button"
                id="btn-view-departments-pie"
                onClick={() => setPayrollViewMode("departments")}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
                  payrollViewMode === "departments"
                    ? "bg-white dark:bg-[#111927] text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Department Expenses (Pie)
              </button>
            </div>
          </div>

          {/* Quick Payroll Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Disbursed ({payrollTimeframe === "6months" ? "6 Mo" : "12 Mo"})
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatGHSCurrency(payrollSummary.totalDisbursed)}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                100% Payout execution
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Department Expense
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                {formatGHSCurrency(totalDepartmentExpenditure)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Across {departmentExpenseData.length} company units
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Attendance Deductions
              </span>
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 block truncate">
                {formatGHSCurrency(payrollSummary.totalDeductions)}
              </span>
              <span className="text-[11px] text-rose-500 dark:text-rose-400">
                Lateness &amp; absence penalties
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Active Staff Headcount
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 block">
                {payrollSummary.avgHeadcount} Employees
              </span>
              <span className="text-[11px] text-slate-400">
                Receiving monthly disbursements
              </span>
            </div>
          </div>

          {/* DUAL VISUALIZATION: BAR CHART (Monthly Trend) + PIE CHART (Department Distribution) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 1. Monthly Payroll Stacked Bar Chart */}
            {(payrollViewMode === "both" || payrollViewMode === "trend") && (
              <div
                className={`${
                  payrollViewMode === "both" ? "lg:col-span-7" : "lg:col-span-12"
                } bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Monthly Compensation Breakdown
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPayrollTimeframe("6months")}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        payrollTimeframe === "6months"
                          ? "bg-slate-200 dark:bg-[#162033] font-bold text-slate-900 dark:text-white"
                          : "text-slate-500"
                      }`}
                    >
                      6 Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayrollTimeframe("12months")}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        payrollTimeframe === "12months"
                          ? "bg-slate-200 dark:bg-[#162033] font-bold text-slate-900 dark:text-white"
                          : "text-slate-500"
                      }`}
                    >
                      12 Mo
                    </button>
                  </div>
                </div>

                <div className="w-full h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payrollChartData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `GH₵${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<PayrollDistributionTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      
                      <Bar
                        dataKey="baseSalary"
                        name="Base Salary"
                        stackId="payroll"
                        fill="#0B1E48"
                        radius={[0, 0, 0, 0]}
                        barSize={20}
                      />
                      <Bar
                        dataKey="allowances"
                        name="Allowances"
                        stackId="payroll"
                        fill="#06B6D4"
                        radius={[0, 0, 0, 0]}
                        barSize={20}
                      />
                      <Bar
                        dataKey="deductions"
                        name="Deductions"
                        fill="#F43F5E"
                        radius={[3, 3, 0, 0]}
                        barSize={10}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 2. NEW PIE CHART SEGMENT: DISTRIBUTION OF EXPENSES ACROSS DIFFERENT COMPANY DEPARTMENTS */}
            {(payrollViewMode === "both" || payrollViewMode === "departments") && (
              <div
                id="payroll-department-pie-chart-segment"
                className={`${
                  payrollViewMode === "both" ? "lg:col-span-5" : "lg:col-span-12"
                } bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <PieChartIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Expenses by Department
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {departmentExpenseData.length} Departments
                    </span>
                  </div>

                  {/* Recharts Pie Chart */}
                  <div className="w-full h-56 sm:h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<DepartmentPieTooltip />} />
                        <Pie
                          data={departmentExpenseData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={84}
                          paddingAngle={3}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        >
                          {departmentExpenseData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fill || DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Department legend & percentage list */}
                <div className="mt-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
                  {departmentExpenseData.map((dept, idx) => (
                    <div
                      key={dept.name || idx}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              dept.fill || DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
                          }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                          {dept.name || dept.department}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({dept.headcount || 1} staff)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatGHSCurrency(dept.totalExpense || dept.value || 0)}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-px rounded bg-slate-200 dark:bg-[#162033] text-slate-600 dark:text-slate-300">
                          {dept.percentage || 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceAnalyticsDashboard;
