import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Building2, Calendar, Clock, FileText, Eye, Calculator, Banknote, BanknoteIcon, Download, Printer, RefreshCw, Trash2, CheckCircle2, MoreVertical, AlertTriangle, CheckSquare, Square, FileDown, Files } from "lucide-react";
import { ui } from "./ui/tokens";
import { Badge } from "./ui/primitives";

import { useManagement } from "../../context/ManagementContextProvider";
import PayslipsModal from "../../components/modal/PayslipsModal";
import PayrollDetailsModal from "../../components/modal/PayrollDetailsModal";
import PayrollSummaryCalculator from "../../components/PayrollSummaryCalculator";
import MonthlyPayrollRunTable from "../../components/MonthlyPayrollRunTable";
import PayrollCycleHistory from "../../components/PayrollCycleHistory";
import PenaltyPayrollImpactChart from "../../components/PenaltyPayrollImpactChart";
import PayrollForecastingTool from "../../components/PayrollForecastingTool";
import GlobalDateRangePicker from "../../components/GlobalDateRangePicker";
import { getAllPayslips, updatePayrollStatus, deletePayroll, getAdminPayrollSummary, namesList } from "../../apis/fontApis";
import { downloadPayslipPDF, downloadBulkPayslipsPDF } from "../../utils/payslipPdfGenerator";
import ExportPayrollReportButton from "../../components/ExportPayrollReportButton";
import {
  List,
  History,
  TrendingDown,
} from "lucide-react";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";

const Payslips = () => {
  const navigate = useNavigate();
  const [activeViewTab, setActiveViewTab] = useState("records"); // "records" | "calculator"
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All Months");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState("all");
  const { showPayslipsModal, setShowPayslipsModal, setShowToast } = useManagement();
  const [payslips, setPayslips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Details Modal State
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active Employees count from DB
  const [activeEmployeesCount, setActiveEmployeesCount] = useState(0);

  // Dynamic Aggregation KPI Summary State from Backend
  const [payrollSummary, setPayrollSummary] = useState({
    totalEmployees: 0,
    totalPaidOut: 0,
    pendingApprovals: 0,
    taxesAndDeductions: 0,
  });

  // Action Menu Dropdown State for rows
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Bulk selection and PDF generation state
  const [selectedPayIds, setSelectedPayIds] = useState(new Set());
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState(null);

  // Get current month and year
  const getCurrentMonth = () => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const currentDate = new Date();
    return months[currentDate.getMonth()];
  };

  const getCurrentYear = () => {
    return new Date().getFullYear();
  };

  const allMonths = [
    "All Months",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();

  const fetchPayslips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data } = await getAllPayslips();
      if (data.success) {
        setPayslips(data.list || data.records || data.payslips || []);
      } else {
        setError(data.message || "Failed to fetch payroll records.");
        setShowToast({
          message: data.message,
          show: true,
          type: "error",
        });
      }
    } catch (error) {
      console.error(error);
      setError(error.message || "An error occurred while fetching payroll.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveStaffSummary = async (monthToFilter = filterMonth) => {
    try {
      const params = {};
      if (monthToFilter && monthToFilter !== "All Months" && monthToFilter !== "All" && monthToFilter !== "all") {
        params.month = monthToFilter;
      }
      const { data: summaryData } = await getAdminPayrollSummary(params);
      if (summaryData?.success || summaryData?.totalPaidOut !== undefined) {
        setPayrollSummary({
          totalEmployees: Number(summaryData.totalEmployees || 0),
          totalPaidOut: Number(summaryData.totalPaidOut !== undefined ? summaryData.totalPaidOut : (summaryData.totalPayrollDisbursed || 0)),
          pendingApprovals: Number(summaryData.pendingApprovals !== undefined ? summaryData.pendingApprovals : (summaryData.pendingDisbursements || 0)),
          taxesAndDeductions: Number(summaryData.taxesAndDeductions !== undefined ? summaryData.taxesAndDeductions : 0),
        });
        if (summaryData.totalEmployees) {
          setActiveEmployeesCount(Number(summaryData.totalEmployees));
        }
      }

      if (!summaryData?.totalEmployees) {
        const { data: namesData } = await namesList();
        if (namesData?.success && Array.isArray(namesData?.employees)) {
          setActiveEmployeesCount(namesData.employees.length);
        }
      }
    } catch (err) {
      console.warn("Could not fetch active employees summary:", err);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  useEffect(() => {
    fetchActiveStaffSummary(filterMonth);
  }, [filterMonth]);

  // Filter Data
  const filteredData = payslips.filter((pay) => {
    const employeeName = pay?.employee?.fullName || pay?.employeeName || "";
    const department = pay?.employee?.department || pay?.department || "";
    const employeeId = pay?.employee?.employeeId || pay?.employeeId || "";
    const month = pay?.payMonth || pay?.month || "";
    const status = pay?.status || "";

    const matchesSearch =
      employeeName.toLowerCase().includes(search.toLowerCase()) ||
      department.toLowerCase().includes(search.toLowerCase()) ||
      employeeId.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus === "All" || status === filterStatus;

    let payMonth = month;
    if (!payMonth && pay?.paymentDate) {
      try {
        const date = new Date(pay.paymentDate);
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        payMonth = months[date.getMonth()];
      } catch {
        payMonth = "";
      }
    }

    const matchesMonth =
      filterMonth === "All Months" || (payMonth && payMonth.toLowerCase().includes(filterMonth.toLowerCase()));

    // Global Date Range Filtering
    let matchesDateRange = true;
    if (startDateFilter || endDateFilter) {
      let recordDateStr = "";
      if (pay?.paymentDate) {
        recordDateStr = new Date(pay.paymentDate).toISOString().split("T")[0];
      } else if (pay?.createdAt) {
        recordDateStr = new Date(pay.createdAt).toISOString().split("T")[0];
      } else if (pay?.date) {
        recordDateStr = new Date(pay.date).toISOString().split("T")[0];
      }

      if (recordDateStr) {
        if (startDateFilter && recordDateStr < startDateFilter) {
          matchesDateRange = false;
        }
        if (endDateFilter && recordDateStr > endDateFilter) {
          matchesDateRange = false;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesMonth && matchesDateRange;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return "bg-[#16A34A] text-white";
      case "Pending":
        return "bg-[#F59E0B] text-white";
      case "Failed":
        return "bg-[#DC2626] text-white";
      default:
        return "bg-[#64748B] text-white";
    }
  };

  const statusOptions = ["All", "Paid", "Pending", "Failed"];

  // Calculate summary stats
  const totalEmployees = filteredData.length;
  const totalPaid = filteredData
    .filter((pay) => pay?.status === "Paid")
    .reduce((sum, pay) => sum + (Number(pay?.netSalary) || 0), 0);
  const totalPending = filteredData
    .filter((pay) => pay?.status === "Pending")
    .reduce((sum, pay) => sum + (Number(pay?.netSalary) || 0), 0);
  const totalDeductions = filteredData.reduce(
    (sum, pay) => sum + (Number(pay?.deductions) || 0),
    0
  );

  const formatCurrency = (amount) => {
    return (Number(amount) || 0).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const getInitials = (name) => {
    if (!name) return "E";
    return name.charAt(0).toUpperCase();
  };

  // View Details Action Handler
  const handleViewDetails = (payrollItem) => {
    setSelectedPayroll(payrollItem);
    setShowDetailsModal(true);
    setActiveMenuId(null);
  };

  // Quick Status Update
  const handleQuickStatusUpdate = async (item, newStatus) => {
    const targetId = item?._id || item?.id || item?.payslipNumber;
    if (!targetId) return;

    try {
      const res = await updatePayrollStatus(targetId, { status: newStatus });
      if (res.data?.success) {
        setShowToast({
          message: `Status updated to ${newStatus}`,
          type: "success",
          show: true,
        });
        fetchPayslips();
      }
    } catch (err) {
      console.error(err);
      setShowToast({
        message: err.message || "Failed to update status",
        type: "error",
        show: true,
      });
    } finally {
      setActiveMenuId(null);
    }
  };

  // Download PDF Action Handler
  const handleDownloadPDF = async (payrollItem) => {
    try {
      setShowToast({
        message: `Generating official payslip PDF for ${payrollItem?.employee?.fullName || payrollItem?.employeeName || "employee"}...`,
        type: "success",
        show: true,
      });
      await downloadPayslipPDF(payrollItem);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setShowToast({
        message: "Failed to generate PDF. Opening print preview...",
        type: "error",
        show: true,
      });
      navigate(`/print-payslips/${payrollItem?._id || payrollItem?.id || payrollItem?.payslipNumber}`);
    }
  };

  // Toggle selection for all visible rows
  const handleToggleSelectAll = () => {
    if (selectedPayIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedPayIds(new Set());
    } else {
      const allIds = new Set(
        filteredData.map((p, idx) => String(p?._id || p?.id || p?.payslipNumber || `pay-${idx}`))
      );
      setSelectedPayIds(allIds);
    }
  };

  // Toggle selection for a single row
  const handleToggleSelectRow = (payItem, idx) => {
    const id = String(payItem?._id || payItem?.id || payItem?.payslipNumber || `pay-${idx}`);
    setSelectedPayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk Download Pay Stubs Action (uses html2canvas + jsPDF)
  const handleBulkDownloadPDF = async (onlySelected = false) => {
    const targetItems = onlySelected
      ? filteredData.filter((p, idx) => {
          const id = String(p?._id || p?.id || p?.payslipNumber || `pay-${idx}`);
          return selectedPayIds.has(id);
        })
      : filteredData;

    if (targetItems.length === 0) {
      setShowToast({
        message: "No payroll records selected for bulk PDF download.",
        type: "error",
        show: true,
      });
      return;
    }

    try {
      setIsBulkExporting(true);
      setBulkExportProgress({
        current: 1,
        total: targetItems.length,
        percentage: 0,
        employeeName: "Initializing...",
      });

      setShowToast({
        message: `Compiling ${targetItems.length} official pay stubs using html2canvas & jsPDF...`,
        type: "success",
        show: true,
      });

      const result = await downloadBulkPayslipsPDF(targetItems, {
        onProgress: (p) => setBulkExportProgress(p),
      });

      setShowToast({
        message: `Successfully generated ${result.count} pay stubs into "${result.fileName}"!`,
        type: "success",
        show: true,
      });
    } catch (err) {
      console.error("[Payslips] Bulk PDF export error:", err);
      setShowToast({
        message: err.message || "Failed to generate bulk PDF statements.",
        type: "error",
        show: true,
      });
    } finally {
      setIsBulkExporting(false);
      setBulkExportProgress(null);
    }
  };

  // Delete Trigger Action
  const handleDelete = (item) => {
    setActiveMenuId(null);
    setDeleteConfirmItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const targetId = deleteConfirmItem?._id || deleteConfirmItem?.id || deleteConfirmItem?.payslipNumber;
    if (!targetId) return;

    try {
      setIsDeleting(true);
      const res = await deletePayroll(targetId);
      if (res?.data?.success || res?.status === 200) {
        // Immediately remove from local state
        setPayslips((prev) =>
          prev.filter(
            (item) =>
              String(item._id) !== String(targetId) &&
              String(item.id) !== String(targetId) &&
              item.payslipNumber !== targetId
          )
        );
        setShowToast({
          message: "Payroll record permanently removed from the database.",
          type: "success",
          show: true,
        });
        setDeleteConfirmItem(null);
        fetchPayslips();
      } else {
        throw new Error(res?.data?.message || "Failed to delete payroll record");
      }
    } catch (err) {
      console.error(err);
      setShowToast({
        message: err.response?.data?.message || err.message || "Failed to delete record",
        type: "error",
        show: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && payslips.length === 0) {
    return <Loading />;
  }

  return (
    <div className={`${ui.page} overflow-x-hidden`}>
      {/* Toolbar */}
      <div className={ui.toolbar}>
        <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            <Calendar className="h-3 w-3" />
            {currentMonth} {currentYear}
          </Badge>
          <span>Review payroll, generate payslips, and manage payment records.</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ExportPayrollReportButton
            records={filteredData}
            month={filterMonth !== "All Months" ? filterMonth : "Summary"}
            year={currentYear}
            buttonText="Export Payroll Report"
            onSuccess={(res) => {
              setShowToast({
                message: `Exported ${res.format} report (${res.count} records).`,
                type: "success",
                show: true,
              });
            }}
            onError={(errMsg) => {
              setShowToast({
                message: errMsg,
                type: "error",
                show: true,
              });
            }}
          />
          <button type="button" onClick={() => setShowPayslipsModal(true)} className={ui.btnPrimary}>
            <FileText className="w-4 h-4" />
            <span>Generate payslip</span>
          </button>
        </div>
      </div>

      {/* Global Date-Range Picker for Payroll */}
      <GlobalDateRangePicker
        startDate={startDateFilter}
        endDate={endDateFilter}
        preset={dateRangePreset}
        title="Payroll Cycle & Date Range Filter"
        onRangeChange={({ startDate, endDate, preset }) => {
          setStartDateFilter(startDate);
          setEndDateFilter(endDate);
          setDateRangePreset(preset);
        }}
      />

      {/* Primary View Switcher Tabs */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-[#162033]/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl self-start flex-wrap gap-1">
        <button
          id="tab-btn-monthly-run"
          type="button"
          onClick={() => setActiveViewTab("monthly-run")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "monthly-run"
              ? "bg-[#002185] dark:bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span>Automated Monthly Run</span>
        </button>

        <button
          id="tab-btn-records"
          type="button"
          onClick={() => setActiveViewTab("records")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "records"
              ? "bg-[#002185] dark:bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>Payroll Records ({payslips.length})</span>
        </button>

        <button
          id="tab-btn-cycles"
          type="button"
          onClick={() => setActiveViewTab("cycles")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "cycles"
              ? "bg-[#002185] dark:bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Cycle History</span>
        </button>

        <button
          id="tab-btn-impact"
          type="button"
          onClick={() => setActiveViewTab("impact")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "impact"
              ? "bg-[#002185] dark:bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Penalty Impact Analytics</span>
        </button>

        <button
          id="tab-btn-forecasting"
          type="button"
          onClick={() => setActiveViewTab("forecasting")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "forecasting"
              ? "bg-white dark:bg-[#111927] text-amber-600 dark:text-amber-400 shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Lateness Deduction Forecasting</span>
        </button>

        <button
          id="tab-btn-calculator"
          type="button"
          onClick={() => setActiveViewTab("calculator")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeViewTab === "calculator"
              ? "bg-[#002185] dark:bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Attendance & Salary Calculator</span>
        </button>
      </div>

      {/* Lateness Deduction Forecasting Tool */}
      {activeViewTab === "forecasting" && (
        <div className="animate-in fade-in duration-200">
          <PayrollForecastingTool
            initialMonth={filterMonth !== "All Months" ? filterMonth : undefined}
          />
        </div>
      )}

      {/* Automated Monthly Payroll Run & Calendar Audit */}
      {activeViewTab === "monthly-run" && (
        <div className="animate-in fade-in duration-200">
          <MonthlyPayrollRunTable />
        </div>
      )}

      {/* Dynamic Payroll & Attendance Calculator */}
      {activeViewTab === "calculator" && (
        <div className="animate-in fade-in duration-200">
          <PayrollSummaryCalculator
            onApplyCalculatedValues={(_calculatedData) => {
              setShowPayslipsModal(true);
            }}
          />
        </div>
      )}

      {/* Payroll Cycle History */}
      {activeViewTab === "cycles" && (
        <div className="animate-in fade-in duration-200">
          <PayrollCycleHistory
            onSelectCycle={(cycleMonth) => {
              setFilterMonth(cycleMonth.split(" ")[0]);
              setActiveViewTab("records");
            }}
          />
        </div>
      )}

      {/* Penalty Impact Analytics Dashboard Chart */}
      {activeViewTab === "impact" && (
        <div className="animate-in fade-in duration-200">
          <PenaltyPayrollImpactChart
            startDate={startDateFilter}
            endDate={endDateFilter}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchPayslips}
          onClose={() => setError(null)}
        />
      )}

      {/* Tab: Records Table View */}
      {activeViewTab === "records" && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Total Employees
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(startDateFilter || endDateFilter) ? totalEmployees : (payrollSummary.totalEmployees || activeEmployeesCount || totalEmployees || 0)}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  {(startDateFilter || endDateFilter) ? "Filtered Staff Records" : "Active Staff on Record"}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Total Paid Out
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  GH₵{Number((startDateFilter || endDateFilter) ? totalPaid : (payrollSummary.totalPaidOut !== undefined ? payrollSummary.totalPaidOut : totalPaid)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Disbursed to Staff</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <BanknoteIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Pending Approvals
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  GH₵{Number((startDateFilter || endDateFilter) ? totalPending : (payrollSummary.pendingApprovals !== undefined ? payrollSummary.pendingApprovals : totalPending)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Awaiting Transfer</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Taxes & Deductions
                </p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  GH₵{Number((startDateFilter || endDateFilter) ? totalDeductions : (payrollSummary.taxesAndDeductions !== undefined ? payrollSummary.taxesAndDeductions : totalDeductions)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Absence, Lateness & Deductions</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search Bar & Filters */}
          <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee name, ID, or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#002185]/25 text-slate-900 dark:text-white placeholder-slate-400 transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by Status"
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    Status: {status}
                  </option>
                ))}
              </select>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                aria-label="Filter by Month"
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {allMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchPayslips}
                disabled={isLoading}
                title="Refresh Table Data"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Results Count Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {filteredData.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {payslips.length}
              </span>{" "}
              payroll entries
            </div>
            {filterMonth !== "All Months" && (
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-semibold border border-blue-500/20">
                Month: {filterMonth}
              </span>
            )}
          </div>

          {/* Bulk Pay Stub Export Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300 hover:text-blue-700 cursor-pointer"
              >
                {selectedPayIds.size > 0 && selectedPayIds.size === filteredData.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedPayIds.size > 0
                    ? `${selectedPayIds.size} Selected`
                    : "Select All for Bulk PDF Export"}
                </span>
              </button>

              {selectedPayIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPayIds(new Set())}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer underline ml-1"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Download Selected Stubs */}
              {selectedPayIds.size > 0 && (
                <button
                  type="button"
                  disabled={isBulkExporting}
                  onClick={() => handleBulkDownloadPDF(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Download selected pay stubs into a consolidated PDF using html2canvas & jsPDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Selected ({selectedPayIds.size}) Stubs (PDF)</span>
                </button>
              )}

              {/* Download All Visible Stubs */}
              <button
                type="button"
                disabled={isBulkExporting || filteredData.length === 0}
                onClick={() => handleBulkDownloadPDF(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#162033] border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Download all filtered pay stubs in bulk using html2canvas & jsPDF"
              >
                <Files className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Bulk Download All ({filteredData.length}) Stubs (PDF)</span>
              </button>
            </div>
          </div>

          {/* Main Payroll Table */}
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-2 px-5 py-3.5 bg-slate-50 dark:bg-[#162033]/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[13px] font-medium text-slate-500 dark:text-slate-400 items-center">
              <div className="col-span-1 flex items-center">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-slate-400 hover:text-blue-600 cursor-pointer"
                  title="Select All Rows"
                >
                  {selectedPayIds.size > 0 && selectedPayIds.size === filteredData.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="col-span-3">Employee Details</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-2">Pay Period</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Net Salary</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Main Content Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredData.map((pay, index) => {
                const rowId = String(pay?._id || pay?.id || pay?.payslipNumber || `pay-${index}`);
                const isSelected = selectedPayIds.has(rowId);
                const empName = pay?.employee?.fullName || pay?.employeeName || "Employee";
                const empId = pay?.employee?.employeeId || pay?.employeeId || "EMP001";
                const dept = pay?.employee?.department || pay?.department || "Operations";
                const pos = pay?.employee?.position || pay?.position || "Staff";
                const payMonth = pay?.payMonth || pay?.month || "August 2026";
                const net = Number(pay?.netSalary || 0);
                const isMenuOpen = activeMenuId === (pay?._id || pay?.id || index);

                return (
                  <div
                    key={rowId}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150 ${
                      isSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    {/* Desktop Grid Row */}
                    <div className="hidden lg:grid grid-cols-12 gap-2 items-center px-5 py-3.5">
                      {/* Selection Checkbox */}
                      <div className="col-span-1 flex items-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectRow(pay, index);
                          }}
                          className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5"
                          title="Select for bulk PDF export"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Employee Details */}
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#002185] dark:bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                          {getInitials(empName)}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleViewDetails(pay)}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition text-left cursor-pointer"
                          >
                            {empName}
                          </button>
                          <p className="text-xs text-slate-400 flex items-center gap-2">
                            <span>ID: {empId}</span>
                            <span>•</span>
                            <span>{pos}</span>
                          </p>
                        </div>
                      </div>

                      {/* Department */}
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {dept}
                        </p>
                      </div>

                      {/* Pay Month */}
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {payMonth}
                        </p>
                        <span className="text-[10px] text-slate-400 block">
                          Paid: {formatDate(pay?.paymentDate)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${getStatusColor(
                            pay?.status || "Paid"
                          )}`}
                        >
                          {pay?.status || "Paid"}
                        </span>
                      </div>

                      {/* Net Salary */}
                      <div className="col-span-2 text-right">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {formatCurrency(net)}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Basic: {formatCurrency(pay?.basicSalary)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end gap-1 relative">
                        {/* Eye Icon ("View Details") */}
                        <button
                          id={`btn-view-details-${pay?._id || index}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(pay);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                          title="View Complete Breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Download PDF Icon */}
                        <button
                          id={`btn-download-pdf-${pay?._id || index}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(pay);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                          title="Download PDF Payslip"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Print Icon */}
                        <button
                          id={`btn-print-payslip-${pay?._id || index}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/print-payslips/${pay?._id || pay?.id || pay?.payslipNumber}`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                          title="Print Payslip Document"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Delete Icon */}
                        <button
                          id={`btn-delete-payslip-${pay?._id || index}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(pay);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-all cursor-pointer"
                          title="Delete Payroll Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* More Options Dropdown */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(
                              isMenuOpen ? null : (pay?._id || pay?.id || index)
                            );
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                          title="More Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu Popup */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 w-48 bg-white dark:bg-[#162033] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in duration-150"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(pay);
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              View Full Breakdown
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(pay);
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusUpdate(pay, "Paid");
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 flex items-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark as Paid
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusUpdate(pay, "Pending");
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 flex items-center gap-2 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Mark as Pending
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/print-payslips/${pay?._id || pay?.id || pay?.payslipNumber}`);
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print Payslip View
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(pay);
                              }}
                              className="w-full text-left px-3.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center gap-2 cursor-pointer font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Record
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Card Row */}
                    <div className="lg:hidden p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#002185] dark:bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs">
                            {getInitials(empName)}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(pay);
                              }}
                              className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                            >
                              {empName}
                            </button>
                            <p className="text-xs text-slate-400">
                              {dept} • {empId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(pay);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPDF(pay);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/print-payslips/${pay?._id || pay?.id || pay?.payslipNumber}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(pay);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">{payMonth}</span>
                          <span
                            className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${getStatusColor(
                              pay?.status || "Paid"
                            )}`}
                          >
                            {pay?.status || "Paid"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Net Take-Home</span>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredData.length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#162033] flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No payroll records found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Try adjusting your search keywords, month selection, or generate a new payslip.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPayslipsModal(true)}
                  className="mt-4 px-4 py-2 bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  Generate First Payslip
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal - Generate Payslip */}
      {showPayslipsModal && (
        <PayslipsModal
          onClose={() => setShowPayslipsModal(false)}
          onSuccess={() => {
            fetchPayslips();
            fetchActiveStaffSummary(filterMonth);
          }}
        />
      )}

      {/* Modal - View Full Details (Eye Icon) */}
      {showDetailsModal && selectedPayroll && (
        <PayrollDetailsModal
          payrollId={selectedPayroll?._id || selectedPayroll?.id || selectedPayroll?.payslipNumber}
          initialData={selectedPayroll}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPayroll(null);
          }}
          onRefresh={fetchPayslips}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div
          id="delete-payroll-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isDeleting && setDeleteConfirmItem(null)}
        >
          <div
            id="delete-payroll-modal-container"
            className="bg-white dark:bg-[#111927] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Payroll Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete the payslip for{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {deleteConfirmItem?.employee?.fullName || deleteConfirmItem?.employeeName || "this employee"}
                  </span>{" "}
                  for the period{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {deleteConfirmItem?.payMonth || deleteConfirmItem?.month || "N/A"}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This action is irreversible and will permanently remove this payroll record from the database.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Deleting Record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk PDF Export Progress Modal */}
      {isBulkExporting && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
              <WorkspaceLoader inline />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Generating Bulk Payroll Statements
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Rendering documents with html2canvas and compiling into a consolidated PDF via jsPDF.
              </p>
            </div>

            {bulkExportProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="truncate max-w-[200px]">
                    {bulkExportProgress.employeeName || "Processing..."}
                  </span>
                  <span>
                    {bulkExportProgress.current} / {bulkExportProgress.total} (
                    {bulkExportProgress.percentage || 0}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#162033] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#002185] dark:bg-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${bulkExportProgress.percentage || 5}%` }}
                  ></div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Please do not close this window while statements are being compiled.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payslips;
