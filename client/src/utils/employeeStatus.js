/**
 * Shared display helpers for employee records (status badge + date), used as defaults by
 * components such as EmployeeDetailModal when the caller does not supply its own.
 */
export const getEmployeeStatusBadge = (status, isActive, emp = null) => {
  let raw;
  if (emp?.isOnLeave || emp?.onLeave || emp?.currentLeaveStatus === "Approved") {
    raw = "on leave";
  } else if (emp?.isTerminated || emp?.terminated) {
    raw = "terminated";
  } else if (status) {
    raw = String(status).toLowerCase().trim().replace(/[-_]/g, " ");
  } else if (isActive !== false) {
    raw = "active";
  } else {
    raw = "inactive";
  }

  if (raw === "on leave" || raw === "onleave" || raw === "leave" || raw === "on-leave") {
    return {
      bg: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70",
      dot: "bg-blue-500",
      label: "On Leave",
      code: "on leave",
    };
  }

  if (raw === "terminated" || raw === "dismissed") {
    return {
      bg: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70",
      dot: "bg-rose-500",
      label: "Terminated",
      code: "terminated",
    };
  }

  if (raw === "active") {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70",
      dot: "bg-emerald-500",
      label: "Active",
      code: "active",
    };
  }

  if (raw === "suspended") {
    return {
      bg: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/70",
      dot: "bg-red-500",
      label: "Suspended",
      code: "suspended",
    };
  }

  if (raw === "inactive") {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70",
      dot: "bg-amber-500",
      label: "Inactive",
      code: "inactive",
    };
  }

  return {
    bg: "bg-slate-50 dark:bg-[#162033]/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dot: "bg-slate-500",
    label: raw.charAt(0).toUpperCase() + raw.slice(1),
    code: raw,
  };
};

export const formatEmployeeDate = (dateVal) => {
  if (!dateVal) return "N/A";
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" });
};
