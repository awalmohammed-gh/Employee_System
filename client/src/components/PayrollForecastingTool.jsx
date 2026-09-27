import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingDown,
  Calculator,
  CheckCircle2,
  Calendar,
  Clock,
  Sliders,
  Download,
  Search,
  RefreshCw,
  ShieldAlert,
  BarChart3,
  Building2,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { getPayrollForecasting, exportPayrollForecastingCSV } from "../apis/fontApis";
import Avatar from "./Avatar";
import { useManagement } from "../context/ManagementContextProvider";

export const PayrollForecastingTool = ({ initialMonth, initialYear }) => {
  const { setShowToast } = useManagement();

  // Selected Month & Year
  const [selectedMonth, setSelectedMonth] = useState(
    initialMonth || new Date().toLocaleDateString("en-US", { month: "long" })
  );
  const [selectedYear, setSelectedYear] = useState(
    initialYear || new Date().getFullYear()
  );

  // Scenario Mode: 'trend' | 'strict' | 'optimistic' | 'best_case' | 'custom'
  const [scenario, setScenario] = useState("trend");

  // Custom Simulator Parameters
  const [customMultiplier, setCustomMultiplier] = useState(1.2);
  const [customAvgMinutes, setCustomAvgMinutes] = useState(30);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState("all");

  // Data States
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Single Employee Sandbox Drilldown Modal State
  const [drilldownEmployee, setDrilldownEmployee] = useState(null);
  const [simLateDays, setSimLateDays] = useState(2);
  const [simAvgMinutes, setSimAvgMinutes] = useState(35);

  const monthsList = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const fetchForecast = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);

      const params = {
        month: selectedMonth,
        year: selectedYear,
        scenario,
        department: selectedDepartment,
        search: searchQuery,
      };

      if (scenario === "custom") {
        params.customLateMultiplier = customMultiplier;
        params.customAvgMinutes = customAvgMinutes;
      }

      const { data } = await getPayrollForecasting(params);
      if (data && data.success) {
        setForecastData(data);
      } else {
        setShowToast({
          show: true,
          message: data?.message || "Failed to load payroll forecast.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error fetching payroll forecast:", err);
      setShowToast({
        show: true,
        message: err.response?.data?.message || err.message || "Failed to load forecast data.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMonth, selectedYear, scenario, selectedDepartment, searchQuery, customMultiplier, customAvgMinutes, setShowToast]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  // Export CSV Handler
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params = {
        month: selectedMonth,
        year: selectedYear,
        scenario,
        department: selectedDepartment,
      };

      const response = await exportPayrollForecastingCSV(params);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Payroll_Lateness_Forecast_${selectedMonth}_${selectedYear}_${scenario}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setShowToast({
        show: true,
        message: "Forecasting report exported successfully.",
        type: "success",
      });
    } catch (err) {
      console.error("Error exporting forecast CSV:", err);
      setShowToast({
        show: true,
        message: "Failed to download forecast report.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Format currency in Ghana Cedis
  const formatCurrency = (val) => {
    return (Number(val) || 0).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filtered employees list based on search and risk filter
  const filteredEmployees = useMemo(() => {
    if (!forecastData || !forecastData.employees) return [];
    let list = forecastData.employees;

    if (selectedRiskFilter !== "all") {
      list = list.filter((e) => e.riskLevel === selectedRiskFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q)
      );
    }

    return list;
  }, [forecastData, selectedRiskFilter, searchQuery]);

  // Extract distinct departments for filter dropdown
  const departmentsList = useMemo(() => {
    if (!forecastData || !forecastData.employees) return [];
    const depts = new Set(forecastData.employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts);
  }, [forecastData]);

  // Prepare Chart Data: Top 7 Most Impacted Employees
  const employeeChartData = useMemo(() => {
    if (!forecastData || !forecastData.employees) return [];
    return [...forecastData.employees]
      .sort(
        (a, b) =>
          b.estimatedTotalMonthLatenessDeduction - a.estimatedTotalMonthLatenessDeduction
      )
      .slice(0, 7)
      .map((e) => ({
        name: e.fullName.split(" ")[0] || e.employeeId,
        fullName: e.fullName,
        currentDeduction: e.currentAccumulatedLatenessDeduction,
        projectedAdditional: e.projectedAdditionalLatenessDeduction,
        totalProjected: e.estimatedTotalMonthLatenessDeduction,
        riskLevel: e.riskLevel,
      }));
  }, [forecastData]);

  // Prepare Department Risk Chart Data
  const departmentChartData = useMemo(() => {
    if (!forecastData || !forecastData.departmentBreakdown) return [];
    return forecastData.departmentBreakdown.map((d) => ({
      name: d.department,
      current: d.currentDeductions,
      projected: d.projectedDeductions,
      headcount: d.headcount,
    }));
  }, [forecastData]);

  // Handle opening employee drilldown
  const handleOpenDrilldown = (emp) => {
    setDrilldownEmployee(emp);
    setSimLateDays(emp.projectedAdditionalLateDays || 1);
    setSimAvgMinutes(emp.avgMinutesPerLateDay || 30);
  };

  // Calculate live simulation for drilldown modal
  const simulatedDrilldownResult = useMemo(() => {
    if (!drilldownEmployee) return null;
    const baseSalary = drilldownEmployee.baseSalary || 8000;
    const currentDeductions = drilldownEmployee.currentAccumulatedLatenessDeduction || 0;

    // Determine tier penalty per simulated day
    let finePerDay;
    if (simAvgMinutes <= 30) finePerDay = 10;
    else if (simAvgMinutes <= 60) finePerDay = 30;
    else if (simAvgMinutes <= 120) finePerDay = 50;
    else if (simAvgMinutes <= 180) finePerDay = 75;
    else if (simAvgMinutes <= 240) finePerDay = 100;
    else finePerDay = 150;

    const simFutureDeduction = simLateDays * finePerDay;
    const simTotalDeductions = currentDeductions + simFutureDeduction;
    const simNetSalary = Math.max(0, baseSalary - simTotalDeductions);
    const simPct = parseFloat(((simTotalDeductions / baseSalary) * 100).toFixed(2));
    const savingsVsTrend =
      drilldownEmployee.estimatedTotalMonthLatenessDeduction - simTotalDeductions;

    return {
      simFutureDeduction,
      simTotalDeductions,
      simNetSalary,
      simPct,
      savingsVsTrend,
      finePerDay,
    };
  }, [drilldownEmployee, simLateDays, simAvgMinutes]);

  return (
    <div id="payroll-forecasting-tool-container" className="space-y-6">
      {/* Top Header Row & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calculator className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1E48] dark:text-white">
              Payroll Lateness Deduction Forecasting
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Predictive end-of-month salary impact modeling based on current accumulated lateness
            telemetry, remaining working days, and customizable punctuality trend scenarios.
          </p>
        </div>

        {/* Action Controls: Month/Year & Export */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <select
            id="select-forecast-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#002185]/25 cursor-pointer"
          >
            {monthsList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            id="select-forecast-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#002185]/25 cursor-pointer"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            id="btn-refresh-forecast"
            onClick={() => fetchForecast(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#002185] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 transition-colors cursor-pointer disabled:opacity-60"
            title="Recalculate forecast from live attendance logs"
          >
            {(isRefreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            <span>{isRefreshing ? "Recalculating..." : "Refresh"}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            id="btn-export-forecast-csv"
            onClick={handleExportCSV}
            disabled={isExporting || isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#002185] hover:bg-[#001760] active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? <><WorkspaceLoader inline /> Exporting...</> : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Cycle & Working Days Telemetry Banner */}
      {forecastData?.workingDays && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-[#002185] dark:text-blue-400" />
              <span>
                Pay Period Cycle Telemetry:{" "}
                <span className="text-[#002185] dark:text-blue-400">
                  {forecastData.month}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>
                Elapsed Workdays:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {forecastData.workingDays.elapsedWorkingDays}
                </strong>
              </span>
              <span>•</span>
              <span>
                Remaining Workdays:{" "}
                <strong className="text-amber-600 dark:text-amber-400">
                  {forecastData.workingDays.remainingWorkingDays} days left
                </strong>
              </span>
              <span>•</span>
              <span>
                Total Business Days:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {forecastData.workingDays.totalWorkingDays}
                </strong>
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-[#162033] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#002185] dark:bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${forecastData.workingDays.cycleCompletionRate}%` }}
              title={`Cycle Completion: ${forecastData.workingDays.cycleCompletionRate}%`}
            />
          </div>
        </div>
      )}

      {/* Scenario Model Selector Bar */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Select Forecasting Extrapolation Scenario:
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Current Scenario:{" "}
            <strong className="text-[#002185] dark:text-blue-400 uppercase tracking-wider">
              {scenario.replace("_", " ")}
            </strong>
          </span>
        </div>

        {/* Scenario Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setScenario("trend")}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
              scenario === "trend"
                ? "bg-[#002185] text-white border-[#002185] shadow-xs"
                : "bg-slate-50 dark:bg-[#162033]/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div>Current Pace</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Empirical Trend</div>
          </button>

          <button
            type="button"
            onClick={() => setScenario("strict")}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
              scenario === "strict"
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-slate-50 dark:bg-[#162033]/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div>Strict Escalation</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">+25% Lateness Rate</div>
          </button>

          <button
            type="button"
            onClick={() => setScenario("optimistic")}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
              scenario === "optimistic"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-slate-50 dark:bg-[#162033]/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div>Target Improvement</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">-50% Lateness Rate</div>
          </button>

          <button
            type="button"
            onClick={() => setScenario("best_case")}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
              scenario === "best_case"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-slate-50 dark:bg-[#162033]/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div>100% Punctuality</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Best Case (Zero Loss)</div>
          </button>

          <button
            type="button"
            onClick={() => setScenario("custom")}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              scenario === "custom"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 dark:bg-[#162033]/60 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div>Custom Sandbox</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Custom Multiplier</div>
          </button>
        </div>

        {/* Custom Sandbox Controls */}
        {scenario === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700/60 animate-fadeIn">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Lateness Frequency Multiplier:</span>
                <span className="text-[#002185] dark:text-blue-400 font-bold">
                  {customMultiplier}x ({Math.round(customMultiplier * 100)}%)
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={customMultiplier}
                onChange={(e) => setCustomMultiplier(parseFloat(e.target.value))}
                className="w-full accent-[#002185] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Simulated Delay per Incident:</span>
                <span className="text-amber-600 font-bold">{customAvgMinutes} mins</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={customAvgMinutes}
                onChange={(e) => setCustomAvgMinutes(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Organization KPI Summary Cards */}
      {forecastData?.organizationSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Estimated Total Deductions */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Projected Month-End Deductions
              </span>
              <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(
                  forecastData.organizationSummary.totalProjectedEndOfMonthLatenessDeductions
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Current Realized:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatCurrency(
                    forecastData.organizationSummary.totalCurrentLatenessDeductions
                  )}
                </strong>
              </p>
            </div>
          </div>

          {/* Card 2: Projected Future Impact */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Future Projected Deductions
              </span>
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(
                  forecastData.organizationSummary.totalProjectedAdditionalDeductions
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Expected across next{" "}
                {forecastData.workingDays.remainingWorkingDays} working days
              </p>
            </div>
          </div>

          {/* Card 3: Potential Workforce Savings */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Potential Punctuality Savings
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  forecastData.organizationSummary.totalPotentialWorkforceSavings
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Amount retained if 100% on-time
              </p>
            </div>
          </div>

          {/* Card 4: Risk Distribution */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Workforce Risk Profile
              </span>
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#002185] dark:text-blue-400">
                <ShieldAlert className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                {forecastData.organizationSummary.riskDistribution.critical} Critical
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {forecastData.organizationSummary.riskDistribution.moderate} Moderate
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {forecastData.organizationSummary.riskDistribution.low} Safe
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Payroll impact rate:{" "}
              <strong>{forecastData.organizationSummary.overallPayrollImpactRate}%</strong> of total
              base payroll
            </p>
          </div>
        </div>
      )}

      {/* Visual Recharts Forecasting Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Realized vs. Projected Deductions by Top Impacted Employees */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0B1E48] dark:text-white">
                Realized vs. Projected Deductions by Employee
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Highest projected end-of-month salary deduction impact (GH₵)
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            {employeeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-blue-300">{item.fullName}</p>
                          <p>
                            Realized To Date:{" "}
                            <span className="font-semibold text-slate-200">
                              GH₵ {item.currentDeduction.toFixed(2)}
                            </span>
                          </p>
                          <p>
                            Projected Future:{" "}
                            <span className="font-semibold text-amber-300">
                              GH₵ {item.projectedAdditional.toFixed(2)}
                            </span>
                          </p>
                          <div className="pt-1 border-t border-slate-700 flex justify-between gap-4 font-bold text-rose-300">
                            <span>Estimated Total:</span>
                            <span>GH₵ {item.totalProjected.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                  <Bar
                    dataKey="currentDeduction"
                    name="Realized To Date (GH₵)"
                    fill="#002185"
                    stackId="a"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="projectedAdditional"
                    name="Projected Future (GH₵)"
                    fill="#F59E0B"
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No attendance telemetry available for this cycle.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Projected Deductions by Department */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0B1E48] dark:text-white">
                Projected Lateness Cost by Department
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cumulative estimated deduction exposure across departments
              </p>
            </div>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            {departmentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val, name) => [
                      `GH₵ ${Number(val).toFixed(2)}`,
                      name === "projected" ? "Total Projected" : "Realized To Date",
                    ]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                  <Bar
                    dataKey="current"
                    name="Realized (GH₵)"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="projected"
                    name="Projected Total (GH₵)"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No department breakdown available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Employee Forecast Table Section */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#0B1E48] dark:text-white">
              Employee-by-Employee Forecast Roster
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredEmployees.length} employee records with estimated end-of-month salary deductions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="input-forecast-employee-search"
                placeholder="Search staff, ID, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002185]/25"
              />
            </div>

            {/* Department Filter */}
            <select
              id="select-forecast-department-filter"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Risk Category Filter */}
            <select
              id="select-forecast-risk-filter"
              value={selectedRiskFilter}
              onChange={(e) => setSelectedRiskFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Risk Tiers</option>
              <option value="Critical Risk">Critical Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Low Risk">Low Risk / Safe</option>
            </select>
          </div>
        </div>

        {/* Forecast Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#162033]/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-3">Base Salary</th>
                <th className="py-3.5 px-3">Elapsed Attendance</th>
                <th className="py-3.5 px-3">Realized Deductions</th>
                <th className="py-3.5 px-3">Projected Late</th>
                <th className="py-3.5 px-3">Est. Total Deduction</th>
                <th className="py-3.5 px-3">Est. Net Salary</th>
                <th className="py-3.5 px-3">Impact (%)</th>
                <th className="py-3.5 px-3">Risk Tier</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp._id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Employee info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={emp.avatar}
                          name={emp.fullName}
                          size="sm"
                          shape="rounded"
                          className="w-9 h-9"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {emp.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {emp.employeeId} • {emp.department}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(emp.baseSalary)}
                    </td>

                    {/* Elapsed Attendance to Date */}
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {emp.recordedLateDays} late{" "}
                        <span className="text-[11px] text-slate-500">
                          ({emp.latenessFrequencyRate}%)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Avg: {emp.avgMinutesPerLateDay}m delay
                      </div>
                    </td>

                    {/* Realized Deductions */}
                    <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                      {formatCurrency(emp.currentAccumulatedLatenessDeduction)}
                    </td>

                    {/* Projected Additional Late Days */}
                    <td className="py-3.5 px-3 font-medium text-amber-600 dark:text-amber-400">
                      +{emp.projectedAdditionalLateDays} days
                      <div className="text-[10px] text-slate-500">
                        +{formatCurrency(emp.projectedAdditionalLatenessDeduction)}
                      </div>
                    </td>

                    {/* Estimated Total Month-End Lateness Deduction */}
                    <td className="py-3.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(emp.estimatedTotalMonthLatenessDeduction)}
                    </td>

                    {/* Estimated End-of-Month Net Salary */}
                    <td className="py-3.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(emp.estimatedEndOfMonthSalary)}
                    </td>

                    {/* Impact % */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          emp.deductionPercentageOfSalary >= 5
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            : emp.deductionPercentageOfSalary >= 2
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {emp.deductionPercentageOfSalary}%
                      </span>
                    </td>

                    {/* Risk Tier Badge */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${emp.riskBadgeClass}`}
                      >
                        {emp.riskLevel}
                      </span>
                    </td>

                    {/* Action Deep Dive */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        id={`btn-simulate-employee-${emp.employeeId}`}
                        onClick={() => handleOpenDrilldown(emp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#002185] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                        title="Simulate what-if outcomes for this employee"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Simulate</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No matching employee forecast records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Employee What-If Drilldown Modal */}
      {drilldownEmployee && (
        <div
          id="employee-forecast-drilldown-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
        >
          <div className="w-full max-w-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={drilldownEmployee.avatar}
                  name={drilldownEmployee.fullName}
                  size="md"
                  shape="rounded"
                />
                <div>
                  <h3 className="text-base font-bold text-[#0B1E48] dark:text-white">
                    {drilldownEmployee.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {drilldownEmployee.employeeId} • {drilldownEmployee.department} • Base:{" "}
                    {formatCurrency(drilldownEmployee.baseSalary)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownEmployee(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Realized Metrics Summary */}
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#162033]/50 border border-slate-200/60 dark:border-slate-800 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Realized Late Days
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {drilldownEmployee.recordedLateDays} days
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Avg Delay
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {drilldownEmployee.avgMinutesPerLateDay} mins
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Realized Deduction
                </span>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(drilldownEmployee.currentAccumulatedLatenessDeduction)}
                </p>
              </div>
            </div>

            {/* Interactive Simulation Sliders */}
            <div className="space-y-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span>Simulate Remaining Days Outcome</span>
              </div>

              {/* Slider 1: Remaining Late Days */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Simulated Future Late Days:</span>
                  <strong className="text-amber-600 font-bold">{simLateDays} days</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max={forecastData?.workingDays?.remainingWorkingDays || 15}
                  value={simLateDays}
                  onChange={(e) => setSimLateDays(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>0 (Perfect Punctuality)</span>
                  <span>{forecastData?.workingDays?.remainingWorkingDays || 15} days max</span>
                </div>
              </div>

              {/* Slider 2: Average Delay */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Simulated Delay per Late Day:</span>
                  <strong className="text-amber-600 font-bold">{simAvgMinutes} minutes</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={simAvgMinutes}
                  onChange={(e) => setSimAvgMinutes(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>5 mins (Tier 1: GH₵10)</span>
                  <span>60 mins (Tier 2: GH₵30)</span>
                  <span>180 mins (Tier 4: GH₵75)</span>
                </div>
              </div>
            </div>

            {/* Simulated Outcome Result */}
            {simulatedDrilldownResult && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Projected Month-End Deduction:
                  </span>
                  <strong className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(simulatedDrilldownResult.simTotalDeductions)}
                  </strong>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Estimated Net Salary Take-Home:
                  </span>
                  <strong className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(simulatedDrilldownResult.simNetSalary)}
                  </strong>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Salary Impact Rate:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {simulatedDrilldownResult.simPct}% of base pay
                  </span>
                </div>

                {simulatedDrilldownResult.savingsVsTrend > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Potential Savings vs. Current Trend:</span>
                    <span>+{formatCurrency(simulatedDrilldownResult.savingsVsTrend)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDrilldownEmployee(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Close Sandbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollForecastingTool;
