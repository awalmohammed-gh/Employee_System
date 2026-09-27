import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import { Shield, Activity, Search, RefreshCw, ArrowRight, ChevronDown, ChevronUp, Trash2, Banknote, UserCheck, Users, BellRing, Sliders } from "lucide-react";
import { getActivityLogs } from "../apis/fontApis";

export const DashboardAuditTrail = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({});

  const categories = [
    { id: "All", label: "All Events" },
    { id: "Employees", label: "Employee Actions" },
    { id: "Payroll", label: "Payroll Processing" },
    { id: "Security", label: "Profile & Security" },
    { id: "Attendance", label: "Attendance & Alerts" },
    { id: "Admin Settings", label: "Settings & Config" },
  ];

  const fetchLogs = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRefreshing(true);
      try {
        const res = await getActivityLogs({
          category: category !== "All" ? category : undefined,
          search: search.trim() || undefined,
          page,
          limit: 25,
        });

        if (res?.data?.success) {
          setLogs(res.data.logs || res.data.data || []);
          setTotal(res.data.total || 0);
          if (res.data.categoryCounts) {
            setCategoryCounts(res.data.categoryCounts);
          }
        }
      } catch (err) {
        console.warn("[DashboardAuditTrail] Error fetching activity logs:", err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, search, page]
  );

  useEffect(() => {
    fetchLogs();
    // Real-time polling every 20 seconds
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Helper for action badges & styling
  const getActionBadge = (action = "") => {
    const act = action.toUpperCase();

    if (act.includes("DELETE")) {
      return {
        label: "Employee Deletion",
        icon: Trash2,
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        badgeBg: "bg-rose-500",
      };
    }
    if (act.includes("PAYROLL")) {
      return {
        label: "Payroll Processed",
        icon: Banknote,
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        badgeBg: "bg-emerald-500",
      };
    }
    if (act.includes("PROFILE")) {
      return {
        label: "Profile Updated",
        icon: UserCheck,
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        badgeBg: "bg-blue-500",
      };
    }
    if (act.includes("NOTIF") || act.includes("ALERT") || act.includes("LATE")) {
      return {
        label: "Attendance Alert",
        icon: BellRing,
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        badgeBg: "bg-amber-500",
      };
    }
    if (act.includes("EMPLOYEE")) {
      return {
        label: "Staff Modified",
        icon: Users,
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        badgeBg: "bg-indigo-500",
      };
    }
    if (act.includes("SETTING") || act.includes("BRAND")) {
      return {
        label: "System Settings",
        icon: Sliders,
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        badgeBg: "bg-purple-500",
      };
    }

    return {
      label: action.replace(/_/g, " "),
      icon: Activity,
      className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
      badgeBg: "bg-slate-500",
    };
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "Recently";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;

      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  System Audit Trail & Administrative Telemetry
                </h3>
                {/* Real-time Live indicator */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Collection Feed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time chronological log of administrative operations (employee deletions, payroll processing, profile updates, and security adjustments) stored in <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">ActivityLog</span> collection.
              </p>
            </div>
          </div>
        </div>

        {/* Search & Refresh tools */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search actions, admin, targets..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#162033]/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Refresh audit trail"
          >
            {(refreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {categories.map((cat) => {
          const count = cat.id === "All" ? total : categoryCounts[cat.id] || 0;
          const isSelected = category === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isSelected
                  ? "bg-[#002185] text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-[#162033]/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
              }`}
            >
              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-px rounded-full text-[10px] font-bold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Activity log feed list */}
      <div className="space-y-2.5">
        {loading && logs.length === 0 ? (
          <WorkspaceLoader fullScreen={false} />
        ) : logs.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No audit logs recorded matching this filter.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Administrative operations will automatically appear here as they occur in real time.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log._id;
            const badge = getActionBadge(log.action);
            const Icon = badge.icon;
            const adminName = log.performedBy?.name || "Administrator";
            const adminRole = log.performedBy?.role || "admin";

            return (
              <div
                key={log._id}
                className="group border border-slate-200/80 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-[#111927]/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 overflow-hidden"
              >
                {/* Main clickable row */}
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                  className="p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    {/* Action Icon Pill */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badge.className}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Summary and Actor info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        {log.target && (
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#162033] px-2 py-0.5 rounded-md truncate max-w-xs">
                            {log.target}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          by <strong className="text-slate-600 dark:text-slate-300">{adminName}</strong>
                        </span>
                      </div>

                      {/* Main narrative summary */}
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 leading-snug">
                        {log.summary}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Timestamp & expand chevron */}
                  <div className="flex items-center gap-2.5 shrink-0 ml-2">
                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#162033]/20 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 pt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Executed By
                        </span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          {adminName}{" "}
                          <span className="text-slate-400 font-normal">
                            ({log.performedBy?.email || "admin@system.local"})
                          </span>
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Target Entity
                        </span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          {log.target || "System"} ({log.targetModel || "General"})
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Timestamp & Origin
                        </span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          {new Date(log.createdAt).toLocaleString()} • IP: {log.ipAddress || "127.0.0.1"}
                        </p>
                      </div>
                    </div>

                    {/* Detailed description if present */}
                    {log.details && log.details !== log.summary && (
                      <div className="mb-3 p-2.5 rounded-xl bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                          Action Details
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                          {log.details}
                        </p>
                      </div>
                    )}

                    {/* Field Changes Diffs */}
                    {log.changes && log.changes.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                          Modified Properties ({log.changes.length})
                        </span>
                        <div className="space-y-1.5">
                          {log.changes.map((ch, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 text-[11px]"
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-28">
                                {ch.label || ch.field}:
                              </span>
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 line-through truncate max-w-xs">
                                {String(ch.oldValue ?? "None")}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-xs">
                                {String(ch.newValue ?? "None")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination & footer count */}
      {total > 25 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of {total} audit records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 25 >= total}
              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAuditTrail;
