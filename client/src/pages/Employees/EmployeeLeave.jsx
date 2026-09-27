import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  X,
  CalendarDays,
  ShieldCheck,
  MessageSquare,
  Search,
  RefreshCw,
} from "lucide-react";
import ApplyLeaveModal from "../../components/modal/ApplyLeaveModal";
import { myLeave } from "../../apis/fontApis";
import { useManagement } from "../../context/ManagementContextProvider";
import { getSocket, registerSocketUser } from "../../utils/socket";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import { ui, tones } from "./ui/tokens";
import { Badge, Card, EmptyState, StatCard, Tabs } from "./ui/primitives";

const EmployeeLeave = () => {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [balanceStats, setBalanceStats] = useState({
    totalDays: 20,
    usedDays: 0,
    availableDays: 20,
  });

  const { setShowToast, employee } = useManagement();

  const fetchLeaveData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      setIsError(null);
      const { data } = await myLeave();

      if (data.success || Array.isArray(data.leaves) || Array.isArray(data)) {
        let leaves = [];
        if (Array.isArray(data.leaves)) {
          leaves = data.leaves;
        } else if (Array.isArray(data.data)) {
          leaves = data.data;
        } else if (Array.isArray(data)) {
          leaves = data;
        } else if (data.leaves && typeof data.leaves === "object") {
          leaves = [data.leaves];
        }

        setLeaveRequests(leaves);

        if (data.employeeBalance) {
          setBalanceStats(data.employeeBalance);
        } else {
          // Compute balance stats from requests
          const approvedDays = leaves
            .filter((l) => (l.status || "").toLowerCase() === "approved")
            .reduce((acc, curr) => acc + (Number(curr.totalDays) || Number(curr.days) || 1), 0);
          setBalanceStats({
            totalDays: 20,
            usedDays: approvedDays,
            availableDays: Math.max(0, 20 - approvedDays),
          });
        }
      } else {
        if (!isSilent) {
          setIsError(data.message || "Failed to fetch leave requests.");
          setShowToast({
            show: true,
            message: data.message || "Failed to fetch leave requests.",
            type: "error",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching leave data:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch leave requests.";
      if (!isSilent) {
        setIsError(errorMessage);
        setShowToast({
          show: true,
          message: errorMessage,
          type: "error",
        });
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [setShowToast]);

  // Initial load and Socket.io real-time listener setup
  useEffect(() => {
    fetchLeaveData();

    // Register user with socket room
    const currentEmpId = employee?._id || employee?.id || employee?.employeeId;
    if (currentEmpId) {
      registerSocketUser(currentEmpId, "employee");
    }

    const socket = getSocket();

    const handleLeaveStatusChanged = (eventData) => {
      console.log("[Socket.io] Real-time leave_status_changed event received:", eventData);
      
      const updatedLeave = eventData.leave || eventData;
      const updatedId = eventData.leaveId || updatedLeave._id || updatedLeave.id;
      const newStatus = eventData.status || updatedLeave.status || "Updated";
      const isApproved = (newStatus || "").toLowerCase() === "approved";
      const isRejected = (newStatus || "").toLowerCase() === "rejected";

      // 1. Instantly update the state list
      setLeaveRequests((prevList) => {
        const found = prevList.some((item) => String(item._id || item.id) === String(updatedId));
        if (found) {
          return prevList.map((item) =>
            String(item._id || item.id) === String(updatedId)
              ? {
                  ...item,
                  ...updatedLeave,
                  status: newStatus,
                  adminNotes: eventData.adminNotes || updatedLeave.adminNotes || item.adminNotes,
                  adminRemark: eventData.adminNotes || updatedLeave.adminRemark || item.adminRemark,
                  approvedBy: eventData.reviewedBy || updatedLeave.approvedBy || item.approvedBy,
                  reviewedAt: eventData.reviewedAt || updatedLeave.reviewedAt || new Date().toISOString(),
                  approvedAt: eventData.reviewedAt || updatedLeave.approvedAt || new Date().toISOString(),
                }
              : item
          );
        }
        return [updatedLeave, ...prevList];
      });

      // 2. If modal is viewing this leave, update modal in real-time
      setSelectedLeave((prev) => {
        if (prev && String(prev._id || prev.id) === String(updatedId)) {
          return {
            ...prev,
            ...updatedLeave,
            status: newStatus,
            adminNotes: eventData.adminNotes || updatedLeave.adminNotes || prev.adminNotes,
            adminRemark: eventData.adminNotes || updatedLeave.adminRemark || prev.adminRemark,
            approvedBy: eventData.reviewedBy || updatedLeave.approvedBy || prev.approvedBy,
            reviewedAt: eventData.reviewedAt || updatedLeave.reviewedAt || new Date().toISOString(),
          };
        }
        return prev;
      });

      // 3. Trigger instant toast notification
      const dateRangeStr = updatedLeave.startDate && updatedLeave.endDate
        ? ` for ${new Date(updatedLeave.startDate).toLocaleDateString()} to ${new Date(updatedLeave.endDate).toLocaleDateString()}`
        : "";
      
      setShowToast({
        show: true,
        message: isApproved
          ? `Your leave request${dateRangeStr} has been approved by management!`
          : isRejected
          ? `Your leave request${dateRangeStr} was rejected by management.${eventData.adminNotes ? ` Note: "${eventData.adminNotes}"` : ""}`
          : `Leave request status updated to ${newStatus}.`,
        type: isApproved ? "success" : isRejected ? "error" : "info",
      });

      // 4. Background re-fetch to ensure complete sync with database
      fetchLeaveData(true);
    };

    socket.on("leave_status_changed", handleLeaveStatusChanged);
    socket.on("leave_approved", handleLeaveStatusChanged);
    socket.on("leave_rejected", handleLeaveStatusChanged);

    return () => {
      socket.off("leave_status_changed", handleLeaveStatusChanged);
      socket.off("leave_approved", handleLeaveStatusChanged);
      socket.off("leave_rejected", handleLeaveStatusChanged);
    };
  }, [fetchLeaveData, employee, setShowToast]);

  const statusMeta = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return { tone: "success", icon: CheckCircle, strip: "bg-emerald-500" };
      case "rejected":
        return { tone: "danger", icon: XCircle, strip: "bg-rose-500" };
      case "pending":
        return { tone: "warning", icon: ClockIcon, strip: "bg-amber-400" };
      default:
        return { tone: "neutral", icon: ClockIcon, strip: "bg-slate-300" };
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  const formatDateLong = (date) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString("en-GH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  // Filtered requests
  const filteredRequests = leaveRequests.filter((leave) => {
    const status = (leave.status || "Pending").toLowerCase();
    const type = (leave.leaveType || "").toLowerCase();
    const reason = (leave.reason || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = type.includes(search) || reason.includes(search);
    const matchesFilter =
      statusFilter === "All" || status === statusFilter.toLowerCase();

    return matchesSearch && matchesFilter;
  });

  // Calculate summary stats
  const approvedRequests = leaveRequests.filter(
    (leave) => (leave.status || "").toLowerCase() === "approved",
  ).length;
  const pendingRequests = leaveRequests.filter(
    (leave) => (leave.status || "").toLowerCase() === "pending",
  ).length;
  const rejectedRequests = leaveRequests.filter(
    (leave) => (leave.status || "").toLowerCase() === "rejected",
  ).length;

  const handleViewDetails = (leave) => {
    setSelectedLeave(leave);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchLeaveData}
        onClose={() => setIsError(null)}
      />
    );
  }

  const availablePercent = Math.min(
    100,
    Math.max(0, (balanceStats.availableDays / (balanceStats.totalDays || 20)) * 100)
  );
  const isFiltered = searchTerm || statusFilter !== "All";
  const filterTabs = [
    { value: "All", label: "All", count: leaveRequests.length },
    { value: "Approved", label: "Approved", count: approvedRequests },
    { value: "Pending", label: "Pending", count: pendingRequests },
    { value: "Rejected", label: "Rejected", count: rejectedRequests },
  ];
  const selectedMeta = selectedLeave ? statusMeta(selectedLeave.status) : null;

  return (
    <>
      <div id="employee-leave-portal" className={ui.page}>
        <div className={`${ui.card} p-4 flex flex-wrap items-center justify-end gap-2`}>
          <button
            type="button"
            onClick={() => fetchLeaveData(false)}
            className={`${ui.btnSecondary} w-10! px-0!`}
            title="Refresh requests"
            aria-label="Refresh requests"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            aria-haspopup="dialog"
            className={`${ui.btnPrimary} flex-1 sm:flex-initial`}
          >
            <Plus className="h-4 w-4" />
            Apply for leave
          </button>
        </div>

        {/* Balance & status summary */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className={`${ui.card} ${ui.cardInteractive} p-4 sm:p-5`}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Available balance</span>
              <span className={`grid place-items-center w-8 h-8 rounded-lg ${tones.brand.icon}`}>
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {balanceStats.availableDays}
              <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">/ {balanceStats.totalDays} days</span>
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#002185] dark:bg-blue-500 transition-[width] duration-500"
                style={{ width: `${availablePercent}%` }}
              />
            </div>
          </div>

          <StatCard
            label="Approved leaves"
            value={<span className="text-emerald-600 dark:text-emerald-400">{approvedRequests}</span>}
            hint={`${balanceStats.usedDays} days used · excluded from attendance penalties`}
            icon={CheckCircle}
            tone="success"
          />

          <div className={`${ui.card} ${ui.cardInteractive} p-4 sm:p-5`}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                Pending approval
                {pendingRequests > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              </span>
              <span className={`grid place-items-center w-8 h-8 rounded-lg ${tones.warning.icon}`}>
                <ClockIcon className="w-4 h-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingRequests}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Awaiting manager review &amp; approval</p>
          </div>

          <StatCard
            label="Rejected / unapproved"
            value={<span className="text-rose-600 dark:text-rose-400">{rejectedRequests}</span>}
            hint="View admin remarks in details"
            icon={XCircle}
            tone="danger"
          />
        </div>

        {/* Requests */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className={ui.h2}>Request history</h2>
              <p className={`${ui.caption} mt-0.5`}>Status updates arrive in real time.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <Tabs tabs={filterTabs} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter by status" />
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search by type or reason..."
                  aria-label="Search leave requests"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${ui.input} pl-9`}
                />
              </div>
            </div>
          </div>

          {filteredRequests.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRequests.map((leave, index) => {
                const leaveId = leave._id || leave.id;
                const statusNormalized = (leave.status || "Pending").toLowerCase();
                const isApproved = statusNormalized === "approved";
                const isRejected = statusNormalized === "rejected";
                const daysCount = leave.totalDays || leave.days || leave.numberOfDays || 1;
                const reviewer = leave.approvedBy || leave.reviewedBy || (isApproved || isRejected ? "Management" : null);
                const reviewDate = leave.reviewedAt || leave.approvedAt;
                const adminNote = leave.adminNotes || leave.adminRemark;
                const meta = statusMeta(leave.status);
                const StatusIcon = meta.icon;

                return (
                  <li key={leaveId || index} className="relative p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-[#162033]/40 transition-colors">
                    <span aria-hidden="true" className={`absolute left-0 top-4 bottom-4 w-0.75 rounded-r-full ${meta.strip}`} />
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${tones[meta.tone].icon}`}>
                          <StatusIcon className="w-4.5 h-4.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{leave.leaveType || "Leave Request"}</h3>
                            <Badge tone="neutral">
                              {daysCount} day{daysCount !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">{formatDate(leave.startDate)}</span>
                            <span className="text-slate-400">to</span>
                            <span className="font-medium">{formatDate(leave.endDate)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:shrink-0 pl-13 sm:pl-0">
                        <Badge tone={meta.tone} className="capitalize">
                          <StatusIcon className="w-3 h-3" />
                          {leave.status || "Pending"}
                        </Badge>
                        <button type="button" onClick={() => handleViewDetails(leave)} className={`${ui.btnSecondary} ${ui.btnSm}`}>
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </div>
                    </div>

                    {(leave.reason || reviewer || adminNote || reviewDate) && (
                      <div className="mt-3 sm:pl-13 space-y-2">
                        {leave.reason && (
                          <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            <span className="text-slate-400 dark:text-slate-500">Reason: </span>
                            {leave.reason}
                          </p>
                        )}
                        {(reviewer || adminNote || reviewDate) && (
                          <div
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs ${
                              isApproved
                                ? "bg-emerald-50/70 border-emerald-200/70 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300"
                                : isRejected
                                ? "bg-rose-50/70 border-rose-200/70 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                                : "bg-amber-50/70 border-amber-200/70 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300"
                            }`}
                          >
                            <span className="flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-px" />
                              {adminNote ? (
                                <span>
                                  <span className="font-semibold">Manager feedback:</span> “{adminNote}”
                                </span>
                              ) : (
                                <span>Decision recorded by {reviewer || "Management"}</span>
                              )}
                            </span>
                            {reviewDate && <span className="text-slate-500 dark:text-slate-400 shrink-0">Reviewed {formatDate(reviewDate)}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={isFiltered ? "No matching leave requests" : "No leave requests submitted yet"}
              description={
                isFiltered
                  ? "Try clearing your search query or selecting 'All' statuses to view your complete record history."
                  : "When you submit a leave application, you can track its review progress in real time right here without needing to refresh."
              }
              action={
                isFiltered ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("All");
                    }}
                    className={ui.btnSecondary}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowLeaveModal(true)} className={ui.btnPrimary}>
                    <Plus className="h-4 w-4" />
                    Apply for leave
                  </button>
                )
              }
              className="py-16"
            />
          )}
        </Card>
      </div>

      {/* Details modal */}
      {showDetailsModal && selectedLeave && (
        <div className={`${ui.overlay} animate-fade-in`} onClick={() => setShowDetailsModal(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-leave-details-title"
            onClick={(e) => e.stopPropagation()}
            className={`${ui.modal} sm:max-w-xl`}
          >
            <div className={ui.modalHeader}>
              <div className="flex items-start gap-3 min-w-0">
                <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${tones.brand.icon}`}>
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="employee-leave-details-title" className={ui.h2}>Leave request details</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {selectedLeave.id || selectedLeave._id || "N/A"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowDetailsModal(false)} className={ui.iconBtn} aria-label="Close">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className={`${ui.modalBody} space-y-5`}>
              <div className={`flex items-center justify-between gap-3 p-4 rounded-xl border ${tones[selectedMeta.tone].badge}`}>
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-white/80 dark:bg-[#111927]/60">
                    <selectedMeta.icon className="w-4.5 h-4.5" />
                  </span>
                  <div>
                    <p className="text-xs opacity-80">Current status</p>
                    <p className="text-base font-semibold capitalize">{selectedLeave.status || "Pending"}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#111927]/60 text-slate-800 dark:text-slate-100">
                  {selectedLeave.totalDays || selectedLeave.days || 1} day(s)
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Leave category", value: selectedLeave.leaveType || "Annual Leave" },
                  { label: "Leave period", value: `${formatDate(selectedLeave.startDate)} — ${formatDate(selectedLeave.endDate)}` },
                  { label: "Submitted", value: formatDateLong(selectedLeave.requestedDate || selectedLeave.createdAt) },
                  {
                    label: "Review",
                    value:
                      selectedLeave.reviewedAt || selectedLeave.approvedAt
                        ? `Reviewed on ${formatDate(selectedLeave.reviewedAt || selectedLeave.approvedAt)}`
                        : "Pending review",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className={`${ui.subtle} p-3.5`}>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{value}</dd>
                  </div>
                ))}
              </dl>

              {selectedLeave.reason && (
                <div>
                  <p className={ui.label}>Applicant reason</p>
                  <p className={`${ui.subtle} p-3.5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed`}>{selectedLeave.reason}</p>
                </div>
              )}

              {(selectedLeave.adminNotes || selectedLeave.adminRemark) && (
                <div>
                  <p className={`${ui.label} flex items-center gap-1.5`}>
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Management feedback / notes
                  </p>
                  <p className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-sm text-slate-800 leading-relaxed dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-slate-200">
                    “{selectedLeave.adminNotes || selectedLeave.adminRemark}”
                  </p>
                </div>
              )}
            </div>

            <div className={ui.modalFooter}>
              <button type="button" onClick={() => setShowDetailsModal(false)} className={ui.btnPrimary}>
                Close details
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <ApplyLeaveModal
          onClose={() => setShowLeaveModal(false)}
          onSuccess={() => fetchLeaveData(true)}
        />
      )}
    </>
  );
};

export default EmployeeLeave;
