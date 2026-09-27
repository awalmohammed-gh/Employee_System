import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useCallback } from "react";
import { Bell, Clock, CheckCircle2, RefreshCw, Send, Phone, Mail, ShieldAlert, Check, Users } from "lucide-react";
import {
  getLateAttendanceAlerts,
  notifyLateEmployees,
  excuseLateEmployee,
} from "../apis/fontApis";

export const AttentionRequiredLateAttendance = ({ onActionLogged = null }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    shiftStartTime: "08:00",
    currentTime: "08:00",
    isShiftStarted: true,
    gracePeriodMinutes: 15,
    totalActive: 0,
    totalClockedIn: 0,
    totalLateUnclocked: 0,
    employees: [],
  });

  const [notifyingIds, setNotifyingIds] = useState(new Set());
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const [notifyingAll, setNotifyingAll] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selectedForExcuse, setSelectedForExcuse] = useState(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [submittingExcuse, setSubmittingExcuse] = useState(false);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'critical' | 'not_notified'

  const fetchAlerts = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await getLateAttendanceAlerts();
      if (res?.data?.success && res.data.data) {
        setData(res.data.data);

        // Pre-fill notifiedIds from backend records
        const alreadyNotified = new Set();
        (res.data.data.employees || []).forEach((emp) => {
          if (emp.notificationSent) {
            alreadyNotified.add(String(emp._id || emp.id));
          }
        });
        setNotifiedIds(alreadyNotified);
      }
    } catch (err) {
      console.warn("[AttentionRequired] Error fetching late attendance alerts:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Auto-poll every 30 seconds for live attendance monitoring
    const timer = setInterval(() => {
      fetchAlerts(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  // Notify individual employee
  const handleNotifyEmployee = async (emp) => {
    const idStr = String(emp._id || emp.id);
    setNotifyingIds((prev) => new Set(prev).add(idStr));
    try {
      const res = await notifyLateEmployees({
        employeeId: idStr,
      });

      if (res?.data?.success) {
        setNotifiedIds((prev) => new Set(prev).add(idStr));
        setNotice({
          type: "success",
          message: `✓ Notification sent to ${emp.fullName}: Shift start was ${emp.shiftStartTime || data.shiftStartTime}.`,
        });
        if (onActionLogged) onActionLogged();
      } else {
        setNotice({
          type: "error",
          message: res?.data?.message || "Failed to dispatch notification.",
        });
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err.response?.data?.message || "Network error sending notification.",
      });
    } finally {
      setNotifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
      setTimeout(() => setNotice(null), 5000);
    }
  };

  // Notify all unclocked employees
  const handleNotifyAll = async () => {
    setNotifyingAll(true);
    try {
      const res = await notifyLateEmployees({ sendAll: true });
      if (res?.data?.success) {
        const allIds = new Set(data.employees.map((e) => String(e._id || e.id)));
        setNotifiedIds(allIds);
        setNotice({
          type: "success",
          message: `✓ Broadcast sent: Dispatched late attendance notice to ${res.data.count || data.employees.length} employee(s).`,
        });
        if (onActionLogged) onActionLogged();
      } else {
        setNotice({
          type: "error",
          message: res?.data?.message || "Failed to broadcast notifications.",
        });
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err.response?.data?.message || "Network error broadcasting alerts.",
      });
    } finally {
      setNotifyingAll(false);
      setTimeout(() => setNotice(null), 6000);
    }
  };

  // Excuse late employee
  const handleConfirmExcuse = async () => {
    if (!selectedForExcuse) return;
    setSubmittingExcuse(true);
    try {
      const res = await excuseLateEmployee({
        employeeId: String(selectedForExcuse._id || selectedForExcuse.id),
        reason: excuseReason.trim() || "Excused by Administrator",
      });

      if (res?.data?.success) {
        setNotice({
          type: "success",
          message: `✓ Excused late attendance for ${selectedForExcuse.fullName}.`,
        });
        setSelectedForExcuse(null);
        setExcuseReason("");
        fetchAlerts(true);
        if (onActionLogged) onActionLogged();
      } else {
        setNotice({
          type: "error",
          message: res?.data?.message || "Failed to excuse attendance.",
        });
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err.response?.data?.message || "Error excusing attendance.",
      });
    } finally {
      setSubmittingExcuse(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filteredEmployees = (data.employees || []).filter((emp) => {
    const idStr = String(emp._id || emp.id);
    if (filterMode === "critical") {
      return (emp.minutesOverdue || 0) >= 60;
    }
    if (filterMode === "not_notified") {
      return !notifiedIds.has(idStr);
    }
    return true;
  });

  const formatOverdue = (minutes) => {
    if (!minutes || minutes <= 0) return "Pending shift start";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `+${hrs}h ${mins > 0 ? `${mins}m` : ""} overdue`;
    }
    return `+${mins}m overdue`;
  };

  if (loading) {
    return (
      <WorkspaceLoader fullScreen={false} />
    );
  }

  // Empty state: zero employees in database
  if (data.totalActive === 0) {
    return (
      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Attention Required: Workforce Attendance
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  0 Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No active employees registered yet. Add employees to enable real-time clock-in tracking and late arrival monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All clear state: employees exist and all are clocked in on time
  if (data.totalLateUnclocked === 0) {
    return (
      <div className="bg-white dark:bg-[#111927] border border-emerald-500/20 dark:border-emerald-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Attention Required: Workforce Attendance
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  All Clear
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                All scheduled employees have clocked in on time for today's shift (Shift Start: {data.shiftStartTime}). No attendance attention is currently required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchAlerts()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer self-start sm:self-center"
          >
            {(refreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            <span>Check Now</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111927] border-2 border-rose-500/30 dark:border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-md dark:shadow-black/30 relative overflow-hidden transition-all duration-200">
      {/* High-priority subtle top accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500"></div>

      {/* Toast notice banner */}
      {notice && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
            notice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-2 font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header section with live pulsating indicator and actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Attention Required: Late Attendance
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  {data.totalLateUnclocked} {data.totalLateUnclocked === 1 ? "Employee" : "Employees"} Overdue
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Identified personnel scheduled for shift starting at{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {data.shiftStartTime}
                </span>{" "}
                who have not clocked in. Immediate administrative action or reminder required.
              </p>
            </div>
          </div>
        </div>

        {/* Action button cluster */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-[#162033] p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                filterMode === "all"
                  ? "bg-white dark:bg-[#111927] text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All ({data.totalLateUnclocked})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("critical")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                filterMode === "critical"
                  ? "bg-white dark:bg-[#111927] text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Over 1h Late
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("not_notified")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                filterMode === "not_notified"
                  ? "bg-white dark:bg-[#111927] text-amber-600 dark:text-amber-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Pending Alert
            </button>
          </div>

          <button
            type="button"
            onClick={handleNotifyAll}
            disabled={notifyingAll || data.totalLateUnclocked === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {notifyingAll ? (
              <WorkspaceLoader inline />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            <span>Send All Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => fetchAlerts()}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Refresh late attendance list"
          >
            {(refreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Late employees grid cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredEmployees.map((emp) => {
          const empIdStr = String(emp._id || emp.id);
          const isNotifying = notifyingIds.has(empIdStr);
          const isNotified = notifiedIds.has(empIdStr);
          const isCritical = (emp.minutesOverdue || 0) >= 120;

          return (
            <div
              key={empIdStr}
              className={`rounded-2xl p-4 border transition-all duration-150 flex flex-col justify-between ${
                isCritical
                  ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                  : "bg-slate-50/70 dark:bg-[#162033]/40 border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Employee info header */}
              <div>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-sm shrink-0 border border-slate-300 dark:border-slate-600">
                      {emp.avatar ? (
                        <img
                          src={emp.avatar}
                          alt={emp.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        emp.fullName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {emp.fullName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {emp.position} • {emp.department}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isCritical
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {formatOverdue(emp.minutesOverdue)}
                  </span>
                </div>

                {/* Shift and contact telemetry */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Shift: {emp.shiftStartTime || data.shiftStartTime}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {emp.phone && (
                      <a
                        href={`tel:${emp.phone}`}
                        title={`Call ${emp.fullName}`}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                    {emp.email && (
                      <a
                        href={`mailto:${emp.email}`}
                        title={`Email ${emp.fullName}`}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                      >
                        <Mail className="w-3 h-3" />
                      </a>
                    )}
                    <span className="font-mono text-[10px] text-slate-400">
                      {emp.employeeId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNotifyEmployee(emp)}
                  disabled={isNotifying}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isNotified
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 shadow-2xs"
                  }`}
                >
                  {isNotifying ? (
                    <WorkspaceLoader inline />
                  ) : isNotified ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isNotified ? "Alerted ✓" : "Notify Staff"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedForExcuse(emp);
                    setExcuseReason("Approved Transportation Delay");
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Excuse this late attendance"
                >
                  Excuse
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
          No employees match the current filter selection.
        </div>
      )}

      {/* Excuse modal dialog */}
      {selectedForExcuse && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111927] rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Excuse Late Attendance
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Waive attendance irregularity for{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {selectedForExcuse.fullName}
              </strong>
              . This event will be recorded in the system audit trail.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reason / Justification
              </label>
              <input
                type="text"
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                placeholder="e.g. Official Duty, Medical Appointment, Transit Delay"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedForExcuse(null)}
                disabled={submittingExcuse}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExcuse}
                disabled={submittingExcuse}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#002185] hover:bg-[#001760] dark:hover:bg-blue-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {submittingExcuse && <WorkspaceLoader inline />}
                <span>Confirm & Waive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttentionRequiredLateAttendance;
