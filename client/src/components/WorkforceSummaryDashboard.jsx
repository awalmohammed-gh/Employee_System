import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Clock,
  UserCheck,
  ArrowRight,
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import ExportHREmployeeModal from "./ExportHREmployeeModal";
import { exportHREmployeeReportToCSV } from "../utils/exportCsv";

/**
 * WorkforceSummaryDashboard
 * Displays key workforce metrics:
 * 1. Total Active Employees
 * 2. Pending Leave Requests
 * 3. Current Attendance Status
 * Using Recharts for interactive operational intelligence.
 */
export const WorkforceSummaryDashboard = ({
  dashboardData,
  employeeList = [],
  onExportNotice,
}) => {
  const navigate = useNavigate();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  // -------------------------------------------------------------
  // 1. EXTRACT CORE METRICS SAFELY WITH DEFENSIVE DEFAULTS
  // -------------------------------------------------------------
  const totalEmployees = Number(
    dashboardData?.cards?.totalEmployees ??
    dashboardData?.attendance?.totalEmployees ??
    (employeeList ? employeeList.length : 0)
  );

  const activeEmployees = Number(
    dashboardData?.cards?.activeEmployees ??
    dashboardData?.employeeStatusDistribution?.find((s) => s.name?.toLowerCase() === "active")?.value ??
    (employeeList ? employeeList.filter((e) => e.status?.toLowerCase() === "active" || (e.status === undefined && e.isActive !== false)).length : totalEmployees)
  );

  const inactiveEmployees = Number(
    dashboardData?.employeeStatusDistribution?.find((s) => s.name?.toLowerCase() === "inactive")?.value ??
    (employeeList ? employeeList.filter((e) => e.status?.toLowerCase() === "inactive" || e.isActive === false).length : Math.max(0, totalEmployees - activeEmployees))
  );

  const suspendedEmployees = Number(
    dashboardData?.employeeStatusDistribution?.find((s) => s.name?.toLowerCase() === "suspended")?.value ?? 0
  );

  const pendingLeaves = Number(
    dashboardData?.cards?.pendingLeaves ??
    dashboardData?.leave?.pending ??
    0
  );

  const approvedLeaves = Number(
    dashboardData?.leave?.approved ??
    dashboardData?.cards?.onLeave ??
    0
  );

  const rejectedLeaves = Number(
    dashboardData?.leave?.rejected ??
    0
  );

  const totalLeaveRequests = Number(
    dashboardData?.leave?.totalRequests ??
    (pendingLeaves + approvedLeaves + rejectedLeaves)
  );

  // Attendance metrics for today
  const presentToday = Number(
    dashboardData?.cards?.presentToday ??
    dashboardData?.attendance?.present ??
    0
  );

  const lateToday = Number(
    dashboardData?.attendance?.late ??
    0
  );

  const onLeaveToday = Number(
    dashboardData?.cards?.onLeave ??
    dashboardData?.attendance?.onLeave ??
    0
  );

  const onTimeToday = Math.max(0, presentToday - lateToday);
  const absentToday = Math.max(0, (activeEmployees || totalEmployees) - presentToday - onLeaveToday);

  // Turnout percentage
  const effectiveHeadcount = activeEmployees > 0 ? activeEmployees : totalEmployees;
  const turnoutRate = effectiveHeadcount > 0 ? Math.round((presentToday / effectiveHeadcount) * 100) : 0;
  const activeRate = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;

  // -------------------------------------------------------------
  // 2. RECHARTS DATA PREPARATION
  // -------------------------------------------------------------

  // A. Current Attendance Status Segments (Donut Chart)
  const rawSegments = [
    { name: "On Time", value: onTimeToday, fill: "#16A34A" },
    { name: "Late Clock-in", value: lateToday, fill: "#F59E0B" },
    { name: "Approved Leave", value: onLeaveToday, fill: "#3B82F6" },
    { name: "Absent", value: absentToday, fill: "#DC2626" },
  ].filter((seg) => seg.value > 0);

  const attendanceChartData =
    rawSegments.length > 0
      ? rawSegments
      : [{ name: "No Logs Recorded", value: effectiveHeadcount || 1, fill: "#94A3B8" }];

  // B. Department Headcount Distribution (Bar Chart)
  const getDepartmentChartData = () => {
    if (dashboardData?.departmentDistribution && dashboardData.departmentDistribution.length > 0) {
      return dashboardData.departmentDistribution.slice(0, 5).map((d) => ({
        name: d.department || d.name || "General",
        active: Number(d.active || d.total || 0),
        total: Number(d.total || d.active || 0),
      }));
    }
    if (employeeList && employeeList.length > 0) {
      const counts = {};
      employeeList.forEach((emp) => {
        const dept = emp.department || "General";
        const isActive = emp.status?.toLowerCase() === "active" || (emp.status === undefined && emp.isActive !== false);
        if (!counts[dept]) counts[dept] = { name: dept, active: 0, total: 0 };
        if (isActive) counts[dept].active += 1;
        counts[dept].total += 1;
      });
      return Object.values(counts).sort((a, b) => b.active - a.active).slice(0, 5);
    }
    // Zero mock fallback: when no employees exist, return empty array
    return [];
  };

  const departmentChartData = getDepartmentChartData();

  // C. Leave Requests Pipeline Data (Bar Chart)
  const leavePipelineData = [
    {
      name: "Pending",
      count: pendingLeaves,
      fill: "#ff5500",
      label: "Awaiting Action",
    },
    {
      name: "Approved",
      count: approvedLeaves,
      fill: "#16A34A",
      label: "Excused Absence",
    },
    {
      name: "Rejected",
      count: rejectedLeaves,
      fill: "#DC2626",
      label: "Declined",
    },
  ];

  // Quick 1-click HR database CSV download handler
  const handleQuickDownloadCSV = () => {
    const listToExport = employeeList && employeeList.length > 0
      ? employeeList
      : (dashboardData?.employees || []);

    if (listToExport.length > 0) {
      const result = exportHREmployeeReportToCSV(listToExport, {
        filterStatus: "all",
        filename: `workpulse_hr_employee_database_${new Date().toISOString().split("T")[0]}.csv`,
      });
      if (result.success) {
        setExportFeedback(`✓ Exported ${result.count} employee records to CSV`);
        if (onExportNotice) onExportNotice(result.message);
        setTimeout(() => setExportFeedback(null), 5000);
      }
    } else {
      setShowExportModal(true);
    }
  };

  return (
    <section
      id="workforce-metrics-summary"
      aria-label="Workforce Metrics Summary"
      className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6 transition-colors duration-200"
    >
      {/* -------------------------------------------------------------
          HEADER ROW: Title, Real-time metadata, and HR Export Actions
          ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#002185] dark:bg-blue-400"></span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Workforce Operations & Attendance Summary
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time active employee count, pending leave approval pipeline, and daily attendance turnout.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {exportFeedback && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
              {exportFeedback}
            </span>
          )}

          <button
            type="button"
            id="workforce-summary-quick-export-csv"
            onClick={handleQuickDownloadCSV}
            title="Export full employee database to CSV"
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            id="workforce-summary-open-export-modal"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-md"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>HR Reporting Export...</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          KEY WORKFORCE METRICS: 3 CORE STAT CARDS
          1. Total Active Employees
          2. Pending Leave Requests
          3. Current Attendance Status
          ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* CARD 1: Total Active Employees */}
        <div
          onClick={() => navigate("/admin/employees")}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/admin/employees");
            }
          }}
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Active Employees
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-slate-900 dark:text-white">
                {activeEmployees}
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                / {totalEmployees} Total
              </span>
            </div>

            {/* Zero-pill unboxed metadata */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {activeRate}% of database headcount · Verified active on payroll
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums text-[11px]">
              {inactiveEmployees > 0 ? `${inactiveEmployees} Inactive` : "0 Inactive"} · {suspendedEmployees > 0 ? `${suspendedEmployees} Suspended` : "0 Suspended"}
            </span>
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Directory</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* CARD 2: Pending Leave Requests */}
        <div
          onClick={() => navigate("/admin/leave")}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/admin/leave");
            }
          }}
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/80 dark:border-slate-800 hover:border-orange-500/50 dark:hover:border-orange-500/50 rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pending Leave Requests
              </span>
              <div
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  pendingLeaves > 0
                    ? "bg-orange-100 dark:bg-orange-950/80 border-orange-200/60 dark:border-orange-800/60 text-orange-600 dark:text-orange-400"
                    : "bg-emerald-100 dark:bg-emerald-950/80 border-emerald-200/60 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pendingLeaves > 0 ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-slate-900 dark:text-white">
                {pendingLeaves}
              </span>
              <span
                className={`text-xs font-bold ${
                  pendingLeaves > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pendingLeaves > 0 ? "Requires Decision" : "Queue Cleared"}
              </span>
            </div>

            {/* Zero-pill unboxed metadata */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {pendingLeaves > 0
                ? `${pendingLeaves} application${pendingLeaves === 1 ? "" : "s"} awaiting approval by administrator`
                : "All leave applications have been reviewed"}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums text-[11px]">
              {approvedLeaves} Approved · {rejectedLeaves} Rejected
            </span>
            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Review</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* CARD 3: Current Attendance Status */}
        <div
          onClick={() => navigate("/admin/attendance")}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/admin/attendance");
            }
          }}
          className="bg-slate-50/70 dark:bg-[#162033]/40 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Attendance Status
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight font-mono tabular-nums text-slate-900 dark:text-white">
                {presentToday}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {turnoutRate}% Turnout
              </span>
            </div>

            {/* Zero-pill unboxed metadata */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {onTimeToday} on-time clock-in{onTimeToday === 1 ? "" : "s"} · {lateToday} delayed · {onLeaveToday} on leave
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums text-[11px]">
              {absentToday} Absent headcount today
            </span>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>Attendance Log</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          RECHARTS VISUALIZATIONS GRID:
          Panel A: Today's Attendance Status Breakdown (Donut Chart)
          Panel B: Active Employees by Department (Bar Chart)
          Panel C: Leave Applications Pipeline (Bar Chart)
          ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 pt-2">
        {/* PANEL A: Current Attendance Status Breakdown (Donut Chart) */}
        <div className="lg:col-span-5 bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Today Attendance Turnout
              </h3>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {turnoutRate}% Present
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Breakdown of clock-in timeliness and excused absence
            </p>

            <div className="relative w-full h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`att-slice-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} staff`, name]}
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "10px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums leading-none">
                  {presentToday}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
                  Present
                </span>
              </div>
            </div>
          </div>

          {/* Tabular Numerals Legend below Donut */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#111927]/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">On Time</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {onTimeToday}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#111927]/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">Late</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {lateToday}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#111927]/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">On Leave</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {onLeaveToday}
              </span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#111927]/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px]">Absent</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {absentToday}
              </span>
            </div>
          </div>
        </div>

        {/* PANEL B: Active Employees by Department (Bar Chart) */}
        <div className="lg:col-span-4 bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active Staff by Department
              </h3>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                Top {departmentChartData.length} Depts
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Headcount distribution across company units
            </p>

            {departmentChartData.length > 0 ? (
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#475569" }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(val) => [`${val} active staff`, "Active Staff"]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        borderRadius: "10px",
                        color: "#F8FAFC",
                        fontSize: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                      }}
                    />
                    <Bar dataKey="active" fill="#002185" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full h-56 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 dark:bg-[#111927]/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No department breakdown available
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Add employees with designated departments to view distribution.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{departmentChartData.reduce((acc, c) => acc + c.active, 0)} staff represented</span>
            <button
              type="button"
              onClick={() => navigate("/admin/employees")}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              View all
            </button>
          </div>
        </div>

        {/* PANEL C: Leave Requests Pipeline (Bar Chart) */}
        <div className="lg:col-span-3 bg-slate-50/50 dark:bg-[#162033]/30 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Leave Queue
              </h3>
              <span
                className={`text-[11px] font-mono font-bold tabular-nums ${
                  pendingLeaves > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {pendingLeaves} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Pending vs processed applications
            </p>

            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={leavePipelineData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#475569" }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(val, _name, item) => [`${val} requests`, item.payload.label]}
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "10px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24}>
                    {leavePipelineData.map((entry, index) => (
                      <Cell key={`leave-pipe-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{totalLeaveRequests} total recorded</span>
            <button
              type="button"
              onClick={() => navigate("/admin/leave")}
              className="text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
            >
              Process queue
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          HR EXPORT MODAL
          ------------------------------------------------------------- */}
      <ExportHREmployeeModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        employeeList={employeeList && employeeList.length > 0 ? employeeList : (dashboardData?.employees || [])}
        departments={dashboardData?.departments || []}
        onSuccessNotice={(msg) => {
          setExportFeedback(`✓ ${msg}`);
          if (onExportNotice) onExportNotice(msg);
          setTimeout(() => setExportFeedback(null), 5000);
        }}
      />
    </section>
  );
};

export default WorkforceSummaryDashboard;
