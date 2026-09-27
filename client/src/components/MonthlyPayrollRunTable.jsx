import WorkspaceLoader from "./ui/WorkspaceLoader";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, Banknote, Clock, UserX, UserCheck, RefreshCw, Search, AlertCircle, ChevronDown, ChevronUp, Filter, ArrowUpDown, FileSpreadsheet, FileText, Building2, Info, ShieldCheck } from "lucide-react";
import { getMonthlyPayrollRun } from "../apis/fontApis";
import { exportPayrollToPDF } from "../utils/payrollReportExport";

export const MonthlyPayrollRunTable = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0");

  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonthNum}`);
  const [isLoading, setIsLoading] = useState(false);
  const [runData, setRunData] = useState(null);
  const [error, setError] = useState(null);
  
  // Table filters & sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [deductionFilter, setDeductionFilter] = useState("all"); // 'all', 'with-deductions', 'zero-deductions', 'late-only', 'absent-only'
  const [sortField, setSortField] = useState("netTakeHomePay");
  const [sortDirection, setSortDirection] = useState("desc"); // 'asc' or 'desc'
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState(null);
  const [collapseSecondary, setCollapseSecondary] = useState(true);

  const fetchMonthlyRun = useCallback(async (monthStr) => {
    try {
      setIsLoading(true);
      setError(null);
      const targetMonth = monthStr || selectedMonth;
      const res = await getMonthlyPayrollRun({ month: targetMonth });
      if (res.data && res.data.success) {
        setRunData(res.data);
      } else {
        setError(res.data?.message || "Failed to fetch monthly payroll run.");
      }
    } catch (err) {
      console.error("Error loading monthly payroll run:", err);
      setError(err.response?.data?.message || err.message || "Failed to calculate batch payroll run.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchMonthlyRun(selectedMonth);
  }, [selectedMonth, fetchMonthlyRun]);

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const employees = useMemo(() => runData?.employees || [], [runData]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered & Sorted Employees
  const processedEmployees = useMemo(() => {
    let result = [...employees];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (emp) =>
          (emp.fullName || "").toLowerCase().includes(q) ||
          (emp.employeeCode || "").toLowerCase().includes(q) ||
          (emp.department || "").toLowerCase().includes(q) ||
          (emp.email || "").toLowerCase().includes(q) ||
          (emp.position || "").toLowerCase().includes(q)
      );
    }

    // Department filter
    if (departmentFilter !== "all") {
      result = result.filter((emp) => emp.department === departmentFilter);
    }

    // Deduction type filter
    if (deductionFilter === "with-deductions") {
      result = result.filter((emp) => (emp.totalAttendanceDeductions || 0) > 0);
    } else if (deductionFilter === "zero-deductions") {
      result = result.filter((emp) => (emp.totalAttendanceDeductions || 0) === 0);
    } else if (deductionFilter === "late-only") {
      result = result.filter((emp) => (emp.latenessDeductions || 0) > 0);
    } else if (deductionFilter === "absent-only") {
      result = result.filter((emp) => (emp.absenceDeductions || 0) > 0);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal || 0);
      bVal = Number(bVal || 0);
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [employees, searchQuery, departmentFilter, deductionFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Export CSV functionality
  const handleExportCSV = () => {
    if (!processedEmployees.length) return;

    const headers = [
      "Employee ID",
      "Full Name",
      "Department",
      "Position",
      "Base Salary (GHS)",
      "Workdays Elapsed",
      "Attended Days",
      "On Time Days",
      "Late Days",
      "Total Late Minutes",
      "Lateness Deductions (GHS)",
      "Unexcused Absent Days",
      "Absence Deductions (GHS)",
      "Approved Leave Days",
      "Allowances (GHS)",
      "Other Deductions (GHS)",
      "Net Take-Home Pay (GHS)",
    ];

    const rows = processedEmployees.map((emp) => [
      emp.employeeCode || emp.employeeId,
      `"${emp.fullName || ""}"`,
      `"${emp.department || ""}"`,
      `"${emp.position || ""}"`,
      emp.baseSalary?.toFixed(2) || "0.00",
      emp.workdaysElapsed || 0,
      emp.attendedDays || 0,
      emp.onTimeDays || 0,
      emp.lateDays || 0,
      emp.totalLateMinutes || 0,
      emp.latenessDeductions?.toFixed(2) || "0.00",
      emp.absentDays || 0,
      emp.absenceDeductions?.toFixed(2) || "0.00",
      emp.approvedLeaveDays || 0,
      emp.allowances?.toFixed(2) || "0.00",
      emp.otherDeductions?.toFixed(2) || "0.00",
      emp.netTakeHomePay?.toFixed(2) || "0.00",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Monthly_Payroll_Run_${runData?.month || selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Export PDF functionality for accounting
  const handleExportPDF = async () => {
    if (!processedEmployees.length) return;
    try {
      setIsExportingPDF(true);
      const activeMonthStr = runData?.month || selectedMonth;
      await exportPayrollToPDF({
        records: processedEmployees.map((e) => ({
          employeeId: e.employeeCode || e.employeeId,
          employeeName: e.fullName,
          department: e.department,
          position: e.position,
          payMonth: activeMonthStr,
          basicSalary: e.baseSalary,
          allowances: e.allowances,
          deductions: e.totalAttendanceDeductions || ((e.absenceDeductions || 0) + (e.latenessDeductions || 0) + (e.otherDeductions || 0)),
          netSalary: e.netTakeHomePay,
          paymentMethod: e.paymentMethod || "Bank Transfer",
          status: "Processed",
          bankName: e.bankName || "Ghana Commercial Bank",
          accountNumber: e.accountNumber || "N/A",
        })),
        month: activeMonthStr,
        year: currentYear,
        title: `MONTHLY PROCESSED PAYROLL RUN - ${activeMonthStr.toUpperCase()} ${currentYear}`,
      });
    } catch (err) {
      console.error("Failed to export PDF report:", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const monthOptions = [];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  for (let i = 0; i < 12; i++) {
    const mNum = String(i + 1).padStart(2, "0");
    monthOptions.push({
      value: `${currentYear}-${mNum}`,
      label: `${monthNames[i]} ${currentYear}`,
    });
  }

  return (
    <div id="monthly-payroll-run-admin-table" className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Month Selection & KPI Cards */}
      <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0] dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#002185] text-white flex items-center justify-center shadow-xs">
                <Banknote className="w-5 h-5 text-[#ff5500]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#002185] dark:text-blue-400">
                  Monthly Payroll Run Audit & Deductions Table
                </h2>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                  Automated scan of all employees&apos; calendar attendance, lateness penalties, unexcused absence fines, and final net take-home salary.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#162033] px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-slate-700 shadow-xs">
              <Calendar className="w-4 h-4 text-[#002185] dark:text-blue-400" />
              <select
                id="monthly-run-select-period"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#002185] dark:text-blue-300 focus:outline-none cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-slate-800 dark:bg-[#162033] dark:text-slate-100">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="monthly-run-btn-export"
              type="button"
              onClick={handleExportCSV}
              disabled={!processedEmployees.length}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-40"
              title="Export all rows to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              id="monthly-run-btn-export-pdf"
              type="button"
              onClick={handleExportPDF}
              disabled={!processedEmployees.length || isExportingPDF}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-40"
              title="Export official accounting report to PDF"
            >
              {isExportingPDF ? (
                <WorkspaceLoader inline />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>{isExportingPDF ? "Exporting..." : "Export PDF"}</span>
            </button>

            <button
              id="monthly-run-btn-refresh"
              type="button"
              onClick={() => fetchMonthlyRun(selectedMonth)}
              disabled={isLoading}
              className="px-3.5 py-2 bg-[#002185] hover:bg-[#001760] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              <span>Recalculate Run</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#162033]/60 border border-[#E2E8F0] dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Total Net Payroll
              </span>
              <Banknote className="w-4 h-4 text-[#002185] dark:text-blue-400" />
            </div>
            <p className="text-xl font-bold text-[#002185] dark:text-blue-300 mt-1">
              {formatCurrency(runData?.totalPayrollCost)}
            </p>
            <span className="text-[10px] text-[#64748B]">
              Aggregate take-home disbursement
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#162033]/60 border border-[#E2E8F0] dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Contractual Base
              </span>
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {formatCurrency(runData?.totalBaseSalary)}
            </p>
            <span className="text-[10px] text-[#64748B]">
              {runData?.totalEmployees || 0} active employees
            </span>
          </div>

          <div className="p-4 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">
                Lateness Fines
              </span>
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-300 mt-1">
              -{formatCurrency(runData?.totalLatenessDeductions)}
            </p>
            <span className="text-[10px] text-orange-700/80 dark:text-orange-400">
              Tiers 1–6 delay fines deducted
            </span>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                Absence Fines
              </span>
              <UserX className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-300 mt-1">
              -{formatCurrency(runData?.totalAbsenceDeductions)}
            </p>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400">
              GH₵{runData?.companySettings?.absenceDeductionRate || 15}/day unexcused rate
            </span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Workday Audit
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              {runData?.workdaysElapsed || 0} / {runData?.workdaysInMonth || 22} Days
            </p>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
              Mon–Fri calendar workdays
            </span>
          </div>
        </div>
      </div>

      {/* Filtering & Table Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-[#111927] p-4 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="monthly-run-search-input"
            type="text"
            placeholder="Search employee, ID, position, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-[#F8FAFC] dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#002185]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-[#162033] px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-slate-700 text-xs">
            <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              id="monthly-run-dept-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Deduction Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-[#162033] px-3 py-1.5 rounded-xl border border-[#E2E8F0] dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              id="monthly-run-deduction-filter"
              value={deductionFilter}
              onChange={(e) => setDeductionFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Records</option>
              <option value="with-deductions">Has Deductions (&gt; 0)</option>
              <option value="zero-deductions">Zero Deductions (100%)</option>
              <option value="late-only">Has Lateness Fines</option>
              <option value="absent-only">Has Unexcused Absences</option>
            </select>
          </div>

          <span className="text-xs text-[#64748B] ml-auto font-medium">
            Showing <strong className="text-[#002185] dark:text-blue-300">{processedEmployees.length}</strong> of {employees.length}
          </span>
        </div>
      </div>

      {/* Main Administrative Data Table */}
      <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <WorkspaceLoader compact title="" />
            <p className="text-xs font-bold text-[#002185] dark:text-blue-400">
              Running automated MongoDB calendar audit across all business days...
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : processedEmployees.length === 0 ? (
          <div className="p-16 text-center text-[#64748B]">
            <UserX className="w-10 h-10 mx-auto mb-3 text-[#94A3B8]" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No employee payroll records match the current filters.
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Try resetting your search query or department filter.
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile Horizontal Scroll Indicator & Secondary Columns Collapse Toggle */}
            <div className="flex sm:hidden items-center justify-between px-3.5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border-b border-[#E2E8F0] dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 text-[11px] font-medium">
                <ArrowUpDown className="w-3 h-3 rotate-90 text-[#002185] dark:text-blue-400 shrink-0" />
                <span>Swipe table horizontally</span>
              </div>
              <button
                type="button"
                id="btn-toggle-payroll-columns"
                onClick={() => setCollapseSecondary(!collapseSecondary)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#162033] text-[#002185] dark:text-blue-300 border border-blue-200 dark:border-blue-900 shadow-2xs hover:bg-blue-100 cursor-pointer"
              >
                {collapseSecondary ? "Show All Columns" : "Collapse Secondary"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[340px]">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-[#162033]/90 border-b border-[#E2E8F0] dark:border-slate-800 text-[#64748B] dark:text-slate-400 uppercase tracking-wider font-semibold select-none">
                    {/* Employee Info Header (Primary) */}
                    <th
                      className="py-4 px-4 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors"
                      onClick={() => handleSort("fullName")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Employee</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Base Salary Header (Secondary - Collapsible) */}
                    <th
                      className={`py-4 px-3 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors ${
                        collapseSecondary ? "hidden sm:table-cell" : ""
                      }`}
                      onClick={() => handleSort("baseSalary")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Base Salary</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Attendance Days Header (Secondary - Collapsible) */}
                    <th
                      className={`py-4 px-3 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors ${
                        collapseSecondary ? "hidden md:table-cell" : ""
                      }`}
                      onClick={() => handleSort("attendedDays")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Workday Status</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Lateness Penalties Header (Secondary - Collapsible) */}
                    <th
                      className={`py-4 px-3 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors ${
                        collapseSecondary ? "hidden lg:table-cell" : ""
                      }`}
                      onClick={() => handleSort("latenessDeductions")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Lateness Deductions</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Absence Deductions Header (Secondary - Collapsible) */}
                    <th
                      className={`py-4 px-3 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors ${
                        collapseSecondary ? "hidden lg:table-cell" : ""
                      }`}
                      onClick={() => handleSort("absenceDeductions")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Absence Deductions</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Approved Leaves Header (Secondary - Collapsible) */}
                    <th
                      className={`py-4 px-3 ${
                        collapseSecondary ? "hidden xl:table-cell" : ""
                      }`}
                    >
                      <span>Approved Leaves</span>
                    </th>

                    {/* Final Net Take-Home Pay Header (Primary) */}
                    <th
                      className="py-4 px-3 cursor-pointer hover:text-[#002185] dark:hover:text-white transition-colors"
                      onClick={() => handleSort("netTakeHomePay")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Net Take-Home Pay</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>

                    {/* Actions Header (Primary) */}
                    <th className="py-4 px-4 text-right">
                      <span>Daily Audit</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {processedEmployees.map((emp) => {
                    const isExpanded = expandedEmployeeId === emp.employeeId;
                    const totalDeductions = (emp.latenessDeductions || 0) + (emp.absenceDeductions || 0) + (emp.otherDeductions || 0);

                    return (
                      <React.Fragment key={emp.employeeId || emp.employeeCode}>
                        <tr
                          className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors ${
                            isExpanded ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          {/* Employee Details (Primary) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#002185]/10 dark:bg-blue-500/20 text-[#002185] dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                                {emp.fullName?.charAt(0) || "E"}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                  {emp.fullName}
                                  {totalDeductions === 0 && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Perfect attendance" />
                                  )}
                                </p>
                                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                                  <span className="font-mono text-[#002185] dark:text-blue-400 font-semibold">{emp.employeeCode}</span> • {emp.department}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Base Salary (Secondary - Collapsible) */}
                          <td
                            className={`py-3.5 px-3 ${
                              collapseSecondary ? "hidden sm:table-cell" : ""
                            }`}
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(emp.baseSalary)}
                            </span>
                          </td>

                          {/* Workday Attendance (Secondary - Collapsible) */}
                          <td
                            className={`py-3.5 px-3 ${
                              collapseSecondary ? "hidden md:table-cell" : ""
                            }`}
                          >
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 text-[11px]">
                                <UserCheck className="w-3 h-3" />
                                {emp.attendedDays} / {emp.workdaysElapsed} Attended
                              </span>
                              <p className="text-[10px] text-[#64748B]">
                                {emp.onTimeDays} on-time • {emp.lateDays} late
                              </p>
                            </div>
                          </td>

                          {/* Lateness Penalties (Secondary - Collapsible) */}
                          <td
                            className={`py-3.5 px-3 ${
                              collapseSecondary ? "hidden lg:table-cell" : ""
                            }`}
                          >
                            {emp.lateDays > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/60 text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  {emp.lateDays} days ({emp.totalLateMinutes}m)
                                </span>
                                <p className="text-[11px] text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                                  -{formatCurrency(emp.latenessDeductions)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">0 delay (GH₵0.00)</span>
                            )}
                          </td>

                          {/* Absence Deductions (Secondary - Collapsible) */}
                          <td
                            className={`py-3.5 px-3 ${
                              collapseSecondary ? "hidden lg:table-cell" : ""
                            }`}
                          >
                            {emp.absentDays > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 text-[11px]">
                                  <UserX className="w-3 h-3" />
                                  {emp.absentDays} unexcused
                                </span>
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                                  -{formatCurrency(emp.absenceDeductions)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">0 absent (GH₵0.00)</span>
                            )}
                          </td>

                          {/* Approved Leaves (Secondary - Collapsible) */}
                          <td
                            className={`py-3.5 px-3 ${
                              collapseSecondary ? "hidden xl:table-cell" : ""
                            }`}
                          >
                            {emp.approvedLeaveDays > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 text-[11px] font-bold">
                                {emp.approvedLeaveDays} excused
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">0 days</span>
                            )}
                          </td>

                          {/* Final Net Take-Home Pay (Primary) */}
                          <td className="py-3.5 px-3">
                            <div>
                              <span className="text-sm font-bold text-[#002185] dark:text-blue-300 block">
                                {formatCurrency(emp.netTakeHomePay)}
                              </span>
                              {emp.allowances > 0 && (
                                <span className="text-[10px] text-emerald-600 font-bold">
                                  +{formatCurrency(emp.allowances)} allow.
                                </span>
                              )}
                              {totalDeductions > 0 && (
                                <span className="text-[10px] text-rose-500 font-semibold block">
                                  -{formatCurrency(totalDeductions)} total ded.
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Row Actions (Primary) */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedEmployeeForModal(emp)}
                                className="p-1.5 bg-slate-100 hover:bg-[#002185] hover:text-white text-slate-600 dark:bg-[#162033] dark:text-slate-300 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                                title="View Full Calculation Breakdown"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedEmployeeId(isExpanded ? null : emp.employeeId)
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? "bg-[#002185] text-white"
                                    : "bg-[#F8FAFC] dark:bg-[#162033] hover:bg-[#002185] hover:text-white text-slate-700 dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700"
                                }`}
                              >
                                <span>Audit</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Daily Workday Audit Breakdown */}
                        {isExpanded && Array.isArray(emp.dailyAudit) && (
                          <tr className="bg-[#F8FAFC]/90 dark:bg-[#111927]/90 border-b border-[#E2E8F0] dark:border-slate-800">
                            <td colSpan={8} className="p-4 sm:p-6">
                              <div className="bg-white dark:bg-[#162033] rounded-2xl border border-[#E2E8F0] dark:border-slate-700 p-4 sm:p-5 space-y-4 shadow-sm">
                                {/* Mobile Summary of Collapsed Secondary Columns */}
                                <div className="grid grid-cols-2 sm:hidden gap-2 p-3 bg-slate-50 dark:bg-[#111927]/70 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
                                  <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Contractual Base</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(emp.baseSalary)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Workdays Attended</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{emp.attendedDays} / {emp.workdaysElapsed}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lateness Fines</span>
                                    <span className="font-bold text-orange-600 dark:text-orange-400">-{formatCurrency(emp.latenessDeductions)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Absence Fines</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(emp.absenceDeductions)}</span>
                                  </div>
                                </div>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-slate-700">
                                <div>
                                  <h4 className="text-xs font-bold text-[#002185] dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
                                    <span>Calendar Workday Audit Log: {emp.fullName}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px]">
                                      {emp.dailyAudit.length} Elapsed Business Days
                                    </span>
                                  </h4>
                                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                                    Every calendar business day (Monday–Friday) is evaluated. Preceding days prior to the first check-in without approved leave are penalized as unexcused absences.
                                  </p>
                                </div>

                                <div className="text-right text-[11px]">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    Month Base: {formatCurrency(emp.baseSalary)}
                                  </span>
                                  <span className="mx-2 text-slate-300">•</span>
                                  <span className="font-bold text-[#002185] dark:text-blue-300">
                                    Net: {formatCurrency(emp.netTakeHomePay)}
                                  </span>
                                </div>
                              </div>

                              {/* Daily Audit Cards Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {emp.dailyAudit.map((dayItem) => {
                                  let cardStyle = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-[#111927]/60 dark:border-slate-700";
                                  if (dayItem.status === "On Time") {
                                    cardStyle = "bg-emerald-50/70 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300";
                                  } else if (dayItem.status === "Late") {
                                    cardStyle = "bg-orange-50/70 text-orange-800 border-orange-200/80 dark:bg-orange-950/20 dark:border-orange-900/50 dark:text-orange-300";
                                  } else if (dayItem.status === "Approved Leave") {
                                    cardStyle = "bg-blue-50/70 text-blue-800 border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-300";
                                  } else if (dayItem.status === "Unexcused Absent") {
                                    cardStyle = "bg-rose-50/70 text-rose-800 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300";
                                  }

                                  return (
                                    <div
                                      key={dayItem.date}
                                      className={`p-3 rounded-xl border text-[11px] ${cardStyle}`}
                                    >
                                      <div className="flex items-center justify-between font-bold pb-1 mb-1 border-b border-black/5 dark:border-white/10">
                                        <span>{dayItem.date} ({dayItem.dayName?.slice(0, 3)})</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/70 dark:bg-black/40 font-bold">
                                          {dayItem.status}
                                        </span>
                                      </div>

                                      <div className="space-y-1 text-[10px]">
                                        {dayItem.clockIn && (
                                          <p className="flex items-center justify-between">
                                            <span className="opacity-75">Clock-in:</span>
                                            <strong className="font-mono">{dayItem.clockIn}</strong>
                                          </p>
                                        )}
                                        {dayItem.lateMinutes > 0 && (
                                          <p className="flex items-center justify-between text-orange-600 dark:text-orange-400 font-bold">
                                            <span>Delay:</span>
                                            <span>{dayItem.lateMinutes} mins</span>
                                          </p>
                                        )}
                                        {dayItem.penalty > 0 && (
                                          <p className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400">
                                            <span>Deduction:</span>
                                            <span>-GH₵{dayItem.penalty.toFixed(2)}</span>
                                          </p>
                                        )}
                                        {dayItem.reason && (
                                          <p className="opacity-75 italic text-[9.5px] leading-tight pt-0.5">
                                            {dayItem.reason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

      {/* Modal: Single Employee Detailed Calculation Breakdown */}
      {selectedEmployeeForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setSelectedEmployeeForModal(null)}
        >
          <div
            className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#002185] text-white flex items-center justify-center font-bold">
                  {selectedEmployeeForModal.fullName?.charAt(0) || "E"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {selectedEmployeeForModal.fullName}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    {selectedEmployeeForModal.employeeCode} • {selectedEmployeeForModal.department}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployeeForModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Formula Breakdown Card */}
            <div className="space-y-3 bg-[#F8FAFC] dark:bg-[#162033]/60 p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0] dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Contractual Base Salary</span>
                <strong className="text-slate-800 dark:text-slate-100">
                  {formatCurrency(selectedEmployeeForModal.baseSalary)}
                </strong>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0] dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Allowances / Bonuses</span>
                <span className="text-emerald-600 font-bold">
                  +{formatCurrency(selectedEmployeeForModal.allowances || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0] dark:border-slate-700">
                <div>
                  <span className="text-orange-700 dark:text-orange-400 font-semibold block">
                    Lateness Penalty Deductions
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    {selectedEmployeeForModal.lateDays} days late ({selectedEmployeeForModal.totalLateMinutes} mins total)
                  </span>
                </div>
                <span className="text-orange-600 font-bold">
                  -{formatCurrency(selectedEmployeeForModal.latenessDeductions || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0] dark:border-slate-700">
                <div>
                  <span className="text-rose-700 dark:text-rose-400 font-semibold block">
                    Unexcused Absence Deductions
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    {selectedEmployeeForModal.absentDays} unworked business days @ GH₵{runData?.companySettings?.absenceDeductionRate || 15}/day
                  </span>
                </div>
                <span className="text-rose-600 font-bold">
                  -{formatCurrency(selectedEmployeeForModal.absenceDeductions || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0] dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 font-semibold">Approved Excused Leaves</span>
                <span className="text-blue-600 font-bold">
                  {selectedEmployeeForModal.approvedLeaveDays} days (0 deduction)
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 text-sm">
                <span className="font-bold text-[#002185] dark:text-blue-400">
                  Calculated Net Take-Home Pay
                </span>
                <span className="font-bold text-base text-[#002185] dark:text-blue-300">
                  {formatCurrency(selectedEmployeeForModal.netTakeHomePay)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEmployeeForModal(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#002185] text-white hover:bg-[#001760] transition-colors cursor-pointer"
              >
                Close Audit Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPayrollRunTable;
