import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback, memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  CalendarCheck,
  CalendarPlus,
  RefreshCw,
  AlertCircle,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getEmployeeLeaveStats, myLeave } from "../apis/fontApis";
import { ui, tones } from "../pages/Employees/ui/tokens";
import { Badge, CardHeader, EmptyState } from "../pages/Employees/ui/primitives";

// Custom Chart Tooltip declared at module scope
const CustomChartTooltip = ({ active, payload, totalRequests = 0 }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const percentage =
    totalRequests > 0 ? Math.round((item.value / totalRequests) * 100) : 0;

  return (
    <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl shadow-[0_8px_24px_-8px_rgba(15,23,42,0.25)] text-xs space-y-1.5">
      <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between gap-3">
        <span>{item.payload.name}</span>
        <span className="text-[10px] text-slate-400 font-normal">Click to view</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
        <span>Submitted Requests:</span>
        <span className="font-bold text-slate-900 dark:text-white">
          {item.value} {item.value === 1 ? "request" : "requests"}
        </span>
      </div>
      {totalRequests > 0 && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          {percentage}% of your total leave requests
        </div>
      )}
    </div>
  );
};

const EmployeeLeaveChartComponent = ({
  onApplyLeave,
  className = "",
  refreshTrigger = 0,
}) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Modal State for viewing individual category requests
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryLeaves, setCategoryLeaves] = useState([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [leaveFetchError, setLeaveFetchError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getEmployeeLeaveStats();
      const data = response?.data || {};

      setStats({
        "Annual Leave": Number(data["Annual Leave"]) || 0,
        "Casual Leave": Number(data["Casual Leave"]) || 0,
        "Sick Leave": Number(data["Sick Leave"]) || 0,
        "Maternity/Study": Number(data["Maternity/Study"]) || 0,
        total: Number(data.total) || 0,
      });
    } catch (err) {
      console.error("Error fetching live employee leave stats:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load leave statistics");
      // Default to 0 counts strictly on error - zero mock fallback
      setStats({
        "Annual Leave": 0,
        "Casual Leave": 0,
        "Sick Leave": 0,
        "Maternity/Study": 0,
        total: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  // Fetch individual leave records when a category is clicked
  const handleCategoryClick = async (categoryName) => {
    if (!categoryName) return;
    setSelectedCategory(categoryName);
    setIsLoadingLeaves(true);
    setLeaveFetchError(null);

    try {
      const response = await myLeave();
      const list = response?.data?.leaves || [];

      // Filter leaves matching the clicked category
      const filtered = list.filter((leave) => {
        const type = (leave?.leaveType || "").toLowerCase();
        const cat = categoryName.toLowerCase();

        if (cat.includes("annual") && type.includes("annual")) return true;
        if (cat.includes("casual") && type.includes("casual")) return true;
        if (cat.includes("sick") && type.includes("sick")) return true;
        if (
          (cat.includes("maternity") || cat.includes("study")) &&
          (type.includes("maternity") || type.includes("study"))
        ) {
          return true;
        }
        return type === cat;
      });

      setCategoryLeaves(filtered);
    } catch (err) {
      console.error("Error fetching leaves for category modal:", err);
      setLeaveFetchError("Failed to load requests for this category.");
      setCategoryLeaves([]);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  const closeModal = () => {
    setSelectedCategory(null);
    setCategoryLeaves([]);
    setLeaveFetchError(null);
  };

  const handleApplyClick = () => {
    closeModal();
    if (typeof onApplyLeave === "function") {
      onApplyLeave();
    } else {
      navigate("/employee/dashboard/leave");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const totalRequests = stats?.total || 0;
  const hasRequests =
    totalRequests > 0 ||
    (stats &&
      (stats["Annual Leave"] > 0 ||
        stats["Casual Leave"] > 0 ||
        stats["Sick Leave"] > 0 ||
        stats["Maternity/Study"] > 0));

  // Dynamic Chart Dataset strictly derived from live DB response
  const chartData = stats
    ? [
        {
          name: "Annual Leave",
          count: stats["Annual Leave"] || 0,
          fill: "#002185",
          colorClass: "text-[#002185] bg-[#002185]/10",
        },
        {
          name: "Casual Leave",
          count: stats["Casual Leave"] || 0,
          fill: "#ff5500",
          colorClass: "text-[#ff5500] bg-[#ff5500]/10",
        },
        {
          name: "Sick Leave",
          count: stats["Sick Leave"] || 0,
          fill: "#16A34A",
          colorClass: "text-[#16A34A] bg-[#16A34A]/10",
        },
        {
          name: "Maternity/Study",
          count: stats["Maternity/Study"] || 0,
          fill: "#8B5CF6",
          colorClass: "text-[#8B5CF6] bg-[#8B5CF6]/10",
        },
      ]
    : [];

  const statusBadge = (status) => {
    switch (status) {
      case "Approved":
        return (
          <Badge tone="success">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </Badge>
        );
      case "Rejected":
        return (
          <Badge tone="danger">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      case "Pending":
      default:
        return (
          <Badge tone="warning">
            <Clock className="w-3 h-3" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
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

  return (
    <>
      <section id="employee-requests-by-leave-type-card" className={`${ui.card} ${ui.cardPad} flex flex-col gap-5 ${className}`}>
        <CardHeader
          icon={CalendarCheck}
          title="Requests by leave type"
          description="Breakdown of your submitted time-off requests by policy. Select a category to view its requests."
          action={
            <>
              {hasRequests && <Badge tone="brand">{totalRequests} total</Badge>}
              <button
                type="button"
                onClick={fetchStats}
                disabled={isLoading}
                className={ui.iconBtn}
                title="Refresh leave statistics"
                aria-label="Refresh leave statistics"
              >
                {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </>
          }
        />

        {isLoading && !stats ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <WorkspaceLoader compact title="" />
            <span className="text-xs font-medium">Loading leave statistics...</span>
          </div>
        ) : error && !hasRequests ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/20">
            <EmptyState
              icon={AlertCircle}
              title={error}
              action={
                <button type="button" onClick={fetchStats} className={`${ui.btnSecondary} ${ui.btnSm}`}>
                  Retry sync
                </button>
              }
              className="py-8"
            />
          </div>
        ) : !hasRequests ? (
          <div
            id="leave-type-chart-empty-state"
            className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#162033]/40"
          >
            <EmptyState
              icon={CalendarPlus}
              title="No leave requests submitted yet"
              description="Your leave request distribution chart will automatically generate once you submit your first time-off application."
              action={
                <button type="button" onClick={handleApplyClick} className={ui.btnPrimary}>
                  <CalendarPlus className="w-4 h-4" />
                  Apply for leave
                </button>
              }
              className="py-10"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-full h-56 cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, "dataMax + 1"]}
                  />
                  <YAxis type="category" dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip cursor={{ fill: "#94A3B8", fillOpacity: 0.08 }} content={<CustomChartTooltip totalRequests={totalRequests} />} />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                    className="cursor-pointer"
                    onClick={(entry) => {
                      if (entry && entry.name) {
                        handleCategoryClick(entry.name);
                      }
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={entry.fill}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleCategoryClick(entry.name)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {chartData.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleCategoryClick(item.name)}
                  className={`group flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#162033]/40 text-left hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-[#162033] transition-colors cursor-pointer ${ui.focusRing}`}
                  title={`View ${item.name} requests`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.name}</span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{item.count}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Category requests modal */}
      {selectedCategory && (
        <div className={`${ui.overlay} animate-fade-in`} onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-category-title"
            className={`${ui.modal} sm:max-w-xl flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={ui.modalHeader}>
              <div className="flex items-start gap-3">
                <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${tones.brand.icon}`}>
                  <CalendarCheck className="w-4.5 h-4.5" />
                </span>
                <div>
                  <h3 id="leave-category-title" className={ui.h2}>{selectedCategory} requests</h3>
                  <p className={`${ui.caption} mt-0.5`}>
                    {categoryLeaves.length} {categoryLeaves.length === 1 ? "record" : "records"} found
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className={ui.iconBtn} title="Close" aria-label="Close">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className={`${ui.modalBody} flex-1 overflow-y-auto`}>
              {isLoadingLeaves ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <WorkspaceLoader inline />
                  <span className="text-xs font-medium">Loading {selectedCategory} requests...</span>
                </div>
              ) : leaveFetchError ? (
                <EmptyState
                  icon={AlertCircle}
                  title={leaveFetchError}
                  action={
                    <button type="button" onClick={() => handleCategoryClick(selectedCategory)} className={`${ui.btnSecondary} ${ui.btnSm}`}>
                      Retry
                    </button>
                  }
                />
              ) : categoryLeaves.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={`No ${selectedCategory} requests submitted yet`}
                  description="You haven't submitted any time-off applications under this policy category."
                  action={
                    <button type="button" onClick={handleApplyClick} className={ui.btnPrimary}>
                      <CalendarPlus className="w-4 h-4" />
                      Apply for {selectedCategory}
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {categoryLeaves.map((leave, idx) => (
                    <li key={leave._id || idx} className={`${ui.subtle} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {leave.totalDays || 1} {Number(leave.totalDays) === 1 ? "day" : "days"}
                          </p>
                        </div>
                        {statusBadge(leave.status || "Pending")}
                      </div>

                      <p className="mt-3 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        {leave.reason || "No detailed reason provided"}
                      </p>

                      {leave.adminRemark && (
                        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200">
                          <span className="font-semibold">Management remark:</span> {leave.adminRemark}
                        </div>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Submitted {formatDate(leave.createdAt)}</span>
                        {leave.approvedAt && <span>Processed {formatDate(leave.approvedAt)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`${ui.modalFooter} sm:justify-between`}>
              <button type="button" onClick={closeModal} className={ui.btnSecondary}>
                Close
              </button>
              <button type="button" onClick={handleApplyClick} className={ui.btnPrimary}>
                <CalendarPlus className="w-4 h-4" />
                Apply for new leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const EmployeeLeaveChart = memo(EmployeeLeaveChartComponent);
export default EmployeeLeaveChart;
