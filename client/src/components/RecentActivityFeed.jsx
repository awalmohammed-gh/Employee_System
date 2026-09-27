import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Banknote,
  Activity,
  UserCheck,
  UserX,
  FileText,
} from "lucide-react";
import { getRecentActivity } from "../apis/fontApis";
import { getSocket } from "../utils/socket";
import Avatar from "./Avatar";

export const RecentActivityFeed = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "attendance" | "payroll"
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [payrollLogs, setPayrollLogs] = useState([]);
  const [combinedLogs, setCombinedLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await getRecentActivity();
      if (res?.data?.success && res.data.data) {
        const att = res.data.data.attendance || [];
        const pay = res.data.data.payroll || [];
        const comb = res.data.data.combined || [];

        setAttendanceLogs(att);
        setPayrollLogs(pay);
        setCombinedLogs(comb);
      } else {
        setAttendanceLogs(res?.data?.attendanceLogs || []);
        setPayrollLogs(res?.data?.payrollLogs || []);
        setCombinedLogs(res?.data?.recentActivities || []);
      }
    } catch (err) {
      console.warn("Failed to fetch recent activity feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();

    // Listen for real-time live events via WebSocket
    const socket = getSocket();
    if (socket) {
      const handleLiveEvent = () => {
        fetchActivity();
      };

      socket.on("attendance_created", handleLiveEvent);
      socket.on("attendance_updated", handleLiveEvent);
      socket.on("attendance_clockin", handleLiveEvent);
      socket.on("attendance_clockout", handleLiveEvent);
      socket.on("payroll_created", handleLiveEvent);
      socket.on("payroll_published", handleLiveEvent);
      socket.on("payroll_generated", handleLiveEvent);

      return () => {
        socket.off("attendance_created", handleLiveEvent);
        socket.off("attendance_updated", handleLiveEvent);
        socket.off("attendance_clockin", handleLiveEvent);
        socket.off("attendance_clockout", handleLiveEvent);
        socket.off("payroll_created", handleLiveEvent);
        socket.off("payroll_published", handleLiveEvent);
        socket.off("payroll_generated", handleLiveEvent);
      };
    }
  }, [fetchActivity]);

  const formatCurrency = (val) => {
    return `GH₵${Number(val || 0).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "Just now";
    const date = new Date(ts);
    if (isNaN(date.getTime())) return String(ts);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  };

  // Determine current items to display
  const itemsToDisplay =
    activeTab === "attendance"
      ? attendanceLogs
      : activeTab === "payroll"
      ? payrollLogs
      : combinedLogs;

  return (
    <div
      id="recent-activity-feed-container"
      className={`bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between ${className}`}
    >
      {/* Header & Tabs */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#002185] dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Recent Activity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live event stream from Attendance and Payroll records
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-[#162033] p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              id="btn-tab-all-activity"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All ({combinedLogs.length})
            </button>
            <button
              id="btn-tab-attendance-activity"
              onClick={() => setActiveTab("attendance")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "attendance"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Attendance ({attendanceLogs.length})
            </button>
            <button
              id="btn-tab-payroll-activity"
              onClick={() => setActiveTab("payroll")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "payroll"
                  ? "bg-white dark:bg-slate-700 text-[#002185] dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Payroll ({payrollLogs.length})
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="pt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading ? (
            <WorkspaceLoader fullScreen={false} />
          ) : itemsToDisplay.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 stroke-1" />
              <span>No activity logs found in database.</span>
            </div>
          ) : (
            itemsToDisplay.map((item, index) => {
              const isAttendance = item.category === "attendance";
              const statusLower = (item.status || "").toLowerCase();
              const displayName = item.employeeName || item.fullName || item.employee?.fullName || item.employee?.name || "Employee";
              const displayDept = item.department || item.employee?.department || "Staff";

              return (
                <div
                  key={item._id || item.id || index}
                  id={`activity-item-${item._id || index}`}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                >
                  {/* Left: Avatar / Category Icon + Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar
                        src={item.avatar || item.employee?.avatar || item.employee?.profilePicture}
                        fullName={displayName}
                        size="sm"
                        className="w-9 h-9"
                      />
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          isAttendance
                            ? statusLower === "late"
                              ? "bg-amber-500 text-white"
                              : statusLower === "absent"
                              ? "bg-rose-500 text-white"
                              : "bg-[#002185] dark:bg-blue-600 text-white"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {isAttendance ? (
                          statusLower === "late" ? (
                            <Clock className="w-2.5 h-2.5" />
                          ) : statusLower === "absent" ? (
                            <UserX className="w-2.5 h-2.5" />
                          ) : (
                            <UserCheck className="w-2.5 h-2.5" />
                          )
                        ) : (
                          <Banknote className="w-2.5 h-2.5" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                          • {displayDept}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.action}
                      </p>
                    </div>
                  </div>

                  {/* Right: Badge / Values & Relative Timestamp */}
                  <div className="flex flex-col items-end shrink-0 gap-1 text-right">
                    {isAttendance ? (
                      <div className="flex items-center gap-1.5">
                        {item.penalty > 0 && (
                          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded font-semibold">
                            -{formatCurrency(item.penalty)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            statusLower === "present"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : statusLower === "late"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {item.status || "Present"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                          {item.status || "Published"}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Real-time sync active
        </span>
        <span className="text-[11px] text-slate-400">
          Showing last 5 logs per collection
        </span>
      </div>
    </div>
  );
};

export default RecentActivityFeed;
