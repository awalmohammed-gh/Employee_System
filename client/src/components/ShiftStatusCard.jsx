import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  LogIn,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { getSettings } from "../apis/fontApis";
import { buttonPressProps } from "../utils/motion";
import { ui } from "../pages/Employees/ui/tokens";
import { Badge } from "../pages/Employees/ui/primitives";

/**
 * ShiftStatusCard Component
 *
 * Real-time dynamic shift status card that immediately reflects whether
 * the employee is "On-Time", "Late", or "Absent" once they clock in or shift cutoff passes.
 * Dynamic styling rules:
 * - On-Time Arrival: Soft emerald theme across card, accents, and "Shift Attendance Status: On-Time Arrival" title.
 * - Late Arrival: Soft rose theme across card, accents, and "Shift Attendance Status: Late Arrival" title.
 * - Absent: Soft rose/slate theme with "Status: Absent" badge and "No clock-in recorded for today's scheduled shift." subtitle.
 * - No colored top accent bars; clean hairline borders.
 */
const ShiftStatusCard = ({
  attendanceData = {},
  hasClockedIn = false,
  isLoading = false,
  isCheckingStatus = false,
  isSyncing = false,
  onClockIn,
  workStartTime: propWorkStartTime,
  onRefresh,
  user,
  userName: propUserName,
}) => {
  const [companyStartTime, setCompanyStartTime] = useState(
    propWorkStartTime || "08:00"
  );
  const [companyEndTime, setCompanyEndTime] = useState("19:00");
  const [penaltyTiers, setPenaltyTiers] = useState([
    { tier: 1, name: "Tier 1 (1–30 mins)", minMinutes: 1, maxMinutes: 30, fine: 10 },
    { tier: 2, name: "Tier 2 (31–60 mins)", minMinutes: 31, maxMinutes: 60, fine: 30 },
    { tier: 3, name: "Tier 3 (61–120 mins)", minMinutes: 61, maxMinutes: 120, fine: 50 },
    { tier: 4, name: "Tier 4 (121–180 mins)", minMinutes: 121, maxMinutes: 180, fine: 75 },
    { tier: 5, name: "Tier 5 (181–240 mins)", minMinutes: 181, maxMinutes: 240, fine: 100 },
    { tier: 6, name: "Tier 6 (241+ mins)", minMinutes: 241, maxMinutes: 9999, fine: 150 },
  ]);

  // Fetch company settings to ensure real-time shift threshold & penalty tiers
  useEffect(() => {
    let isMounted = true;
    const loadCompanySettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings) {
          const { attendance, penalties } = res.data.settings;
          const startTime =
            attendance?.workStartTime ||
            penalties?.workStartTime ||
            res.data.settings?.workStartTime;
          const endTime =
            attendance?.workEndTime ||
            penalties?.workEndTime ||
            res.data.settings?.workEndTime;
          if (startTime) {
            setCompanyStartTime(startTime);
          }
          if (endTime) {
            setCompanyEndTime(endTime);
          }
          if (res.data.settings?.latenessTiers) {
            setPenaltyTiers(res.data.settings.latenessTiers);
          }
        }
      } catch {
        // Fallback to default 08:00 / 19:00
      }
    };

    if (!propWorkStartTime) {
      loadCompanySettings();
    } else {
      setCompanyStartTime(propWorkStartTime);
    }

    return () => {
      isMounted = false;
    };
  }, [propWorkStartTime]);

  // Format 12-hour display string for shift threshold
  const formattedStartTime = useMemo(() => {
    const raw = companyStartTime || "08:00";
    const [hStr, mStr] = raw.split(":");
    const h = parseInt(hStr, 10) || 8;
    const m = parseInt(mStr, 10) || 0;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }, [companyStartTime]);

  // Parse start threshold in minutes
  const startThresholdMinutes = useMemo(() => {
    const raw = companyStartTime || "08:00";
    const [hStr, mStr] = raw.split(":");
    const h = parseInt(hStr, 10) || 8;
    const m = parseInt(mStr, 10) || 0;
    return h * 60 + m;
  }, [companyStartTime]);

  const endThresholdHour = useMemo(() => {
    const raw = companyEndTime || "19:00";
    const [hStr] = raw.split(":");
    return parseInt(hStr, 10) || 19;
  }, [companyEndTime]);

  const resolvedEmployeeName = useMemo(() => {
    if (propUserName && typeof propUserName === "string" && propUserName.trim()) {
      return propUserName.trim();
    }
    if (user?.fullName && typeof user.fullName === "string" && user.fullName.trim()) {
      return user.fullName.trim();
    }
    if (user?.name && typeof user.name === "string" && user.name.trim()) {
      return user.name.trim();
    }
    if (user?.full_name && typeof user.full_name === "string" && user.full_name.trim()) {
      return user.full_name.trim();
    }
    return "";
  }, [propUserName, user]);

  const greetingTimeOfDay = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const formatShortTime = (timeStr) => {
    if (!timeStr) return "--:--";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return timeStr;
    }
  };

  // Evaluate Live Status
  const statusEvaluation = useMemo(() => {
    const isClockedInToday = hasClockedIn && Boolean(attendanceData?.clockIn || attendanceData?.clockInTime);
    const dbStatus = String(attendanceData?.status || "").trim().toLowerCase();
    const currentHour = new Date().getHours();
    const isPastShiftCutoff = currentHour >= endThresholdHour;

    // Check Absent: either status is explicitly Absent OR employee has not clocked in by 7:00 PM
    if (dbStatus === "absent" || (!isClockedInToday && isPastShiftCutoff)) {
      return {
        type: "absent",
        title: "Shift Attendance Status: Absent",
        badgeText: "Status: Absent",
        subtitle: "No clock-in recorded for today's scheduled shift.",
        isLate: false,
        isAbsent: true,
        delayMinutes: 0,
        penaltyAmount: 0,
      };
    }

    if (!isClockedInToday) {
      // Awaiting Clock-In before shift cutoff
      return {
        type: "pending",
        title: "Shift Attendance Status: Scheduled",
        badgeText: "Scheduled",
        subtitle: "Work starts from 8:00 AM and ends at 7:00 PM",
        isLate: false,
        isAbsent: false,
        delayMinutes: 0,
        penaltyAmount: 0,
      };
    }

    // Employee has clocked in: Evaluate On-Time vs Late
    const clockInDate = new Date(attendanceData.clockIn || attendanceData.clockInTime);
    const clockInMinutes =
      !isNaN(clockInDate.getTime())
        ? clockInDate.getHours() * 60 + clockInDate.getMinutes()
        : startThresholdMinutes;
    const delayMins = Math.max(0, clockInMinutes - startThresholdMinutes);

    const dbDelay = Number(attendanceData.delayMinutes || attendanceData.lateMinutes || 0);
    const hasRecordedPenalty =
      attendanceData.latePenalty !== undefined &&
      attendanceData.latePenalty !== null &&
      attendanceData.latePenalty !== "";
    const dbPenalty = Number(attendanceData.latePenalty || 0);

    const finalDelayMinutes = dbDelay > 0 ? dbDelay : delayMins;
    const isLate = dbStatus.includes("late") || finalDelayMinutes > 0;

    let calculatedFine = hasRecordedPenalty ? dbPenalty : -1;
    let matchingTier = attendanceData.penaltyTier || "";

    if (isLate && calculatedFine < 0 && finalDelayMinutes > 0) {
      const tierObj = penaltyTiers.find(
        (t) => finalDelayMinutes >= t.minMinutes && finalDelayMinutes <= t.maxMinutes
      );
      if (tierObj) {
        const fineVal = Number(tierObj.amount !== undefined ? tierObj.amount : (tierObj.fine !== undefined ? tierObj.fine : tierObj.penalty)) || 0;
        calculatedFine = fineVal;
        matchingTier = tierObj.name;
      } else {
        calculatedFine = 0;
      }
    }
    if (calculatedFine < 0) calculatedFine = 0;

    const clockInShort = formatShortTime(attendanceData.clockIn || attendanceData.clockInTime);

    if (isLate) {
      return {
        type: "late",
        title: "Shift Attendance Status: Late Arrival",
        badgeText: "Late Arrival",
        subtitle: `Clocked in at ${clockInShort} · Late by ${finalDelayMinutes}m${calculatedFine > 0 ? ` (-GH₵${calculatedFine.toFixed(2)})` : ""}`,
        isLate: true,
        isAbsent: false,
        delayMinutes: finalDelayMinutes,
        penaltyAmount: calculatedFine,
        tierName: matchingTier || `Tier (${finalDelayMinutes} min delay)`,
        clockInShort,
      };
    }

    return {
      type: "ontime",
      title: "Shift Attendance Status: On-Time Arrival",
      badgeText: "On-Time Arrival",
      subtitle: `Clocked in at ${clockInShort} (On schedule)`,
      isLate: false,
      isAbsent: false,
      delayMinutes: 0,
      penaltyAmount: 0,
      tierName: "On Time",
      clockInShort,
    };
  }, [
    hasClockedIn,
    attendanceData?.clockIn,
    attendanceData?.clockInTime,
    attendanceData?.status,
    attendanceData?.delayMinutes,
    attendanceData?.lateMinutes,
    attendanceData?.latePenalty,
    attendanceData?.penaltyTier,
    startThresholdMinutes,
    endThresholdHour,
    penaltyTiers,
  ]);

  // Visual theme per attendance status
  const theme = useMemo(() => {
    switch (statusEvaluation.type) {
      case "ontime":
        return { tone: "success", icon: CheckCircle2, strip: "bg-emerald-500", iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" };
      case "late":
        return { tone: "danger", icon: AlertTriangle, strip: "bg-rose-500", iconBox: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" };
      case "absent":
        return { tone: "danger", icon: AlertCircle, strip: "bg-rose-500", iconBox: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" };
      default:
        return { tone: "neutral", icon: Clock, strip: "bg-slate-300 dark:bg-slate-600", iconBox: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
    }
  }, [statusEvaluation.type]);

  const StatusIcon = theme.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      id="shift-realtime-status-card"
      className={`${ui.card} relative overflow-hidden`}
    >
      <span aria-hidden="true" className={`absolute left-0 inset-y-0 w-1 ${theme.strip}`} />
      <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${theme.iconBox}`}>
            <StatusIcon className="w-5 h-5" />
          </span>

          <div className="min-w-0">
            {resolvedEmployeeName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 flex flex-wrap items-center gap-1.5">
                <span>
                  {greetingTimeOfDay}, <span className="font-semibold text-slate-800 dark:text-slate-200">{resolvedEmployeeName}</span>
                </span>
                {user?.employeeId && (
                  <span className="font-mono text-[10.5px] px-1.5 py-px rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {user.employeeId}
                  </span>
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {statusEvaluation.title}
              </h2>
              <span id="shift-status-outcome-badge">
                <Badge tone={theme.tone} dot>
                  {statusEvaluation.badgeText}
                </Badge>
              </span>
            </div>

            <p className="mt-1.5 text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-relaxed">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Shift hours</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formattedStartTime} – 7:00 PM</span>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">•</span>
              <span>{statusEvaluation.subtitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 md:self-center">
          {typeof onRefresh === "function" && (
            <motion.button
              type="button"
              {...buttonPressProps}
              onClick={onRefresh}
              disabled={isSyncing}
              className={ui.iconBtn}
              title="Refresh shift status"
              aria-label="Refresh shift status"
            >
              {(isSyncing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            </motion.button>
          )}
          {isCheckingStatus ? (
            <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium">
              <WorkspaceLoader inline />
              Checking…
            </span>
          ) : !hasClockedIn && statusEvaluation.type !== "absent" && typeof onClockIn === "function" ? (
            <motion.button
              type="button"
              id="btn-status-card-clock-in"
              {...buttonPressProps}
              onClick={onClockIn}
              disabled={isLoading}
              className={ui.btnPrimary}
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? <><WorkspaceLoader inline /> Recording…</> : "Clock in now"}</span>
            </motion.button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

export default memo(ShiftStatusCard);
