import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminDashboardOverview,
  getDashboardStats,
  getAdminEmployees,
  updateStatus,
  exportEmployeesCSV,
} from "../../apis/fontApis";
import {
  Users,
  UserPlus,
  UserCheck,
  CalendarCheck,
  Building2,
  Clock,
  BanknoteIcon,
  TrendingUp,
  PieChart as PieChartIcon,
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserX,
  Download,
  Award,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import ErrorMessage from "../../ui/ErrorMessage";
import DepartmentStatusVisualizer from "../../components/DepartmentStatusVisualizer";
import AnnouncementBoard from "../../components/AnnouncementBoard";
import DashboardMetricsSkeleton from "../../components/DashboardMetricsSkeleton";
import LatenessDeductionsLineChart from "../../components/LatenessDeductionsLineChart";
import PenaltyPayrollImpactChart from "../../components/PenaltyPayrollImpactChart";
import AttentionRequiredLateAttendance from "../../components/AttentionRequiredLateAttendance";
import DashboardSummaryMetrics from "../../components/DashboardSummaryMetrics";
import WorkforceSummaryDashboard from "../../components/WorkforceSummaryDashboard";
import DashboardQuickActions from "../../components/DashboardQuickActions";
import AddEmployee from "../../components/modal/AddEmployee";
import RecordAttendanceModal from "../../components/modal/RecordAttendanceModal";
import PayslipsModal from "../../components/modal/PayslipsModal";
import DashboardDataSummarySection from "../../components/DashboardDataSummarySection";
import Avatar from "../../components/Avatar";
import EmployeeDetailModal from "../../components/EmployeeDetailModal";
import { exportHREmployeeReportToCSV } from "../../utils/exportCsv";
import { useManagement } from "../../context/ManagementContextProvider";
import { ui } from "./ui/tokens";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const {
    showEmployeeModal,
    setShowEmployeeModal,
    showPayslipsModal,
    setShowPayslipsModal,
  } = useManagement();
  const [showRecordAttendanceModal, setShowRecordAttendanceModal] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [employeeList, setEmployeeList] = useState([]);
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(null);
  const [actionProcessingId, setActionProcessingId] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

  const filteredEmployeeList = useMemo(() => {
    if (!employeeSearchTerm) return employeeList;
    const term = employeeSearchTerm.toLowerCase().trim();
    return employeeList.filter(
      (emp) =>
        emp.fullName?.toLowerCase().includes(term) ||
        emp.department?.toLowerCase().includes(term) ||
        emp.position?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.employeeId?.toLowerCase().includes(term)
    );
  }, [employeeList, employeeSearchTerm]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setIsError(null);

      // Query live single-tenant endpoints directly from database
      const [statsRes, overviewRes, employeesRes] = await Promise.allSettled([
        getDashboardStats(),
        adminDashboardOverview(),
        getAdminEmployees(),
      ]);

      let mergedData = {};

      if (overviewRes.status === "fulfilled" && overviewRes.value.data?.success) {
        mergedData = { ...overviewRes.value.data.overview };
      }

      if (statsRes.status === "fulfilled" && statsRes.value.data?.success) {
        const liveStats = statsRes.value.data;
        mergedData = {
          ...mergedData,
          ...liveStats,
          cards: {
            ...mergedData.cards,
            ...liveStats.cards,
          },
          attendance: {
            ...mergedData.attendance,
            ...liveStats.attendance,
          },
          payroll: {
            ...mergedData.payroll,
            ...liveStats.payroll,
          },
          leave: {
            ...mergedData.leave,
            ...liveStats.leave,
          },
          departments:
            liveStats.departments ||
            liveStats.departmentDistribution ||
            mergedData.departments,
          recentAttendance:
            liveStats.recentAttendance || mergedData.recentAttendance || [],
          pendingApprovalsList:
            liveStats.pendingApprovalsList || mergedData.pendingApprovalsList || [],
        };
      }

      if (Object.keys(mergedData).length > 0) {
        setDashboardData(mergedData);
      } else {
        setIsError("Failed to fetch dashboard data from server.");
      }

      // Live Employees list directly from database (Global Single-Tenant)
      if (employeesRes.status === "fulfilled" && employeesRes.value?.data) {
        const empData = employeesRes.value.data;
        const list = Array.isArray(empData.employees)
          ? empData.employees
          : Array.isArray(empData)
          ? empData
          : empData.list || [];
        setEmployeeList(list);
      } else if (Array.isArray(mergedData?.recentEmployees) && mergedData.recentEmployees.length > 0) {
        setEmployeeList(mergedData.recentEmployees);
      } else {
        setEmployeeList([]);
      }

    } catch (error) {
      console.error("Error fetching dashboard:", error);
      setEmployeeList([]);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch dashboard data.";
      setIsError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportEmployeesCSV = async () => {
    try {
      setIsExportingCsv(true);
      const res = await exportEmployeesCSV();
      if (res.data) {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `workforce-employee-database-${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setExportNotice({
          type: "success",
          message: "HR Employee database exported successfully to CSV.",
        });
        setTimeout(() => setExportNotice(null), 5000);
      }
    } catch (err) {
      console.warn("Server CSV export fallback to client utility:", err.message);
      exportHREmployeeReportToCSV(employeeList);
      setExportNotice({
        type: "success",
        message: "HR Employee database exported successfully via report generator.",
      });
      setTimeout(() => setExportNotice(null), 5000);
    } finally {
      setIsExportingCsv(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    const val = typeof amount === "number" ? amount : parseFloat(amount) || 0;
    return `GH₵${val.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Handle instant Approval / Rejection directly from dashboard
  const handleQuickDecision = async (leaveId, status) => {
    try {
      setActionProcessingId(leaveId);
      const res = await updateStatus(leaveId, status, `Processed directly from Admin Dashboard.`);
      if (res.data?.success) {
        // Refresh dashboard overview
        fetchDashboardData();
      }
    } catch (err) {
      console.error("Quick decision error:", err);
    } finally {
      setActionProcessingId(null);
    }
  };

  // Daily Attendance Ratio for Today
  const todayAttendanceRatioData = useMemo(() => {
    const total = Number(dashboardData?.cards?.totalEmployees || dashboardData?.attendance?.totalEmployees || 0);
    const present = Number(dashboardData?.cards?.presentToday ?? dashboardData?.attendance?.present ?? 0);
    const onLeave = Number(dashboardData?.cards?.onLeave ?? dashboardData?.attendance?.onLeave ?? 0);
    const late = Number(dashboardData?.attendance?.late ?? 0);
    const onTime = Math.max(0, present - late);
    const absent = Math.max(0, total - (present + onLeave));

    const ratioPercent = total > 0 ? Math.round((present / total) * 100) : 0;
    const accountedPercent = total > 0 ? Math.round(((present + onLeave) / total) * 100) : 0;

    const segments = [
      { name: "On Time", value: onTime, fill: "#16A34A" },
      { name: "Late Clock-in", value: late, fill: "#F59E0B" },
      { name: "Approved Leave", value: onLeave, fill: "#3B82F6" },
      { name: "Absent", value: absent, fill: "#DC2626" },
    ].filter((item) => item.value > 0);

    return {
      total,
      present,
      onTime,
      late,
      onLeave,
      absent,
      ratioPercent,
      accountedPercent,
      segments: segments.length > 0 ? segments : [{ name: "No Attendance", value: 1, fill: "#64748B" }],
    };
  }, [dashboardData]);

  // Prepare stats cards data from API response
  const statsCards = useMemo(() => {
    if (!dashboardData) return [];
    const totalPayroll = dashboardData.payroll?.totalPayroll ?? 0;
    const pendingPayroll = dashboardData.payroll?.pending ?? dashboardData.payroll?.pendingDisbursements ?? 0;
    const activeEmpCount = Number(dashboardData.cards?.activeEmployees ?? dashboardData.activeEmployees ?? dashboardData.cards?.totalEmployees ?? 0);
    const totalEmpCount = Number(dashboardData.cards?.totalEmployees ?? dashboardData.totalEmployees ?? activeEmpCount);

    return [
      {
        title: "Active Employees",
        value: activeEmpCount,
        icon: Users,
        color: "bg-[#002185]",
        textColor: "text-[#002185] dark:text-blue-400",
        link: "/admin/employees",
        subtitle: totalEmpCount > 0 ? `${activeEmpCount} active of ${totalEmpCount} staff` : "0 active employees registered",
      },
      {
        title: "Pending Leave Requests",
        value: Number(dashboardData.cards?.pendingLeaves ?? dashboardData.leave?.pending ?? 0),
        icon: Clock,
        color: "bg-[#ff5500]",
        textColor: "text-[#ff5500] dark:text-orange-400",
        link: "/admin/leave",
        subtitle: (dashboardData.cards?.pendingLeaves || dashboardData.leave?.pending || 0) > 0 ? "Awaiting administrative review" : "No pending review requests",
      },
      {
        title: "Payroll Status",
        value: formatCurrency(totalPayroll),
        icon: BanknoteIcon,
        color: "bg-[#16A34A]",
        textColor: "text-[#16A34A] dark:text-emerald-400",
        link: "/admin/payroll",
        subtitle: pendingPayroll > 0 ? `${formatCurrency(pendingPayroll)} pending` : "Disbursements up to date",
      },
      {
        title: "Present Today",
        value: Number(dashboardData.cards?.presentToday ?? dashboardData.attendance?.present ?? 0),
        icon: UserCheck,
        color: "bg-[#002185]",
        textColor: "text-[#002185] dark:text-blue-400",
        link: "/admin/attendance",
        subtitle: `${todayAttendanceRatioData?.ratioPercent || 0}% turnout rate`,
      },
      {
        title: "On Leave",
        value: Number(dashboardData.cards?.onLeave ?? dashboardData.attendance?.onLeave ?? 0),
        icon: CalendarCheck,
        color: "bg-[#F59E0B]",
        textColor: "text-[#F59E0B] dark:text-amber-400",
        link: "/admin/leave",
        subtitle: "Excused scheduled absence",
      },
    ];
  }, [dashboardData, todayAttendanceRatioData]);

  // Attendance Trend Data
  const attendanceTrends = useMemo(() => {
    if (dashboardData?.attendanceTrends && dashboardData.attendanceTrends.length > 0) {
      return dashboardData.attendanceTrends;
    }
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    return days.map((day) => ({
      day,
      present: dashboardData?.attendance?.present || 0,
      late: dashboardData?.attendance?.late || 0,
      absent: dashboardData?.attendance?.absent || 0,
      onLeave: dashboardData?.attendance?.onLeave || 0,
    }));
  }, [dashboardData]);

  // Leave Status Distribution Data for Recharts Pie
  const leaveStatusData = useMemo(() => {
    if (dashboardData?.leaveStatusData) {
      return dashboardData.leaveStatusData;
    }
    const approved = dashboardData?.leave?.approved || 0;
    const pending = dashboardData?.leave?.pending || 0;
    const rejected = dashboardData?.leave?.rejected || 0;
    return [
      { name: "Approved", value: approved, fill: "#16A34A" },
      { name: "Pending", value: pending, fill: "#ff5500" },
      { name: "Rejected", value: rejected, fill: "#DC2626" },
    ];
  }, [dashboardData]);

  // Total leave request count
  const totalLeaveRequests = useMemo(() => {
    return dashboardData?.leave?.totalRequests ||
      leaveStatusData.reduce((acc, curr) => acc + curr.value, 0);
  }, [dashboardData, leaveStatusData]);

  // Leave Type Breakdown Data for Recharts Bar Chart (Strictly database records)
  const leaveTypeDistribution = useMemo(() => {
    if (dashboardData?.leaveTypeDistribution && dashboardData.leaveTypeDistribution.length > 0) {
      return dashboardData.leaveTypeDistribution;
    }
    return [
      { name: "Annual Leave", value: 0, fill: "#002185" },
      { name: "Casual Leave", value: 0, fill: "#ff5500" },
      { name: "Sick Leave", value: 0, fill: "#16A34A" },
      { name: "Maternity/Study", value: 0, fill: "#8B5CF6" },
    ];
  }, [dashboardData]);

  // Pending Approvals List
  const pendingApprovals = useMemo(() => {
    return dashboardData?.pendingApprovalsList || [];
  }, [dashboardData]);

  if (isLoading && !dashboardData) {
    return <DashboardMetricsSkeleton />;
  }

  if (isError && !dashboardData) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchDashboardData}
        onClose={() => setIsError(null)}
      />
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748B] dark:text-slate-400">No dashboard data available</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 overflow-x-hidden">
      {/* Export Notification Toast */}
      {exportNotice && (
        <div
          id="dashboard-export-notice-banner"
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
            exportNotice.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span>{exportNotice.message}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* EXECUTIVE DATA SUMMARY SECTION (TOP OF DASHBOARD) */}
      <DashboardDataSummarySection
        dashboardData={dashboardData}
        onExportSuccess={(res) => {
          setExportNotice({
            type: "success",
            message: `✓ Successfully ${res.message} (${res.filename})`,
          });
          setTimeout(() => setExportNotice(null), 6000);
        }}
        onExportError={(errMsg) => {
          setExportNotice({
            type: "error",
            message: `Export Error: ${errMsg}`,
          });
        }}
      />

      {/* Top Metric Cards Grid: 4-column responsive grid */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsCards.slice(0, 4).map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <button
              type="button"
              key={index}
              onClick={() => stat.link && navigate(stat.link)}
              className={`${ui.card} ${ui.cardInteractive} ${ui.focusRing} group text-left p-5 cursor-pointer flex flex-col justify-between`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1.5 truncate">
                    {stat.value}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-[#002185]/[0.07] text-[#002185] dark:bg-blue-500/10 dark:text-blue-300 group-hover:bg-[#002185] group-hover:text-white dark:group-hover:bg-blue-600 transition-colors">
                  <IconComponent className="w-5 h-5" />
                </div>
              </div>
              {stat.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 truncate">
                  {stat.subtitle}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* ZERO STATE BANNER FOR BRAND NEW OR INITIALIZED SYSTEM WITH 0 EMPLOYEES */}
      {Number(dashboardData.cards?.totalEmployees || dashboardData.totalEmployees || 0) === 0 && (
        <div
          id="dashboard-zero-state-banner"
          className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#002185] dark:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Workspace Initialized · 0 Active Employees
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                All metrics strictly reflect 0 records. Add your first employee to start recording attendance, scheduling shifts, and running payroll disbursements.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-zero-state-add-employee"
            onClick={() => setShowEmployeeModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Employee</span>
          </button>
        </div>
      )}

      {/* HIGH-PRIORITY ATTENTION REQUIRED: Late Attendance & Missing Clock-Ins Monitoring */}
      <AttentionRequiredLateAttendance onActionLogged={() => fetchDashboardData()} />

      {/* RECHARTS SECTION 2: Pending Approvals Queue & Leave Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals Management Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Pending Approvals Queue
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submissions awaiting administrative review and instant decision
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/admin/leave")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pending items list */}
          {pendingApprovals.length === 0 ? (
            <div className="py-10 px-4 text-center bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">All Approvals Cleared!</p>
              <p className="text-xs text-slate-400 mt-0.5">
                No leave requests currently requiring administrative sign-off.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.slice(0, 4).map((leave) => {
                const leaveId = leave._id;
                const emp = leave.employee || {};
                const isProcessing = actionProcessingId === leaveId;

                return (
                  <div
                    key={leaveId}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <Avatar
                        src={emp.avatar || emp.avatarUrl || emp.profilePicture || emp.profile_image_url}
                        name={emp.fullName || "Employee"}
                        size="md"
                        shape="rounded"
                        className="w-10 h-10 shrink-0 shadow-sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {emp.fullName || "Employee"}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 font-medium">
                            {emp.department || "General"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-semibold text-orange-600 dark:text-orange-400">{leave.leaveType}</span> •{" "}
                          {leave.totalDays} day(s) ({leave.startDate} to {leave.endDate})
                        </p>
                        {leave.reason && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">
                            &quot;{leave.reason}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleQuickDecision(leaveId, "Approved")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleQuickDecision(leaveId, "Rejected")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111927] border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leave Requests by Type */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Requests by Leave Type
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Categorized request distribution
            </p>
          </div>

          {leaveTypeDistribution.reduce((acc, curr) => acc + (curr.value || 0), 0) === 0 ? (
            <div className="w-full h-64 flex flex-col items-center justify-center p-4 text-center bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <CalendarCheck className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">No Leave Requests</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                No leave applications have been submitted across departments yet.
              </p>
            </div>
          ) : (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={leaveTypeDistribution}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} requests`, "Count"]}
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                    {leaveTypeDistribution.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill || "#2563EB"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* RECHARTS KEY WORKFORCE OPERATIONS & ATTENDANCE SUMMARY COMPONENT */}
      <WorkforceSummaryDashboard
        dashboardData={dashboardData}
        employeeList={employeeList}
        onExportNotice={(msg) => {
          setExportNotice({
            type: "success",
            message: msg,
          });
          setTimeout(() => setExportNotice(null), 6000);
        }}
      />

      {/* RECHARTS KEY METRICS & ACTIVE PAYROLL ALERTS SUMMARY COMPONENT */}
      <DashboardSummaryMetrics dashboardData={dashboardData} />

      {/* DEPARTMENT & WORKFORCE STATUS RECHARTS VISUALIZATION */}
      <DepartmentStatusVisualizer
        departmentDistribution={dashboardData.departmentDistribution}
        employeeStatusDistribution={dashboardData.employeeStatusDistribution}
        totalEmployees={dashboardData.cards?.totalEmployees || 0}
      />

      {/* TODAY ATTENDANCE RATIO RECHARTS SUMMARY WIDGET */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Today's Workforce Attendance Ratio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time daily presence ratio calculated against total registered workforce ({todayAttendanceRatioData.total} employees)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {todayAttendanceRatioData.ratioPercent}% Present Today
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Recharts Donut Ratio Visualizer */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl">
            <div className="relative w-full h-56 max-w-xs flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={todayAttendanceRatioData.segments}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {todayAttendanceRatioData.segments.map((entry, index) => (
                      <Cell key={`ratio-cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} employees`, name]}
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Ratio Badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {todayAttendanceRatioData.ratioPercent}%
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Turnout Ratio
                </span>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div className="text-center p-2.5 rounded-xl bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 block font-medium">Total Present</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {todayAttendanceRatioData.present} / {todayAttendanceRatioData.total}
                </span>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 block font-medium">Compliance Rate</span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {todayAttendanceRatioData.accountedPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown KPI Tiles */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* On-Time Card */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    On-Time Clock-in
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-2">
                  {todayAttendanceRatioData.onTime}
                </p>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {todayAttendanceRatioData.total > 0
                    ? Math.round((todayAttendanceRatioData.onTime / todayAttendanceRatioData.total) * 100)
                    : 0}
                  % of total team
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111927] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs border border-emerald-100 dark:border-slate-800">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Late Arrival Card */}
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Late Clock-ins
                  </span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-2">
                  {todayAttendanceRatioData.late}
                </p>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  After shift start arrival
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111927] flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs border border-amber-100 dark:border-slate-800">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Approved Leave Card */}
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    Approved Leave
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-2">
                  {todayAttendanceRatioData.onLeave}
                </p>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Official excused absence
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111927] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs border border-blue-100 dark:border-slate-800">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Absent Card */}
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    Unexcused Absent
                  </span>
                </div>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-2">
                  {todayAttendanceRatioData.absent}
                </p>
                <span className="text-xs text-rose-600 dark:text-rose-400">
                  No clock-in or leave record
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111927] flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs border border-rose-100 dark:border-slate-800">
                <UserX className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Company Announcement Board (Admin Management) */}
      <AnnouncementBoard role="admin" />

      {/* RECHARTS SECTION 1: Attendance Trends & Leave Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Workforce Attendance Trends
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Weekly attendance breakdown (Present, Late, Absent, On Leave)
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Late
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Absent
              </span>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={attendanceTrends}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "#475569" }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#F8FAFC",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    fontSize: "12px",
                  }}
                  itemStyle={{ padding: "2px 0" }}
                />
                <Area
                  type="monotone"
                  dataKey="present"
                  name="Present"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={0.15}
                  fill="#10B981"
                />
                <Area
                  type="monotone"
                  dataKey="late"
                  name="Late"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fillOpacity={0.15}
                  fill="#F59E0B"
                />
                <Bar
                  dataKey="absent"
                  name="Absent"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Total Leave Requests & Status Distribution */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                <PieChartIcon className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Leave Breakdown
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#162033] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {totalLeaveRequests} Total
            </span>
          </div>

          {/* Donut Chart */}
          <div className="relative w-full h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leaveStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {leaveStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} requests`, name]}
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "#334155",
                    borderRadius: "12px",
                    color: "#F8FAFC",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Donut Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalLeaveRequests}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Requests
              </span>
            </div>
          </div>

          {/* Legend Badges */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            {leaveStatusData.map((status, idx) => (
              <div key={idx} className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.fill }}
                  ></span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{status.name}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{status.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visualizing Total Lateness Deductions over Current Payroll Month (Recharts Line Chart) */}
      <LatenessDeductionsLineChart />

      {/* 6-Month Attendance Penalty Impact Visualizer */}
      <PenaltyPayrollImpactChart />

      {/* Summary Cards: Payroll & Department Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll Summary Card */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                <BanknoteIcon className="w-4 h-4" />
              </div>
              <span>Payroll Overview</span>
            </h3>
            <button
              onClick={() => navigate("/admin/payslips")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              View Details
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block font-medium">Total Payroll</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {formatCurrency(dashboardData.payroll?.totalPayroll ?? 0)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block font-medium">Disbursed</span>
              <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(dashboardData.payroll?.paid ?? dashboardData.payroll?.totalPayrollDisbursed ?? 0)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block font-medium">Pending</span>
              <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(dashboardData.payroll?.pending ?? dashboardData.payroll?.pendingDisbursements ?? 0)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-xs text-slate-400 block font-medium">Employees Paid</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {dashboardData.payroll?.employeesPaidCount ?? dashboardData.payroll?.totalEmployeesPaid ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Department Workforce */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Building2 className="w-4 h-4" />
              </div>
              <span>Department Workforce</span>
            </h3>
            <button
              onClick={() => navigate("/admin/employees")}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              View Roster
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {dashboardData.departments && dashboardData.departments.length > 0 ? (
              dashboardData.departments.map((dept, index) => (
                <div
                  key={index}
                  className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 text-center"
                >
                  <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    {dept._id || "Dept"}
                  </h4>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {dept.total || 0}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-slate-400 py-4 text-xs">
                No department data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workforce Roster */}
      <div className="space-y-6">
        {/* Employee Directory */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Workforce Employee Database
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {employeeList.length} Active Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Global workforce roster fetched directly from MongoDB without tenant restrictions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#162033] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#002185]/25 w-44 sm:w-56"
                />
              </div>

              <button
                type="button"
                disabled={isExportingCsv}
                onClick={handleExportEmployeesCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingCsv ? <><WorkspaceLoader inline /> Exporting CSV...</> : "Export CSV for HR Reporting"}</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            /* Loading State Protection: Skeleton Loader while initial data fetch has not completely resolved */
            <WorkspaceLoader fullScreen={false} />
          ) : !isLoading && employeeList.length === 0 ? (
            /* PROFESSIONAL EMPTY STATE: Centered UI when database returns zero records */
            <div className="py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                No employees added yet.
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                Get started by adding your first employee to the system to view attendance and payroll data.
              </p>
              <div className="mt-5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer hover:shadow-md active:scale-98"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Employee</span>
                </button>
              </div>
            </div>
          ) : filteredEmployeeList.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No employees match your search query
              </p>
              <p className="text-xs text-slate-400 mt-0.5 mb-3">
                Try searching by another name, department, or email.
              </p>
              <button
                type="button"
                onClick={() => setEmployeeSearchTerm("")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Position</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Base Salary</th>
                    <th className="py-3 px-3 text-right">Performance & Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredEmployeeList.slice(0, 10).map((emp, eIdx) => {
                    const empName = emp.fullName || "Staff Member";
                    const avatarUrl = emp.avatar || emp.profilePicture || emp.profile_image_url || "";
                    const statusStr = (emp.status || (emp.isActive !== false ? "active" : "inactive")).toLowerCase();
                    const isActive = statusStr === "active";

                    return (
                      <tr
                        key={emp._id || eIdx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              src={avatarUrl}
                              alt={empName}
                              name={empName}
                              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {empName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {emp.email || emp.employeeId || "EMP"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                          {emp.position || "Staff"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {emp.department || "General"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          GHS {Number(emp.baseSalary || emp.salary || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeForModal(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002185] hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-300" />
                            <span>Performance & Reviews</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Floating Quick Actions Menu */}
      <DashboardQuickActions
        onOpenAddEmployee={() => setShowEmployeeModal(true)}
        onOpenRecordAttendance={() => setShowRecordAttendanceModal(true)}
        onOpenProcessPayroll={() => setShowPayslipsModal(true)}
      />

      {/* Quick Action Modals */}
      {showEmployeeModal && (
        <AddEmployee
          onEmployeeAdded={() => {
            fetchDashboardData();
          }}
        />
      )}

      {showRecordAttendanceModal && (
        <RecordAttendanceModal
          isOpen={showRecordAttendanceModal}
          onClose={() => setShowRecordAttendanceModal(false)}
          onSuccess={() => {
            fetchDashboardData();
          }}
        />
      )}

      {showPayslipsModal && (
        <PayslipsModal
          onClose={() => setShowPayslipsModal(false)}
          onSuccess={() => {
            setShowPayslipsModal(false);
            fetchDashboardData();
          }}
        />
      )}

      {/* Employee Detail & Quarterly Performance Modal */}
      {selectedEmployeeForModal && (
        <EmployeeDetailModal
          employee={selectedEmployeeForModal}
          isOpen={!!selectedEmployeeForModal}
          onClose={() => setSelectedEmployeeForModal(null)}
          isAdmin={true}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
