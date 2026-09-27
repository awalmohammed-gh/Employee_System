import { motion } from "framer-motion";
import {
  Banknote,
  Megaphone,
  CalendarCheck,
  Clock,
  Sparkles,
  Info,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  UserPlus,
} from "lucide-react";

/**
 * Format timestamp to friendly relative time string if helper not provided
 */
const defaultFormatRelativeTime = (timestamp) => {
  if (!timestamp) return "Just now";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return "Just now";
    if (diffSec < 90) return "1m ago";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
};

/**
 * NotificationItem Component
 * Renders individual notification items with specialized category styling,
 * Banknote icon for payroll/penalty notifications, and interactive status controls.
 */
export const NotificationItem = ({
  item,
  role = "employee",
  onItemClick,
  onToggleRead,
  onDismiss,
  formatRelativeTime = defaultFormatRelativeTime,
}) => {
  if (!item) return null;

  const itemId = item._id || item.id;
  const isItemRead = Boolean(item.is_read || item.unread === false);
  const isPayroll =
    item.category === "payroll" ||
    item.type === "payroll_alert" ||
    item.type === "payroll_status_update" ||
    item.category === "payslip" ||
    item.type === "penalty_alert";

  const isEmployeeRegistration =
    item.type === "new_employee_registration" ||
    item.category === "employee" ||
    item.category === "employees";

  const actionTargetUrl =
    item.action_url ||
    item.actionUrl ||
    (isPayroll
      ? role === "admin"
        ? "/admin/payroll"
        : "/employee/dashboard/payslips"
      : isEmployeeRegistration
      ? "/admin/employees"
      : item.category === "leave"
      ? role === "admin"
        ? "/admin/leave"
        : "/employee/dashboard/leave"
      : "");

  const actionBtnLabel =
    item.action_label ||
    item.actionLabel ||
    (isPayroll
      ? role === "admin"
        ? "View Payroll"
        : "View Payslip Impact"
      : isEmployeeRegistration
      ? "View Directory"
      : item.category === "leave"
      ? role === "admin"
        ? "Review Leave"
        : "View Leave Status"
      : "View Details");

  // Determine category icon and styling
  const renderCategoryIcon = () => {
    if (isEmployeeRegistration) {
      return (
        <div
          id={`notification-icon-employee-${itemId}`}
          className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200/60 dark:border-cyan-800/40 shrink-0 mt-0.5 shadow-xs"
        >
          <UserPlus className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
      );
    }

    if (isPayroll) {
      return (
        <div
          id={`notification-icon-payroll-${itemId}`}
          className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/40 shrink-0 mt-0.5 shadow-xs"
        >
          <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    }

    if (item.type === "announcement" || item.category === "announcement") {
      return (
        <div
          id={`notification-icon-announcement-${itemId}`}
          className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/60 dark:border-orange-800/40 shrink-0 mt-0.5 shadow-xs"
        >
          <Megaphone className="w-5 h-5 text-[#ff5500]" />
        </div>
      );
    }

    switch (item.category) {
      case "leave":
        return (
          <div
            id={`notification-icon-leave-${itemId}`}
            className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/40 shrink-0 mt-0.5 shadow-xs"
          >
            <CalendarCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
        );
      case "attendance":
        return (
          <div
            id={`notification-icon-attendance-${itemId}`}
            className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#002185] dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/40 shrink-0 mt-0.5 shadow-xs"
          >
            <Clock className="w-5 h-5 text-[#002185] dark:text-blue-400" />
          </div>
        );
      case "system":
        return (
          <div
            id={`notification-icon-system-${itemId}`}
            className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/40 shrink-0 mt-0.5 shadow-xs"
          >
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
        );
      default:
        return (
          <div
            id={`notification-icon-default-${itemId}`}
            className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60 shrink-0 mt-0.5 shadow-xs"
          >
            <Info className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
        );
    }
  };

  return (
    <motion.div
      layout
      key={itemId}
      id={`notification-item-${itemId}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => onItemClick && onItemClick(item)}
      className={`p-4 transition-colors cursor-pointer flex gap-3 group relative border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 ${
        isPayroll
          ? !isItemRead
            ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-l-4 border-emerald-500 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40"
            : "bg-white dark:bg-slate-900 opacity-90 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60"
          : !isItemRead
          ? "bg-[#002185]/[0.03] dark:bg-blue-500/[0.06] border-l-4 border-[#002185] dark:border-blue-500 hover:bg-[#002185]/[0.06]"
          : "bg-white dark:bg-slate-900 opacity-80 hover:opacity-100 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60"
      }`}
    >
      {/* Category Icon */}
      {renderCategoryIcon()}

      {/* Content */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <h4
            className={`text-xs truncate ${
              !isItemRead
                ? "font-bold text-[#002185] dark:text-blue-400"
                : "font-semibold text-[#0F172A] dark:text-slate-200"
            }`}
          >
            {item.title}
          </h4>

          {/* Category Badges */}
          {isPayroll && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {role === "admin" ? "Payroll" : "Payslip"}
            </span>
          )}
          {isEmployeeRegistration && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              New Staff
            </span>
          )}
          {item.category === "leave" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {item.type === "pending_leave_approval" ? "Pending Approval" : "Leave"}
            </span>
          )}

          {/* Read/Unread Status Tag */}
          {!isItemRead ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ff5500]/10 text-[#ff5500] border border-[#ff5500]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5500] animate-pulse" />
              Unread
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Check className="w-2.5 h-2.5" />
              Read
            </span>
          )}
        </div>

        <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed line-clamp-2">
          {item.message}
        </p>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-[#94A3B8] dark:text-slate-500 font-medium">
            {formatRelativeTime(item.created_at || item.createdAt || item.timestamp)}
          </span>

          <div className="flex items-center gap-2">
            {/* Explicit Mark Read / Unread Status Toggle Button */}
            {onToggleRead && (
              <button
                type="button"
                id={`btn-toggle-read-${itemId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRead(e, item);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title={isItemRead ? "Mark as unread" : "Mark as read"}
              >
                {isItemRead ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span>Mark unread</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Mark read</span>
                  </>
                )}
              </button>
            )}

            {/* Primary Action Target (View Payslip / Announcement / Details) */}
            {(actionTargetUrl ||
              item.type === "announcement" ||
              item.category === "announcement" ||
              isPayroll) && (
              <button
                type="button"
                id={`btn-action-${itemId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onItemClick) onItemClick(item);
                }}
                className={`inline-flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  isPayroll
                    ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                    : "text-[#002185] dark:text-blue-400 hover:text-[#ff5500] dark:hover:text-[#ff5500]"
                }`}
              >
                <span>{actionBtnLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Dismiss / Close Button (Top Right) */}
      {onDismiss && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          <button
            type="button"
            id={`btn-dismiss-${itemId}`}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(e, item);
            }}
            title={isPayroll ? "Dismiss payslip alert" : "Dismiss notification"}
            className="p-1 rounded-lg text-[#94A3B8] dark:text-slate-500 hover:text-[#DC2626] dark:hover:text-red-400 hover:bg-[#FEF2F2] dark:hover:bg-red-950/30 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default NotificationItem;
