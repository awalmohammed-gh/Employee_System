import { isSundayHoliday, SUNDAY_HOLIDAY_MESSAGE } from "../utils/attendanceHoliday";
import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  Timer,
  Calendar,
} from "lucide-react";
import { useAttendanceContext } from "../context/AttendanceContext";
import { getTodayAttendanceStatus } from "../apis/fontApis";
import { ui } from "../pages/Employees/ui/tokens";

/**
 * Custom Hook: useMidnightRefresh
 * Calculates milliseconds remaining until 12:00:01 AM (midnight rollover),
 * automatically triggering fresh attendance status resolution and resetting action buttons.
 */
export const useMidnightRefresh = (onMidnight, dependency = null) => {
  useEffect(() => {
    const now = new Date();
    const tomorrowMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1
    );
    const msUntilMidnight = Math.max(1000, tomorrowMidnight.getTime() - now.getTime());

    // Midnight timer
    const timer = setTimeout(() => {
      console.log("[useMidnightRefresh] Midnight boundary reached! Refreshing attendance state...");
      if (typeof onMidnight === "function") {
        onMidnight();
      }
    }, msUntilMidnight);

    // Watchdog interval to detect system sleep/wake or date jumps
    const initialDateStr = now.toISOString().split("T")[0];
    const watchdog = setInterval(() => {
      const currentDateStr = new Date().toISOString().split("T")[0];
      if (currentDateStr !== initialDateStr) {
        console.log("[useMidnightRefresh] Date boundary rollover detected:", currentDateStr);
        if (typeof onMidnight === "function") {
          onMidnight();
        }
      }
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(watchdog);
    };
  }, [onMidnight, dependency]);
};

/**
 * DailyShiftClock Component
 *
 * Implements automated end-of-day shift closure and midnight reset logic:
 * - Unclosed shifts from prior days reset cleanly at 12:00 AM.
 * - Primary action button resets back to active "Clock In" button for the new workday.
 * - Live shift duration timer tracks elapsed time or resets to 0h 00m 00s.
 * - 3 discrete action button UI state resolutions.
 */
const DailyShiftClock = ({
  attendanceData: propAttendanceData,
  hasClockedIn: propHasClockedIn,
  hasClockedOut: propHasClockedOut,
  isLoading: propIsLoading,
  isCheckingStatus: propIsCheckingStatus,
  onClockIn: propOnClockIn,
  onClockOut: propOnClockOut,
  workStartTime = "08:00",
  workEndTime = "19:00",
  allowEarlyOverride = true,
}) => {
  // Access global attendance context
  const contextValues = useAttendanceContext();

  const {
    todayRecord = null,
    hasClockedIn: ctxHasClockedIn = false,
    hasClockedOut: ctxHasClockedOut = false,
    isClocking: ctxIsClocking = false,
    isCheckingStatus: ctxIsCheckingStatus = false,
    clockIn: ctxClockIn,
    clockOut: ctxClockOut,
    refreshAttendance: ctxRefreshAttendance,
    updateTodayRecord,
  } = contextValues || {};

  const [mountAttendance, setMountAttendance] = useState(null);
  const [internalIsCheckingStatus, setInternalIsCheckingStatus] = useState(true);

  // Fetch /api/attendance/today-status on mount to ensure zero loss of state upon refresh
  useEffect(() => {
    let isMounted = true;
    const fetchTodayStatusOnMount = async () => {
      try {
        setInternalIsCheckingStatus(true);
        const res = await getTodayAttendanceStatus();
        if (res?.data?.success && isMounted) {
          const shiftData =
            res.data.attendance ||
            res.data.todayRecord ||
            res.data.data;
          if (shiftData) {
            setMountAttendance(shiftData);
            if (typeof updateTodayRecord === "function") {
              updateTodayRecord(shiftData);
            }
          }
        }
      } catch (err) {
        console.warn("[DailyShiftClock] Error hydrating /api/attendance/today-status on mount:", err.message);
      } finally {
        if (isMounted) {
          setInternalIsCheckingStatus(false);
        }
      }
    };
    fetchTodayStatusOnMount();
    return () => {
      isMounted = false;
    };
  }, [updateTodayRecord]);

  // Unified status verification barrier: prevents Clock In button from flashing on refresh
  const isCheckingStatus =
    propIsCheckingStatus !== undefined
      ? propIsCheckingStatus
      : ctxIsCheckingStatus || internalIsCheckingStatus;

  // Resolve attendance data & flags: priority to mount-fetched/props, fallback to context
  const activeRecord = propAttendanceData ?? mountAttendance ?? todayRecord;
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const recordDate = activeRecord?.date || (activeRecord?.clockIn ? new Date(activeRecord.clockIn).toISOString().split("T")[0] : "");
  const isRecordForToday = Boolean(recordDate && recordDate === todayStr);
  const isClockedIn = isRecordForToday && (propHasClockedIn ?? ctxHasClockedIn ?? Boolean(activeRecord?.clockIn || activeRecord?.clockInTime));
  const isClockedOut = isRecordForToday && (propHasClockedOut ?? ctxHasClockedOut ?? Boolean(activeRecord?.clockOut || activeRecord?.clockOutTime));
  const isPending = propIsLoading ?? ctxIsClocking ?? false;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");

  // Live wall clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hook up automated midnight boundary timer
  const handleMidnightRefresh = useCallback(() => {
    if (ctxRefreshAttendance) {
      ctxRefreshAttendance(false);
    }
  }, [ctxRefreshAttendance]);

  useMidnightRefresh(handleMidnightRefresh, activeRecord?.clockIn);

  // Parse work start & end times
  const { startHour, startMin, endHour, endMin } = useMemo(() => {
    const [sH = "08", sM = "00"] = String(workStartTime).split(":");
    const [eH = "19", eM = "00"] = String(workEndTime).split(":");
    return {
      startHour: parseInt(sH, 10),
      startMin: parseInt(sM, 10),
      endHour: parseInt(eH, 10),
      endMin: parseInt(eM, 10),
    };
  }, [workStartTime, workEndTime]);

  // Format shift closing time display (e.g., "07:00 PM")
  const formattedEndTime = useMemo(() => {
    const period = endHour >= 12 ? "PM" : "AM";
    const displayHour = endHour % 12 === 0 ? 12 : endHour % 12;
    return `${String(displayHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")} ${period}`;
  }, [endHour, endMin]);

  const formattedStartTime = useMemo(() => {
    const period = startHour >= 12 ? "PM" : "AM";
    const displayHour = startHour % 12 === 0 ? 12 : startHour % 12;
    return `${String(displayHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")} ${period}`;
  }, [startHour, startMin]);

  // Milestone 1: Check if current wall clock has reached or exceeded shift closing time (7:00 PM / 19:00 unlock)
  const isUnlockTime = useMemo(() => {
    const nowHours = currentTime.getHours();
    const nowMinutes = currentTime.getMinutes();
    return nowHours > endHour || (nowHours === endHour && nowMinutes >= endMin);
  }, [currentTime, endHour, endMin]);

  // Backward compatibility alias
  const isShiftClosingReached = isUnlockTime;

  // Milestone 2: 7:30 PM (19:30) automatic system clock-out grace period
  const isAutoClosedTime = useMemo(() => {
    const nowHours = currentTime.getHours();
    const nowMinutes = currentTime.getMinutes();
    if (endHour === 19 && endMin === 0) {
      return nowHours > 19 || (nowHours === 19 && nowMinutes >= 30);
    }
    const totalEndMinutes = endHour * 60 + endMin + 30;
    const currentTotalMinutes = nowHours * 60 + nowMinutes;
    return currentTotalMinutes >= totalEndMinutes;
  }, [currentTime, endHour, endMin]);

  // Determine if shift is auto-closed (either flagged by database or reached 19:30 milestone with open shift)
  const isAutoClosed = useMemo(() => {
    if (activeRecord?.autoClockedOut) return true;
    const notesLower = (activeRecord?.notes || "").toLowerCase();
    if (notesLower.includes("auto clocked out") || notesLower.includes("missed manual clock-out")) return true;
    if ((activeRecord?.shiftStatus || "").toLowerCase() === "auto-closed") return true;
    if (isClockedIn && !isClockedOut && isAutoClosedTime) return true;
    return false;
  }, [activeRecord, isClockedIn, isClockedOut, isAutoClosedTime]);

  const effectiveIsClockedOut = isClockedOut || (isClockedIn && isAutoClosedTime);

  // Auto-sync status with backend when 7:30 PM grace period expires
  useEffect(() => {
    if (isClockedIn && !isClockedOut && isAutoClosedTime) {
      console.log("[DailyShiftClock] 7:30 PM auto-close milestone reached: refreshing status from backend...");
      if (ctxRefreshAttendance) {
        ctxRefreshAttendance(false);
      }
    }
  }, [isClockedIn, isClockedOut, isAutoClosedTime, ctxRefreshAttendance]);

  // Calculate live shift duration
  const shiftDuration = useMemo(() => {
    // Case 1: Not clocked in yet today -> reset to 0h 00m 00s
    if (!isClockedIn || !activeRecord?.clockIn) {
      return { hours: "0h", minutes: "00m", seconds: "00s", totalHours: "0.0" };
    }

    const clockInDate = new Date(activeRecord.clockIn || activeRecord.clockInTime);
    if (isNaN(clockInDate.getTime())) {
      return { hours: "0h", minutes: "00m", seconds: "00s", totalHours: "0.0" };
    }

    // If clocked out, freeze at clockOut timestamp; if auto-closed, freeze at 7:30 PM
    let endDate = currentTime;
    if (isClockedOut && activeRecord.clockOut) {
      endDate = new Date(activeRecord.clockOut || activeRecord.clockOutTime);
    } else if (isAutoClosed) {
      const autoDate = new Date();
      autoDate.setHours(19, 30, 0, 0);
      endDate = autoDate;
    }

    const diffMs = Math.max(0, endDate.getTime() - clockInDate.getTime());
    const totalSecs = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    return {
      hours: `${h}h`,
      minutes: `${String(m).padStart(2, "0")}m`,
      seconds: `${String(s).padStart(2, "0")}s`,
      totalHours: (diffMs / (1000 * 60 * 60)).toFixed(1),
    };
  }, [isClockedIn, isClockedOut, isAutoClosed, activeRecord, currentTime]);

  // Formatted clock-in time for badge
  const formattedClockInTime = useMemo(() => {
    if (!activeRecord?.clockIn) return "";
    try {
      const d = new Date(activeRecord.clockIn || activeRecord.clockInTime);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [activeRecord]);

  // Attendance Status evaluation (On-Time, Late, Absent, Pending)
  const attendanceStatus = useMemo(() => {
    const dbStatus = String(activeRecord?.status || "").trim().toLowerCase();
    const currentHour = new Date().getHours();
    const isPastShiftCutoff = currentHour >= endHour;

    if (dbStatus === "absent" || (!isClockedIn && isPastShiftCutoff)) {
      return "absent";
    }

    if (!isClockedIn) {
      return "pending";
    }

    // Has clocked in: check delay / lateness
    const dbDelay = Number(activeRecord?.delayMinutes || activeRecord?.lateMinutes || 0);
    const clockInDate = activeRecord?.clockIn ? new Date(activeRecord.clockIn) : null;
    let computedDelay = 0;
    if (clockInDate && !isNaN(clockInDate.getTime())) {
      const clockInMinutes = clockInDate.getHours() * 60 + clockInDate.getMinutes();
      const thresholdMinutes = startHour * 60 + startMin;
      computedDelay = Math.max(0, clockInMinutes - thresholdMinutes);
    }
    const finalDelay = dbDelay > 0 ? dbDelay : computedDelay;
    const isLate = dbStatus.includes("late") || finalDelay > 0;

    return isLate ? "late" : "ontime";
  }, [activeRecord, isClockedIn, endHour, startHour, startMin]);

  // Clock In Action Handler
  const handleClockInClick = async () => {
    if (propOnClockIn) {
      propOnClockIn();
    } else if (ctxClockIn) {
      await ctxClockIn();
    }
  };

  // Clock Out Action Handler
  const handleClockOutClick = async (reason = "") => {
    if (propOnClockOut) {
      propOnClockOut(reason);
    } else if (ctxClockOut) {
      await ctxClockOut(reason);
    }
    setShowOverrideModal(false);
    setOverrideReason("");
  };

  const handleOverrideSubmit = (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setOverrideError("Please provide a brief reason for early clock out.");
      return;
    }
    setOverrideError("");
    handleClockOutClick(overrideReason.trim());
  };

  const statusIconBox = {
    ontime: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    late: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    absent: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    pending: "bg-[#002185]/[0.07] text-[#002185] dark:bg-blue-500/10 dark:text-blue-300",
  }[attendanceStatus];

  const tile = `${ui.subtle} p-4 flex flex-col gap-1.5 min-w-0`;
  const tileLabel = "text-xs font-medium text-slate-500 dark:text-slate-400";
  const tileHint = "text-xs text-slate-500 dark:text-slate-400 leading-relaxed";
  const actionBase =
    "w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold transition-all duration-150";
  const disabledState = `${actionBase} bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700`;

  if (isSundayHoliday(currentTime)) {
    return <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] p-6" role="status"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sunday holiday</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{SUNDAY_HOLIDAY_MESSAGE}</p></section>;
  }

  return (
    <section id="daily-shift-clock-container" className={`${ui.card} p-5 sm:p-6`}>
      {/* Header: title + live clock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${statusIconBox}`}>
            <Clock className="w-4.5 h-4.5" />
          </span>
          <div>
            <h3 className={ui.h2}>Daily shift clock</h3>
            <p className={`${ui.caption} mt-0.5`}>Work starts from 8:00 AM and ends at 7:00 PM</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-left sm:text-right">
            <p className="text-2xl sm:text-[28px] font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center sm:justify-end gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {currentTime.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Status, duration, clock-out access */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <div className={tile}>
          <span className={tileLabel}>Workday status</span>
          <div className="flex items-center gap-2 min-w-0">
            {attendanceStatus === "absent" ? (
              <>
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">Status: Absent</span>
              </>
            ) : effectiveIsClockedOut ? (
              <>
                <CheckCircle2
                  className={`w-4.5 h-4.5 shrink-0 ${isAutoClosed ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isAutoClosed ? "Shift Completed (Auto-Closed)" : "Shift Completed"}
                </span>
              </>
            ) : isClockedIn ? (
              <>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${attendanceStatus === "late" ? "bg-rose-400" : "bg-emerald-400"}`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${attendanceStatus === "late" ? "bg-rose-500" : "bg-emerald-500"}`}
                  />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Active Shift ({attendanceStatus === "late" ? "Late Arrival" : "On-Time"})
                </span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ready to Clock In</span>
              </>
            )}
          </div>
          <p className={tileHint}>
            {attendanceStatus === "absent"
              ? "No clock-in recorded for today's scheduled shift."
              : isAutoClosed
              ? "Auto clocked out by system at 7:30 PM"
              : effectiveIsClockedOut
              ? "Clock-out logged for today"
              : isClockedIn
              ? `Shift active since ${formattedClockInTime}`
              : "No shift recorded yet today"}
          </p>
        </div>

        <div className={tile}>
          <div className="flex items-center justify-between">
            <span className={tileLabel}>Shift duration</span>
            <Timer className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
            {shiftDuration.hours} <span className="text-slate-600 dark:text-slate-300">{shiftDuration.minutes}</span>{" "}
            <span className="text-lg text-slate-400 dark:text-slate-500">{shiftDuration.seconds}</span>
          </p>
          <p className={tileHint}>
            {effectiveIsClockedOut
              ? `Total logged: ${shiftDuration.totalHours} hrs`
              : isClockedIn
              ? "Live timer updating in real time"
              : "Timer resets to 0h 00m 00s at midnight"}
          </p>
        </div>

        <div className={tile}>
          <span className={tileLabel}>Clock-out access</span>
          <div className="flex items-center gap-2">
            {effectiveIsClockedOut ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isAutoClosed ? "Closed (Auto 7:30 PM)" : "Closed"}
                </span>
              </>
            ) : isUnlockTime ? (
              <>
                <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Unlocked ({formattedEndTime} Reached)
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Unlocks at {formattedEndTime}</span>
              </>
            )}
          </div>
          <p className={tileHint}>
            {effectiveIsClockedOut
              ? isAutoClosed
                ? "Shift automatically finalized past 7:30 PM grace period."
                : "Shift checkout logged."
              : isUnlockTime
              ? "Scheduled shift complete. Ready to clock out."
              : `Standard checkout opens at ${formattedEndTime}`}
          </p>
        </div>
      </div>

      {/* Auto clock-out notice */}
      {isAutoClosed && (
        <div className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-[13px] dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Auto Clocked Out by System (Missed manual clock-out):</span> Your shift was
            automatically concluded at the 7:30 PM system grace period.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        {isCheckingStatus ? (
          <>
            <div id="daily-clock-in-skeleton" className={`${disabledState} cursor-default`}>
              <WorkspaceLoader inline />
              <span>Verifying attendance status…</span>
            </div>
            <div id="daily-clock-out-skeleton" className={`${disabledState} cursor-default opacity-70`}>
              <Lock className="w-4 h-4" />
              <span>Checking shift state…</span>
            </div>
          </>
        ) : (
          <>
            {/* Clock-in side */}
            {!isClockedIn && !effectiveIsClockedOut ? (
              <button
                id="btn-daily-clock-in"
                type="button"
                onClick={handleClockInClick}
                disabled={isPending}
                className={`${ui.btnPrimary} h-12! w-full`}
              >
                <LogIn className="w-4.5 h-4.5" />
                <span>{isPending ? <><WorkspaceLoader inline /> Clocking In...</> : "Clock In"}</span>
              </button>
            ) : isClockedIn && !effectiveIsClockedOut ? (
              <button id="btn-daily-clocked-in-disabled" type="button" disabled className={disabledState}>
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <span>Clocked In ({formattedClockInTime || "In Progress"})</span>
              </button>
            ) : (
              <button id="btn-daily-shift-completed-in" type="button" disabled className={`${disabledState} cursor-default`}>
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <span>Shift Completed</span>
              </button>
            )}

            {/* Clock-out side */}
            {!isClockedIn && !effectiveIsClockedOut ? (
              <button id="btn-daily-clock-out-locked-init" type="button" disabled className={`${disabledState} opacity-70`}>
                <Lock className="w-4 h-4" />
                <span>Clock Out (Unlocks at {formattedEndTime})</span>
              </button>
            ) : isClockedIn && !effectiveIsClockedOut ? (
              isUnlockTime ? (
                <button
                  id="btn-daily-clock-out-active"
                  type="button"
                  onClick={() => handleClockOutClick()}
                  disabled={isPending}
                  className={`${actionBase} bg-rose-600 text-white shadow-[0_1px_2px_rgba(225,29,72,0.3)] hover:bg-rose-700 active:scale-[0.98] cursor-pointer disabled:opacity-60 ${ui.focusRing}`}
                >
                  <LogOut className="w-4.5 h-4.5" />
                  <span>{isPending ? <><WorkspaceLoader inline /> Clocking Out...</> : "Clock Out Now"}</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button id="btn-daily-clock-out-locked" type="button" disabled className={`${disabledState} flex-1 min-w-0`}>
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">Unlocks at {formattedEndTime}</span>
                  </button>
                  {allowEarlyOverride && (
                    <button
                      id="btn-daily-clock-out-early-override"
                      type="button"
                      onClick={() => setShowOverrideModal(true)}
                      className={`${ui.btnSecondary} h-12! shrink-0`}
                      title="Clock out early with reason"
                    >
                      Early out
                    </button>
                  )}
                </div>
              )
            ) : isAutoClosed ? (
              <button
                id="btn-daily-shift-completed-out-auto"
                type="button"
                disabled
                className={`${actionBase} bg-amber-50 text-amber-800 border border-amber-200 cursor-default dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20`}
              >
                <CheckCircle2 className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Shift Completed (Auto Clocked Out at 7:30 PM)</span>
              </button>
            ) : (
              <button
                id="btn-daily-shift-completed-out"
                type="button"
                disabled
                className={`${actionBase} bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20`}
              >
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                <span>Shift Completed ({shiftDuration.totalHours} hrs)</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Early clock-out reason */}
      {showOverrideModal && (
        <div
          id="early-clockout-modal-backdrop"
          className={ui.overlay}
          onClick={(e) => e.target === e.currentTarget && setShowOverrideModal(false)}
        >
          <div id="early-clockout-modal" role="dialog" aria-modal="true" aria-labelledby="early-clockout-title" className={`${ui.modal} sm:max-w-md`}>
            <div className={ui.modalHeader}>
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 shrink-0">
                  <AlertCircle className="w-4.5 h-4.5" />
                </span>
                <div>
                  <h4 id="early-clockout-title" className={ui.h2}>Early shift departure</h4>
                  <p className={`${ui.caption} mt-0.5`}>
                    Regular shift ends at <strong className="text-slate-700 dark:text-slate-200">{formattedEndTime}</strong>.
                    Please provide a reason for clocking out early before closing time.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleOverrideSubmit}>
              <div className={ui.modalBody}>
                <label htmlFor="early-clockout-reason-input" className={ui.label}>
                  Reason
                </label>
                <textarea
                  id="early-clockout-reason-input"
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State your reason (e.g. Approved doctor appointment, personal emergency)..."
                  className={`${ui.textarea} resize-none`}
                  required
                  autoFocus
                />
                {overrideError && <p className={ui.error}>{overrideError}</p>}
              </div>

              <div className={ui.modalFooter}>
                <button type="button" onClick={() => setShowOverrideModal(false)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`${ui.btnPrimary} bg-rose-600! hover:bg-rose-700! dark:bg-rose-600! dark:hover:bg-rose-700!`}
                >
                  {isPending ? <><WorkspaceLoader inline /> Confirming...</> : "Confirm clock out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

/**
 * Strict Conditional Attendance Action Button Component
 *
 * Implements strict conditional rendering:
 * 1. if (isCheckingStatus) return <LoadingSkeleton />;
 * 2. if (!hasClockedIn) return <ClockInButton />;
 * 3. if (hasClockedIn && !hasClockedOut) return <ClockOutButton />;
 * 4. if (hasClockedIn && hasClockedOut) return <ShiftCompletedBadge />;
 */
export const AttendanceActionButton = memo(function AttendanceActionButton({
  isCheckingStatus = false,
  hasClockedIn = false,
  hasClockedOut = false,
  onClockIn,
  onClockOut,
  isPending = false,
  workHours = 0,
}) {
  const base = "w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold transition-all duration-150";

  if (isCheckingStatus) {
    return (
      <div
        id="attendance-action-skeleton"
        className={`${base} bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700`}
      >
        <WorkspaceLoader inline />
        <span>Verifying status…</span>
      </div>
    );
  }

  if (!hasClockedIn) {
    return (
      <button id="btn-strict-clock-in" type="button" onClick={onClockIn} disabled={isPending} className={`${ui.btnPrimary} h-12! w-full`}>
        <LogIn className="w-4.5 h-4.5" />
        <span>{isPending ? <><WorkspaceLoader inline /> Clocking In...</> : "Clock In"}</span>
      </button>
    );
  }

  if (hasClockedIn && !hasClockedOut) {
    return (
      <button
        id="btn-strict-clock-out"
        type="button"
        onClick={onClockOut}
        disabled={isPending}
        className={`${base} bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] cursor-pointer disabled:opacity-60 ${ui.focusRing}`}
      >
        <LogOut className="w-4.5 h-4.5" />
        <span>{isPending ? <><WorkspaceLoader inline /> Clocking Out...</> : "Clock Out"}</span>
      </button>
    );
  }

  if (hasClockedIn && hasClockedOut) {
    return (
      <div
        id="badge-strict-shift-completed"
        className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20`}
      >
        <CheckCircle2 className="w-4.5 h-4.5" />
        <span>Shift Completed{workHours ? ` (${workHours} hrs)` : ""}</span>
      </div>
    );
  }

  return null;
});

export default memo(DailyShiftClock);
