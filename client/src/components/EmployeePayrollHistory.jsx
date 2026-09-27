import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Banknote,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { getEmployeePayslip } from "../apis/fontApis";
import { downloadPayslipPDF } from "../utils/payslipPdfGenerator";
import EmployeePayslipsModal from "./modal/EmployeePayslipsModal";
import { useManagement } from "../context/ManagementContextProvider";
import { ui, selectChevronStyle } from "../pages/Employees/ui/tokens";
import { Badge, Card, CardHeader, EmptyState, StatCard } from "../pages/Employees/ui/primitives";

const RowActions = ({ slip, isDownloading, onView, onDownload, stretch = false }) => (
  <div className={`flex items-center gap-1.5 ${stretch ? "w-full" : "justify-end"}`}>
    <button
      type="button"
      onClick={() => onView(slip)}
      className={`${ui.btnSecondary} ${ui.btnSm} ${stretch ? "flex-1" : ""}`}
      title="View itemized breakdown"
    >
      <Eye className="w-3.5 h-3.5" />
      View
    </button>
    <button
      type="button"
      onClick={() => onDownload(slip)}
      disabled={isDownloading}
      className={`${ui.btnGhost} ${ui.btnSm} ${stretch ? "flex-1 border border-slate-200 dark:border-slate-700" : ""}`}
      title="Download official PDF"
    >
      {(isDownloading) ? <WorkspaceLoader inline /> : <Download className="w-4 h-4" />}
      {isDownloading ? "Generating..." : "PDF"}
    </button>
  </div>
);

export const EmployeePayrollHistory = ({
  initialPayslips = null,
  title = "Payroll History & Pay Stubs",
  subtitle = "View and download historical pay stubs and verified salary disbursement records",
  showSummaryMetrics = true,
  maxDisplay = null,
}) => {
  const [payslips, setPayslips] = useState(initialPayslips || []);
  const [isLoading, setIsLoading] = useState(!initialPayslips);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { setShowToast } = useManagement();

  // Helper to format currency in Ghana Cedis
  const formatGHS = (val) => {
    const num = Number(val) || 0;
    return `GH₵${num.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper to format date strings
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Fetch payslips from API
  const fetchPayslips = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const res = await getEmployeePayslip();
      const data = res?.data;

      if (data?.success || Array.isArray(data?.payslips)) {
        let list = [];
        if (Array.isArray(data?.payslips)) {
          list = data.payslips;
        } else if (data?.payslips && typeof data.payslips === "object") {
          list = [data.payslips];
        }

        // Release/Payment filter: allow released or published/paid records, or all if available
        setPayslips(list);
      } else {
        const msg = data?.message || "Failed to load payroll history.";
        if (!isSilent) setError(msg);
      }
    } catch (err) {
      console.error("Error fetching payroll history:", err);
      const msg = err.response?.data?.message || err.message || "Failed to load payroll history.";
      if (!isSilent) setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialPayslips) {
      fetchPayslips();
    } else {
      setPayslips(initialPayslips);
    }
  }, [fetchPayslips, initialPayslips]);

  // Extract available years for dropdown
  const availableYears = useMemo(() => {
    const years = new Set();
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);

    payslips.forEach((p) => {
      const monthStr = p.payMonth || p.month || "";
      if (monthStr && monthStr.includes("-")) {
        const y = monthStr.split("-")[0];
        if (y && y.length === 4) years.add(y);
      }
      if (p.paymentDate) {
        try {
          const y = new Date(p.paymentDate).getFullYear().toString();
          if (y && y.length === 4) years.add(y);
        } catch {
          // ignore
        }
      }
      if (p.payrollPeriod?.year) {
        years.add(String(p.payrollPeriod.year));
      }
    });

    return Array.from(years).sort().reverse();
  }, [payslips]);

  // Normalize payslip for calculations and display
  const getNormalizedDetails = (slip) => {
    const period = slip.payMonth || slip.month || (slip.payrollPeriod ? `${slip.payrollPeriod.month} ${slip.payrollPeriod.year}` : "Pay Period");
    const refId = slip.payslipNumber || (slip._id ? `PAY-${String(slip._id).slice(-6).toUpperCase()}` : (slip.id ? `PAY-${String(slip.id).slice(-6).toUpperCase()}` : "PAY-REF"));
    const dateIssued = slip.paymentDate || slip.createdAt;

    const baseSalary = Number(
      slip.breakdown?.baseSalary !== undefined
        ? slip.breakdown.baseSalary
        : slip.baseSalary !== undefined
        ? slip.baseSalary
        : slip.basicSalary || 0
    );

    const allowances = Number(
      slip.breakdown?.totalAllowances !== undefined
        ? slip.breakdown.totalAllowances
        : Array.isArray(slip.earnings)
        ? slip.earnings.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : Number(slip.allowances || 0)
    );

    const lateness = Number(
      slip.breakdown?.latenessDeduction?.totalAmount !== undefined
        ? slip.breakdown.latenessDeduction.totalAmount
        : Number(slip.latenessDeduction || 0)
    );

    const absence = Number(
      slip.breakdown?.absenceDeduction?.totalAmount !== undefined
        ? slip.breakdown.absenceDeduction.totalAmount
        : Number(slip.absentDaysDeduction || 0)
    );

    const customDeductions = Number(
      slip.breakdown?.totalCustomDeductions !== undefined
        ? slip.breakdown.totalCustomDeductions
        : Array.isArray(slip.deductions)
        ? slip.deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : Number(slip.deductions || 0)
    );

    const totalDeductions = Number(
      slip.breakdown?.totalDeductions !== undefined
        ? slip.breakdown.totalDeductions
        : (customDeductions + absence + lateness)
    );

    const netPay = Number(
      slip.netSalary !== undefined && slip.netSalary !== null
        ? slip.netSalary
        : slip.netPay !== undefined && slip.netPay !== null
        ? slip.netPay
        : slip.breakdown?.netSalary !== undefined
        ? slip.breakdown.netSalary
        : (baseSalary + allowances - totalDeductions)
    );

    const status = String(slip.status || "Paid");

    return {
      period,
      refId,
      dateIssued,
      baseSalary,
      allowances,
      lateness,
      absence,
      customDeductions,
      totalDeductions,
      netPay,
      status,
    };
  };

  // Filtered payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter((slip) => {
      const details = getNormalizedDetails(slip);
      const search = searchTerm.toLowerCase().trim();

      // Search term matching
      const matchesSearch =
        !search ||
        details.period.toLowerCase().includes(search) ||
        details.refId.toLowerCase().includes(search) ||
        details.status.toLowerCase().includes(search) ||
        String(details.netPay).includes(search);

      // Year filter
      let slipYear = "";
      if (slip.payMonth && slip.payMonth.includes("-")) {
        slipYear = slip.payMonth.split("-")[0];
      } else if (slip.payrollPeriod?.year) {
        slipYear = String(slip.payrollPeriod.year);
      } else if (slip.paymentDate) {
        try {
          slipYear = new Date(slip.paymentDate).getFullYear().toString();
        } catch {
          // ignore
        }
      }
      const matchesYear = selectedYear === "all" || !slipYear || slipYear === selectedYear;

      // Status filter
      const matchesStatus =
        selectedStatus === "all" ||
        details.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesYear && matchesStatus;
    });
  }, [payslips, searchTerm, selectedYear, selectedStatus]);

  const displayList = maxDisplay ? filteredPayslips.slice(0, maxDisplay) : filteredPayslips;

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalTakeHome = 0;
    let totalDeductions = 0;
    let count = 0;

    payslips.forEach((slip) => {
      const d = getNormalizedDetails(slip);
      totalTakeHome += d.netPay;
      totalDeductions += d.totalDeductions;
      count += 1;
    });

    const averageNet = count > 0 ? totalTakeHome / count : 0;
    const latestPeriod = payslips.length > 0 ? getNormalizedDetails(payslips[0]).period : "None";

    return {
      totalCount: count,
      totalTakeHome,
      totalDeductions,
      averageNet,
      latestPeriod,
    };
  }, [payslips]);

  // Handle direct PDF Download
  const handleDownload = async (slip) => {
    const slipId = slip._id || slip.id || slip.payslipNumber;
    try {
      setDownloadingId(slipId);
      await downloadPayslipPDF(slip);
      if (setShowToast) {
        setShowToast({
          show: true,
          message: `Official pay stub PDF downloaded successfully!`,
          type: "success",
        });
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      if (setShowToast) {
        setShowToast({
          show: true,
          message: "Failed to generate pay stub PDF.",
          type: "error",
        });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const statusToneFor = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid" || s === "published") return "success";
    if (s === "pending" || s === "draft") return "warning";
    return "neutral";
  };

  const hasFilters = searchTerm || selectedYear !== "all" || selectedStatus !== "all";

  return (
    <div id="employee-payroll-history-section" className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader
          icon={Banknote}
          title={title}
          description={subtitle}
          action={
            <>
              <Badge tone="brand">
                {payslips.length} pay stub{payslips.length !== 1 ? "s" : ""}
              </Badge>
              <button
                type="button"
                onClick={() => fetchPayslips(true)}
                disabled={isLoading || isRefreshing}
                className={ui.btnSecondary}
                title="Refresh pay stubs"
              >
                {(isRefreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
                <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
              </button>
            </>
          }
        />
      </Card>

      {/* Summary metrics */}
      {showSummaryMetrics && (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Historical pay stubs"
            value={metrics.totalCount}
            hint={`Latest: ${metrics.latestPeriod}`}
            icon={FileText}
            tone="brand"
          />
          <StatCard
            label="Total net take-home"
            value={<span className="text-emerald-600 dark:text-emerald-400">{formatGHS(metrics.totalTakeHome)}</span>}
            hint="Disbursed to bank / mobile wallet"
            icon={Banknote}
            tone="success"
          />
          <StatCard
            label="Average net pay"
            value={formatGHS(metrics.averageNet)}
            hint="Per finalized billing cycle"
            icon={TrendingUp}
            tone="info"
          />
          <StatCard
            label="Total deductions"
            value={<span className="text-amber-600 dark:text-amber-400">{formatGHS(metrics.totalDeductions)}</span>}
            hint="Taxes, lateness & deductions"
            icon={ShieldCheck}
            tone="warning"
          />
        </div>
      )}

      {/* Records */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pay period, reference number, or amount..."
              aria-label="Search pay stubs"
              className={`${ui.input} pl-9`}
            />
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Filter by year"
              className={`${ui.select} sm:w-36`}
              style={selectChevronStyle}
            >
              <option value="all">All years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by status"
              className={`${ui.select} sm:w-40`}
              style={selectChevronStyle}
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedYear("all");
                  setSelectedStatus("all");
                }}
                className={`${ui.btnGhost} col-span-2 sm:col-span-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10`}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <WorkspaceLoader compact title="" />
            <p className={ui.muted}>Retrieving historical pay stubs...</p>
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title={error}
            action={
              <button type="button" onClick={() => fetchPayslips()} className={ui.btnPrimary}>
                Retry loading
              </button>
            }
          />
        ) : displayList.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No historical pay stubs found"
            description={
              hasFilters
                ? "No records matched your search filters. Try adjusting your year or status selection."
                : "Official payslips will appear here as soon as management completes and authorizes monthly payroll disbursement."
            }
          />
        ) : (
          <>
            {/* Phones & small tablets: cards */}
            <ul className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {displayList.map((slip, index) => {
                const item = getNormalizedDetails(slip);
                const isDownloading = downloadingId === (slip._id || slip.id || slip.payslipNumber);
                return (
                  <li key={slip._id || slip.id || slip.payslipNumber || index} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.period}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {item.refId} · {formatDate(item.dateIssued)}
                        </p>
                      </div>
                      <Badge tone={statusToneFor(item.status)}>{item.status}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Base</p>
                        <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{formatGHS(item.baseSalary)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Deductions</p>
                        <p className="font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                          {item.totalDeductions > 0 ? `-${formatGHS(item.totalDeductions)}` : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 dark:text-slate-400">Net pay</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatGHS(item.netPay)}</p>
                      </div>
                    </div>
                    <RowActions slip={slip} isDownloading={isDownloading} onView={setSelectedPayslip} onDownload={handleDownload} stretch />
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className={`hidden lg:block ${ui.tableWrap}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.th}>Pay period</th>
                    <th className={ui.th}>Reference</th>
                    <th className={ui.th}>Payment date</th>
                    <th className={`${ui.th} text-right`}>Base salary</th>
                    <th className={`${ui.th} text-right`}>Allowances</th>
                    <th className={`${ui.th} text-right`}>Deductions</th>
                    <th className={`${ui.th} text-right`}>Net take-home</th>
                    <th className={ui.th}>Status</th>
                    <th className={`${ui.th} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((slip, index) => {
                    const item = getNormalizedDetails(slip);
                    const slipKey = slip._id || slip.id || slip.payslipNumber || index;
                    const isDownloading = downloadingId === (slip._id || slip.id || slip.payslipNumber);
                    return (
                      <tr key={slipKey} className={ui.tr}>
                        <td className={`${ui.td} font-semibold text-slate-900 dark:text-white whitespace-nowrap`}>{item.period}</td>
                        <td className={ui.td}>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.refId}
                          </span>
                        </td>
                        <td className={`${ui.td} whitespace-nowrap text-slate-500 dark:text-slate-400`}>{formatDate(item.dateIssued)}</td>
                        <td className={`${ui.td} text-right tabular-nums`}>{formatGHS(item.baseSalary)}</td>
                        <td className={`${ui.td} text-right tabular-nums text-emerald-600 dark:text-emerald-400`}>
                          {item.allowances > 0 ? `+${formatGHS(item.allowances)}` : "—"}
                        </td>
                        <td className={`${ui.td} text-right tabular-nums text-rose-600 dark:text-rose-400`}>
                          {item.totalDeductions > 0 ? `-${formatGHS(item.totalDeductions)}` : "—"}
                        </td>
                        <td className={`${ui.td} text-right`}>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatGHS(item.netPay)}</span>
                        </td>
                        <td className={ui.td}>
                          <Badge tone={statusToneFor(item.status)}>
                            <CheckCircle2 className="w-3 h-3" />
                            {item.status}
                          </Badge>
                        </td>
                        <td className={`${ui.td} text-right`}>
                          <RowActions slip={slip} isDownloading={isDownloading} onView={setSelectedPayslip} onDownload={handleDownload} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {selectedPayslip && (
        <EmployeePayslipsModal
          payslip={selectedPayslip}
          allPayslips={payslips}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </div>
  );
};

export default EmployeePayrollHistory;
