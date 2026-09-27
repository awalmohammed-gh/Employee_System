import { useNavigate } from "react-router-dom";
import {
  Users,
  CalendarCheck,
  Banknote,
  ArrowRight,
} from "lucide-react";
import ExportPayrollReportButton from "./ExportPayrollReportButton";

/**
 * Data summary section at the top of the dashboard using small cards
 * to display 'Active Employees', 'Employees on Leave', and 'Pending Payroll' metrics.
 */
export const DashboardDataSummarySection = ({
  dashboardData,
  payrollRecords = [],
  onExportSuccess,
  onExportError,
}) => {
  const navigate = useNavigate();

  // Format currency in Ghana Cedis
  const formatCurrency = (amount) => {
    const val = typeof amount === "number" ? amount : parseFloat(amount) || 0;
    return `GH₵${val.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 1. Active Employees metric
  const activeEmployees = Number(
    dashboardData?.cards?.activeEmployees ??
    dashboardData?.employeeStatusDistribution?.find((s) => s.name === "Active")?.value ??
    dashboardData?.cards?.totalEmployees ??
    dashboardData?.attendance?.totalEmployees ??
    0
  );
  const totalHeadcount = Number(
    dashboardData?.cards?.totalEmployees ??
    dashboardData?.attendance?.totalEmployees ??
    activeEmployees
  );

  // 2. Employees on Leave metric
  const employeesOnLeave = Number(
    dashboardData?.cards?.onLeave ??
    dashboardData?.cards?.employeesOnLeave ??
    dashboardData?.attendance?.onLeave ??
    dashboardData?.leave?.approved ??
    0
  );

  // 3. Pending Payroll metric
  const pendingPayrollAmount = Number(
    dashboardData?.payroll?.pending ??
    dashboardData?.payroll?.pendingDisbursements ??
    dashboardData?.cards?.pendingPayroll ??
    0
  );
  const pendingPayrollCount = Number(
    dashboardData?.payroll?.pendingCount ??
    dashboardData?.cards?.pendingPayrollCount ??
    0
  );
  const currentPayMonth =
    dashboardData?.payroll?.month ||
    dashboardData?.payroll?.payMonth ||
    new Date().toLocaleDateString("en-GH", { month: "long", year: "numeric" });

  // Small summary cards configuration
  const smallSummaryCards = [
    {
      id: "summary-card-active-employees",
      label: "Active Employees",
      value: activeEmployees,
      sublabel: totalHeadcount > activeEmployees ? `${activeEmployees} of ${totalHeadcount} total staff` : "Verified workforce on payroll",
      icon: Users,
      accentBg: "bg-blue-50 dark:bg-blue-950/50",
      accentBorder: "border-blue-200 dark:border-blue-800/80",
      iconColor: "text-blue-600 dark:text-blue-400",
      path: "/admin/employees",
      badgeText: "Staff",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
    },
    {
      id: "summary-card-employees-on-leave",
      label: "Employees on Leave",
      value: employeesOnLeave,
      sublabel: employeesOnLeave > 0 ? `${employeesOnLeave} approved scheduled absence${employeesOnLeave > 1 ? "s" : ""}` : "All active staff reporting",
      icon: CalendarCheck,
      accentBg: "bg-amber-50 dark:bg-amber-950/50",
      accentBorder: "border-amber-200 dark:border-amber-800/80",
      iconColor: "text-amber-600 dark:text-amber-400",
      path: "/admin/leave",
      badgeText: "On Leave",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    },
    {
      id: "summary-card-pending-payroll",
      label: "Pending Payroll",
      value: formatCurrency(pendingPayrollAmount),
      sublabel: pendingPayrollAmount > 0
        ? `${pendingPayrollCount > 0 ? `${pendingPayrollCount} cycle${pendingPayrollCount > 1 ? "s" : ""} • ` : ""}Awaiting disbursement`
        : "Disbursements reconciled",
      icon: Banknote,
      accentBg: "bg-emerald-50 dark:bg-emerald-950/50",
      accentBorder: "border-emerald-200 dark:border-emerald-800/80",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      path: "/admin/payroll",
      badgeText: pendingPayrollAmount > 0 ? "Pending" : "Reconciled",
      badgeColor: pendingPayrollAmount > 0
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
    },
  ];

  return (
    <section
      id="dashboard-data-summary-section"
      aria-label="Executive Data Summary"
      className="space-y-3"
    >
      {/* Section Header with Title and Quick Export Feature */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#002185] dark:bg-blue-400"></span>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Data Summary
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            • Live Metrics Overview
          </span>
        </div>

        {/* Accounting Direct Export Trigger at top of dashboard */}
        {payrollRecords && payrollRecords.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-400 hidden md:inline">
              Accounting:
            </span>
            <ExportPayrollReportButton
              records={payrollRecords}
              month={currentPayMonth}
              year={new Date().getFullYear()}
              buttonText="Export Processed Payroll"
              size="sm"
              onSuccess={onExportSuccess}
              onError={onExportError}
            />
          </div>
        )}
      </div>

      {/* Small Cards Grid: 3-column responsive layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {smallSummaryCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              onClick={() => card.path && navigate(card.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  card.path && navigate(card.path);
                }
              }}
              className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-xl sm:rounded-2xl p-4 shadow-xs dark:shadow-black/20 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              {/* Card Top: Icon & Badge */}
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`w-8 h-8 rounded-lg ${card.accentBg} border ${card.accentBorder} flex items-center justify-center ${card.iconColor} group-hover:scale-105 transition-transform shrink-0`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${card.badgeColor}`}
                >
                  {card.badgeText}
                </span>
              </div>

              {/* Card Middle: Label & Metric Value */}
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  {card.label}
                </p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5 truncate">
                  {card.value}
                </p>
              </div>

              {/* Card Bottom: Context & Link affordance */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate pr-1">{card.sublabel}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DashboardDataSummarySection;
