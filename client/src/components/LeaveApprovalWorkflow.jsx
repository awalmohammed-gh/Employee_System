import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Bell,
  CheckCheck,
  MessageSquare,
  AlertTriangle,
  Building2,
  Check,
  X,
  History,
  FileText,
  CalendarDays,
} from "lucide-react";

export const LeaveApprovalWorkflow = ({
  allRequests = [],
  pendingRequests = [],
  onUpdateStatus,
  updatingId = null,
  onRefresh = null,
}) => {
  const [activeView, setActiveView] = useState("pending"); // "pending" | "history" | "rules"
  const [filterDept, setFilterDept] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [urgencyOnly, setUrgencyOnly] = useState(false);
  const [remarksState, setRemarksState] = useState({});
  const [activeRemarkId, setActiveRemarkId] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Departments & Types for filtering
  const departments = useMemo(() => {
    const set = new Set();
    allRequests.forEach((r) => {
      if (r.employee?.department) set.add(r.employee.department);
    });
    return ["All", ...Array.from(set)];
  }, [allRequests]);

  const leaveTypes = ["All", "Annual Leave", "Sick Leave", "Casual Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave"];

  // Filter pending requests
  const filteredPending = useMemo(() => {
    return pendingRequests.filter((req) => {
      const dept = req.employee?.department || "";
      const type = req.leaveType || "";
      if (filterDept !== "All" && dept !== filterDept) return false;
      if (filterType !== "All" && type !== filterType) return false;
      if (urgencyOnly) {
        // Starts within 3 days
        const start = new Date(req.startDate);
        const now = new Date();
        const diffDays = (start - now) / (1000 * 60 * 60 * 24);
        if (diffDays > 3) return false;
      }
      return true;
    });
  }, [pendingRequests, filterDept, filterType, urgencyOnly]);

  // Reviewed requests for history
  const reviewedRequests = useMemo(() => {
    return allRequests
      .filter((r) => r.status === "Approved" || r.status === "Rejected")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [allRequests]);

  const handleRemarkChange = (id, text) => {
    setRemarksState((prev) => ({
      ...prev,
      [id]: text,
    }));
  };

  const handleApprove = async (id) => {
    const remark = remarksState[id] || "";
    await onUpdateStatus(id, "Approved", remark);
    setActiveRemarkId(null);
  };

  const handleReject = async (id) => {
    const remark = remarksState[id] || "";
    await onUpdateStatus(id, "Rejected", remark);
    setActiveRemarkId(null);
  };

  const handleBatchApproveAll = async () => {
    if (filteredPending.length === 0) return;
    if (!window.confirm(`Are you sure you want to approve all ${filteredPending.length} filtered leave request(s)?`)) {
      return;
    }
    setBatchLoading(true);
    try {
      for (const req of filteredPending) {
        await onUpdateStatus(req._id, "Approved", "Batch approved by Manager");
      }
    } finally {
      setBatchLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getLeaveTypeStyle = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("sick")) return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
    if (t.includes("annual")) return "bg-blue-50 dark:bg-blue-950/40 text-[#002185] dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (t.includes("casual")) return "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    if (t.includes("maternity") || t.includes("paternity")) return "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800";
    return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  };

  return (
    <div id="automated-leave-workflow" className="space-y-6 animate-fade-in">
      {/* Workflow Process Banner */}
      <div className="bg-[#002185] rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ff5500] text-white uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Automated Approval Workflow
              </span>
              <span className="text-xs text-white/80 font-medium flex items-center gap-1">
                <Bell className="w-3 h-3 text-emerald-400" />
                Real-time Notifications Active
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Manager Leave Review & Decision Hub
            </h2>
            <p className="text-xs sm:text-sm text-white/75 mt-1 max-w-2xl leading-relaxed">
              When employees request time off, managers receive instant notifications to approve or reject with one click. Approved leaves automatically update employee attendance calendars and sync with monthly payroll deductions.
            </p>
          </div>

          {/* Workflow Stats Badge & Batch Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs text-center">
              <div className="text-xl font-bold text-white">{pendingRequests.length}</div>
              <div className="text-[10px] uppercase font-bold text-white/70">Pending Requests</div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs text-center">
              <div className="text-xl font-bold text-emerald-400">
                {allRequests.filter((r) => r.status === "Approved").length}
              </div>
              <div className="text-[10px] uppercase font-bold text-white/70">Approved Total</div>
            </div>
            {pendingRequests.length > 0 && (
              <button
                type="button"
                onClick={handleBatchApproveAll}
                disabled={batchLoading}
                className="px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                <span>{batchLoading ? <><WorkspaceLoader inline /> Processing...</> : `Approve All (${filteredPending.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Workflow Steps Pipeline */}
        <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 block mb-0.5">STEP 1: SUBMISSION</span>
            <span className="font-semibold text-white">Employee Requests Leave</span>
            <p className="text-[11px] text-white/70 mt-0.5">Specifies leave type, dates, and reason</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 block mb-0.5">STEP 2: NOTIFICATION</span>
            <span className="font-semibold text-white">Manager Receives Alert</span>
            <p className="text-[11px] text-white/70 mt-0.5">Instant notification in bell & action queue</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 block mb-0.5">STEP 3: DECISION</span>
            <span className="font-semibold text-white">1-Click Approve / Reject</span>
            <p className="text-[11px] text-white/70 mt-0.5">With optional manager remarks & feedback</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold text-emerald-300 block mb-0.5">STEP 4: AUTOMATION</span>
            <span className="font-semibold text-white">Auto Sync & Employee Alert</span>
            <p className="text-[11px] text-white/70 mt-0.5">Updates attendance & notifies employee</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filter Controls */}
      <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView("pending")}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeView === "pending"
                ? "bg-[#002185] text-white shadow-xs"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-blue-400"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review ({pendingRequests.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("history")}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeView === "history"
                ? "bg-[#002185] text-white shadow-xs"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-blue-400"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Decision History ({reviewedRequests.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView("rules")}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeView === "rules"
                ? "bg-[#002185] text-white shadow-xs"
                : "text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-blue-400"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Workflow Policy</span>
          </button>
        </div>

        {/* Filter Toolbar for Pending Requests */}
        {activeView === "pending" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Department Filter */}
            <div className="flex items-center bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#64748B] mr-1.5" />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="bg-transparent font-semibold text-[#0F172A] dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d} value={d} className="text-[#0F172A] bg-white">
                    {d === "All" ? "All Departments" : d}
                  </option>
                ))}
              </select>
            </div>

            {/* Leave Type Filter */}
            <div className="flex items-center bg-[#F8FAFC] dark:bg-slate-950 border border-[#E2E8F0] dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <FileText className="w-3.5 h-3.5 text-[#64748B] mr-1.5" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent font-semibold text-[#0F172A] dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {leaveTypes.map((t) => (
                  <option key={t} value={t} className="text-[#0F172A] bg-white">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency Toggle (Starting < 3 days) */}
            <button
              type="button"
              onClick={() => setUrgencyOnly(!urgencyOnly)}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                urgencyOnly
                  ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
                  : "bg-[#F8FAFC] dark:bg-slate-950 text-[#64748B] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-800"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#ff5500]" />
              <span>Urgent (&lt; 3 Days)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main View Area */}
      {activeView === "pending" && (
        <div>
          {filteredPending.length === 0 ? (
            <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-10 text-center shadow-xs">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#16A34A] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#002185] dark:text-blue-400">
                All Leave Requests Reviewed!
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                There are no pending leave requests awaiting approval at this moment. Any newly submitted time-off requests will appear here with an automated manager notification badge.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPending.map((leave) => {
                const leaveId = leave._id;
                const employeeName = leave.employee?.fullName || "Employee";
                const employeeId = leave.employee?.employeeId || "EMP";
                const department = leave.employee?.department || "Operations";
                const position = leave.employee?.position || "Staff";
                const totalDays = leave.totalDays || 1;
                const isUpdating = updatingId === leaveId;
                const showRemarkInput = activeRemarkId === leaveId;

                return (
                  <div
                    key={leaveId}
                    className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-[#002185]/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Employee info & Type Badge */}
                      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#002185]/10 dark:bg-blue-500/20 text-[#002185] dark:text-blue-400 font-bold text-sm flex items-center justify-center shrink-0">
                            {employeeName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 leading-tight">
                              {employeeName}
                            </h4>
                            <p className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">
                              {position} • <span className="text-[#002185] dark:text-blue-400 font-semibold">{department}</span>
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${getLeaveTypeStyle(
                            leave.leaveType
                          )}`}
                        >
                          {leave.leaveType || "Leave"}
                        </span>
                      </div>

                      {/* Date Range & Duration */}
                      <div className="my-3 p-3 bg-[#F8FAFC] dark:bg-slate-950 rounded-xl border border-[#E2E8F0] dark:border-slate-800 text-xs">
                        <div className="flex items-center justify-between font-semibold text-[#0F172A] dark:text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400" />
                            <span>{formatDate(leave.startDate)}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>{formatDate(leave.endDate)}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B] dark:text-slate-400">Total Duration:</span>
                          <span className="font-bold text-[#ff5500] px-2 py-0.5 bg-[#ff5500]/10 rounded-md">
                            {totalDays} Day{totalDays !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {/* Stated Reason */}
                      <div className="mb-3">
                        <span className="text-[10px] uppercase font-bold text-[#64748B] dark:text-slate-400 block mb-1">
                          Applicant Stated Reason:
                        </span>
                        <p className="text-xs text-[#0F172A] dark:text-slate-300 italic bg-[#F1F5F9]/50 dark:bg-[#162033]/50 p-2.5 rounded-xl border border-[#E2E8F0] dark:border-slate-800">
                          "{leave.reason || "No detailed explanation provided."}"
                        </p>
                      </div>

                      {/* Optional Manager Remark Input Toggle */}
                      {showRemarkInput ? (
                        <div className="mb-3 space-y-1.5 animate-fade-in">
                          <label className="text-[11px] font-bold text-[#002185] dark:text-blue-400 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Manager Feedback / Note (Optional):
                          </label>
                          <textarea
                            value={remarksState[leaveId] || ""}
                            onChange={(e) => handleRemarkChange(leaveId, e.target.value)}
                            placeholder="Add reason for approval/rejection..."
                            rows={2}
                            className="w-full text-xs p-2 rounded-xl border border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-[#162033] text-[#0F172A] dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#002185]/25"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveRemarkId(leaveId)}
                          className="text-[11px] text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-blue-400 font-semibold flex items-center gap-1 mb-3 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>+ Add Manager Remark</span>
                        </button>
                      )}
                    </div>

                    {/* Action Buttons: 1-Click Approve / Reject */}
                    <div className="pt-3 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(leaveId)}
                        disabled={isUpdating}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isUpdating ? <><WorkspaceLoader inline /> Processing...</> : "Approve"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(leaveId)}
                        disabled={isUpdating}
                        className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-[#162033] border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{isUpdating ? <><WorkspaceLoader inline /> Processing...</> : "Reject"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Decision History View */}
      {activeView === "history" && (
        <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#002185] dark:text-blue-400 flex items-center gap-2">
                <History className="w-4 h-4 text-[#ff5500]" />
                <span>Leave Approval Decision Log & Audit Trail</span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Complete record of historical management approvals and rejections
              </p>
            </div>
            <span className="text-xs font-bold bg-[#F8FAFC] dark:bg-[#162033] px-3 py-1 rounded-lg text-[#64748B] dark:text-slate-300">
              {reviewedRequests.length} Total Decisions
            </span>
          </div>

          {reviewedRequests.length === 0 ? (
            <div className="p-8 text-center text-[#64748B] dark:text-slate-400 text-xs">
              No historical decisions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
              {reviewedRequests.map((req) => {
                const isApproved = req.status === "Approved";
                const employeeName = req.employee?.fullName || "Employee";
                const department = req.employee?.department || "General";

                return (
                  <div key={req._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isApproved
                            ? "bg-[#16A34A]/10 text-[#16A34A]"
                            : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                        }`}
                      >
                        {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F172A] dark:text-slate-100">{employeeName}</span>
                          <span className="text-[#64748B] font-medium">• {department}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getLeaveTypeStyle(req.leaveType)}`}>
                            {req.leaveType}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                          {formatDate(req.startDate)} to {formatDate(req.endDate)} ({req.totalDays || 1} days)
                          {req.adminRemark && (
                            <span className="ml-2 italic text-[#002185] dark:text-blue-400">
                              Note: "{req.adminRemark}"
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isApproved
                            ? "bg-[#16A34A]/15 text-[#16A34A]"
                            : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Workflow Policy & Automation Rules Info View */}
      {activeView === "rules" && (
        <div className="bg-white dark:bg-[#111927] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#002185] dark:text-blue-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
              <span>Automated Leave Approval Rules & Policy Guidelines</span>
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              Standard organizational guidelines governing the automated workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#002185]/10 text-[#002185] dark:text-blue-400 flex items-center justify-center font-bold">
                1
              </div>
              <h4 className="font-bold text-[#0F172A] dark:text-slate-100">Attendance Sync Policy</h4>
              <p className="text-[#64748B] dark:text-slate-400 leading-relaxed text-[11px]">
                Upon manager approval, leave dates are marked with the "Leave" (L) badge in the monthly attendance matrix, preventing unexcused absence deductions.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center font-bold">
                2
              </div>
              <h4 className="font-bold text-[#0F172A] dark:text-slate-100">Payroll Integration</h4>
              <p className="text-[#64748B] dark:text-slate-400 leading-relaxed text-[11px]">
                Approved annual and paid leaves preserve full salary entitlement. Unpaid leaves or unapproved absences are factored automatically into monthly salary disbursements.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#ff5500]/10 text-[#ff5500] flex items-center justify-center font-bold">
                3
              </div>
              <h4 className="font-bold text-[#0F172A] dark:text-slate-100">Instant Notification Engine</h4>
              <p className="text-[#64748B] dark:text-slate-400 leading-relaxed text-[11px]">
                Both submission and status decisions broadcast instantaneous notifications with action links to managers and employees via the top navigation bell.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveApprovalWorkflow;
