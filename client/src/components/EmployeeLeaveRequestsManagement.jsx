import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  AlertCircle,
  ShieldCheck,
  X,
  Info,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { myLeave, applyForLeave } from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";
import { ui, tones, selectChevronStyle } from "../pages/Employees/ui/tokens";
import { Badge, Card, CardHeader, DataRow, EmptyState, StatCard, Tabs } from "../pages/Employees/ui/primitives";

const LEAVE_TYPES = [
  { value: "Annual Leave", label: "Annual Leave (Paid)" },
  { value: "Sick Leave", label: "Sick Leave (Medical)" },
  { value: "Casual Leave", label: "Casual Leave" },
  { value: "Maternity Leave", label: "Maternity Leave" },
  { value: "Paternity Leave", label: "Paternity Leave" },
  { value: "Study Leave", label: "Study / Professional Leave" },
  { value: "Compassionate Leave", label: "Compassionate / Bereavement" },
  { value: "Unpaid Leave", label: "Unpaid Leave" },
];

// Status label, icon and tone
const getStatusBadge = (status) => {
  const s = String(status || "").toLowerCase();
  switch (s) {
    case "approved":
      return { label: "Approved", icon: CheckCircle2, tone: "success" };
    case "rejected":
      return { label: "Rejected", icon: XCircle, tone: "danger" };
    case "pending":
    default:
      return { label: "Pending Review", icon: Clock, tone: "warning" };
  }
};

const StatusBadge = ({ status }) => {
  const info = getStatusBadge(status);
  const Icon = info.icon;
  return (
    <Badge tone={info.tone}>
      <Icon className="w-3 h-3" />
      {info.label}
    </Badge>
  );
};

const RemarkNote = ({ leave }) => {
  const remark = leave.adminRemark || leave.adminNotes;
  if (!remark) return null;
  const rejected = String(leave.status || "").toLowerCase() === "rejected";
  return (
    <p
      className={`mt-1.5 text-[11px] leading-snug px-2 py-1 rounded-md border truncate ${
        rejected
          ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
          : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300"
      }`}
      title={remark}
    >
      <span className="font-semibold">Note:</span> {remark}
    </p>
  );
};

export const EmployeeLeaveRequestsManagement = ({
  title = "Leave Requests Management",
  subtitle = "Submit time-off requests, track management approvals, and monitor your annual leave balance",
  onLeaveApplied = null,
  initialData = null,
}) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [balance, setBalance] = useState({
    totalDays: 20,
    usedDays: 0,
    availableDays: 20,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    leaveType: "Annual Leave",
    startDate: "",
    endDate: "",
    reason: "",
  });

  // Table Filter & Search State
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState(null);

  const { setShowToast } = useManagement();

  // Helper date formatter
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

  // Helper date range calculator
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    const diff = Math.abs(e - s);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const requestedDuration = calculateDays(formData.startDate, formData.endDate);

  // Fetch leave requests and balance
  const fetchLeaveData = useCallback(async (isSilent = false) => {
    try {
      if (isSilent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const res = await myLeave();
      const data = res?.data;

      if (data?.success || Array.isArray(data?.leaves) || Array.isArray(data?.data)) {
        let list = [];
        if (Array.isArray(data?.leaves)) {
          list = data.leaves;
        } else if (Array.isArray(data?.data)) {
          list = data.data;
        } else if (Array.isArray(data)) {
          list = data;
        }

        setLeaveRequests(list);

        if (data?.employeeBalance) {
          setBalance({
            totalDays: Number(data.employeeBalance.totalDays) || 20,
            usedDays: Number(data.employeeBalance.usedDays) || 0,
            availableDays:
              data.employeeBalance.availableDays !== undefined
                ? Number(data.employeeBalance.availableDays)
                : Math.max(0, (Number(data.employeeBalance.totalDays) || 20) - (Number(data.employeeBalance.usedDays) || 0)),
          });
        } else {
          // Compute balance from approved requests
          const used = list
            .filter((l) => String(l.status || "").toLowerCase() === "approved")
            .reduce((sum, item) => sum + (Number(item.totalDays) || Number(item.days) || 1), 0);
          setBalance({
            totalDays: 20,
            usedDays: used,
            availableDays: Math.max(0, 20 - used),
          });
        }
      } else {
        const msg = data?.message || "Failed to load leave requests.";
        if (!isSilent) setError(msg);
      }
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      const msg = err.response?.data?.message || err.message || "Failed to load leave records.";
      if (!isSilent) setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveData();
  }, [fetchLeaveData]);

  // Handle Form Input Change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError(null);
  };

  // Submit New Leave Request
  const handleSubmitLeave = async (e) => {
    e.preventDefault();

    if (!formData.leaveType) {
      setFormError("Please select a leave category.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setFormError("Please select both start and end dates.");
      return;
    }

    const s = new Date(formData.startDate);
    const eDate = new Date(formData.endDate);
    if (eDate < s) {
      setFormError("End date cannot be prior to start date.");
      return;
    }

    if (!formData.reason || formData.reason.trim().length < 5) {
      setFormError("Please provide a reason (minimum 5 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = {
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
        totalDays: requestedDuration,
      };

      const res = await applyForLeave(payload);
      const data = res?.data;

      if (data?.success || res?.status === 200 || res?.status === 201) {
        setShowToast({
          show: true,
          message: data?.message || "Leave request submitted successfully!",
          type: "success",
        });

        // Reset Form
        setFormData({
          leaveType: "Annual Leave",
          startDate: "",
          endDate: "",
          reason: "",
        });
        setShowApplyForm(false);

        // Refresh data
        await fetchLeaveData(true);

        if (typeof onLeaveApplied === "function") {
          onLeaveApplied(data?.leave);
        }
      } else {
        setFormError(data?.message || "Failed to submit leave request.");
      }
    } catch (err) {
      console.error("Error submitting leave request:", err);
      setFormError(err.response?.data?.message || err.message || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((leave) => {
      const s = String(leave.status || "Pending").toLowerCase();
      const type = String(leave.leaveType || "").toLowerCase();
      const reason = String(leave.reason || "").toLowerCase();
      const search = searchTerm.toLowerCase().trim();

      const matchesStatus =
        statusFilter === "all" ||
        s === statusFilter.toLowerCase();

      const matchesSearch =
        !search ||
        type.includes(search) ||
        reason.includes(search) ||
        s.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [leaveRequests, statusFilter, searchTerm]);

  // Aggregate stats
  const pendingCount = leaveRequests.filter(
    (l) => String(l.status || "").toLowerCase() === "pending"
  ).length;
  const approvedCount = leaveRequests.filter(
    (l) => String(l.status || "").toLowerCase() === "approved"
  ).length;
  const rejectedCount = leaveRequests.filter(
    (l) => String(l.status || "").toLowerCase() === "rejected"
  ).length;

  const usedPercentage =
    balance.totalDays > 0
      ? Math.min(100, Math.round((balance.usedDays / balance.totalDays) * 100))
      : 0;

  const leaveDays = (leave) => leave.totalDays || leave.days || calculateDays(leave.startDate, leave.endDate);
  const shortId = (leave, index) => String(leave._id || leave.id || index).slice(-6).toUpperCase();

  const filterTabs = [
    { value: "all", label: "All", count: leaveRequests.length },
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "approved", label: "Approved", count: approvedCount },
    { value: "rejected", label: "Rejected", count: rejectedCount },
  ];

  return (
    <div id="employee-leave-requests-management-section" className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader
          icon={CalendarCheck}
          title={title}
          description={subtitle}
          action={
            <>
              <button
                type="button"
                onClick={() => fetchLeaveData(true)}
                disabled={isLoading || isRefreshing}
                className={`${ui.btnSecondary} w-10! px-0!`}
                title="Refresh records"
                aria-label="Refresh leave records"
              >
                {(isRefreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setShowApplyForm(!showApplyForm)}
                className={showApplyForm ? ui.btnSecondary : ui.btnPrimary}
                aria-expanded={showApplyForm}
              >
                {showApplyForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showApplyForm ? "Close form" : "Request time off"}</span>
              </button>
            </>
          }
        />
      </Card>

      {/* Balance summary */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`${ui.card} p-4 sm:p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Remaining balance</span>
            <span className={`grid place-items-center w-8 h-8 rounded-lg ${tones.success.icon}`}>
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {balance.availableDays}
            <span className="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">days available</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${Math.max(0, 100 - usedPercentage)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{100 - usedPercentage}% of annual quota intact</p>
        </div>

        <div className={`${ui.card} p-4 sm:p-5`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Used leave days</span>
            <span className={`grid place-items-center w-8 h-8 rounded-lg ${tones.warning.icon}`}>
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {balance.usedDays}
            <span className="ml-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">days logged</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${usedPercentage}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{usedPercentage}% of quota consumed</p>
        </div>

        <StatCard
          label="Annual entitlement"
          value={`${balance.totalDays} days`}
          hint="Standard paid leave policy allotment"
          icon={Briefcase}
          tone="brand"
        />

        <StatCard
          label="Pending requests"
          value={pendingCount}
          hint={`${approvedCount} approved · ${rejectedCount} rejected`}
          icon={Clock}
          tone="warning"
        />
      </div>

      {/* Request form */}
      {showApplyForm && (
        <Card className="ring-1 ring-[#002185]/10 dark:ring-blue-500/20">
          <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-5 h-5 text-[#002185] dark:text-blue-400" />
              <h3 className={ui.h2}>Submit new time-off request</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowApplyForm(false)}
              className={ui.iconBtn}
              aria-label="Close form"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {formError && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitLeave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="elrm-leave-type" className={ui.label}>
                  Leave category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="elrm-leave-type"
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className={ui.select}
                  style={selectChevronStyle}
                >
                  {LEAVE_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="elrm-start-date" className={ui.label}>
                  Start date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="elrm-start-date"
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                  className={ui.input}
                />
              </div>
              <div>
                <label htmlFor="elrm-end-date" className={ui.label}>
                  End date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="elrm-end-date"
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={formData.startDate}
                  required
                  className={ui.input}
                />
              </div>
            </div>

            {requestedDuration > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] dark:bg-blue-500/10 dark:border-blue-500/20">
                <span className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Requested duration:{" "}
                  <strong>
                    {requestedDuration} day{requestedDuration !== 1 ? "s" : ""}
                  </strong>
                </span>
                {requestedDuration > balance.availableDays && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Exceeds available balance ({balance.availableDays} days)
                  </span>
                )}
              </div>
            )}

            <div>
              <label htmlFor="elrm-reason" className={ui.label}>
                Reason &amp; additional details <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="elrm-reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                placeholder="State the reason for taking leave, emergency contact info or coverage arrangement..."
                required
                className={ui.textarea}
              />
              <p className={ui.hint}>Minimum 5 characters.</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowApplyForm(false)} className={ui.btnSecondary}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className={ui.btnPrimary}>
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? <><WorkspaceLoader inline /> Submitting application...</> : "Submit leave request"}</span>
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Requests list */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
          <Tabs tabs={filterTabs} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter leave requests by status" />
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by reason or type..."
              aria-label="Search leave requests"
              className={`${ui.input} pl-9`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <WorkspaceLoader compact title="" />
            <p className={ui.muted}>Loading leave records...</p>
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title={error}
            action={
              <button type="button" onClick={() => fetchLeaveData()} className={ui.btnPrimary}>
                Retry loading
              </button>
            }
          />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No leave requests found"
            description={
              searchTerm || statusFilter !== "all"
                ? "No leave requests matched your filter criteria."
                : "You haven't submitted any time-off requests yet. Use the 'Request time off' button above to apply."
            }
            action={
              !showApplyForm && (
                <button type="button" onClick={() => setShowApplyForm(true)} className={ui.btnPrimary}>
                  <Plus className="w-4 h-4" />
                  Submit request
                </button>
              )
            }
          />
        ) : (
          <>
            {/* Phones: stacked cards */}
            <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRequests.map((leave, index) => {
                const days = leaveDays(leave);
                return (
                  <li key={leave._id || leave.id || index}>
                    <button
                      type="button"
                      onClick={() => setSelectedLeaveDetails(leave)}
                      className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-[#162033]/50 transition-colors focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-[#162033]/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {leave.leaveType || "Leave Request"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {days} day{days !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <StatusBadge status={leave.status} />
                      </div>
                      <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300 line-clamp-2">
                        {leave.reason || "No description provided"}
                      </p>
                      <RemarkNote leave={leave} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Tablet & desktop: table */}
            <div className={`hidden md:block ${ui.tableWrap}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.th}>Leave type</th>
                    <th className={ui.th}>Period</th>
                    <th className={ui.th}>Applied</th>
                    <th className={ui.th}>Reason</th>
                    <th className={ui.th}>Status</th>
                    <th className={`${ui.th} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((leave, index) => {
                    const days = leaveDays(leave);
                    return (
                      <tr key={leave._id || leave.id || index} className={ui.tr}>
                        <td className={ui.td}>
                          <p className="font-semibold text-slate-900 dark:text-white">{leave.leaveType || "Leave Request"}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">#{shortId(leave, index)}</p>
                        </td>
                        <td className={ui.td}>
                          <p className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {days} day{days !== 1 ? "s" : ""}
                          </p>
                        </td>
                        <td className={`${ui.td} whitespace-nowrap text-slate-500 dark:text-slate-400`}>
                          {formatDate(leave.createdAt || leave.appliedAt || leave.startDate)}
                        </td>
                        <td className={`${ui.td} max-w-xs`}>
                          <p className="truncate" title={leave.reason}>
                            {leave.reason || "No description provided"}
                          </p>
                          <RemarkNote leave={leave} />
                        </td>
                        <td className={ui.td}>
                          <StatusBadge status={leave.status} />
                        </td>
                        <td className={`${ui.td} text-right`}>
                          <button
                            type="button"
                            onClick={() => setSelectedLeaveDetails(leave)}
                            className={`${ui.btnGhost} ${ui.btnSm}`}
                          >
                            Details
                          </button>
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

      {/* Details modal */}
      {selectedLeaveDetails && (
        <div className={`${ui.overlay} animate-fade-in`} onClick={() => setSelectedLeaveDetails(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-details-title"
            className={`${ui.modal} sm:max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={ui.modalHeader}>
              <div>
                <h3 id="leave-details-title" className={ui.h2}>Leave request details</h3>
                <p className={`${ui.caption} mt-0.5`}>{selectedLeaveDetails.leaveType}</p>
              </div>
              <button type="button" onClick={() => setSelectedLeaveDetails(null)} className={ui.iconBtn} aria-label="Close">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className={ui.modalBody}>
              <DataRow label="Leave type" value={selectedLeaveDetails.leaveType} />
              <DataRow
                label="Duration"
                value={`${formatDate(selectedLeaveDetails.startDate)} – ${formatDate(selectedLeaveDetails.endDate)} (${leaveDays(selectedLeaveDetails)} days)`}
              />
              <DataRow
                label="Submitted on"
                value={formatDate(selectedLeaveDetails.createdAt || selectedLeaveDetails.appliedAt)}
              />
              <DataRow label="Approval status" value={<StatusBadge status={selectedLeaveDetails.status} />} />

              <div className="mt-4">
                <p className={ui.label}>Your reason</p>
                <p className={`${ui.subtle} p-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed`}>
                  {selectedLeaveDetails.reason || "No reason specified."}
                </p>
              </div>

              {(selectedLeaveDetails.adminRemark || selectedLeaveDetails.adminNotes) && (
                <div className="mt-4">
                  <p className={ui.label}>Management decision / remarks</p>
                  <p
                    className={`p-3 rounded-xl border text-sm leading-relaxed ${
                      String(selectedLeaveDetails.status).toLowerCase() === "rejected"
                        ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300"
                    }`}
                  >
                    {selectedLeaveDetails.adminRemark || selectedLeaveDetails.adminNotes}
                  </p>
                </div>
              )}
            </div>

            <div className={ui.modalFooter}>
              <button type="button" onClick={() => setSelectedLeaveDetails(null)} className={ui.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLeaveRequestsManagement;
