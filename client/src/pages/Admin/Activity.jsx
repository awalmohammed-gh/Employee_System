import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  RefreshCw,
  Download,
  ShieldCheck,
  Users,
  Banknote,
  Settings,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  User,
  Globe,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ui } from "./ui/tokens";
import { Badge } from "./ui/primitives";
import { getAuditLogs } from "../../apis/fontApis";

const CATEGORIES = [
  "All",
  "Employees",
  "Payroll",
  "Attendance",
  "Admin Settings",
  "Penalties & Deductions",
  "Security",
];

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
    return String(dateStr);
  }
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
};

const getActionConfig = (action = "") => {
  const upper = action.toUpperCase();
  if (upper.includes("CREATE_EMPLOYEE") || upper.includes("REGISTER")) {
    return {
      label: "Employee Created",
      color: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
      dot: "bg-emerald-500",
      icon: Users,
    };
  }
  if (upper.includes("DELETE_EMPLOYEE") || upper.includes("DELETE")) {
    return {
      label: "Record Deleted",
      color: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
      dot: "bg-rose-500",
      icon: AlertCircle,
    };
  }
  if (upper.includes("PAYROLL_FINALIZED") || upper.includes("PAYSLIP") || upper.includes("PAYROLL")) {
    return {
      label: "Payroll Finalized",
      color: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
      dot: "bg-blue-500",
      icon: Banknote,
    };
  }
  if (upper.includes("ATTENDANCE") || upper.includes("OVERRIDE") || upper.includes("WAIVE")) {
    return {
      label: "Attendance Action",
      color: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
      dot: "bg-amber-500",
      icon: CalendarCheck,
    };
  }
  if (upper.includes("SETTINGS") || upper.includes("TENANT") || upper.includes("POLICY")) {
    return {
      label: "System Configuration",
      color: "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50",
      dot: "bg-purple-500",
      icon: Settings,
    };
  }
  return {
    label: action.replace(/_/g, " "),
    color: "bg-slate-50 dark:bg-[#162033] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    icon: History,
  };
};

const Activity = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [exportNotice, setExportNotice] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeCategory !== "All") params.category = activeCategory;
      if (search.trim()) params.search = search.trim();
      params.limit = 100;

      const res = await getAuditLogs(params);
      const data = res?.data;

      if (data && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTotal(data.total ?? data.logs.length);
      } else if (Array.isArray(data)) {
        setLogs(data);
        setTotal(data.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      console.warn("Failed to fetch activity logs:", err.message);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Aggregate stats
  const employeeEventsCount = logs.filter(
    (l) => l.category === "Employees" || (l.action && l.action.includes("EMPLOYEE"))
  ).length;

  const payrollEventsCount = logs.filter(
    (l) => l.category === "Payroll" || (l.action && l.action.includes("PAYROLL"))
  ).length;

  const settingsEventsCount = logs.filter(
    (l) =>
      l.category === "Admin Settings" ||
      l.category === "Penalties & Deductions" ||
      (l.action && l.action.includes("SETTINGS"))
  ).length;

  // Export to CSV
  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;

    try {
      const headers = [
        "Timestamp",
        "Action",
        "Category",
        "Performed By",
        "Actor Email",
        "Target Entity",
        "Summary",
        "IP Address",
      ];

      const rows = logs.map((l) => [
        `"${new Date(l.createdAt || Date.now()).toISOString()}"`,
        `"${(l.action || "").replace(/"/g, '""')}"`,
        `"${(l.category || "General").replace(/"/g, '""')}"`,
        `"${(l.performedBy?.name || "System").replace(/"/g, '""')}"`,
        `"${(l.performedBy?.email || "system@local").replace(/"/g, '""')}"`,
        `"${(l.target || "--").replace(/"/g, '""')}"`,
        `"${(l.summary || "").replace(/"/g, '""')}"`,
        `"${(l.ipAddress || "--").replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit-trail-activity-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportNotice("Audit trail downloaded successfully!");
      setTimeout(() => setExportNotice(""), 3000);
    } catch (err) {
      console.error("Export CSV error:", err);
    }
  };

  return (
    <div id="activity-view-container" className={`${ui.page} overflow-x-hidden`}>
      {/* Toolbar */}
      <div className={ui.toolbar}>
        <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{total} events logged</Badge>
          <span className="max-w-2xl">
            Immutable chronological record of organization events, employee lifecycle actions, payroll finalizations, and policy updates.
          </span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-export-audit-csv"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className={ui.btnSecondary}
            title="Export filtered records to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button type="button" id="btn-refresh-activity" onClick={fetchLogs} disabled={loading} className={ui.btnPrimary}>
            {(loading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Logged
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {total}
            </span>
          </div>
        </div>

        {/* Employee Events */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Staff & Lifecycle
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {employeeEventsCount}
            </span>
          </div>
        </div>

        {/* Payroll Finalizations */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Payroll Finalized
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {payrollEventsCount}
            </span>
          </div>
        </div>

        {/* Settings & System Policy */}
        <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Policy & Security
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {settingsEventsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              id={`activity-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-[#002185] text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <input
            id="activity-search-input"
            type="text"
            placeholder="Search by action, actor, target or detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3">
            <WorkspaceLoader compact title="" />
            <p className="text-xs font-semibold">Retrieving system activity audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 bg-white dark:bg-[#111927] border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6">
            <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No activity records found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Critical actions such as employee profile creation, payroll finalization, and attendance overrides will appear here automatically.
            </p>
            {(search || activeCategory !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                }}
                className="mt-4 px-3.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-[#162033] hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          logs.map((log, index) => {
            const id = log._id || `log-${index}`;
            const isExpanded = expandedLogId === id;
            const config = getActionConfig(log.action);
            const ActionIcon = config.icon;
            const hasChanges = Array.isArray(log.changes) && log.changes.length > 0;
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

            return (
              <div
                key={id}
                id={`activity-card-${id}`}
                className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${config.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                      <ActionIcon className="w-3.5 h-3.5" />
                      <span>{log.action}</span>
                    </span>

                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#162033] px-2 py-0.5 rounded-md">
                      {log.category || "General"}
                    </span>

                    {log.target && (
                      <span className="text-[11px] font-bold text-[#002185] dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 px-2 py-0.5 rounded-md">
                        {log.target}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-xs shrink-0 self-start sm:self-auto">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({formatDateTime(log.createdAt)})
                    </span>
                  </div>
                </div>

                {/* Summary / Narrative */}
                <div className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {log.summary}
                </div>

                {/* Actor & Security Context */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <User className="w-3 h-3 text-slate-400" />
                      {log.performedBy?.name || "System Admin"}
                    </span>
                    {log.performedBy?.role && (
                      <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 rounded">
                        {log.performedBy.role}
                      </span>
                    )}
                    {log.performedBy?.email && (
                      <span className="text-slate-400 font-mono text-[10px]">
                        &lt;{log.performedBy.email}&gt;
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {log.ipAddress && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Globe className="w-3 h-3" />
                        {log.ipAddress}
                      </span>
                    )}

                    {(hasChanges || hasMetadata) && (
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#002185] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details: Field Changes & Metadata */}
                {isExpanded && (
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                    {/* Changes Diff */}
                    {hasChanges && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          State Alterations
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {log.changes.map((c, i) => (
                            <div
                              key={i}
                              className="p-2 bg-white dark:bg-[#111927] rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] space-y-1"
                            >
                              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                                {c.label || c.field}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                <span className="line-through text-rose-500">
                                  {String(c.oldValue ?? "none")}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {String(c.newValue ?? "none")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    {hasMetadata && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Context Attributes
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(log.metadata).map(([key, val]) => (
                            <div
                              key={key}
                              className="px-2 py-1 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-md text-[10px]"
                            >
                              <span className="text-slate-400 font-medium">{key}: </span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                                {typeof val === "object" ? JSON.stringify(val) : String(val)}
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
    </div>
  );
};

export default Activity;
