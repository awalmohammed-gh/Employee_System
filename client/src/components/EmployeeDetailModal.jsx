import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Briefcase, Calendar, CalendarCheck, Banknote, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Printer, Copy, Check, PhoneCall, UserCheck, Trash2, X, Award } from "lucide-react";
import IndividualAttendanceCalendar from "./IndividualAttendanceCalendar";
import { getEmployeeAttendanceHistory, getEmployeeSalaryHistory } from "../apis/fontApis";
import QuarterlyPerformanceVisualizer from "./QuarterlyPerformanceVisualizer";
import { getEmployeeStatusBadge, formatEmployeeDate } from "../utils/employeeStatus";

export const EmployeeDetailModal = ({
  employee,
  isOpen,
  onClose,
  isAdmin,
  statusUpdatingId,
  onStatusChange,
  onDeleteRequest,
  getStatusBadge = getEmployeeStatusBadge,
  formatDate = formatEmployeeDate,
}) => {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "salary_history"
  const [copiedField, setCopiedField] = useState(null);

  // Salary history table search & pagination states
  const [salarySearch, setSalarySearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Salary history for the employee being viewed, built from their recorded payroll runs
  const [salaryState, setSalaryState] = useState({ loading: false, error: null, history: [], forId: null });
  const rawSalaryHistory = salaryState.history;
  const salaryEmployeeId = employee?._id || employee?.id || employee?.employeeId || null;

  const loadSalaryHistory = useCallback(async () => {
    if (!salaryEmployeeId) return;
    setSalaryState({ loading: true, error: null, history: [], forId: salaryEmployeeId });
    try {
      const { data } = await getEmployeeSalaryHistory(salaryEmployeeId);
      if (!data?.success) throw new Error(data?.message || "Could not load salary history.");
      setSalaryState({ loading: false, error: null, history: data.history || [], forId: salaryEmployeeId });
    } catch (err) {
      setSalaryState({
        loading: false,
        error: err.response?.data?.message || err.message || "Could not load salary history.",
        history: [],
        forId: salaryEmployeeId,
      });
    }
  }, [salaryEmployeeId]);

  useEffect(() => {
    if (isOpen && isAdmin && salaryState.forId !== salaryEmployeeId) {
      loadSalaryHistory();
    }
  }, [isOpen, isAdmin, salaryEmployeeId, salaryState.forId, loadSalaryHistory]);

  const filteredSalaryHistory = useMemo(() => {
    if (!salarySearch.trim()) return rawSalaryHistory;
    const q = salarySearch.toLowerCase().trim();
    return rawSalaryHistory.filter(
      (item) =>
        (item.effectiveDate || "").toLowerCase().includes(q) ||
        (item.type || "").toLowerCase().includes(q) ||
        (item.reason || "").toLowerCase().includes(q) ||
        (item.reference || "").toLowerCase().includes(q) ||
        (item.payMonth || "").toLowerCase().includes(q) ||
        String(item.newSalary || "").includes(q) ||
        String(item.percentageChange || "").includes(q)
    );
  }, [rawSalaryHistory, salarySearch]);

  const totalPages = Math.ceil(filteredSalaryHistory.length / itemsPerPage) || 1;
  const paginatedSalaryHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSalaryHistory.slice(start, start + itemsPerPage);
  }, [filteredSalaryHistory, currentPage]);

  // Attendance / absence history for the employee being viewed (loaded when the tab is opened)
  const [attendanceState, setAttendanceState] = useState({ loading: false, error: null, data: null, forId: null });
  const viewedEmployeeId = employee?._id || employee?.id || employee?.employeeId || null;

  const loadAttendanceHistory = useCallback(async () => {
    if (!viewedEmployeeId) return;
    setAttendanceState({ loading: true, error: null, data: null, forId: viewedEmployeeId });
    try {
      const { data } = await getEmployeeAttendanceHistory(viewedEmployeeId);
      if (!data?.success) throw new Error(data?.message || "Could not load attendance history.");
      setAttendanceState({ loading: false, error: null, data, forId: viewedEmployeeId });
    } catch (err) {
      setAttendanceState({
        loading: false,
        error: err.response?.data?.message || err.message || "Could not load attendance history.",
        data: null,
        forId: viewedEmployeeId,
      });
    }
  }, [viewedEmployeeId]);

  useEffect(() => {
    if (isOpen && activeTab === "attendance" && attendanceState.forId !== viewedEmployeeId) {
      loadAttendanceHistory();
    }
  }, [isOpen, activeTab, viewedEmployeeId, attendanceState.forId, loadAttendanceHistory]);

  if (!isOpen || !employee) return null;

  const mBadge = getStatusBadge(
    employee.status,
    employee.isActive,
    employee
  );

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const initials = (employee.fullName || "E")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentSalary =
    employee.baseSalary ||
    employee.basicSalary ||
    employee.salary ||
    employee.monthlyRate ||
    0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        id="print-employee-profile-card"
        className={`w-full ${activeTab === "attendance" ? "max-w-5xl" : "max-w-2xl"} mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[92vh] flex flex-col overflow-hidden animate-fade-in print-container print-card transition-[max-width] duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Official Document Banner (Print Only) */}
        <div className="hidden print-only p-4 border-b border-slate-200 bg-white text-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#002185]">Official Personnel Profile Record</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Confidential HR Record • Verified Document</p>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <p>Issued: {new Date().toLocaleDateString("en-GB")}</p>
              <p>REF: {employee.employeeId || "EMP"}</p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-[#002185] p-4 sm:p-6 text-white relative shrink-0">
          <div className="flex items-center justify-between no-print mb-3">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-semibold text-white/90">
              <span>Employee Record Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-export-pdf"
                data-testid="btn-export-pdf"
                onClick={handlePrint}
                title="Export Employee Profile to PDF"
                aria-label="Export to PDF"
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-white/30"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Export to PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close Profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white text-[#002185] font-bold text-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden border-2 border-white/40">
              {employee.profilePicture ||
              employee.profile_picture ||
              employee.avatar ||
              employee.avatar_url ? (
                <img
                  src={
                    employee.profilePicture ||
                    employee.profile_picture ||
                    employee.avatar ||
                    employee.avatar_url
                  }
                  alt={employee.fullName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                initials
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  {employee.fullName}
                </h3>
                <span className="font-mono bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/20">
                  {employee.employeeId || "EMP"}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                {employee.position || "Staff Member"} • {employee.department}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${mBadge.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${mBadge.dot}`} />
                  {mBadge.label}
                </span>
                <span className="text-[11px] text-blue-200">
                  Joined {formatDate(employee.employmentDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5 border-t border-white/15 pt-3 no-print overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "bg-white text-[#002185] shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Profile Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("salary_history")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "salary_history"
                  ? "bg-white text-[#002185] shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Salary History</span>
              {rawSalaryHistory.length > 0 && (
                <span
                  className={`px-1.5 py-px text-[10px] rounded-full font-bold ${
                    activeTab === "salary_history"
                      ? "bg-blue-100 text-[#002185]"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {rawSalaryHistory.length}
                </span>
              )}
            </button>
            <button
              type="button"
              id="employee-detail-attendance-tab"
              onClick={() => setActiveTab("attendance")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "attendance"
                  ? "bg-white text-[#002185] shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Attendance History</span>
              {attendanceState.data?.summary && attendanceState.forId === viewedEmployeeId && (
                <span
                  className={`px-1.5 py-px text-[10px] rounded-full font-bold ${
                    activeTab === "attendance" ? "bg-rose-100 text-rose-700" : "bg-rose-500/30 text-rose-100"
                  }`}
                  title="Absent days"
                >
                  {attendanceState.data.summary.absent} absent
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("performance")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "performance"
                  ? "bg-white text-[#002185] shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Performance Reviews</span>
              <span
                className={`px-1.5 py-px text-[10px] rounded-full font-bold ${
                  activeTab === "performance"
                    ? "bg-blue-100 text-[#002185]"
                    : "bg-emerald-500/30 text-emerald-200"
                }`}
              >
                QoQ
              </span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Attendance / absence history (this employee only) */}
          {activeTab === "attendance" && (
            <div id="employee-detail-attendance-panel" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Attendance & absence history</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Recorded check-ins, late arrivals and absences for {employee.fullName || "this employee"}. Select a date for details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAttendanceHistory}
                  disabled={attendanceState.loading}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <IndividualAttendanceCalendar
                history={attendanceState.data?.history || []}
                approvedLeaves={attendanceState.data?.approvedLeaves || []}
                summary={attendanceState.data?.summary || null}
                workSchedule={attendanceState.data?.workSchedule || null}
                isLoading={attendanceState.loading || (!attendanceState.data && !attendanceState.error)}
                error={attendanceState.error}
                onRetry={loadAttendanceHistory}
                emptyMessage="No attendance has been recorded for this employee yet."
              />
            </div>
          )}

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Admin Quick Status Switcher */}
              {isAdmin && typeof onStatusChange === "function" && (
                <div className="p-3.5 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2 no-print">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Update Account Status
                    </span>
                    {statusUpdatingId ===
                      (employee._id || employee.employeeId) && (
                      <WorkspaceLoader inline />
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                    {[
                      {
                        key: "active",
                        label: "Active",
                        activeClass: "bg-emerald-600 text-white",
                      },
                      {
                        key: "on leave",
                        label: "On Leave",
                        activeClass: "bg-[#002185] dark:bg-blue-600 text-white",
                      },
                      {
                        key: "terminated",
                        label: "Terminated",
                        activeClass: "bg-rose-600 text-white",
                      },
                      {
                        key: "inactive",
                        label: "Inactive",
                        activeClass: "bg-amber-600 text-white",
                      },
                      {
                        key: "suspended",
                        label: "Suspended",
                        activeClass: "bg-red-600 text-white",
                      },
                    ].map((st) => {
                      const empId = employee._id || employee.employeeId;
                      const isCurrent =
                        mBadge.code === st.key ||
                        mBadge.label.toLowerCase() === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          disabled={isCurrent || statusUpdatingId === empId}
                          onClick={() => onStatusChange(empId, st.key)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                            isCurrent
                              ? `${st.activeClass} shadow-xs`
                              : "bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600"
                          } disabled:opacity-60`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-xl print-card">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Work Email
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                      {employee.email}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(employee.email, "modal_email")}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold mt-1 inline-flex items-center gap-1 cursor-pointer no-print"
                    >
                      {copiedField === "modal_email" ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>
                        {copiedField === "modal_email" ? "Copied!" : "Copy Email"}
                      </span>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-xl print-card">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Phone Number
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {employee.phone || "+233 24 000 0000"}
                    </div>
                    <a
                      href={`tel:${employee.phone}`}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold mt-1 inline-flex items-center gap-1 no-print"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Call Directly</span>
                    </a>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-xl print-card">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Office Location
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {employee.location || "Accra Head Office"}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-xl print-card">
                    <div className="text-[10px] uppercase font-semibold text-slate-400">
                      Emergency Contact
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {employee.emergencyContact || "+233 20 000 0000"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Role & Organizational Details */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Organizational & Compensation Profile
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-[#162033]/60 rounded-xl border border-slate-200 dark:border-slate-700/80 print-card">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Department
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {employee.department}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-[#162033]/60 rounded-xl border border-slate-200 dark:border-slate-700/80 print-card">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Employment Type
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {employee.employmentType || "Full-time"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-[#162033]/60 rounded-xl border border-slate-200 dark:border-slate-700/80 print-card">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Current Base Pay
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {Number(currentSalary) > 0
                        ? `GHS ${Number(currentSalary).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
                        : "Not set"}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-[#162033]/60 rounded-xl border border-slate-200 dark:border-slate-700/80 print-card">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      System Role
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {employee.role || "Employee"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Salary Adjustments History */}
          {activeTab === "salary_history" && !isAdmin && (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              Salary history is available to administrators.
            </div>
          )}

          {activeTab === "salary_history" && isAdmin && salaryState.loading && (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <WorkspaceLoader compact title="" />
              <span>Loading salary history…</span>
            </div>
          )}

          {activeTab === "salary_history" && isAdmin && !salaryState.loading && salaryState.error && (
            <div className="p-6 text-center border border-rose-200 dark:border-rose-900/60 rounded-2xl">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">{salaryState.error}</p>
              <button
                type="button"
                onClick={loadSalaryHistory}
                className="px-3 py-1.5 rounded-lg bg-[#002185] hover:bg-[#001760] text-white text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === "salary_history" && isAdmin && !salaryState.loading && !salaryState.error && rawSalaryHistory.length === 0 && (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              <Banknote className="w-6 h-6 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">No salary history yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Salary history is built from payroll runs. It will appear once payroll has been processed for this employee.
              </p>
            </div>
          )}

          {activeTab === "salary_history" && isAdmin && !salaryState.loading && !salaryState.error && rawSalaryHistory.length > 0 && (
            <div className="space-y-4">
              {/* Summary Stats Chips */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    First Payroll Base
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                    GHS {Number(rawSalaryHistory[rawSalaryHistory.length - 1]?.newSalary || 0).toLocaleString("en-GH")}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    Latest Payroll Base
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    GHS {Number(rawSalaryHistory[0]?.newSalary || 0).toLocaleString("en-GH")}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">
                    Net Change
                  </div>
                  {(() => {
                    const first = Number(rawSalaryHistory[rawSalaryHistory.length - 1]?.newSalary || 0);
                    const latest = Number(rawSalaryHistory[0]?.newSalary || 0);
                    const change = first > 0 ? Math.round(((latest - first) / first) * 100) : 0;
                    return (
                      <div className={`text-xs sm:text-sm font-bold font-mono mt-0.5 flex items-center justify-center gap-1 ${change < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"}`}>
                        {change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        <span>{change > 0 ? "+" : ""}{change}%</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Search filter for history */}
              <div className="relative no-print">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={salarySearch}
                  onChange={(e) => {
                    setSalarySearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by date, month, type, payslip no. or amount..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Salary Adjustments Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#162033]/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                      <tr>
                        <th className="px-3.5 py-2.5">Effective Date</th>
                        <th className="px-3.5 py-2.5">Change</th>
                        <th className="px-3.5 py-2.5 text-right">Previous Pay</th>
                        <th className="px-3.5 py-2.5 text-right">New Base</th>
                        <th className="px-3.5 py-2.5 text-center">Increment</th>
                        <th className="px-3.5 py-2.5">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedSalaryHistory.map((adj) => {
                        return (
                          <tr
                            key={adj.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{formatDate(adj.effectiveDate)}</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-3">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 block">
                                {adj.type}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {adj.status}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {adj.previousSalary > 0
                                ? `GHS ${adj.previousSalary.toLocaleString("en-GH")}`
                                : "—"}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              GHS {adj.newSalary.toLocaleString("en-GH")}
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              {adj.percentageChange > 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70">
                                  <TrendingUp className="w-3 h-3" />
                                  +{adj.percentageChange}%
                                </span>
                              ) : adj.percentageChange === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#162033] text-slate-500">
                                  Start
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200">
                                  <TrendingDown className="w-3 h-3" />
                                  {adj.percentageChange}%
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 min-w-[150px]">
                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                {adj.reason}
                              </div>
                              {adj.reference && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Payslip: {adj.reference}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {paginatedSalaryHistory.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No salary history entries match your search.
                  </div>
                )}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400 no-print">
                  <span>
                    Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredSalaryHistory.length} total entries)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Quarterly Performance Reviews & Growth Trajectory */}
          {activeTab === "performance" && (
            <QuarterlyPerformanceVisualizer
              employeeId={employee?._id || employee?.employeeId}
              employeeData={employee}
              isAdmin={isAdmin}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#162033]/80 border-t border-slate-200 dark:border-slate-700/80 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-2 shrink-0 no-print">
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && typeof onDeleteRequest === "function" && (
              <button
                type="button"
                onClick={() => {
                  onDeleteRequest(employee);
                }}
                className="flex-1 sm:flex-initial justify-center px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              id="btn-export-pdf-footer"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 bg-white dark:bg-[#111927] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs text-center"
            >
              <Printer className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400" />
              <span>Export to PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#002185] hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs text-center"
          >
            Close Profile
          </button>
        </div>

        {/* Official Document Signoff (Print Only) */}
        <div className="hidden print-only p-6 border-t border-slate-200 bg-white text-slate-700 print-break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-6">HR Department Authorization</p>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <p className="text-[10px] text-slate-500">Signature & Official Stamp</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-6">Employee Verification</p>
              <div className="border-b border-slate-400 w-48 ml-auto mb-1"></div>
              <p className="text-[10px] text-slate-500">Employee Signature & Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EmployeeDetailModal;
