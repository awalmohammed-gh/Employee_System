import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Banknote,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const DashboardSummaryMetrics = ({ dashboardData }) => {
  if (!dashboardData) return null;

  const totalEmployees = dashboardData.cards?.totalEmployees || 0;
  const pendingLeaves = dashboardData.cards?.pendingLeaves || dashboardData.leave?.pending || 0;
  const approvedLeaves = dashboardData.leave?.approved || 0;
  const rejectedLeaves = dashboardData.leave?.rejected || 0;

  const totalPayroll = dashboardData.payroll?.totalPayroll || 0;
  const disbursedPayroll =
    dashboardData.payroll?.paid || dashboardData.payroll?.totalPayrollDisbursed || 0;
  const pendingPayroll =
    dashboardData.payroll?.pending || dashboardData.payroll?.pendingDisbursements || 0;
  const penaltyDeductions = dashboardData.payroll?.totalPenaltiesDeducted || 0;

  // Key Metrics Data for Recharts Bar Chart
  const keyMetricsComparison = [
    {
      name: "Total Employees",
      count: totalEmployees,
      fill: "#002185",
    },
    {
      name: "Approved Leaves",
      count: approvedLeaves,
      fill: "#16A34A",
    },
    {
      name: "Pending Leaves",
      count: pendingLeaves,
      fill: "#ff5500",
    },
    {
      name: "Rejected Leaves",
      count: rejectedLeaves,
      fill: "#DC2626",
    },
  ];

  // Payroll Status Breakdown for Donut Chart - strict real values, zero mock multipliers
  const payrollStatusSegments = [
    { name: "Disbursed", value: disbursedPayroll, fill: "#16A34A" },
    { name: "Pending", value: pendingPayroll, fill: "#F59E0B" },
    { name: "Penalties Deducted", value: penaltyDeductions, fill: "#DC2626" },
  ].filter((item) => item.value > 0);

  // Active Alerts Count
  const activeAlerts = [
    ...(pendingLeaves > 0
      ? [{ id: "leave-alert", type: "warning", message: `${pendingLeaves} pending leave application${pendingLeaves > 1 ? "s" : ""} awaiting review` }]
      : []),
    ...(pendingPayroll > 0
      ? [{ id: "payroll-alert", type: "info", message: `${formatCurrency(pendingPayroll)} in pending payroll disbursements` }]
      : []),
    ...(penaltyDeductions > 0
      ? [{ id: "penalty-alert", type: "neutral", message: `${formatCurrency(penaltyDeductions)} in automated attendance penalty deductions applied` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Active System & Payroll Alerts Bar */}
      {activeAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              Active Dashboard Alerts ({activeAlerts.length})
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#162033] border border-amber-200/70 dark:border-amber-800/40 text-xs text-slate-800 dark:text-slate-200 shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-medium truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visualizer Cards: Key Metrics & Payroll Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recharts Bar: Workforce & Leave Key Metrics */}
        <div className="bg-white dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700/60 rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#002185]/10 dark:bg-blue-950/50 flex items-center justify-center text-[#002185] dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#002185] dark:text-white">
                  Key Metrics Summary
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Total employees vs leave approvals & pending requests
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#002185]/10 dark:bg-blue-950/50 text-[#002185] dark:text-blue-300">
              {totalEmployees} Staff
            </span>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={keyMetricsComparison}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
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
                  formatter={(value, name) => [`${value}`, name]}
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    borderColor: "#475569",
                    borderRadius: "12px",
                    color: "#F8FAFC",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={28}>
                  {keyMetricsComparison.map((entry, index) => (
                    <Cell key={`metric-bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Footer Badges */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#E2E8F0] dark:border-slate-700/60 text-center">
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Total Staff
              </span>
              <span className="text-sm font-bold text-[#002185] dark:text-white">
                {totalEmployees}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Pending Leave
              </span>
              <span className="text-sm font-bold text-[#ff5500] dark:text-orange-400">
                {pendingLeaves}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Approved
              </span>
              <span className="text-sm font-bold text-[#16A34A] dark:text-emerald-400">
                {approvedLeaves}
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Donut: Payroll Status & Alerts */}
        <div className="bg-white dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700/60 rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 dark:bg-emerald-950/50 flex items-center justify-center text-[#16A34A] dark:text-emerald-400">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#002185] dark:text-white">
                  Payroll Status Breakdown
                </h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Disbursed, pending, and attendance penalties
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#16A34A]/10 dark:bg-emerald-950/50 text-[#16A34A] dark:text-emerald-300">
              {formatCurrency(totalPayroll)}
            </span>
          </div>

          <div className="relative w-full h-64 flex items-center justify-center">
            {payrollStatusSegments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={payrollStatusSegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {payrollStatusSegments.map((entry, index) => (
                      <Cell key={`payroll-cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name]}
                    contentStyle={{
                      backgroundColor: "#1E293B",
                      borderColor: "#475569",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-6 bg-[#F8FAFC] dark:bg-[#111927]/60 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] mx-auto mb-1" />
                <p className="text-xs font-bold text-[#002185] dark:text-white">No Pending Payroll</p>
              </div>
            )}
          </div>

          {/* Payroll KPI Breakdown Footer */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#E2E8F0] dark:border-slate-700/60 text-center">
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Disbursed
              </span>
              <span className="text-xs font-bold text-[#16A34A] dark:text-emerald-400">
                {formatCurrency(disbursedPayroll)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Pending
              </span>
              <span className="text-xs font-bold text-[#F59E0B] dark:text-amber-400">
                {formatCurrency(pendingPayroll)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111927]/60">
              <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block">
                Penalties
              </span>
              <span className="text-xs font-bold text-[#DC2626] dark:text-red-400">
                {formatCurrency(penaltyDeductions)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummaryMetrics;
