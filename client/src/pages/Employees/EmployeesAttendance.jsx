import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect, useMemo } from "react";
import { Calendar, CalendarDays, Clock, LogIn, LogOut, CheckCircle2, AlertTriangle, TrendingDown, Search, ArrowRight, BarChart3, ListFilter, Check, Zap, Lock, Unlock, ShieldCheck, Printer, Download, AlertCircle, MessageSquare, X, XCircle } from "lucide-react";
import Toaster from "../../ui/Toaster";
import { useManagement } from "../../context/ManagementContextProvider";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import { ui, tones, selectChevronStyle } from "./ui/tokens";
import { Badge, Card, CardHeader, EmptyState, StatCard } from "./ui/primitives";
import {
  getEmployeeAttendance,
  getNowAttendance,
  getSettings,
  getMyAttendanceHistory,
} from "../../apis/fontApis";
import WeeklyAttendanceChart from "../../components/WeeklyAttendanceChart";
import AttendanceIntensityHeatmap from "../../components/AttendanceIntensityHeatmap";
import IndividualAttendanceCalendar from "../../components/IndividualAttendanceCalendar";
import GlobalDateRangePicker from "../../components/GlobalDateRangePicker";
import AttendanceReportModal from "../../components/modal/AttendanceReportModal";
import {
  exportAttendanceLogsToCSV,
  exportAttendanceLogsToPDF,
} from "../../utils/attendanceExportUtils";
import { useCompanyBranding } from "../../hooks/useCompanyBranding";
import { useAttendance } from "../../context/AttendanceContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { useWorkSchedule } from "../../utils/workSchedule";

const CustomWeeklyHoursTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload || {};
    const target = data.targetHours || 8;
    const actual = Number(data.hours || 0);
    const diff = Math.round((actual - target) * 10) / 10;
    const isMet = actual >= target && target > 0;

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 text-xs min-w-[210px] z-50">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
          <div>
            <span className="font-bold text-white text-xs block">
              {data.fullDay}
            </span>
            <span className="text-[10px] text-slate-400">
              {data.dateFormatted}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              isMet
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                : actual > 0
                ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
                : data.isWeekend
                ? "bg-slate-800 text-slate-300 border-slate-700"
                : "bg-rose-950/80 text-rose-300 border-rose-700/60"
            }`}
          >
            {data.status || (isMet ? "Met Target" : "Shift Target")}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Hours Logged:
            </span>
            <span className="font-bold text-white text-xs">{actual} hrs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Shift Target:</span>
            <span className="font-medium text-slate-300">{target} hrs</span>
          </div>

          {target > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/80 text-[11px]">
              <span className="text-slate-400">Variance:</span>
              <span
                className={`font-semibold ${
                  diff >= 0 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {diff >= 0 ? `+${diff}h (Met Goal)` : `${diff}h (Deficit)`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const EmployeesAttendance = () => {
  const { showToast, setShowToast, user, settings } = useManagement();

  // Centralized Global Attendance State
  const {
    todayRecord,
    isCheckingStatus,
    clockIn: contextClockIn,
    clockOut: contextClockOut,
    refreshAttendance: contextRefreshAttendance,
    isClocking: isAttendanceClocking,
  } = useAttendance();

  const attendanceData = todayRecord;
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const isTodayRecord = Boolean(!attendanceData?.date || attendanceData.date === todayStr);
  const hasClockedIn = isTodayRecord && Boolean(attendanceData?.clockIn || attendanceData?.clockInTime);
  const hasClockedOut = isTodayRecord && Boolean(attendanceData?.clockOut || attendanceData?.clockOutTime);

  const [isLoading, setIsLoading] = useState(false);
  const [isLocalClocking, setIsLocalClocking] = useState(false);
  const isClocking = isLocalClocking || isAttendanceClocking;
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);

  // Shift Settings & Early Override Guard State (Default to 19:00 / 07:00 PM)
  const initialEnd = settings?.workEndTime || settings?.attendance?.workEndTime || "19:00";
  const initialStart = settings?.workStartTime || settings?.attendance?.workStartTime || "08:00";
  const [settingsEndTime, setSettingsEndTime] = useState(
    initialEnd && initialEnd !== "17:00" ? initialEnd : "19:00"
  );
  const [settingsStartTime, setSettingsStartTime] = useState(initialStart || "08:00");
  const [earlyOverrideActive, setEarlyOverrideActive] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Table filters & view states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState("all");
  const [activeView, setActiveView] = useState("calendar"); // 'calendar' | 'heatmap' | 'table' | 'chart'

  // Own attendance/absence history (server resolves the employee from the auth token)
  const [myHistory, setMyHistory] = useState({ loading: true, error: null, data: null });
  const loadMyHistory = async () => {
    setMyHistory((prev) => ({ ...prev, loading: !prev.data, error: null }));
    try {
      const { data } = await getMyAttendanceHistory();
      if (!data?.success) throw new Error(data?.message || "Could not load your attendance history.");
      setMyHistory({ loading: false, error: null, data });
    } catch (err) {
      setMyHistory({ loading: false, error: err.response?.data?.message || err.message || "Could not load your attendance history.", data: null });
    }
  };
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const { branding } = useCompanyBranding();

  const handleEmployeeExportCSV = () => {
    const list = filteredHistory.length > 0 ? filteredHistory : attendanceHistory;
    if (!list.length) {
      setShowToast({ show: true, message: "No attendance records to export.", type: "error" });
      return;
    }
    const empName = employee?.fullName || user?.fullName || "Staff";
    const slug = empName.toLowerCase().replace(/\s+/g, "_");
    exportAttendanceLogsToCSV({
      attendanceList: list,
      periodLabel: selectedMonth !== "all" ? selectedMonth : "Current Period",
      companyName: branding?.companyName || "Eyenit Logistics & Transport",
      filename: `attendance_${slug}_${new Date().toISOString().split("T")[0]}.csv`,
    });
    setShowToast({ show: true, message: "Downloaded attendance CSV.", type: "success" });
  };

  const handleEmployeeExportPDF = async () => {
    const list = filteredHistory.length > 0 ? filteredHistory : attendanceHistory;
    if (!list.length) {
      setShowToast({ show: true, message: "No attendance records to export.", type: "error" });
      return;
    }
    const empName = employee?.fullName || user?.fullName || "Staff";
    const slug = empName.toLowerCase().replace(/\s+/g, "_");
    await exportAttendanceLogsToPDF({
      attendanceList: list,
      periodLabel: selectedMonth !== "all" ? selectedMonth : "Current Period",
      companyName: branding?.companyName || "Eyenit Logistics & Transport",
      logoUrl: branding?.logoUrl,
      filename: `attendance_${slug}_${new Date().toISOString().split("T")[0]}.pdf`,
    });
    setShowToast({ show: true, message: "Generated attendance PDF report.", type: "success" });
  };

  // Live ticking digital clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Time Evaluation Guard: Evaluate live client/server time against workEndTime (default 19:00 / 07:00 PM)
  const shiftEvaluation = useMemo(() => {
    const now = currentTime;
    const endStr = (!settingsEndTime || settingsEndTime === "17:00") ? "19:00" : settingsEndTime;
    const startStr = settingsStartTime || "08:00";

    const [endHourStr, endMinStr] = endStr.split(":");
    const endHour = parseInt(endHourStr, 10) || 19;
    const endMin = parseInt(endMinStr, 10) || 0;

    const [startHourStr, startMinStr] = startStr.split(":");
    const startHour = parseInt(startHourStr, 10) || 8;
    const startMin = parseInt(startMinStr, 10) || 0;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = endHour * 60 + endMin;

    const isClosingTimeReached = currentMinutes >= endMinutes;

    // Remaining minutes calculation
    const diffMinutes = Math.max(0, endMinutes - currentMinutes);
    const hoursLeft = Math.floor(diffMinutes / 60);
    const minsLeft = diffMinutes % 60;
    const countdownText =
      hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;

    // 12-hour format strings
    const format12H = (h, m) => {
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    };

    const formattedEndTime = format12H(endHour, endMin);
    const formattedStartTime = format12H(startHour, startMin);

    return {
      isClosingTimeReached,
      countdownText,
      formattedEndTime,
      formattedStartTime,
      hoursLeft,
      minsLeft,
      endHour,
      endMin,
      startHour,
      startMin,
    };
  }, [currentTime, settingsEndTime, settingsStartTime]);

  // Milestone 2: 7:30 PM (19:30) automatic system clock-out grace period
  const isAutoClosedTime = useMemo(() => {
    const nowHours = currentTime.getHours();
    const nowMinutes = currentTime.getMinutes();
    const { endHour, endMin } = shiftEvaluation;

    if (endHour === 19 && endMin === 0) {
      return nowHours > 19 || (nowHours === 19 && nowMinutes >= 30);
    }
    const totalEndMinutes = endHour * 60 + endMin + 30;
    const currentTotalMinutes = nowHours * 60 + nowMinutes;
    return currentTotalMinutes >= totalEndMinutes;
  }, [currentTime, shiftEvaluation]);

  const isAutoClosed = useMemo(() => {
    if (attendanceData?.autoClockedOut) return true;
    const notesLower = (attendanceData?.notes || "").toLowerCase();
    if (notesLower.includes("auto clocked out") || notesLower.includes("missed manual clock-out")) return true;
    if ((attendanceData?.shiftStatus || "").toLowerCase() === "auto-closed") return true;
    if (hasClockedIn && !hasClockedOut && isAutoClosedTime) return true;
    return false;
  }, [attendanceData, hasClockedIn, hasClockedOut, isAutoClosedTime]);

  const effectiveHasClockedOut = hasClockedOut || isAutoClosed;

  const isClockOutUnlocked =
    shiftEvaluation.isClosingTimeReached || earlyOverrideActive;

  // Computed delay if clockIn timestamp is available
  const computedDelay = useMemo(() => {
    const clockInDate = attendanceData?.clockIn ? new Date(attendanceData.clockIn) : null;
    if (clockInDate && !isNaN(clockInDate.getTime())) {
      const { startHour, startMin } = shiftEvaluation;
      const clockInMinutes = clockInDate.getHours() * 60 + clockInDate.getMinutes();
      const thresholdMinutes = startHour * 60 + startMin;
      return Math.max(0, clockInMinutes - thresholdMinutes);
    }
    return 0;
  }, [attendanceData, shiftEvaluation]);

  // Dynamic Attendance Status: On-Time, Late, Absent, Pending
  const attendanceStatus = useMemo(() => {
    const dbStatus = String(attendanceData?.status || "").trim().toLowerCase();
    const nowHours = currentTime.getHours();
    const { endHour } = shiftEvaluation;
    const isPastShiftCutoff = nowHours >= endHour;

    if (dbStatus === "absent" || (!hasClockedIn && isPastShiftCutoff)) {
      return "absent";
    }

    if (!hasClockedIn) {
      return "pending";
    }

    const dbDelay = Number(attendanceData?.delayMinutes ?? attendanceData?.lateMinutes ?? 0);
    const finalDelay = dbDelay > 0 ? dbDelay : computedDelay;
    const isLate = dbStatus.includes("late") || finalDelay > 0;

    return isLate ? "late" : "ontime";
  }, [attendanceData, hasClockedIn, currentTime, shiftEvaluation, computedDelay]);

  // Dynamic Card Theming based on attendance status
  const cardTheme = useMemo(() => {
    if (attendanceStatus === "ontime") return { strip: "bg-emerald-500" };
    if (attendanceStatus === "late" || attendanceStatus === "absent") return { strip: "bg-rose-500" };
    return { strip: "bg-slate-300 dark:bg-slate-600" };
  }, [attendanceStatus]);

  // Determine current 4-state
  const currentStep = useMemo(() => {
    if (attendanceStatus === "absent") return 1;
    if (!hasClockedIn) return 1;
    if (hasClockedIn && !effectiveHasClockedOut) {
      return isClockOutUnlocked ? 3 : 2;
    }
    return 4;
  }, [hasClockedIn, effectiveHasClockedOut, isClockOutUnlocked, attendanceStatus]);

  const canOverride =
    user?.role === "admin" ||
    user?.role === "manager";

  // Determine whether current time is past scheduled work start time for late clock-in detection
  const isLateNow = useMemo(() => {
    if (hasClockedIn) return false;
    const now = currentTime;
    const startStr = settingsStartTime || "08:00";
    const [startH, startM] = startStr.split(":").map(Number);
    const startMinutes = (startH || 8) * 60 + (startM || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes > startMinutes;
  }, [currentTime, settingsStartTime, hasClockedIn]);

  const minutesLateNow = useMemo(() => {
    if (!isLateNow) return 0;
    const now = currentTime;
    const startStr = settingsStartTime || "08:00";
    const [startH, startM] = startStr.split(":").map(Number);
    const startMinutes = (startH || 8) * 60 + (startM || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.max(0, currentMinutes - startMinutes);
  }, [currentTime, settingsStartTime, isLateNow]);

  // Helper to format ISO time strings
  const formatTime = (timeString) => {
    if (!timeString) return "--:--";
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return timeString;
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  // Helper to format date strings
  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString("en-GH", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // Live elapsed work duration if clocked in and not clocked out
  const liveElapsedDuration = useMemo(() => {
    if (!hasClockedIn || !attendanceData?.clockIn || effectiveHasClockedOut || attendanceStatus === "absent") {
      return null;
    }
    try {
      const clockInDate = new Date(attendanceData.clockIn);
      const diffMs = Math.max(0, currentTime.getTime() - clockInDate.getTime());
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      return {
        formatted: `${hours}h ${minutes}m ${seconds}s`,
        hours,
        minutes,
      };
    } catch {
      return null;
    }
  }, [hasClockedIn, attendanceData, effectiveHasClockedOut, attendanceStatus, currentTime]);

  // Re-sync attendance if past 7:30 PM auto-close cutoff and shift is still unfinalized
  useEffect(() => {
    if (hasClockedIn && !hasClockedOut && isAutoClosedTime) {
      contextRefreshAttendance(false);
    }
  }, [hasClockedIn, hasClockedOut, isAutoClosedTime, contextRefreshAttendance]);

  // Fetch today's attendance status
  const fetchTodayAttendance = async () => {
    try {
      setError(null);
      const { data } = await getNowAttendance();
      if (data?.success && data.employee) {
        setEmployee(data.employee);
      }
      await contextRefreshAttendance(true);
    } catch (err) {
      console.warn("Could not fetch today's attendance:", err.message);
    }
  };

  // Fetch historical attendance records
  const fetchAttendanceHistory = async () => {
    loadMyHistory();
    try {
      const { data } = await getEmployeeAttendance();
      if (data?.success) {
        let history = [];
        if (Array.isArray(data.attendance)) {
          history = data.attendance;
        } else if (data.attendance && typeof data.attendance === "object") {
          history = [data.attendance];
        }
        setAttendanceHistory(history);
      }
    } catch (err) {
      console.warn("Could not fetch attendance history:", err.message);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [settingsRes] = await Promise.allSettled([
          getSettings(),
          fetchTodayAttendance(),
          fetchAttendanceHistory(),
        ]);
        if (
          settingsRes.status === "fulfilled" &&
          settingsRes.value?.data?.success &&
          settingsRes.value.data.settings
        ) {
          const s = settingsRes.value.data.settings;
          const workEndTime =
            s.workEndTime ||
            s.attendance?.workEndTime ||
            s.company?.workEndTime;
          const workStartTime =
            s.workStartTime ||
            s.attendance?.workStartTime ||
            s.company?.workStartTime;
          if (workEndTime) {
            setSettingsEndTime(workEndTime === "17:00" ? "19:00" : workEndTime);
          }
          if (workStartTime) setSettingsStartTime(workStartTime);
        }
      } catch {
        // Continue with defaults
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Handle Clock In via centralized AttendanceContext
  const handleClockIn = async () => {
    if (isClocking || hasClockedIn) return;
    try {
      setIsLocalClocking(true);
      const reasonToSend = lateReason.trim();
      const result = await contextClockIn(reasonToSend);

      setShowToast({
        show: true,
        message: result?.data?.message || "Clock In recorded successfully!",
        type: "success",
      });

      setLateReason("");
      await fetchAttendanceHistory();
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err.message || "Clock in failed.";
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLocalClocking(false);
    }
  };

  // Handle Clock Out via centralized AttendanceContext
  const handleClockOut = async (reason = "") => {
    if (isClocking || !hasClockedIn || effectiveHasClockedOut) return;
    try {
      setIsLocalClocking(true);
      const result = await contextClockOut(reason);

      setShowToast({
        show: true,
        message: result?.data?.message || "Clock Out recorded successfully! Great work today.",
        type: "success",
      });

      await fetchAttendanceHistory();
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err.message || "Clock out failed.";
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLocalClocking(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status, lateMinutes = 0, latePenalty = undefined) => {
    const s = String(status || "").toLowerCase();
    if (s === "on time" || s === "ontime" || s === "present") {
      return <Badge tone="success" dot>On Time</Badge>;
    }
    if (
      s.includes("grace") ||
      s.includes("zero penalty") ||
      (s === "late" && latePenalty !== undefined && Number(latePenalty) === 0 && lateMinutes > 0)
    ) {
      return <Badge tone="brand" dot>Late (No Deduction)</Badge>;
    }
    if (s === "late" || lateMinutes > 0) {
      return <Badge tone="warning" dot>Late Arrival</Badge>;
    }
    if (s === "absent") {
      return <Badge tone="danger" dot>Absent</Badge>;
    }
    return <Badge tone="neutral">{status || "Recorded"}</Badge>;
  };

  // Calculate Metrics from history
  const metrics = useMemo(() => {
    const totalRecords = attendanceHistory.length;
    let attendedDays = 0;
    let onTimeDays = 0;
    let lateDays = 0;
    let totalLateMinutes = 0;
    let unexcusedAbsences = 0;
    let totalHours = 0;
    let totalPenaltyAmount = 0;

    attendanceHistory.forEach((log) => {
      const s = String(log?.status || "").toLowerCase();
      const lateMins = Number(log?.lateMinutes ?? log?.delayMinutes ?? 0);
      const hrs = Number(log?.workHours || 0);
      const penalty = Number(log?.latePenalty || 0);

      if (s === "absent") {
        unexcusedAbsences += 1;
      } else if (log?.clockIn || log?.clockInTime || hrs > 0 || s === "present" || s === "on time" || s === "late") {
        attendedDays += 1;
        totalHours += hrs;
        totalPenaltyAmount += penalty;

        if (s === "late" || lateMins > 0) {
          lateDays += 1;
          totalLateMinutes += lateMins;
        } else {
          onTimeDays += 1;
        }
      }
    });

    // If today is active and not yet in history
    if (hasClockedIn && !attendanceHistory.some((h) => h.date === attendanceData.date)) {
      attendedDays += 1;
      if (attendanceData.status === "Late" || attendanceData.lateMinutes > 0) {
        lateDays += 1;
        totalLateMinutes += Number(attendanceData.lateMinutes || 0);
        totalPenaltyAmount += Number(attendanceData.latePenalty || 0);
      } else {
        onTimeDays += 1;
      }
      totalHours += Number(attendanceData.workHours || 0);
    }

    return {
      totalRecords,
      attendedDays,
      onTimeDays,
      lateDays,
      totalLateMinutes,
      unexcusedAbsences,
      totalHours: Number(totalHours.toFixed(1)),
      totalPenaltyAmount: Number(totalPenaltyAmount.toFixed(2)),
      punctualityRate: attendedDays > 0 ? Math.round((onTimeDays / attendedDays) * 100) : 100,
    };
  }, [attendanceHistory, hasClockedIn, attendanceData]);

  const { isWorkingDay } = useWorkSchedule();

  // Current Week Work Hours Data Calculation (Monday through Sunday)
  const currentWeekWorkHours = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const fullDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const weekList = days.map((dayShort, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isoDate = d.toISOString().split("T")[0];
      const isToday = isoDate === today.toISOString().split("T")[0];
      const isFuture = d > today && !isToday;
      const isWeekend = !isWorkingDay(d);
      const targetHours = isWeekend ? 0 : 8;

      let matchingLog = attendanceHistory.find((log) => {
        if (!log?.date) return false;
        const logIso = String(log.date).split("T")[0];
        return logIso === isoDate;
      });

      let hours = 0;
      let status = isWeekend ? "Weekend Off" : (isFuture ? "Upcoming Shift" : "Off");
      let lateMinutes = 0;

      if (isToday && hasClockedIn) {
        hours = Number(attendanceData.workHours || 8);
        status = attendanceData.status || (attendanceData.lateMinutes > 0 ? "Late" : "On Time");
        lateMinutes = Number(attendanceData.lateMinutes || 0);
      } else if (matchingLog) {
        hours = Number(matchingLog.workHours || (matchingLog.status !== "Absent" ? 8 : 0));
        status = matchingLog.status || "Present";
        lateMinutes = Number(matchingLog.lateMinutes || matchingLog.delayMinutes || 0);
      }

      return {
        day: dayShort,
        fullDay: fullDays[idx],
        date: isoDate,
        dateFormatted: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dayLabel: `${dayShort} ${d.getDate()}`,
        hours: Number(hours.toFixed(1)),
        targetHours,
        status,
        lateMinutes,
        isToday,
        isFuture,
        isWeekend,
      };
    });

    const totalLoggedHours = weekList.reduce((acc, curr) => acc + curr.hours, 0);
    const targetWeeklyHours = 40;
    const completedDays = weekList.filter((d) => !d.isFuture && !d.isWeekend && d.hours > 0);
    const dailyAverage = completedDays.length > 0 ? (totalLoggedHours / completedDays.length).toFixed(1) : "0.0";
    const percentGoal = Math.min(150, Math.round((totalLoggedHours / targetWeeklyHours) * 100));

    return {
      days: weekList,
      totalLoggedHours: Number(totalLoggedHours.toFixed(1)),
      targetWeeklyHours,
      dailyAverage,
      percentGoal,
      overtime: Number(Math.max(0, totalLoggedHours - targetWeeklyHours).toFixed(1)),
    };
  }, [attendanceHistory, hasClockedIn, attendanceData, isWorkingDay]);

  // Filtered attendance list
  const filteredHistory = useMemo(() => {
    return attendanceHistory.filter((item) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const dStr = formatDate(item.date).toLowerCase();
        const stStr = String(item.status || "").toLowerCase();
        if (!dStr.includes(query) && !stStr.includes(query)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all") {
        const s = String(item.status || "").toLowerCase();
        if (statusFilter === "ontime" && s !== "on time" && s !== "ontime" && s !== "present") {
          return false;
        }
        if (statusFilter === "late" && s !== "late" && !(Number(item.lateMinutes || 0) > 0)) {
          return false;
        }
        if (statusFilter === "absent" && s !== "absent") {
          return false;
        }
      }

      // Month filter
      if (selectedMonth !== "all") {
        try {
          const itemDate = new Date(item.date);
          const monthKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
          if (monthKey !== selectedMonth) {
            return false;
          }
        } catch {
          // pass
        }
      }

      // Global Date Range Filter
      if (startDateFilter || endDateFilter) {
        let itemDateStr = "";
        if (item.date) {
          itemDateStr = new Date(item.date).toISOString().split("T")[0];
        }
        if (itemDateStr) {
          if (startDateFilter && itemDateStr < startDateFilter) return false;
          if (endDateFilter && itemDateStr > endDateFilter) return false;
        }
      }

      return true;
    });
  }, [attendanceHistory, searchTerm, statusFilter, selectedMonth, startDateFilter, endDateFilter]);

  // Available unique months in history
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    attendanceHistory.forEach((item) => {
      if (item.date) {
        try {
          const d = new Date(item.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthsSet.add(key);
        } catch {
          // ignore
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [attendanceHistory]);

  // Summary statistics for the selected month/period (present, absent, late, total hours)
  const selectedPeriodSummary = useMemo(() => {
    let list = [...attendanceHistory];

    if (selectedMonth !== "all") {
      list = list.filter((item) => {
        try {
          const itemDate = new Date(item.date);
          const monthKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
          return monthKey === selectedMonth;
        } catch {
          return true;
        }
      });
    }

    let present = 0;
    let late = 0;
    let absent = 0;
    let onTime = 0;
    let totalHours = 0;

    list.forEach((item) => {
      const s = String(item.status || "").toLowerCase();
      const lateMins = Number(item.lateMinutes ?? item.delayMinutes ?? 0);
      const hrs = Number(item.workHours || 0);

      totalHours += hrs;

      if (s === "absent") {
        absent += 1;
      } else if (item.clockIn || hrs > 0 || s === "present" || s === "on time" || s === "late") {
        present += 1;
        if (s === "late" || lateMins > 0) {
          late += 1;
        } else {
          onTime += 1;
        }
      }
    });

    let periodTitle = "All Months";
    if (selectedMonth !== "all") {
      try {
        const [y, m] = selectedMonth.split("-");
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        periodTitle = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch {
        periodTitle = selectedMonth;
      }
    }

    const punctuality = present > 0 ? Math.round((onTime / present) * 100) : 100;

    return {
      periodTitle,
      totalEntries: list.length,
      present,
      onTime,
      late,
      absent,
      totalHours: totalHours.toFixed(1),
      punctuality,
    };
  }, [attendanceHistory, selectedMonth]);

  if (isLoading && !employee) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={() => {
          fetchTodayAttendance();
          fetchAttendanceHistory();
        }}
        onClose={() => setError(null)}
      />
    );
  }

  return (
    <div className={`${ui.page} relative`}>

      {/* SECTION 1: MODERN HERO CARD & SHIFT CONTROL HEADER */}
      <div
        id="hero-attendance-clock-card"
        className={`relative overflow-hidden ${ui.card} p-5 sm:p-6 space-y-6`}
      >
        <span aria-hidden="true" className={`absolute left-0 inset-y-0 w-1 ${cardTheme.strip}`} />
        {/* Top Row (Status & Live Time Integration) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 pb-6 border-b border-slate-100 dark:border-slate-800/80">
          {/* Left Side (Status Badges) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Shift status pill */}
              {attendanceStatus === "absent" ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Status: Marked Absent</span>
                </div>
              ) : currentStep === 1 ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Not Clocked In Today</span>
                </div>
              ) : currentStep === 2 ? (
                <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                  attendanceStatus === "late"
                    ? "bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80"
                    : "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    attendanceStatus === "late" ? "bg-rose-500" : "bg-emerald-500"
                  }`} />
                  <span>
                    Currently Working · Clocked in at {formatTime(attendanceData.clockIn)}
                  </span>
                </div>
              ) : currentStep === 3 ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>
                    Shift Closing Time Reached · Ready to Clock Out
                  </span>
                </div>
              ) : (
                <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
                  attendanceStatus === "late"
                    ? "bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80"
                    : "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80"
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${
                    attendanceStatus === "late" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                  }`} />
                  <span>
                    {isAutoClosed && !hasClockedOut
                      ? "Shift Completed · Auto-closed at 07:30 PM"
                      : `Shift Completed · Checked out at ${formatTime(attendanceData.clockOut)}`}
                  </span>
                </div>
              )}

              {/* Dynamic Instant Attendance Status Badge */}
              {attendanceStatus === "absent" ? (
                <div
                  id="attendance-status-badge-absent"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Status: Marked Absent</span>
                </div>
              ) : hasClockedIn && (
                attendanceStatus === "late" ? (
                  <div
                    id="attendance-status-badge-late"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Late Arrival ({attendanceData.lateMinutes || computedDelay} min late)</span>
                    {Number(attendanceData.latePenalty || 0) > 0 && (
                      <span className="font-bold text-rose-700 dark:text-rose-400">
                        · -GH₵{Number(attendanceData.latePenalty).toFixed(2)} deduction
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    id="attendance-status-badge-ontime"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>On-Time Arrival</span>
                  </div>
                )
              )}

              {/* Scheduled Shift Pill */}
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-[#162033] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                <Clock className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400" />
                Scheduled: 08:00 AM – 07:00 PM
              </span>
            </div>
          </div>

          {/* Right Side (Action Buttons) */}
          <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              {isCheckingStatus ? (
                <div
                  id="attendance-buttons-skeleton"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-100 dark:bg-[#162033] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium"
                >
                  <WorkspaceLoader inline />
                  <span>Verifying attendance status...</span>
                </div>
              ) : (
                <>
                  {/* Button 1: Clock In */}
                  <button
                    id="btn-primary-clock-in"
                    type="button"
                    onClick={handleClockIn}
                    disabled={hasClockedIn || isClocking || attendanceStatus === "absent"}
                    className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${ui.focusRing} ${
                      hasClockedIn || attendanceStatus === "absent"
                        ? "bg-slate-100 dark:bg-[#162033] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 cursor-not-allowed"
                        : isClocking
                        ? "bg-blue-400 text-white cursor-not-allowed"
                        : "bg-[#002185] hover:bg-[#001760] dark:bg-blue-600 dark:hover:bg-blue-700 text-white active:scale-[0.98]"
                    }`}
                    title={
                      attendanceStatus === "absent"
                        ? "Cutoff reached — Marked Absent"
                        : hasClockedIn
                        ? `Clocked In (${formatTime(attendanceData.clockIn)})`
                        : "Click to clock in now"
                    }
                  >
                    {attendanceStatus === "absent" ? (
                      <>
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span>Marked Absent</span>
                      </>
                    ) : hasClockedIn ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Clocked In ({formatTime(attendanceData.clockIn)})</span>
                      </>
                    ) : isClocking ? (
                      <>
                        <WorkspaceLoader inline />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Clock In</span>
                      </>
                    )}
                  </button>

                  {/* Button 2: Clock Out */}
                  <button
                    id="btn-primary-clock-out"
                    type="button"
                    onClick={handleClockOut}
                    disabled={!hasClockedIn || effectiveHasClockedOut || !isClockOutUnlocked || isClocking || attendanceStatus === "absent"}
                    className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${ui.focusRing} ${
                      effectiveHasClockedOut
                        ? "bg-slate-100 dark:bg-[#162033] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 cursor-not-allowed"
                        : !hasClockedIn || attendanceStatus === "absent"
                        ? "bg-slate-100 dark:bg-[#162033] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60 cursor-not-allowed"
                        : !isClockOutUnlocked
                        ? "bg-slate-100 dark:bg-[#162033] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60 cursor-not-allowed"
                        : isClocking
                        ? "bg-emerald-400 text-white cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                    }`}
                title={
                  effectiveHasClockedOut
                    ? `Shift Completed (${isAutoClosed && !hasClockedOut ? "Auto-Closed at 07:30 PM" : formatTime(attendanceData.clockOut)})`
                    : !hasClockedIn
                    ? `Unlocks at ${shiftEvaluation.formattedEndTime}`
                    : !isClockOutUnlocked
                    ? `Unlocks at ${shiftEvaluation.formattedEndTime}`
                    : "Click to clock out and end your shift"
                }
              >
                {effectiveHasClockedOut ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {isAutoClosed && !hasClockedOut
                        ? "Shift Auto-Closed (07:30 PM)"
                        : `Clocked Out (${formatTime(attendanceData.clockOut)})`}
                    </span>
                  </>
                ) : (!isClockOutUnlocked || !hasClockedIn) ? (
                  <>
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Unlocks at {shiftEvaluation.formattedEndTime}</span>
                  </>
                ) : isClocking ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Clock Out</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
        </div>

        {/* Lateness Reason Input Section (Visible when not yet clocked in and not absent) */}
        {!hasClockedIn && attendanceStatus !== "absent" && (
          <div
            id="page-clock-in-late-reason-section"
            className={`p-4 rounded-xl border transition-all ${
              isLateNow
                ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800/80"
                : "bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label
                htmlFor="input-attendance-late-reason"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
              >
                <AlertCircle
                  className={`w-4 h-4 ${
                    isLateNow ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                  }`}
                />
                <span>
                  {isLateNow
                    ? `Late Clock-In Detected (+${minutesLateNow}m past ${shiftEvaluation.formattedStartTime})`
                    : "Reason for Late Clock-In (Optional)"}
                </span>
              </label>

              {isLateNow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <Clock className="w-3 h-3" />
                  {minutesLateNow} mins late
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Logged in audit log
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5">
              {isLateNow
                ? "Provide a brief reason for being late. This will be recorded with your clock-in and displayed in the dashboard lateness audit table for full transparency."
                : "If you are arriving delayed or late, enter a brief reason below before clocking in."}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  id="input-attendance-late-reason"
                  type="text"
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  placeholder={
                    isLateNow
                      ? "Provide a brief reason (e.g., Heavy traffic, vehicle trouble, medical appointment...)"
                      : "Enter brief reason for late arrival (optional)..."
                  }
                  disabled={isClocking}
                  className={`${ui.input} pr-9`}
                />
                {lateReason && (
                  <button
                    type="button"
                    onClick={() => setLateReason("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title="Clear reason"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                id="btn-confirm-attendance-clock-in"
                onClick={handleClockIn}
                disabled={isClocking}
                className={`${ui.btnPrimary} shrink-0`}
              >
                {isClocking ? (
                  <>
                    <WorkspaceLoader inline />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Clock In Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick preset chips */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-0.5">
                Quick Suggestions:
              </span>
              {[
                "Heavy Traffic Delay",
                "Vehicle Breakdown",
                "Public Transit Delay",
                "Medical / Doctor Visit",
                "Family Emergency",
                "Inclement Weather",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLateReason(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    lateReason === preset
                      ? "bg-[#002185]/[0.07] border-[#002185]/30 text-[#002185] font-semibold dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-300"
                      : "bg-white dark:bg-[#162033] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3-Card Shift Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: Clock In Record */}
          <div
            id="stat-card-clock-in"
            className={`p-4 sm:p-5 rounded-xl border transition-colors ${
              attendanceStatus === "absent"
                ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                : hasClockedIn
                ? attendanceStatus === "late"
                  ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                  : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-900/40"
                : "bg-slate-50/70 dark:bg-[#162033]/50 border-slate-200/70 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                {attendanceStatus === "absent" ? (
                  <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                ) : hasClockedIn && attendanceStatus === "late" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                ) : hasClockedIn ? (
                  <LogIn className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <LogIn className="w-4 h-4 text-slate-400" />
                )}
                Clock In
              </span>
              {attendanceStatus === "absent" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                  Absent
                </span>
              ) : hasClockedIn && attendanceStatus === "late" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                  Late Arrival
                </span>
              ) : hasClockedIn ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  On-Time
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Pending
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
              {hasClockedIn ? formatTime(attendanceData.clockIn) : "--:--"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {attendanceStatus === "absent"
                ? "Marked absent (Cutoff reached at 07:00 PM)"
                : hasClockedIn
                ? attendanceStatus === "late"
                  ? `Recorded with ${attendanceData.lateMinutes || computedDelay}m delay`
                  : "Recorded on-time"
                : `Ready to record today's check-in (Start: 08:00 AM)`}
            </p>

            {/* Reported Reason Display when Clocked In */}
            {hasClockedIn && (attendanceData.lateReason || attendanceData.notes) && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">
                  Reported Reason:
                </span>
                <div className="flex items-start gap-1.5 font-medium italic text-slate-700 dark:text-slate-200">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>"{attendanceData.lateReason || attendanceData.notes}"</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Shift Duration (Active Timer) */}
          <div
            id="stat-card-shift-duration"
            className={`p-4 sm:p-5 rounded-xl border transition-colors ${
              attendanceStatus === "absent"
                ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                : hasClockedIn && !effectiveHasClockedOut
                ? attendanceStatus === "late"
                  ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                  : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-900/40"
                : effectiveHasClockedOut
                ? attendanceStatus === "late"
                  ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                  : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-900/40"
                : "bg-slate-50/70 dark:bg-[#162033]/50 border-slate-200/70 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <Clock
                  className={`w-4 h-4 ${
                    attendanceStatus === "absent"
                      ? "text-rose-500 dark:text-rose-400"
                      : hasClockedIn && attendanceStatus === "late"
                      ? "text-rose-600 dark:text-rose-400"
                      : hasClockedIn
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400"
                  }`}
                />
                Shift Duration
              </span>
              {attendanceStatus === "absent" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                  0.0 hrs
                </span>
              ) : hasClockedIn && !effectiveHasClockedOut ? (
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md animate-pulse ${
                  attendanceStatus === "late"
                    ? "bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                }`}>
                  Active
                </span>
              ) : effectiveHasClockedOut ? (
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                  attendanceStatus === "late"
                    ? "bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                }`}>
                  Total Logged
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Target
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
              {attendanceStatus === "absent"
                ? "0h 0m 0s"
                : hasClockedIn && !effectiveHasClockedOut
                ? liveElapsedDuration?.formatted || "0h 0m 0s"
                : effectiveHasClockedOut
                ? `${attendanceData.workHours || 0} hrs`
                : "0h 0m 0s"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {attendanceStatus === "absent"
                ? "No active shift duration"
                : hasClockedIn && !effectiveHasClockedOut
                ? "Active work counter"
                : effectiveHasClockedOut
                ? "Approved work hours for payroll"
                : "Standard target: 8.0 hours"}
            </p>
          </div>

          {/* Card 3: Clock Out Record */}
          <div
            id="stat-card-clock-out"
            className={`p-4 sm:p-5 rounded-xl border transition-colors ${
              attendanceStatus === "absent"
                ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                : effectiveHasClockedOut
                ? attendanceStatus === "late"
                  ? "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/70 dark:border-rose-900/40"
                  : "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-900/40"
                : isClockOutUnlocked && hasClockedIn
                ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/70 dark:border-emerald-900/40"
                : "bg-slate-50/70 dark:bg-[#162033]/50 border-slate-200/70 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <LogOut className={`w-4 h-4 ${
                  attendanceStatus === "absent"
                    ? "text-rose-500 dark:text-rose-400"
                    : effectiveHasClockedOut
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isClockOutUnlocked && hasClockedIn
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
                }`} />
                Clock Out
              </span>
              {attendanceStatus === "absent" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                  Closed
                </span>
              ) : effectiveHasClockedOut ? (
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                  attendanceStatus === "late"
                    ? "bg-rose-100/60 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                    : "bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                }`}>
                  Completed
                </span>
              ) : isClockOutUnlocked && hasClockedIn ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 animate-pulse">
                  Unlocked
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Locked
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
              {effectiveHasClockedOut
                ? isAutoClosed && !hasClockedOut
                  ? "07:30 PM"
                  : formatTime(attendanceData.clockOut)
                : "--:--"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
              {attendanceStatus === "absent"
                ? "Day closed (Shift ended at 07:00 PM)"
                : effectiveHasClockedOut
                ? isAutoClosed && !hasClockedOut
                  ? "Day finalized (Auto-closed at 07:30 PM)"
                  : "Day finalized"
                : isClockOutUnlocked && hasClockedIn
                ? "Ready to clock out now (Closing: 07:00 PM)"
                : `Unlocks at 07:00 PM`}
            </p>
          </div>
        </div>

        {/* Streamlined Status Banner */}
        {attendanceStatus === "absent" && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <span className="font-semibold">Status: Marked Absent</span> — No clock-in recorded for today's scheduled shift (08:00 AM – 07:00 PM).
            </div>
          </div>
        )}

        {attendanceStatus !== "absent" && currentStep === 2 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold">Shift In Progress:</span> Clock-out unlocks at scheduled closing time (07:00 PM).
              </div>
            </div>

            {canOverride && (
              <button
                type="button"
                onClick={() => setShowOverrideModal(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Early Clock-Out Override</span>
              </button>
            )}
          </div>
        )}

        {attendanceStatus !== "absent" && currentStep === 3 && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold">Shift Closing Time Reached (07:00 PM):</span> Clock-out is unlocked. Please record your departure.
            </div>
          </div>
        )}

        {attendanceStatus !== "absent" && currentStep === 4 && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold">Shift Completed:</span>{" "}
              {isAutoClosed && !hasClockedOut
                ? "Auto-closed at scheduled grace cutoff (07:30 PM). Day finalized."
                : `Total approved work hours: ${attendanceData.workHours || 0} hrs. Day finalized.`}
            </div>
          </div>
        )}

        {/* Early Clock-Out Override Modal */}
        {showOverrideModal && (
          <div className={`${ui.overlay} animate-fade-in`} onClick={() => setShowOverrideModal(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="early-override-title"
              onClick={(e) => e.stopPropagation()}
              className={`${ui.modal} sm:max-w-md`}
            >
              <div className={ui.modalHeader}>
                <div className="flex items-start gap-3">
                  <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${tones.warning.icon}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 id="early-override-title" className={ui.h2}>Early clock-out override</h3>
                    <p className={`${ui.caption} mt-0.5`}>Manager / Admin Authorization</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowOverrideModal(false)} className={ui.iconBtn} aria-label="Close">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className={ui.modalBody}>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Standard shift closing time is scheduled for{" "}
                  <strong className="text-slate-900 dark:text-white">{shiftEvaluation.formattedEndTime}</strong>.
                  Authorizing this override will unlock the Clock Out button immediately for early departure.
                </p>
              </div>
              <div className={ui.modalFooter}>
                <button type="button" onClick={() => setShowOverrideModal(false)} className={ui.btnSecondary}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEarlyOverrideActive(true);
                    setShowOverrideModal(false);
                  }}
                  className={`${ui.btnPrimary} bg-amber-600! hover:bg-amber-700! dark:bg-amber-600! dark:hover:bg-amber-700!`}
                >
                  <Unlock className="w-4 h-4" />
                  Unlock early clock-out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Month-to-date summary */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Attended days"
          value={`${metrics.attendedDays} Days`}
          icon={Calendar}
          tone="brand"
          hint={
            <>
              On-time <strong className="text-emerald-600 dark:text-emerald-400">{metrics.onTimeDays}</strong> · Late{" "}
              <strong className="text-amber-600 dark:text-amber-400">{metrics.lateDays}</strong> · {metrics.punctualityRate}% punctual
            </>
          }
        />
        <StatCard
          label="Late check-ins (MTD)"
          value={`${metrics.lateDays} ${metrics.lateDays === 1 ? "Day" : "Days"}`}
          icon={TrendingDown}
          tone="warning"
          hint={
            <>
              Total late time: <strong className="text-amber-600 dark:text-amber-400">{metrics.totalLateMinutes}m</strong>
              {metrics.totalPenaltyAmount > 0 && (
                <span className="text-rose-600 dark:text-rose-400"> (GH₵ {metrics.totalPenaltyAmount})</span>
              )}
            </>
          }
        />
        <StatCard
          label="Unexcused absences"
          value={`${metrics.unexcusedAbsences} Days`}
          icon={AlertTriangle}
          tone="danger"
          hint={metrics.unexcusedAbsences === 0 ? "Perfect attendance record" : "Requires HR leave excuse"}
        />
        <StatCard
          label="Approved hours logged"
          value={`${metrics.totalHours} hrs`}
          icon={Clock}
          tone="info"
          hint={`Avg: ${metrics.attendedDays > 0 ? (metrics.totalHours / metrics.attendedDays).toFixed(1) : 0} hrs/day`}
        />
      </div>

      {/* SECTION: WEEKLY WORK HOURS CHART (RECHARTS) */}
      <Card id="weekly-work-hours-section" className="space-y-5">
        <CardHeader
          icon={BarChart3}
          title="Weekly work hours"
          description="Total hours logged across daily shifts vs. standard 8.0h shift target (Mon – Sun)"
          action={
            <>
              <Badge tone="neutral">
                Week total: {currentWeekWorkHours.totalLoggedHours} / {currentWeekWorkHours.targetWeeklyHours}h
              </Badge>
              <Badge tone="success" dot>
                {currentWeekWorkHours.percentGoal}% of 40h target
              </Badge>
              <Badge tone="info">Avg {currentWeekWorkHours.dailyAverage}h / day</Badge>
            </>
          }
        />

        {/* Recharts Bar Chart Container */}
        <div className="h-64 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={currentWeekWorkHours.days}
              margin={{ top: 12, right: 12, left: -20, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#94a3b8"
                strokeOpacity={0.15}
              />
              <XAxis
                dataKey="dayLabel"
                tickLine={false}
                axisLine={{ stroke: "#94a3b8", opacity: 0.2 }}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <YAxis
                domain={[0, (dataMax) => Math.max(10, Math.ceil(dataMax + 1))]}
                tickLine={false}
                axisLine={{ stroke: "#94a3b8", opacity: 0.2 }}
                tick={{ fontSize: 11, fill: "#64748b" }}
                unit="h"
              />
              <RechartsTooltip
                content={<CustomWeeklyHoursTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              />
              <ReferenceLine
                y={8}
                stroke="#002185"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "8.0h Shift Target",
                  position: "insideTopRight",
                  fill: "#002185",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="hours" name="Work Hours" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {currentWeekWorkHours.days.map((entry, index) => {
                  const fillColor = entry.isToday
                    ? "#002185"
                    : entry.hours >= 8
                    ? "#10b981"
                    : entry.hours > 0
                    ? "#f59e0b"
                    : entry.isWeekend
                    ? "#cbd5e1"
                    : "#e2e8f0";
                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day-by-Day Quick Cards Breakdown */}
        <div className="grid grid-cols-2 min-[480px]:grid-cols-4 md:grid-cols-7 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          {currentWeekWorkHours.days.map((item) => (
            <div
              key={item.day}
              className={`p-3 rounded-xl border transition-colors ${
                item.isToday
                  ? "bg-[#002185]/[0.05] border-[#002185]/25 dark:bg-blue-500/10 dark:border-blue-500/30"
                  : "bg-slate-50/70 dark:bg-[#162033]/50 border-slate-200/70 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {item.day}
                </span>
                {item.isToday && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#002185] dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 rounded">
                    Today
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {item.hours > 0 ? `${item.hours}h` : (item.isFuture ? "--" : (item.isWeekend ? "Off" : "0h"))}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    item.hours >= 8
                      ? "text-emerald-600 dark:text-emerald-400"
                      : item.hours > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.hours >= 8
                    ? "Met"
                    : item.hours > 0
                    ? "Partial"
                    : item.isFuture
                    ? "Upcoming"
                    : item.isWeekend
                    ? "Weekend"
                    : "Absent"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Global Date Range Picker */}
      <GlobalDateRangePicker
        startDate={startDateFilter}
        endDate={endDateFilter}
        preset={dateRangePreset}
        title="Filter Attendance Period"
        onRangeChange={({ startDate, endDate, preset }) => {
          setStartDateFilter(startDate);
          setEndDateFilter(endDate);
          setDateRangePreset(preset);
          if (startDate || endDate) {
            setSelectedMonth("all");
          }
        }}
      />

      {/* SECTION 3: MONTHLY ATTENDANCE LOGS TABLE / WEEKLY CHART */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <CardHeader
            icon={Calendar}
            title="Attendance history & logs"
            description="Verified clock-in and clock-out stamps, worked hours, and lateness penalties"
            action={
              <>
                <button
                  type="button"
                  id="btn-employee-export-csv"
                  onClick={handleEmployeeExportCSV}
                  className={`${ui.btnSecondary} ${ui.btnSm}`}
                  title="Download attendance records as CSV for payroll records"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  CSV
                </button>
                <button
                  type="button"
                  id="btn-employee-export-pdf"
                  onClick={handleEmployeeExportPDF}
                  className={`${ui.btnSecondary} ${ui.btnSm}`}
                  title="Download official PDF attendance audit sheet"
                >
                  <Download className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  PDF
                </button>
                <button
                  type="button"
                  id="btn-employee-print-attendance-report"
                  onClick={() => setShowPrintReport(true)}
                  className={`${ui.btnPrimary} ${ui.btnSm}`}
                  title="Print official monthly attendance audit sheet"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Official sheet
                </button>
              </>
            }
          />

          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div role="tablist" aria-label="Attendance view" className={ui.tabList}>
              {[
                ["calendar", "btn-view-calendar", CalendarDays, "Monthly calendar"],
                ["heatmap", "btn-view-heatmap", Zap, "Intensity heatmap"],
                ["table", "btn-view-table", ListFilter, "Table view"],
                ["chart", "btn-view-chart", BarChart3, "Trends chart"],
              ].map(([view, btnId, ViewIcon, label]) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  id={btnId}
                  aria-selected={activeView === view}
                  onClick={() => setActiveView(view)}
                  className={`${ui.tab} ${activeView === view ? ui.tabActive : ui.tabIdle}`}
                >
                  <ViewIcon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {activeView === "table" && (
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                {availableMonths.length > 0 && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    aria-label="Filter by month"
                    className={`${ui.select} sm:w-36`}
                    style={selectChevronStyle}
                  >
                    <option value="all">All months</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                  className={`${ui.select} sm:w-40`}
                  style={selectChevronStyle}
                >
                  <option value="all">All statuses</option>
                  <option value="ontime">On Time</option>
                  <option value="late">Late Arrival</option>
                  <option value="absent">Absent</option>
                </select>
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search date..."
                    aria-label="Search attendance by date"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${ui.input} pl-9 sm:w-48`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Mode: Monthly Calendar */}
        {activeView === "calendar" && (
          <div className="p-4 sm:p-6">
            <IndividualAttendanceCalendar
              history={myHistory.data?.history || []}
              approvedLeaves={myHistory.data?.approvedLeaves || []}
              summary={myHistory.data?.summary || null}
              workSchedule={myHistory.data?.workSchedule || null}
              isLoading={myHistory.loading}
              error={myHistory.error}
              onRetry={loadMyHistory}
              emptyMessage="Your attendance days and any absences will appear here once recorded."
            />
          </div>
        )}

        {/* View Mode: Intensity Heatmap */}
        {activeView === "heatmap" && (
          <div className="p-4 sm:p-6">
            <AttendanceIntensityHeatmap
              attendanceLogs={(startDateFilter || endDateFilter) ? filteredHistory : attendanceHistory}
              title="Attendance Intensity Heatmap"
              subtitle="Daily check-in pattern matrix, worked hours density, and habit consistency throughout the month"
              onSelectDay={(dateKey) => {
                setSearchTerm(dateKey);
                setShowToast({
                  show: true,
                  message: `Filtering logs for ${dateKey}`,
                  type: "info",
                });
              }}
            />
          </div>
        )}

        {/* View Mode: Weekly Chart */}
        {activeView === "chart" && (
          <div className="p-6">
            <WeeklyAttendanceChart
              attendanceLogs={(startDateFilter || endDateFilter) ? filteredHistory : attendanceHistory}
              title="My Punctuality & Shift Hours Trends"
              subtitle="Daily work duration and arrival punctuality overview"
            />
          </div>
        )}

        {/* View Mode: Table & Mobile Cards */}
        {activeView === "table" && (
          <>
            {/* Selected Period Summary Sub-Header */}
            <div className="p-4 sm:p-5 bg-slate-50/60 dark:bg-[#162033]/40 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Period summary</span>
                  <Badge tone="brand">{selectedPeriodSummary.periodTitle}</Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedPeriodSummary.totalEntries} entries recorded
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Punctuality <strong className="text-emerald-600 dark:text-emerald-400">{selectedPeriodSummary.punctuality}%</strong>
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>
                    Worked <strong className="text-slate-900 dark:text-white">{selectedPeriodSummary.totalHours} hrs</strong>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { label: "Present days", value: selectedPeriodSummary.present, sub: `(${selectedPeriodSummary.onTime} on time)`, icon: CheckCircle2, tone: "success" },
                  { label: "Late days", value: selectedPeriodSummary.late, sub: "delayed", icon: TrendingDown, tone: "warning" },
                  { label: "Absences", value: selectedPeriodSummary.absent, sub: "missed", icon: AlertTriangle, tone: "danger" },
                  { label: "Logged hours", value: `${selectedPeriodSummary.totalHours}h`, sub: "recorded", icon: Clock, tone: "info" },
                ].map(({ label, value, sub, icon: SummaryIcon, tone }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800"
                  >
                    <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${tones[tone].icon}`}>
                      <SummaryIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-white tabular-nums leading-tight">
                        {value} <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{sub}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop table */}
            <div className={`hidden md:block ${ui.tableWrap}`}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.th}>Shift date</th>
                    <th className={ui.th}>Clock in / out</th>
                    <th className={ui.th}>Duration</th>
                    <th className={ui.th}>Status</th>
                    <th className={ui.th}>Tardiness / penalties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => {
                      const lateMins = Number(item.lateMinutes ?? item.delayMinutes ?? 0);
                      const latePenalty = Number(item.latePenalty || 0);

                      return (
                        <tr key={item._id || item.id || item.date} className={ui.tr}>
                          <td className={`${ui.td} font-semibold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {formatDate(item.date)}
                          </td>
                          <td className={ui.td}>
                            <span className="inline-flex items-center gap-2 font-mono text-[13px]">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {formatTime(item.clockIn || item.clockInTime)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-500 dark:text-slate-400">{formatTime(item.clockOut || item.clockOutTime)}</span>
                            </span>
                          </td>
                          <td className={`${ui.td} tabular-nums font-medium`}>{item.workHours || 0} hrs</td>
                          <td className={ui.td}>{getStatusBadge(item.status, lateMins, latePenalty)}</td>
                          <td className={ui.td}>
                            {lateMins > 0 ? (
                              <span className="inline-flex flex-wrap items-center gap-2">
                                <span className="font-medium text-amber-600 dark:text-amber-400">{lateMins}m late</span>
                                {latePenalty > 0 ? (
                                  <Badge tone="danger">-GH₵ {latePenalty.toFixed(2)}</Badge>
                                ) : (
                                  <Badge tone="neutral">GH₵ 0.00 (No deduction)</Badge>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Check className="w-3.5 h-3.5 text-emerald-500" /> None (0m)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={Calendar}
                          title="No attendance records found"
                          description={
                            searchTerm || statusFilter !== "all" || selectedMonth !== "all"
                              ? "Try adjusting your search filters above."
                              : "Your daily check-in and check-out logs will be listed here."
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  const lateMins = Number(item.lateMinutes ?? item.delayMinutes ?? 0);
                  const latePenalty = Number(item.latePenalty || 0);

                  return (
                    <div key={item._id || item.id || item.date} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(item.date)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.workHours || 0} hours worked</p>
                        </div>
                        {getStatusBadge(item.status, lateMins, latePenalty)}
                      </div>

                      <div className={`${ui.subtle} grid grid-cols-2 gap-2 p-3`}>
                        <div>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">Clock in</span>
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {formatTime(item.clockIn || item.clockInTime)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">Clock out</span>
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {formatTime(item.clockOut || item.clockOutTime)}
                          </span>
                        </div>
                      </div>

                      {lateMins > 0 && (
                        <div
                          className={`flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg border ${
                            latePenalty > 0
                              ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20"
                              : "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20"
                          }`}
                        >
                          <span
                            className={
                              latePenalty > 0
                                ? "font-medium text-amber-700 dark:text-amber-300"
                                : "font-medium text-[#002185] dark:text-blue-300"
                            }
                          >
                            {lateMins} minutes late
                          </span>
                          {latePenalty > 0 ? (
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              Deduction: GH₵ {latePenalty.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">No deduction incurred (GH₵ 0.00)</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No attendance records found"
                  description="Your daily check-in logs will appear here."
                />
              )}
            </div>
          </>
        )}
      </Card>

      {/* Official Attendance Report Print Modal */}
      {showPrintReport && (
        <AttendanceReportModal
          isOpen={showPrintReport}
          onClose={() => setShowPrintReport(false)}
          employee={employee || user || { fullName: "Staff Member" }}
          attendanceList={filteredHistory.length > 0 ? filteredHistory : attendanceHistory}
          period={selectedMonth !== "all" ? selectedMonth : "Current Period"}
          title="My Official Attendance Sheet"
        />
      )}

      {/* Toast feedback */}
      {showToast.show && (
        <Toaster
          onClose={() =>
            setShowToast({
              show: false,
              message: "",
              type: "success",
            })
          }
          message={showToast.message}
          type={showToast.type}
        />
      )}
    </div>
  );
};

export default EmployeesAttendance;
