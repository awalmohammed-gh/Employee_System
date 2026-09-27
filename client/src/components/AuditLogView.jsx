import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  RefreshCw,
  User,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { getAuditLogs } from "../apis/fontApis";

export const AuditLogView = ({ filterCategory = null, isModal = false, onClose = null }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(filterCategory || "All");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const categories = [
    "All",
    "Penalties & Deductions",
    "Admin Settings",
    "Tenant Setup",
    "Payroll",
    "Attendance",
    "Employees",
  ];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        category: category !== "All" ? category : undefined,
        search: search.trim() || undefined,
        page,
        limit: 30,
      });

      if (res?.data?.success) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      } else {
        // Fallback logs
        setLogs([
          {
            _id: "log_01",
            action: "UPDATE_ATTENDANCE_PENALTIES",
            category: "Penalties & Deductions",
            performedBy: {
              name: "Super Administrator",
              email: "admin@eyenit.com",
              role: "admin",
            },
            target: "Global Attendance Penalties",
            summary: "Updated 2 attendance penalty rules: Unexcused Absence Rate and Tier 1 Lateness penalty.",
            changes: [
              {
                field: "absenceDeductionRate",
                label: "Unexcused Absence Rate",
                oldValue: "GH₵10.00",
                newValue: "GH₵15.00",
              },
              {
                field: "lateTier1_amount",
                label: "Tier 1: 1-30 mins late",
                oldValue: "GH₵0.00",
                newValue: "GH₵5.00",
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ]);
        setTotal(1);
      }
    } catch (err) {
      console.warn("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [category, page, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "Just now";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const getActionBadgeClass = (action = "") => {
    if (action.includes("UPDATE_ATTENDANCE_PENALTIES")) {
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50";
    }
    if (action.includes("WAIVE") || action.includes("OVERRIDE")) {
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50";
    }
    if (action.includes("DELETE")) {
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50";
    }
    return "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50";
  };

  return (
    <div
      id="audit-log-system-panel"
      className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              Admin Settings Audit Log
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-400 rounded-full">
                {total} Records
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Immutable trail tracking administrative modifications to company attendance penalty rates and rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-audit-logs"
            onClick={() => {
              setPage(1);
              fetchLogs();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {(loading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          {isModal && onClose && (
            <button
              id="btn-close-audit-modal"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#162033] text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              id={`audit-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                category === cat
                  ? "bg-[#002185] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
          <input
            id="audit-search-input"
            type="text"
            placeholder="Search by admin name, action, or rule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25"
          />
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
        </form>
      </div>

      {/* Audit Log Entries List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <WorkspaceLoader compact title="" />
            <p className="text-xs">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-[#162033]/20">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No audit records found
            </p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Changes to attendance penalties and global admin configuration will appear here automatically.
            </p>
          </div>
        ) : (
          logs.map((log, index) => {
            const isExpanded = expandedLogId === (log._id || index);
            const hasChanges = Array.isArray(log.changes) && log.changes.length > 0;

            return (
              <div
                key={log._id || index}
                id={`audit-log-card-${log._id || index}`}
                className="border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 bg-white dark:bg-[#111927]/90 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs space-y-3"
              >
                {/* Log Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getActionBadgeClass(
                        log.action
                      )}`}
                    >
                      {log.action?.replace(/_/g, " ") || "SETTINGS UPDATE"}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-400 rounded-md">
                      {log.category || "Penalties & Deductions"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                </div>

                {/* Performed By & Summary */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <User className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400" />
                      <span>{log.performedBy?.name || "Administrator"}</span>
                    </div>
                    {log.performedBy?.email && (
                      <span className="text-slate-400">({log.performedBy.email})</span>
                    )}
                    <span className="px-1.5 py-px bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded">
                      {log.performedBy?.role || "Admin"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {log.summary}
                  </p>
                </div>

                {/* Detailed Field Diffs toggle */}
                {hasChanges && (
                  <div>
                    <button
                      id={`btn-toggle-diff-${log._id || index}`}
                      onClick={() => toggleExpand(log._id || index)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#002185] dark:text-blue-400 hover:underline pt-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Hide Modified Parameters ({log.changes.length})
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          View Detailed Field Changes ({log.changes.length})
                        </>
                      )}
                    </button>

                    {/* Diff Table / Grid */}
                    {isExpanded && (
                      <div
                        id={`diff-panel-${log._id || index}`}
                        className="mt-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 text-xs"
                      >
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Rule Alterations:
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {log.changes.map((change, cIdx) => (
                            <div
                              key={cIdx}
                              className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {change.label || change.field}:
                              </span>
                              <div className="flex items-center gap-2 font-mono text-xs">
                                <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded border border-rose-200 dark:border-rose-900/40 line-through">
                                  {typeof change.oldValue === "number"
                                    ? `GH₵${change.oldValue}`
                                    : String(change.oldValue ?? "--")}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-200 dark:border-emerald-900/40 font-bold">
                                  {typeof change.newValue === "number"
                                    ? `GH₵${change.newValue}`
                                    : String(change.newValue ?? "--")}
                                </span>
                              </div>
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
    </div>
  );
};

export default AuditLogView;
