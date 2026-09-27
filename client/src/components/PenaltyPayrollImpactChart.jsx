import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Percent,
  Clock,
  UserX,
  ShieldCheck,
  Info,
} from "lucide-react";
import { getPenaltyImpactAnalytics } from "../apis/fontApis";

// Custom Tooltip with 2-decimal currency formatting
const CustomPenaltyTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const formatCurrency = (val) => {
    return `GH₵${Number(val || 0).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const dataPoint = payload[0]?.payload;

  return (
    <div
      id="penalty-chart-tooltip"
      className="bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl shadow-md dark:shadow-none text-xs space-y-2.5 min-w-[240px]"
    >
      <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
        <span className="font-bold text-sm text-[#002185] dark:text-blue-400">
          {dataPoint?.monthFull || label}
        </span>
        {dataPoint?.headcount !== undefined && dataPoint?.headcount > 0 && (
          <span className="text-[11px] bg-slate-100 dark:bg-[#162033] px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
            {dataPoint.headcount} Staff
          </span>
        )}
      </div>

      <div className="space-y-1.5 pt-0.5">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {entry.name}:
              </span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              {entry.dataKey === "penaltyImpactPercentage"
                ? `${Number(entry.value || 0).toFixed(2)}%`
                : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>

      {dataPoint && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            Penalty Impact on Gross:
          </span>
          <span className="font-bold text-rose-600 dark:text-rose-400">
            {Number(dataPoint.penaltyImpactPercentage || 0).toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

export const PenaltyPayrollImpactChart = ({ className = "", startDate = "", endDate = "", customData = null }) => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [viewMode, setViewMode] = useState("penalties_breakdown"); // "penalties_breakdown" | "gross_vs_net" | "impact_ratio"

  const fetchImpactData = useCallback(async () => {
    try {
      const res = await getPenaltyImpactAnalytics();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        setData(res.data.data);
        setSummary(res.data.summary || null);
      } else {
        // Zero-state initialization if API returns empty
        const defaultZeroMonths = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => ({
          month: m,
          monthFull: `${m} 2026`,
          grossPayroll: 0,
          totalGrossPayroll: 0,
          absenceDeductions: 0,
          absencePenalties: 0,
          latenessPenalties: 0,
          penaltiesWaived: 0,
          netPenalties: 0,
          totalNetPenalties: 0,
          totalPenalties: 0,
          netPayroll: 0,
          penaltyImpactPercentage: 0,
          headcount: 0,
        }));
        setData(defaultZeroMonths);
        setSummary({
          total6MoPenalties: 0,
          totalNetPenalties6Mo: 0,
          totalPenalties6Mo: 0,
          totalAbsenceDeductions: 0,
          totalAbsencePenalties6Mo: 0,
          totalLatenessPenalties: 0,
          totalLatenessPenalties6Mo: 0,
          totalPenaltiesWaived: 0,
          totalWaived6Mo: 0,
          total6MoGrossPayroll: 0,
          totalGross6Mo: 0,
          totalGrossPayroll: 0,
          avgImpactRate: 0,
          avgPenaltyImpactRate: 0,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch penalty impact analytics:", err);
      const defaultZeroMonths = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => ({
        month: m,
        monthFull: `${m} 2026`,
        grossPayroll: 0,
        totalGrossPayroll: 0,
        absenceDeductions: 0,
        absencePenalties: 0,
        latenessPenalties: 0,
        penaltiesWaived: 0,
        netPenalties: 0,
        totalNetPenalties: 0,
        totalPenalties: 0,
        netPayroll: 0,
        penaltyImpactPercentage: 0,
        headcount: 0,
      }));
      setData(defaultZeroMonths);
      setSummary({
        total6MoPenalties: 0,
        totalNetPenalties6Mo: 0,
        totalPenalties6Mo: 0,
        totalAbsenceDeductions: 0,
        totalAbsencePenalties6Mo: 0,
        totalLatenessPenalties: 0,
        totalLatenessPenalties6Mo: 0,
        totalPenaltiesWaived: 0,
        totalWaived6Mo: 0,
        total6MoGrossPayroll: 0,
        totalGross6Mo: 0,
        totalGrossPayroll: 0,
        avgImpactRate: 0,
        avgPenaltyImpactRate: 0,
      });
    }
  }, []);

  useEffect(() => {
    fetchImpactData();
  }, [fetchImpactData]);

  const formatGHS = (val) => {
    const num = Number(val || 0);
    return `GH₵${num.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filter data according to startDate and endDate if provided
  const displayData = useMemo(() => {
    if (customData && Array.isArray(customData)) return customData;
    if (!startDate && !endDate) return data;

    return data.filter((item) => {
      // Month labels e.g. "Mar" or "Mar 2026" or date fields
      if (item.date) {
        const d = new Date(item.date).toISOString().split("T")[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      }
      return true;
    });
  }, [data, customData, startDate, endDate]);

  // 5 Top Metric Cards aggregated across data directly from backend or filtered data
  const total6MoPenalties = summary?.total6MoPenalties ?? summary?.totalNetPenalties6Mo ?? summary?.totalPenalties6Mo ?? 0;
  const totalAbsenceDeductions = summary?.totalAbsenceDeductions ?? summary?.totalAbsencePenalties6Mo ?? 0;
  const totalLatenessPenalties = summary?.totalLatenessPenalties ?? summary?.totalLatenessPenalties6Mo ?? 0;
  const totalPenaltiesWaived = summary?.totalPenaltiesWaived ?? summary?.totalWaived6Mo ?? 0;
  const avgImpactRate = summary?.avgImpactRate ?? summary?.avgPenaltyImpactRate ?? 0;

  return (
    <motion.div
      id="attendance-penalty-impact-container"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-none space-y-5 overflow-hidden w-full ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                Attendance Penalties & Payroll Cost Impact
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                6-rolling-month historical breakdown of attendance penalties and payroll deductions
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap max-w-full overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center bg-slate-100 dark:bg-[#162033] p-1 rounded-xl text-xs font-semibold shrink-0 border border-slate-200/70 dark:border-slate-700/60">
            <button
              id="btn-view-penalties-breakdown"
              onClick={() => setViewMode("penalties_breakdown")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "penalties_breakdown"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-none font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Penalty Tiers
            </button>
            <button
              id="btn-view-gross-vs-net"
              onClick={() => setViewMode("gross_vs_net")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "gross_vs_net"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-none font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Payroll vs Net
            </button>
            <button
              id="btn-view-impact-ratio"
              onClick={() => setViewMode("impact_ratio")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "impact_ratio"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-none font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Impact Ratio (%)
            </button>
          </div>
        </div>
      </div>

      {/* 5 Dynamic KPI Metric Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 overflow-hidden">
        {/* Card 1: 6-MO TOTAL PENALTIES */}
        <div id="kpi-card-total-penalties" className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/30 rounded-xl p-3 sm:p-3.5 overflow-hidden shadow-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider truncate">
              6-Mo Total Penalties
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatGHS(total6MoPenalties)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Net absence & lateness deductions
          </div>
        </div>

        {/* Card 2: UNEXCUSED ABSENCES */}
        <div id="kpi-card-unexcused-absences" className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 rounded-xl p-3 sm:p-3.5 overflow-hidden shadow-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider truncate">
              Unexcused Absences
            </span>
            <UserX className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatGHS(totalAbsenceDeductions)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Deductions from absent days
          </div>
        </div>

        {/* Card 3: LATENESS TIERS */}
        <div id="kpi-card-lateness-tiers" className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/30 rounded-xl p-3 sm:p-3.5 overflow-hidden shadow-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider truncate">
              Lateness Tiers
            </span>
            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatGHS(totalLatenessPenalties)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Shift delay tier fines
          </div>
        </div>

        {/* Card 4: PENALTIES WAIVED */}
        <div id="kpi-card-penalties-waived" className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/30 rounded-xl p-3 sm:p-3.5 overflow-hidden shadow-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate">
              Penalties Waived
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 truncate">
            {formatGHS(totalPenaltiesWaived)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Manual admin exemptions
          </div>
        </div>

        {/* Card 5: AVG IMPACT RATE % */}
        <div id="kpi-card-avg-impact-rate" className="col-span-1 xs:col-span-2 sm:col-span-1 bg-slate-50 dark:bg-[#162033]/40 border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 overflow-hidden shadow-none">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
              Avg Impact Rate
            </span>
            <Percent className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-1" />
          </div>
          <div className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 truncate">
            {Number(avgImpactRate).toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Of total gross payroll
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full pt-2 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "penalties_breakdown" ? (
            <ComposedChart
              data={displayData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} />
              <XAxis
                dataKey="month"
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `GH₵${v}`}
              />
              <Tooltip content={<CustomPenaltyTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
              />
              {/* Bar Series 1: Absence Deductions (Red #ef4444) */}
              <Bar
                dataKey="absenceDeductions"
                name="Absence Deductions"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                stackId="penalties"
              />
              {/* Bar Series 2: Lateness Penalties (Amber #f59e0b) */}
              <Bar
                dataKey="latenessPenalties"
                name="Lateness Penalties"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                stackId="penalties"
              />
              {/* Bar Series 3: Penalties Waived (Green #10b981) */}
              <Bar
                dataKey="penaltiesWaived"
                name="Penalties Waived"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              {/* Line Series: Total Net Penalties (Navy #1e3a8a) */}
              <Line
                type="monotone"
                dataKey="totalNetPenalties"
                name="Total Net Penalties"
                stroke="#1e3a8a"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#1e3a8a" }}
              />
            </ComposedChart>
          ) : viewMode === "gross_vs_net" ? (
            <ComposedChart
              data={displayData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} />
              <XAxis
                dataKey="month"
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `GH₵${Math.round(v / 1000)}k`}
              />
              <Tooltip content={<CustomPenaltyTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="grossPayroll"
                name="Gross Payroll Cost"
                fill="#EEF2FF"
                stroke="#6366F1"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="netPayroll"
                name="Net Payroll Disbursed"
                fill="#F0FDF4"
                stroke="#10b981"
                strokeWidth={2}
              />
              <Bar
                dataKey="totalNetPenalties"
                name="Total Net Penalties"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={displayData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} />
              <XAxis
                dataKey="month"
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomPenaltyTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
              />
              <Line
                type="monotone"
                dataKey="penaltyImpactPercentage"
                name="Penalty % of Gross Payroll"
                stroke="#ef4444"
                strokeWidth={3}
                dot={{ r: 5, fill: "#ef4444" }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Info / Legend Note */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            Monthly attendance penalties, delay deductions, and admin exemptions.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span> Unexcused Days
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span> Lateness Tiers
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span> Waived
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#1e3a8a]"></span> Net Penalties
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export const AttendancePenaltiesChart = PenaltyPayrollImpactChart;
export default PenaltyPayrollImpactChart;
