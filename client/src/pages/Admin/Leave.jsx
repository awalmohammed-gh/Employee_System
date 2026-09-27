import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Search, Building2, CalendarDays, FileText, CheckCircle, XCircle, Clock as ClockIcon, Users, ArrowRight, SlidersHorizontal, LayoutGrid, List, Check, X, Trash2, AlertTriangle, Calendar } from "lucide-react";
import { Badge, Tabs } from "./ui/primitives";
import { allLeaves, updateStatus, deleteLeave } from "../../apis/fontApis";
import { useManagement } from "../../context/ManagementContextProvider";
import { getSocket, registerSocketUser } from "../../utils/socket";
import LeaveApprovalWorkflow from "../../components/LeaveApprovalWorkflow";
import TeamLeaveCalendar from "../../components/TeamLeaveCalendar";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";

export const Leave = () => {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "calendar" | "all"
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deleteConfirmLeave, setDeleteConfirmLeave] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { setShowToast, admin } = useManagement();

  const fetchLeaveRequests = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      setIsError(null);
      const { data } = await allLeaves();

      if (data.success) {
        let leaves = [];
        if (Array.isArray(data.leaves)) {
          leaves = data.leaves;
        } else if (data.leaves && typeof data.leaves === "object") {
          leaves = [data.leaves];
        } else if (Array.isArray(data.data)) {
          leaves = data.data;
        } else {
          leaves = [];
        }
        setRequests(leaves);
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
      console.error("Error fetching leave requests:", error);
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
  };

  useEffect(() => {
    fetchLeaveRequests();

    const adminId = admin?._id || admin?.id || "admin";
    registerSocketUser(adminId, "admin");

    const socket = getSocket();

    const handleLeaveCreated = (newLeave) => {
      const leaveObj = newLeave.leave || newLeave;
      setRequests((prev) => {
        const id = leaveObj._id || leaveObj.id;
        if (prev.some((r) => String(r._id || r.id) === String(id))) {
          return prev;
        }
        return [leaveObj, ...prev];
      });
      setShowToast({
        show: true,
        message: `New leave request submitted by ${leaveObj.employee?.fullName || "an employee"}.`,
        type: "info",
      });
    };

    const handleLeaveStatusChanged = (eventData) => {
      const updatedLeave = eventData.leave || eventData;
      const updatedId = eventData.leaveId || updatedLeave._id || updatedLeave.id;
      setRequests((prev) =>
        prev.map((r) =>
          String(r._id || r.id) === String(updatedId)
            ? { ...r, ...updatedLeave, status: eventData.status || updatedLeave.status }
            : r
        )
      );
    };

    socket.on("leave_created", handleLeaveCreated);
    socket.on("leave_status_changed", handleLeaveStatusChanged);

    return () => {
      socket.off("leave_created", handleLeaveCreated);
      socket.off("leave_status_changed", handleLeaveStatusChanged);
    };
  }, [admin, setShowToast]);

  const handleStatusChange = async (id, status, adminRemark = "") => {
    // Find the leave request
    const leaveToUpdate = requests.find((leave) => String(leave._id) === String(id));
    if (!leaveToUpdate) return;

    // Don't update if status is the same
    if (leaveToUpdate.status === status && !adminRemark) return;

    try {
      setUpdatingStatus(id);
      const { data } = await updateStatus(id, status, adminRemark);

      if (data.success) {
        setRequests((prev) =>
          prev.map((leave) =>
            String(leave._id) === String(id)
              ? { ...leave, status, adminRemark: adminRemark || leave.adminRemark }
              : leave
          )
        );

        setShowToast({
          show: true,
          message:
            data.message ||
            `Leave request ${status.toLowerCase()} and saved to database successfully!`,
          type: "success",
        });
      } else {
        setShowToast({
          show: true,
          message: data.message || "Failed to update status in database.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update status.";
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmLeave) return;
    const targetId = deleteConfirmLeave._id || deleteConfirmLeave.id;
    if (!targetId) return;

    try {
      setIsDeleting(true);
      const res = await deleteLeave(targetId);
      if (res?.data?.success || res?.status === 200) {
        setRequests((prev) =>
          prev.filter(
            (r) => String(r._id) !== String(targetId) && String(r.id) !== String(targetId)
          )
        );
        setShowToast({
          show: true,
          message: "Leave record permanently deleted from the database.",
          type: "success",
        });
        setDeleteConfirmLeave(null);
      } else {
        throw new Error(res?.data?.message || "Failed to delete leave request");
      }
    } catch (err) {
      console.error("Error deleting leave:", err);
      setShowToast({
        show: true,
        message: err.response?.data?.message || err.message || "Failed to delete leave record.",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredData = requests.filter((leave) => {
    const employeeName = leave.employee?.fullName || "";
    const department = leave.employee?.department || "";
    const leaveType = leave.leaveType || "";

    const matchesSearch =
      employeeName.toLowerCase().includes(search.toLowerCase()) ||
      department.toLowerCase().includes(search.toLowerCase()) ||
      leaveType.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "All" || leave.status === filterStatus;

    const matchesType = filterType === "All" || leave.leaveType === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const pendingList = requests.filter((leave) => leave.status === "Pending");
  const approvedRequests = requests.filter((leave) => leave.status === "Approved").length;
  const pendingRequests = pendingList.length;
  const rejectedRequests = requests.filter((leave) => leave.status === "Rejected").length;
  const totalRequests = requests.length;

  const getStatusSelectStyles = (status) => {
    switch (status) {
      case "Approved":
        return "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30 focus:ring-[#16A34A]/30";
      case "Pending":
        return "bg-[#FFFBEB] text-[#B45309] border-[#F59E0B]/30 focus:ring-[#F59E0B]/30";
      case "Rejected":
        return "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30 focus:ring-[#DC2626]/30";
      default:
        return "bg-[#F8FAFC] text-[#64748B] border-[#64748B]/30 focus:ring-[#64748B]/30";
    }
  };

  const statusOptions = ["All", "Approved", "Pending", "Rejected"];
  const leaveTypes = [
    "All",
    ...new Set(requests.map((leave) => leave.leaveType).filter(Boolean)),
  ];

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchLeaveRequests}
        onClose={() => setIsError(null)}
      />
    );
  }

  return (
    <div id="admin-leave-management" className={`${ui.page} overflow-x-hidden`}>
      {/* Toolbar */}
      <div className={ui.toolbar}>
        <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
          {pendingRequests > 0 && (
            <Badge tone="warning" dot pulse>
              {pendingRequests} action required
            </Badge>
          )}
          <span>Review leave requests and plan team availability.</span>
        </p>
        <Tabs
          ariaLabel="Leave views"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "pending", label: "Pending review", icon: LayoutGrid, count: pendingRequests > 0 ? pendingRequests : undefined },
            { value: "calendar", label: "Team calendar", icon: Calendar },
            { value: "all", label: "All records", icon: List, count: totalRequests },
          ]}
        />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div
          onClick={() => {
            setActiveTab("all");
            setFilterStatus("All");
          }}
          className="cursor-pointer bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Total Requests
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {totalRequests}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("pending")}
          className="cursor-pointer bg-white dark:bg-[#111927] border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-amber-500 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Action Pending</span>
              {pendingRequests > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {pendingRequests}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <ClockIcon className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("all");
            setFilterStatus("Approved");
          }}
          className="cursor-pointer bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-emerald-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Approved
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {approvedRequests}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("all");
            setFilterStatus("Rejected");
          }}
          className="cursor-pointer bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-rose-500/50 transition-all flex items-center justify-between group"
        >
          <div>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              Rejected
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {rejectedRequests}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab 1: Automated Leave Approval Workflow Hub */}
      {activeTab === "pending" && (
        <LeaveApprovalWorkflow
          allRequests={requests}
          pendingRequests={pendingList}
          onUpdateStatus={handleStatusChange}
          updatingId={updatingStatus}
          onRefresh={fetchLeaveRequests}
        />
      )}

      {/* Tab 2: Team Leave Calendar (visualizes all approved leave requests to prevent staffing conflicts) */}
      {activeTab === "calendar" && (
        <TeamLeaveCalendar
          leaves={requests}
          onLeaveSelect={(leave) => {
            console.log("Selected leave:", leave);
          }}
        />
      )}

      {/* Tab 3: Full Leave Database Records Table (with Search, Filter & Row-level quick Approve/Reject) */}
      {activeTab === "all" && (
        <div className="space-y-4">
          {/* Search Bar & Filters */}
          <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by employee, department, or leave type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200/80 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-[#002185]/25 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1.5 pl-1 pr-2 text-slate-400">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-200/80 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs cursor-pointer hover:border-blue-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "All" ? "All statuses" : status}
                    </option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-200/80 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs cursor-pointer hover:border-blue-500"
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All leave types" : type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {filteredData.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900 dark:text-white">{requests.length}</span>{" "}
              leave records
            </span>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-2 px-5 py-3.5 bg-slate-50 dark:bg-[#162033]/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[13px] font-medium text-slate-500 dark:text-slate-400">
              <div className="col-span-3">Employee</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-2">Date Range</div>
              <div className="col-span-1 text-center">Days</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Admin Actions</div>
            </div>

            {/* Main Content */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredData.length > 0 ? (
                filteredData.map((leave) => {
                  const leaveId = leave._id;
                  const employeeName = leave.employee?.fullName || "Unknown";
                  const employeeId = leave.employee?.employeeId || "N/A";
                  const department = leave.employee?.department || "N/A";
                  const leaveType = leave.leaveType || "N/A";
                  const status = leave.status || "Pending";
                  const totalDays = leave.totalDays || 0;
                  const isUpdating = updatingStatus === leaveId;

                  return (
                    <div
                      key={leaveId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Desktop View */}
                      <div className="hidden lg:grid grid-cols-12 gap-2 items-center px-5 py-3.5">
                        <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#002185] dark:bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-2xs">
                            {employeeName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {employeeName}
                            </p>
                            <p className="text-xs text-slate-400 font-mono">{employeeId}</p>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {department}
                          </p>
                          <span className="inline-block mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                            {leaveType}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="flex items-center gap-1">
                              {formatDate(leave.startDate)}
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              {formatDate(leave.endDate)}
                            </span>
                          </p>
                          {leave.reason && (
                            <p className="text-[10px] text-slate-400 italic truncate mt-0.5">
                              "{leave.reason}"
                            </p>
                          )}
                        </div>

                        <div className="col-span-1 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums bg-slate-100 dark:bg-[#162033] rounded-md px-2 py-1">
                            {totalDays}d
                          </span>
                        </div>

                        <div className="col-span-2">
                          <select
                            value={status}
                            onChange={(e) =>
                              handleStatusChange(leaveId, e.target.value)
                            }
                            disabled={isUpdating}
                            className={`text-xs font-semibold pl-3 pr-7 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none transition-colors ${getStatusSelectStyles(
                              status
                            )} ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                            style={{
                              backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "right 8px center",
                              backgroundSize: "10px",
                            }}
                          >
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>

                        {/* Direct Approve & Reject Quick Action Buttons */}
                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                          {status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(leaveId, "Approved")}
                              disabled={isUpdating}
                              title="Click to Approve request"
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                          )}

                          {status !== "Rejected" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(leaveId, "Rejected")}
                              disabled={isUpdating}
                              title="Click to Reject request"
                              className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#162033] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[11px] font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Reject</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmLeave(leave);
                            }}
                            title="Permanently delete leave record"
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile View */}
                      <div className="lg:hidden p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-[#002185] dark:bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                              {employeeName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {employeeName}
                              </p>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {department}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-md px-2 py-1 border border-blue-200 dark:border-blue-800">
                            {totalDays} days
                          </span>
                        </div>

                        {leave.reason && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 italic">
                            "{leave.reason}"
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(leaveId, "Rejected")}
                            disabled={isUpdating || status === "Rejected"}
                            className="py-2 px-2 rounded-xl bg-white dark:bg-[#162033] border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(leaveId, "Approved")}
                            disabled={isUpdating || status === "Approved"}
                            className="py-2 px-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 shadow-2xs"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmLeave(leave)}
                            className="py-2 px-2 rounded-xl bg-white dark:bg-[#162033] border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Empty State */
                <div className="text-center py-14 bg-white dark:bg-[#111927]">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-[#162033] text-slate-400 flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No leave records found
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmLeave && (
        <div
          id="delete-leave-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => !isDeleting && setDeleteConfirmLeave(null)}
        >
          <div
            id="delete-leave-modal-container"
            className="bg-white dark:bg-[#111927] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Leave Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete the{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {deleteConfirmLeave?.leaveType || "leave"}
                  </span>{" "}
                  request for{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {deleteConfirmLeave?.employee?.fullName || "this employee"}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This action is irreversible and will permanently remove this leave request from the database.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmLeave(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Deleting...</span>
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
    </div>
  );
};

export default Leave;
import { ui } from "./ui/tokens";
