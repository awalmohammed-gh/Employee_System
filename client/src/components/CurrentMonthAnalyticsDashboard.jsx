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
  Calendar,
  Users,
  Clock,
  Banknote,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Sparkles,
} from "lucide-react";
import { useWorkSchedule } from "../utils/workSchedule";

// Format Currency for GH₵
const formatCurrency = (value) => {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  return `GH₵${num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatCurrencyCompact = (value) => {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  if (num >= 1000000) return `GH₵${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `GH₵${(num / 1000).toFixed(1)}k`;
  return `GH₵${num.toFixed(0)}`;
};

// Department palette for Charts
const DEPT_COLORS = [
  "#002185", // Navy
  "#2563EB", // Royal Blue
  "#0EA5E9", // Sky Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#14B8A6", // Teal
  "#64748B", // Slate
];

// Custom Tooltip for Attendance Trends
const AttendanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div
      id="attendance-chart-tooltip"
      className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[220px] space-y-2.5"
    >
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <span className="font-semibold text-sm text-blue-300">
          {data?.label || label}
        </span>
        {data?.isWeekend ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
            Weekend
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
            {data?.turnoutRate ?? 0}% Turnout
          </span>
        )}
      </div>

      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Present:
          </span>
          <span className="font-semibold">{data?.present ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Late:
          </span>
          <span className="font-semibold">{data?.late ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Absent:
          </span>
          <span className="font-semibold">{data?.absent ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            On Leave:
          </span>
          <span className="font-semibold">{data?.onLeave ?? 0}</span>
        </div>
        {data?.punctualityRate !== undefined && !data?.isWeekend && (
          <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-slate-300">
            <span>Punctuality Rate:</span>
            <span className="font-bold text-emerald-300">
              {data.punctualityRate}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom Tooltip for Payroll Categories
const PayrollCategoryTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div
      id="payroll-category-tooltip"
      className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-xl text-xs text-white min-w-[200px]"
    >
      <div className="font-semibold text-sm text-slate-100 mb-1 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: data?.fill || "#2563EB" }}
        />
        {data?.name || data?.category}
      </div>
      <div className="text-base font-bold text-emerald-400 mt-1">
        {formatCurrency(data?.amount || data?.value || 0)}
      </div>
      {data?.percentage !== undefined && (
        <div className="text-slate-400 text-[11px] mt-1">
          Share of Total Gross: <span className="text-white font-medium">{data.percentage}%</span>
        </div>
      )}
    </div>
  );
};

// Custom Tooltip for Department Distribution
const DeptPayrollTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;

  return (
    <div
      id="dept-payroll-tooltip"
      className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-xl text-xs text-white min-w-[210px] space-y-1.5"
    >
      <div className="font-semibold text-sm text-blue-300 border-b border-slate-700/80 pb-1.5">
        {data?.department || data?.name}
      </div>
      <div className="flex justify-between items-center text-slate-300 pt-0.5">
        <span>Expenditure:</span>
        <span className="font-bold text-emerald-400">
          {formatCurrency(data?.totalExpense || data?.value || 0)}
        </span>
      </div>
      <div className="flex justify-between items-center text-slate-300">
        <span>Headcount:</span>
        <span className="font-medium text-white">{data?.headcount || 1} staff</span>
      </div>
      {data?.percentage !== undefined && (
        <div className="flex justify-between items-center text-slate-300">
          <span>Budget Share:</span>
          <span className="font-medium text-blue-400">{data.percentage}%</span>
        </div>
      )}
    </div>
  );
};

export default function CurrentMonthAnalyticsDashboard({ dashboardData }) {
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'attendance' | 'payroll'
  const [chartType, setChartType] = useState("composed"); // 'composed' | 'line'

  const { isWorkingDay } = useWorkSchedule();

  // Extract current month data (server breakdown, or an empty month when it is unavailable)
  const monthData = useMemo(() => {
    const raw = dashboardData?.currentMonthAnalytics;
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentMonthName = monthNames[currentMonthIdx];
    const currentMonthShort = monthShortNames[currentMonthIdx];
    const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
    const currentDay = now.getDate();

    if (raw) {
      return raw;
    }

    // Fallback synthesis from overview data
    const activeStaff = Number(
      dashboardData?.cards?.activeEmployees ??
      dashboardData?.cards?.totalEmployees ??
      dashboardData?.activeEmployees ??
      0
    );
    const grossEst = Number(dashboardData?.payroll?.monthlyPayrollTotal ?? dashboardData?.payroll?.totalPayroll ?? 0);
    // The base/allowance split is unknown without the server breakdown; don't invent one.
    const basicEst = 0;
    const allowEst = 0;
    const penEst = Number(dashboardData?.payroll?.totalPenaltiesDeducted ?? 0);
    const dedEst = penEst;
    const netEst = Math.max(0, parseFloat((grossEst - dedEst).toFixed(2)));

    const syntheticTrends = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonthIdx, d);
      const isWeekend = !isWorkingDay(dateObj);
      const isFuture = d > currentDay;
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

      // No attendance breakdown was supplied, so nothing is shown rather than estimated.
      const p = 0, l = 0, a = 0, ol = 0;

      const turnout = p + l;
      syntheticTrends.push({
        dayNumber: d,
        date: `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        dayName,
        label: `${currentMonthShort} ${d}`,
        isWeekend,
        isFuture,
        present: p,
        late: l,
        absent: a,
        onLeave: ol,
        turnoutRate: isWeekend || isFuture || activeStaff === 0 ? 0 : Math.round((turnout / activeStaff) * 100),
        punctualityRate: turnout > 0 ? Math.round((p / turnout) * 100) : 0,
        totalEmployees: activeStaff,
      });
    }

    return {
      monthInfo: {
        monthName: currentMonthName,
        monthShort: currentMonthShort,
        year: currentYear,
        daysInMonth,
        currentDay,
        monthKey: `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`,
      },
      attendance: {
        trends: syntheticTrends,
        avgTurnoutRate: 0,
        avgPunctualityRate: 0,
        totalPresentLogs: 0,
        totalLateLogs: 0,
        totalAbsentLogs: 0,
        totalOnLeaveLogs: 0,
      },
      payroll: {
        grossExpenditure: grossEst,
        netExpenditure: netEst,
        basicSalaries: basicEst,
        allowances: allowEst,
        statutoryDeductions: parseFloat(Math.max(0, dedEst - penEst).toFixed(2)),
        penaltyDeductions: penEst,
        totalDeductions: dedEst,
        disbursedExpenditure: Number(dashboardData?.payroll?.paid ?? dashboardData?.payroll?.totalPayrollDisbursed ?? 0),
        pendingExpenditure: Number(dashboardData?.payroll?.pending ?? dashboardData?.payroll?.pendingDisbursements ?? 0),
        totalHeadcount: activeStaff,
        averageCostPerEmployee: activeStaff > 0 ? Math.round(grossEst / activeStaff) : 0,
        categories: [
          { name: "Base Salaries", amount: basicEst, fill: "#002185", percentage: 0 },
          { name: "Allowances & Benefits", amount: allowEst, fill: "#2563EB", percentage: 0 },
          { name: "Statutory Tax & SSNIT", amount: parseFloat(Math.max(0, dedEst - penEst).toFixed(2)), fill: "#F59E0B", percentage: 0 },
          { name: "Lateness & Absence Penalties", amount: penEst, fill: "#DC2626", percentage: 0 },
        ],
        departmentBreakdown: dashboardData?.departmentExpenseDistribution || [],
      },
    };
  }, [dashboardData, isWorkingDay]);

  // Filter trends for workdays or selected timeframe
  const displayTrends = useMemo(() => {
    return (monthData.attendance?.trends || []).filter(
      (item) => !item.isWeekend
    );
  }, [monthData]);

  const { monthInfo, attendance, payroll } = monthData;

  return (
    <section
      id="current-month-analytics-dashboard"
      className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-6 transition-colors duration-200"
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Current Month Intelligence & Expenditure
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>
                  {monthInfo?.monthName} {monthInfo?.year} (Day {monthInfo?.currentDay} of {monthInfo?.daysInMonth})
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Recharts Analytics
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            id="analytics-view-toggle"
            className="inline-flex p-1 bg-slate-100 dark:bg-[#162033]/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium"
          >
            <button
              id="tab-view-all"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Unified View
            </button>
            <button
              id="tab-view-attendance"
              onClick={() => setActiveTab("attendance")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "attendance"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Attendance Trends
            </button>
            <button
              id="tab-view-payroll"
              onClick={() => setActiveTab("payroll")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "payroll"
                  ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Payroll Expenditure
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div
          id="kpi-current-attendance-rate"
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Avg. Attendance Rate
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {attendance?.avgTurnoutRate ?? 0}%
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {attendance?.avgPunctualityRate ?? 0}% Punctuality
              </span>
              <span>across workdays</span>
            </div>
          </div>
        </div>

        {/* Total Monthly Payroll Expenditure */}
        <div
          id="kpi-current-payroll-gross"
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Gross Monthly Payroll
            </span>
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Banknote className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(payroll?.grossExpenditure || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Headcount: {payroll?.totalHeadcount || 0}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Avg: {formatCurrencyCompact(payroll?.averageCostPerEmployee || 0)}/emp
              </span>
            </div>
          </div>
        </div>

        {/* Disbursed vs Pending */}
        <div
          id="kpi-current-payroll-disbursed"
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Net Payout Disbursed
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(payroll?.disbursedExpenditure || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Pending: {formatCurrencyCompact(payroll?.pendingExpenditure || 0)}</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-semibold text-[10px]">
                {payroll?.pendingEmployeesCount || 0} Pending
              </span>
            </div>
          </div>
        </div>

        {/* Deductions & Penalties */}
        <div
          id="kpi-current-payroll-deductions"
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Statutory & Penalties
            </span>
            <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(payroll?.totalDeductions || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Taxes/SSNIT: {formatCurrencyCompact(payroll?.statutoryDeductions || 0)}</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Penalties: {formatCurrencyCompact(payroll?.penaltyDeductions || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizations Container */}
      <div className="space-y-6">
        {/* SECTION 1: ATTENDANCE TRENDS FOR CURRENT MONTH */}
        {(activeTab === "all" || activeTab === "attendance") && (
          <div
            id="current-month-attendance-chart-container"
            className="bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 md:p-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Employee Attendance Trends ({monthInfo?.monthName} {monthInfo?.year})</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    Daily Staff Presence, Lateness, & Turnout Rate
                  </span>
                </h3>
              </div>

              {/* Chart Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Chart Type:
                </span>
                <div className="inline-flex p-0.5 bg-slate-200/80 dark:bg-slate-700/80 rounded-lg text-xs">
                  <button
                    id="btn-chart-composed"
                    onClick={() => setChartType("composed")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      chartType === "composed"
                        ? "bg-white dark:bg-[#162033] text-slate-900 dark:text-white font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Bars & Turnout
                  </button>
                  <button
                    id="btn-chart-line"
                    onClick={() => setChartType("line")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      chartType === "line"
                        ? "bg-white dark:bg-[#162033] text-slate-900 dark:text-white font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Trend Lines
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Attendance Container */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "composed" ? (
                  <ComposedChart
                    data={displayTrends}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                    />
                    <Tooltip content={<AttendanceTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      iconType="circle"
                    />
                    <ReferenceLine
                      yAxisId="right"
                      y={95}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: "95% Target",
                        fill: "#10b981",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="present"
                      name="Present (On-Time)"
                      fill="#10B981"
                      stackId="attendance"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="late"
                      name="Late Arrivals"
                      fill="#F59E0B"
                      stackId="attendance"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="absent"
                      name="Absent"
                      fill="#EF4444"
                      stackId="attendance"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="turnoutRate"
                      name="Turnout Rate (%)"
                      stroke="#002185"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#002185" }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                ) : (
                  <LineChart
                    data={displayTrends}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<AttendanceTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      iconType="circle"
                    />
                    <Line
                      type="monotone"
                      dataKey="present"
                      name="Present Staff"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      name="Late Staff"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="absent"
                      name="Absent Staff"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Attendance Summary Footnote */}
            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Total Present: <strong className="text-slate-900 dark:text-white">{attendance?.totalPresentLogs || 0}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Total Late Logs: <strong className="text-slate-900 dark:text-white">{attendance?.totalLateLogs || 0}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Total Absences: <strong className="text-slate-900 dark:text-white">{attendance?.totalAbsentLogs || 0}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  Excused Leaves: <strong className="text-slate-900 dark:text-white">{attendance?.totalOnLeaveLogs || 0}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: PAYROLL EXPENDITURE SUMMARIES FOR CURRENT MONTH */}
        {(activeTab === "all" || activeTab === "payroll") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart 2A: Payroll Allocation by Category (8 cols) */}
            <div
              id="payroll-expenditure-category-card"
              className="lg:col-span-7 bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 md:p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Payroll Expenditure Breakdown</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      Current Month
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Gross expenditure split across base salaries, allowances, statutory taxes, and penalty offsets
                  </p>
                </div>
              </div>

              {/* Bar chart of categories */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={payroll?.categories || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrencyCompact(v)}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip content={<PayrollCategoryTooltip />} />
                    <Bar
                      dataKey="amount"
                      radius={[0, 6, 6, 0]}
                    >
                      {(payroll?.categories || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || DEPT_COLORS[index % DEPT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category Legend with exact figures */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                {(payroll?.categories || []).map((cat, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#162033]/80 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.fill }} />
                      <span className="truncate">{cat.name}:</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white shrink-0 ml-1">
                      {formatCurrencyCompact(cat.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2B: Department Expenditure Share (5 cols) */}
            <div
              id="payroll-department-distribution-card"
              className="lg:col-span-5 bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-4 md:p-5 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Department Expenditure</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Monthly payroll expenditure distribution by organizational unit
                </p>
              </div>

              {/* Donut Pie Chart */}
              <div className="h-56 w-full relative my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payroll?.departmentBreakdown || []}
                      dataKey="totalExpense"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {(payroll?.departmentBreakdown || []).map((entry, index) => (
                        <Cell
                          key={`dept-cell-${index}`}
                          fill={entry.fill || DEPT_COLORS[index % DEPT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DeptPayrollTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Gross Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Total Gross
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatCurrencyCompact(payroll?.grossExpenditure || 0)}
                  </span>
                </div>
              </div>

              {/* Department breakdown list */}
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs">
                {(payroll?.departmentBreakdown || []).slice(0, 4).map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: d.fill || DEPT_COLORS[i % DEPT_COLORS.length] }}
                      />
                      {d.department || d.name}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(d.totalExpense || d.value || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
