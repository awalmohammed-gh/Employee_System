import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useEffect, useState, useMemo } from "react";
import {
  Calendar,
  FileText,
  Eye,
  Download,
  Lock,
  RefreshCw,
  CheckCircle2,
  Filter,
  Table,
  LayoutGrid,
} from "lucide-react";
import EmployeePayslipsModal from "../../components/modal/EmployeePayslipsModal";
import EmployeePayrollHistory from "../../components/EmployeePayrollHistory";
import { useManagement } from "../../context/ManagementContextProvider";
import { getEmployeePayslip } from "../../apis/fontApis";
import { downloadPayslipPDF, printPayslipDocument } from "../../utils/payslipPdfGenerator";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import { ui, tones, selectChevronStyle } from "./ui/tokens";
import { Badge, Card, EmptyState, Tabs } from "./ui/primitives";

const EmployeePayslips = () => {
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [employeePayslips, setEmployeePayslips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(null);
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"

  const { setShowToast } = useManagement();

  const fetchEmployeePayslips = async () => {
    try {
      setIsLoading(true);
      setIsError(null);
      const { data } = await getEmployeePayslip();

      if (data.success) {
        let payslips = [];
        if (Array.isArray(data.payslips)) {
          payslips = data.payslips;
        } else if (data.payslips && typeof data.payslips === "object") {
          payslips = [data.payslips];
        } else {
          payslips = [];
        }
        // Strict client-side filter: Only released / published / paid payslips are accessible
        const releasedPayslips = payslips.filter((p) => {
          const s = (p.status || "").toLowerCase();
          return s === "paid" || s === "published";
        });
        setEmployeePayslips(releasedPayslips);
      } else {
        setIsError(data.message || "Failed to fetch payslips.");
        setShowToast({
          show: true,
          message: data.message || "Failed to fetch payslips.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error fetching payslips:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch payslips.";
      setIsError(errorMessage);
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeePayslips();
  }, []);

  const formatCurrency = (amount) => {
    return (
      (Number(amount) || 0).toLocaleString("en-GH", {
        style: "currency",
        currency: "GHS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const statusToneFor = (status) => {
    const s = (status || "Paid").toLowerCase();
    return s === "paid" || s === "published" ? "success" : "neutral";
  };

  const handleDownloadPDF = (payslip) => {
    try {
      downloadPayslipPDF(payslip);
      setShowToast({
        show: true,
        message: `Official PDF payslip downloaded for ${payslip.payMonth || payslip.month || "pay period"}.`,
        type: "success",
      });
    } catch (err) {
      console.error("Error downloading PDF:", err);
      printPayslipDocument(payslip);
    }
  };

  const handlePrint = (payslip) => {
    printPayslipDocument(payslip);
  };

  // Compute dynamic list of years present in payslips, default to recent years
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    const currentYear = new Date().getFullYear().toString();
    yearsSet.add(currentYear);
    yearsSet.add((Number(currentYear) - 1).toString());

    employeePayslips.forEach((slip) => {
      const monthVal = slip.month || slip.payMonth || "";
      if (monthVal) {
        const yearPart = monthVal.split("-")[0];
        if (yearPart && yearPart.length === 4) {
          yearsSet.add(yearPart);
        }
      }
      if (slip.paymentDate) {
        try {
          const y = new Date(slip.paymentDate).getFullYear().toString();
          yearsSet.add(y);
        } catch {
          // ignore
        }
      }
    });

    return Array.from(yearsSet).sort().reverse();
  }, [employeePayslips]);

  const filteredPayslips = useMemo(() => {
    return employeePayslips.filter((slip) => {
      const monthStr = slip.month || slip.payMonth || "";
      let slipYear = "";
      let slipMonth = "";

      if (monthStr && monthStr.includes("-")) {
        const parts = monthStr.split("-");
        slipYear = parts[0];
        slipMonth = parts[1]?.padStart(2, "0");
      } else if (slip.paymentDate) {
        try {
          const d = new Date(slip.paymentDate);
          slipYear = d.getFullYear().toString();
          slipMonth = String(d.getMonth() + 1).padStart(2, "0");
        } catch {
          // pass
        }
      }

      const matchesYear = selectedYear === "all" || !slipYear || slipYear === selectedYear;
      const matchesMonth = selectedMonth === "all" || !slipMonth || slipMonth === selectedMonth;
      return matchesYear && matchesMonth;
    });
  }, [employeePayslips, selectedYear, selectedMonth]);

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchEmployeePayslips}
        onClose={() => setIsError(null)}
      />
    );
  }

  const MONTHS = [
    ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"], ["05", "May"], ["06", "June"],
    ["07", "July"], ["08", "August"], ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
  ];

  return (
    <>
      <div className={ui.page}>
        <div className={`${ui.card} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <Tabs
            tabs={[
              { value: "table", label: "Table view", icon: Table },
              { value: "cards", label: "Card view", icon: LayoutGrid },
            ]}
            value={viewMode}
            onChange={setViewMode}
            ariaLabel="Payslip view"
          />
          <div className="flex items-center gap-2">
            <Badge tone="brand" className="h-10! px-3! rounded-xl! text-xs!">
              {filteredPayslips.length} released payslip{filteredPayslips.length !== 1 ? "s" : ""}
            </Badge>
            <button type="button" onClick={fetchEmployeePayslips} disabled={isLoading} className={ui.btnSecondary}>
              {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>
        </div>

        {viewMode === "table" ? (
          <EmployeePayrollHistory initialPayslips={employeePayslips.length > 0 ? employeePayslips : null} />
        ) : (
          <>
            <Card id="payslip-monthly-filter-bar" padded={false} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                Billing cycle
              </p>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <select
                  id="payslip-filter-year-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Year"
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
                  id="payslip-filter-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  aria-label="Month"
                  className={`${ui.select} sm:w-40`}
                  style={selectChevronStyle}
                >
                  <option value="all">All months</option>
                  {MONTHS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                {(selectedYear !== "all" || selectedMonth !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear("all");
                      setSelectedMonth("all");
                    }}
                    className={`${ui.btnGhost} col-span-2 sm:col-span-1`}
                  >
                    Reset filter
                  </button>
                )}
              </div>
            </Card>

            {filteredPayslips.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredPayslips.map((payslip, index) => {
                  const cardBaseSalary = Number(
                    payslip.breakdown?.baseSalary !== undefined
                      ? payslip.breakdown.baseSalary
                      : payslip.baseSalary !== undefined
                      ? payslip.baseSalary
                      : payslip.basicSalary || 0
                  );

                  const cardAllowances = Number(
                    payslip.breakdown?.totalAllowances !== undefined
                      ? payslip.breakdown.totalAllowances
                      : Array.isArray(payslip.earnings)
                      ? payslip.earnings.reduce((s, i) => s + Number(i.amount || 0), 0)
                      : Number(payslip.allowances || 0)
                  );

                  const cardAbsence = payslip.breakdown?.absenceDeduction || payslip.absenceDeduction || {};
                  const cardAbsenceAmount = Number(
                    cardAbsence.totalAmount !== undefined
                      ? cardAbsence.totalAmount
                      : Number(payslip.absentDaysDeduction || 0)
                  );

                  const cardLateness = payslip.breakdown?.latenessDeduction || payslip.latenessDeduction || {};
                  const cardLatenessAmount = Number(
                    cardLateness.totalAmount !== undefined
                      ? cardLateness.totalAmount
                      : (typeof payslip.latenessDeduction === "number" ? payslip.latenessDeduction : 0)
                  );

                  const cardCustomDeductions = Number(
                    payslip.breakdown?.totalCustomDeductions !== undefined
                      ? payslip.breakdown.totalCustomDeductions
                      : Array.isArray(payslip.deductions)
                      ? payslip.deductions.reduce((s, i) => s + Number(i.amount || 0), 0)
                      : Number(payslip.deductions || 0)
                  );

                  const cardTotalDeductions = Number(
                    payslip.breakdown?.totalDeductions !== undefined
                      ? payslip.breakdown.totalDeductions
                      : (cardCustomDeductions + cardAbsenceAmount + cardLatenessAmount)
                  );

                  const cardNetSalary = Number(
                    payslip.netSalary !== undefined && payslip.netSalary !== null
                      ? payslip.netSalary
                      : payslip.netPay !== undefined && payslip.netPay !== null
                      ? payslip.netPay
                      : payslip.breakdown?.netSalary !== undefined
                      ? payslip.breakdown.netSalary
                      : (cardBaseSalary + cardAllowances - cardTotalDeductions)
                  );

                  const chip = "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium";

                  return (
                    <Card
                      as="article"
                      interactive
                      key={payslip.id || payslip._id || payslip.payslipNumber || index}
                      className="flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${tones.brand.icon}`}>
                            <FileText className="w-5 h-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                              {payslip.month || payslip.payMonth || "Monthly Payslip"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                              {payslip.payslipNumber || payslip.id || "N/A"}
                            </p>
                          </div>
                        </div>
                        <Badge tone={statusToneFor(payslip.status)}>{payslip.status || "Paid"}</Badge>
                      </div>

                      <div className="mt-5 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Net take-home</p>
                          <p className="text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(cardNetSalary)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-right">
                          <Calendar className="w-3.5 h-3.5" />
                          Paid {formatDate(payslip.paymentDate)}
                        </p>
                      </div>

                      <dl className={`${ui.subtle} mt-4 grid grid-cols-3 gap-3 p-3.5`}>
                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">Base salary</dt>
                          <dd className="text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(cardBaseSalary)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">Allowances</dt>
                          <dd className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatCurrency(cardAllowances)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">Deductions</dt>
                          <dd className="text-[13px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">-{formatCurrency(cardTotalDeductions)}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {cardAbsenceAmount > 0 && (
                          <span className={`${chip} bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20`}>
                            Absenteeism ({cardAbsence.daysCount || payslip.absentDays || 1} unexcused day(s) @ {formatCurrency(cardAbsence.ratePerDay || 10)}):
                            <strong>-{formatCurrency(cardAbsenceAmount)}</strong>
                          </span>
                        )}
                        {cardLatenessAmount > 0 && (
                          <span className={`${chip} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20`}>
                            Lateness ({cardLateness.lateDaysCount || 1} day(s), {cardLateness.totalLateMinutes || 0} min(s)):
                            <strong>-{formatCurrency(cardLatenessAmount)}</strong>
                          </span>
                        )}
                        {cardAbsenceAmount === 0 && cardLatenessAmount === 0 && (
                          <span className={`${chip} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            100% attendance (zero penalties)
                          </span>
                        )}
                        {Array.isArray(payslip.breakdown?.allowances) &&
                          payslip.breakdown.allowances.map((item, idx) => (
                            <span
                              key={`earn-${idx}`}
                              className={`${chip} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20`}
                            >
                              {item.title} <strong>+{formatCurrency(item.amount)}</strong>
                            </span>
                          ))}
                        {Array.isArray(payslip.breakdown?.customDeductions) &&
                          payslip.breakdown.customDeductions.map((item, idx) => (
                            <span
                              key={`ded-${idx}`}
                              className={`${chip} bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20`}
                            >
                              {item.title} <strong>-{formatCurrency(item.amount)}</strong>
                            </span>
                          ))}
                      </div>

                      <div className="mt-auto pt-5 flex flex-wrap justify-end gap-2">
                        <button type="button" onClick={() => setSelectedPayslip(payslip)} className={`${ui.btnSecondary} ${ui.btnSm}`}>
                          <Eye className="h-3.5 w-3.5" />
                          View breakdown
                        </button>
                        <button type="button" onClick={() => handlePrint(payslip)} className={`${ui.btnSecondary} ${ui.btnSm}`}>
                          <FileText className="h-3.5 w-3.5" />
                          Print
                        </button>
                        <button type="button" onClick={() => handleDownloadPDF(payslip)} className={`${ui.btnPrimary} ${ui.btnSm}`}>
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card id="locked-payslip-banner" className="border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5">
                <EmptyState
                  icon={Lock}
                  title="No published payslip for this period. Payslips are released by Management upon payment."
                  description="Your official payslip for this period has not been released yet. Once generated and verified by management upon payment, your complete itemized breakdown and downloadable official PDF will be unlocked here."
                  action={<Badge tone="warning">Official payslip pending release</Badge>}
                  className="py-10"
                />
              </Card>
            )}
          </>
        )}
      </div>

      {selectedPayslip && (
        <EmployeePayslipsModal
          payslip={selectedPayslip}
          allPayslips={employeePayslips}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </>
  );
};

export default EmployeePayslips;
