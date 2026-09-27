import { useEffect, useState, useCallback, useRef } from "react";
import {
  employeeDashboardOverview,
  getEmployeeMe,
  getTodayAttendanceStatus,
} from "../../apis/fontApis";
import {
  UserCheck,
  CalendarDays,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  LayoutDashboard,
  Banknote,
} from "lucide-react";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import { useManagement } from "../../context/ManagementContextProvider";
import EmployeeLeaveChart from "../../components/EmployeeLeaveChart";
import AnnouncementBoard from "../../components/AnnouncementBoard";
import ApplyLeaveModal from "../../components/modal/ApplyLeaveModal";
import DailyShiftClock from "../../components/DailyShiftClock";
import WeeklyAttendanceChart from "../../components/WeeklyAttendanceChart";
import LatenessDeductionsLineChart from "../../components/LatenessDeductionsLineChart";
import MonthlyAttendanceCalendarCard from "../../components/MonthlyAttendanceCalendarCard";
import EmployeeProfileIdentityBanner from "../../components/EmployeeProfileIdentityBanner";
import EmployeePayrollHistory from "../../components/EmployeePayrollHistory";
import EmployeeLeaveRequestsManagement from "../../components/EmployeeLeaveRequestsManagement";
import { useAttendance } from "../../context/AttendanceContext";
import { ui, tones } from "./ui/tokens";
import { Badge, Card, CardHeader, DataRow, EmptyState, StatCard, Tabs } from "./ui/primitives";

// Stable reference fallback for zero re-render allocations
const EMPTY_ARRAY = [];

const EmployeeDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(null);

  // Centralized Global Attendance State
  const {
    todayRecord,
    isCheckingStatus: contextIsCheckingStatus,
    clockIn: contextClockIn,
    clockOut: contextClockOut,
    refreshAttendance: contextRefreshAttendance,
    updateTodayRecord,
  } = useAttendance();

  // Local status verification barrier defaulting to true
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const attendanceData = todayRecord;

  // Hydrate today's attendance status directly on mount to synchronize with database
  useEffect(() => {
    let isSubscribed = true;
    const hydrateTodayAttendanceStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const res = await getTodayAttendanceStatus();
        if (isSubscribed && res?.data?.success) {
          const payload = res.data;
          const shiftData = payload.todayRecord || payload.attendance;
          if (shiftData && typeof updateTodayRecord === "function") {
            updateTodayRecord(shiftData);
          }
        }
      } catch (err) {
        console.warn("[EmployeeDashboard] Error fetching /api/attendance/today-status:", err.message);
      } finally {
        if (isSubscribed) {
          setIsCheckingStatus(false);
        }
      }
    };

    hydrateTodayAttendanceStatus();
    return () => {
      isSubscribed = false;
    };
  }, [updateTodayRecord]);

  // Modals State
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [latenessThresholdAlert, setLatenessThresholdAlert] = useState(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState("overview"); // "overview" | "leave" | "payroll"

  const { setShowToast, user, setUser, settings } = useManagement();

  const fetchEmployeeDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(null);
      const { data } = await employeeDashboardOverview();

      if (data && data.success) {
        setDashboardData(data);
        let resolvedEmployee = data.employee;

        // If employee profile object is incomplete, fetch full profile from /employee/me
        if (!resolvedEmployee || !resolvedEmployee.fullName) {
          try {
            const meRes = await getEmployeeMe();
            if (meRes?.data?.employee || meRes?.data?.user) {
              resolvedEmployee = meRes.data.employee || meRes.data.user;
            }
          } catch {
            // ignore fallback error
          }
        }

        if (resolvedEmployee && typeof setUser === "function") {
          setUser((prevUser) => {
            const mergedEmployee = {
              ...(prevUser || {}),
              ...resolvedEmployee,
              avatar:
                resolvedEmployee.avatar ||
                resolvedEmployee.avatarUrl ||
                resolvedEmployee.profilePicture ||
                resolvedEmployee.profile_image_url ||
                prevUser?.avatar ||
                prevUser?.avatarUrl ||
                prevUser?.profilePicture ||
                "",
              profilePicture:
                resolvedEmployee.profilePicture ||
                resolvedEmployee.avatar ||
                prevUser?.profilePicture ||
                prevUser?.avatar ||
                "",
            };

            // Avoid triggering context re-render cascade if identity fields are identical
            if (
              prevUser &&
              prevUser._id === mergedEmployee._id &&
              prevUser.fullName === mergedEmployee.fullName &&
              prevUser.avatar === mergedEmployee.avatar &&
              prevUser.role === mergedEmployee.role &&
              prevUser.status === mergedEmployee.status
            ) {
              return prevUser;
            }
            return mergedEmployee;
          });
        }

        if (data.todayAttendance && typeof updateTodayRecord === "function") {
          updateTodayRecord(data.todayAttendance);
        }
      } else {
        const errorMsg = data?.message || "Failed to fetch dashboard data.";
        setIsError(errorMsg);
        setShowToast({
          show: true,
          message: errorMsg,
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error fetching employee dashboard:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Failed to fetch live dashboard data.";
      setIsError(errorMessage);
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [setUser, setShowToast, updateTodayRecord]);

  // Stable refs for background timer watchdogs
  const contextRefreshRef = useRef(contextRefreshAttendance);
  const fetchDashboardDataRef = useRef(fetchEmployeeDashboardData);

  useEffect(() => {
    contextRefreshRef.current = contextRefreshAttendance;
  }, [contextRefreshAttendance]);

  useEffect(() => {
    fetchDashboardDataRef.current = fetchEmployeeDashboardData;
  }, [fetchEmployeeDashboardData]);

  // Automated 12:00 AM (Midnight) Workday Reset & Rollover Timer
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

    const timer = setTimeout(() => {
      console.log("[EmployeeDashboard] Midnight boundary reached: refreshing attendance status...");
      if (contextRefreshRef.current) {
        contextRefreshRef.current(false);
      }
      if (fetchDashboardDataRef.current) {
        fetchDashboardDataRef.current();
      }
    }, msUntilMidnight);

    // Watchdog check for date rollover (e.g. system wake)
    let lastDate = now.toISOString().split("T")[0];
    const watchdog = setInterval(() => {
      const currentDate = new Date().toISOString().split("T")[0];
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        console.log("[EmployeeDashboard] Date rollover watchdog triggered:", currentDate);
        if (contextRefreshRef.current) {
          contextRefreshRef.current(false);
        }
        if (fetchDashboardDataRef.current) {
          fetchDashboardDataRef.current();
        }
      }
    }, 20000);

    return () => {
      clearTimeout(timer);
      clearInterval(watchdog);
    };
  }, []);

  // Clock In Function via centralized AttendanceContext
  const handleClockIn = useCallback(async (reasonParam = "") => {
    try {
      setIsLoading(true);
      setIsError(null);
      const reasonToSend = typeof reasonParam === "string" ? reasonParam.trim() : "";
      const result = await contextClockIn(reasonToSend);

      const delayMins = result.record?.delayMinutes || result.record?.lateMinutes || 0;
      const latePenalty = result.record?.latePenalty || 0;
      const isLate = delayMins > 0;
      const isZeroPenalty = isLate && latePenalty === 0;
      const toastType = isZeroPenalty ? "info" : isLate ? "warning" : "success";

      setShowToast({
        show: true,
        message:
          result.data?.message ||
          (isLate
            ? isZeroPenalty
              ? `Clocked in (${delayMins} mins late). Company policy applied: No salary deduction for this delay.`
              : `Clocked in (${delayMins} mins late). Lateness penalty of GH₵${Number(latePenalty).toFixed(2)} has been applied as per company policy.`
            : "Clock in successful!"),
        type: toastType,
      });

      setAnalyticsRefreshKey((prev) => prev + 1);
      await fetchEmployeeDashboardData();
    } catch (error) {
      console.error("Clock in error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Clock in failed.";
      setIsError(errorMessage);
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [contextClockIn, fetchEmployeeDashboardData, setShowToast]);

  // Clock Out Function via centralized AttendanceContext
  const handleClockOut = useCallback(async (reason = "") => {
    try {
      setIsLoading(true);
      setIsError(null);
      const result = await contextClockOut(reason);

      setShowToast({
        show: true,
        message: result?.data?.message || "Clock out successful!",
        type: "success",
      });

      setAnalyticsRefreshKey((prev) => prev + 1);
      await fetchEmployeeDashboardData();
    } catch (error) {
      console.error("Clock out error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Clock out failed.";
      setIsError(errorMessage);
      setShowToast({
        show: true,
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [contextClockOut, fetchEmployeeDashboardData, setShowToast]);

  useEffect(() => {
    fetchEmployeeDashboardData();

    let bc;
    try {
      bc = new BroadcastChannel("eyenit_attendance_sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "clock_in" || event.data?.type === "clock_out" || event.data?.type === "leave_updated") {
          fetchEmployeeDashboardData();
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    return () => {
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
    };
  }, [fetchEmployeeDashboardData]);
  if (isLoading && !dashboardData) {
    return <Loading />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchEmployeeDashboardData}
        onClose={() => setIsError(null)}
      />
    );
  }

  if (!dashboardData) {
    return (
      <div className={ui.page}>
        <Card>
          <EmptyState
            icon={LayoutDashboard}
            title="No dashboard data available"
            description="Your dashboard could not be loaded right now."
            action={
              <button type="button" onClick={fetchEmployeeDashboardData} className={ui.btnSecondary}>
                Try again
              </button>
            }
          />
        </Card>
      </div>
    );
  }

  // Extract data from API response
  const overview = dashboardData.overview || {};

  // Stable attendance logs reference to avoid re-rendering heavy child charts
  const attendanceLogs = dashboardData.attendanceRecords || dashboardData.attendanceLogs || EMPTY_ARRAY;

  // Calculate total days
  const totalDays =
    overview.totalDays !== undefined
      ? overview.totalDays
      : (overview.presentDays || 0) + (overview.absentDays || 0);

  const todayStr = new Date().toISOString().split("T")[0];
  const isTodayRecord = Boolean(!attendanceData?.date || attendanceData.date === todayStr);
  const hasClockedIn = isTodayRecord && Boolean(attendanceData?.clockIn || attendanceData?.clockInTime);
  const hasClockedOut = isTodayRecord && Boolean(attendanceData?.clockOut || attendanceData?.clockOutTime);

  const isLateShift =
    hasClockedIn &&
    (attendanceData?.status === "Late" ||
      attendanceData?.status === "late" ||
      Number(attendanceData?.delayMinutes || attendanceData?.lateMinutes || 0) > 0);

  let clockInTimeStr = "";
  if (hasClockedIn && attendanceData?.clockIn) {
    try {
      clockInTimeStr = new Date(attendanceData.clockIn).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      clockInTimeStr = "";
    }
  }

  // Shift status label & description with indicator icon
  const shiftInfo = hasClockedOut
    ? {
        label: "Clocked Out",
        desc: `Logged ${Number(attendanceData?.workHours || 0).toFixed(1)} hrs today`,
        icon: CheckCircle2,
        tone: "info",
      }
    : hasClockedIn
    ? {
        label: isLateShift ? "Late Shift" : "Active Shift",
        desc: `In: ${clockInTimeStr} · ${isLateShift ? "Delay recorded" : "On schedule"}`,
        icon: isLateShift ? AlertTriangle : CheckCircle2,
        tone: isLateShift ? "warning" : "success",
      }
    : {
        label: "Not Clocked In",
        desc: "Awaiting today's shift clock-in",
        icon: Clock,
        tone: "neutral",
      };

  const remainingLeave =
    overview.remainingLeaveDays !== undefined ? overview.remainingLeaveDays : overview.leaveBalance || 0;

  // 4 Standard Daily Metric Cards (Strictly Privacy Protected - Zero Salary Projections)
  const statsCards = [
    {
      title: "Shift Status",
      value: shiftInfo.label,
      icon: shiftInfo.icon,
      tone: shiftInfo.tone,
      description: shiftInfo.desc,
    },
    {
      title: "Hours Logged",
      value: `${Number(attendanceData?.workHours || 0).toFixed(1)} hrs`,
      icon: UserCheck,
      tone: "brand",
      description: `${overview.presentDays || 0} shifts recorded this cycle`,
    },
    {
      title: "Leave Balance",
      value: `${remainingLeave} days`,
      icon: CalendarDays,
      tone: "success",
      description: `${overview.usedLeaveDays || 0} used of ${overview.totalLeaveDays || 15} days`,
    },
    {
      title: "Announcements",
      value: "Active",
      icon: Megaphone,
      tone: "accent",
      description: "Company bulletins & notices",
    },
  ];

  // Attendance summary (MTD Live Calculation)
  const attendanceSummary = {
    totalDays: totalDays,
    present: overview.presentDays !== undefined ? overview.presentDays : 0,
    late: overview.lateDays !== undefined ? overview.lateDays : 0,
    absent: overview.absentDays !== undefined ? overview.absentDays : 0,
  };

  // Leave balance (Live Calculation)
  const leaveBalance = {
    total: overview.totalLeaveDays || 15,
    used: overview.usedLeaveDays || 0,
    remaining: overview.remainingLeaveDays !== undefined ? overview.remainingLeaveDays : overview.leaveBalance || 15,
  };
  const leaveUsedPercent = leaveBalance.total > 0 ? Math.min(100, Math.round((leaveBalance.used / leaveBalance.total) * 100)) : 0;

  const tabRemaining =
    overview.remainingLeaveDays !== undefined ? overview.remainingLeaveDays : overview.leaveBalance || 15;

  const dashboardTabs = [
    { value: "overview", label: "Overview", icon: LayoutDashboard },
    { value: "leave", label: "Leave requests", icon: CalendarCheck, count: `${tabRemaining}d left` },
    { value: "payroll", label: "Payroll history", icon: Banknote },
  ];

  const thresholdIsLimit = latenessThresholdAlert?.isLimitExceeded;

  return (
    <div className={ui.page}>
      {/* Identity & today's shift state */}
      <EmployeeProfileIdentityBanner
        employeeData={dashboardData?.employee || user}
        todayAttendance={attendanceData}
      />

      {/* Section navigation */}
      <Tabs
        tabs={dashboardTabs}
        value={activeDashboardTab}
        onChange={setActiveDashboardTab}
        ariaLabel="Dashboard sections"
      />

      {/* Leave requests view */}
      {activeDashboardTab === "leave" && (
        <div className="space-y-6">
          <EmployeeLeaveRequestsManagement onLeaveApplied={() => fetchEmployeeDashboardData()} />
          <EmployeeLeaveChart onApplyLeave={() => setShowApplyLeaveModal(true)} />
        </div>
      )}

      {/* Payroll history view */}
      {activeDashboardTab === "payroll" && <EmployeePayrollHistory />}

      {/* Overview */}
      {activeDashboardTab === "overview" && (
        <div className="space-y-6">
          {/* Lateness threshold warning */}
          {latenessThresholdAlert &&
            (latenessThresholdAlert.isWarningExceeded || latenessThresholdAlert.isLimitExceeded) && (
              <div
                role="alert"
                className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 rounded-2xl border ${
                  thresholdIsLimit
                    ? "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20"
                }`}
              >
                <span
                  className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${
                    thresholdIsLimit
                      ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                      : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-semibold ${
                        thresholdIsLimit ? "text-rose-900 dark:text-rose-200" : "text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      {thresholdIsLimit
                        ? "Monthly lateness penalty limit exceeded"
                        : "Monthly lateness penalty threshold warning"}
                    </h3>
                    <Badge tone={thresholdIsLimit ? "danger" : "warning"}>
                      {latenessThresholdAlert.usagePercent}% of cap
                    </Badge>
                  </div>
                  <p
                    className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                      thresholdIsLimit ? "text-rose-800/90 dark:text-rose-200/80" : "text-amber-800/90 dark:text-amber-200/80"
                    }`}
                  >
                    Accumulated lateness penalties for this month have reached{" "}
                    <strong>GH₵{Number(latenessThresholdAlert.currentDeductions || 0).toFixed(2)}</strong>, reaching the
                    predefined company policy threshold (<strong>{latenessThresholdAlert.warningThresholdPercent}%</strong>{" "}
                    warning limit at{" "}
                    <strong>GH₵{Number(latenessThresholdAlert.warningThresholdAmount || 0).toFixed(2)}</strong>
                    {latenessThresholdAlert.hasBaseSalary
                      ? ` of the ${latenessThresholdAlert.maxPenaltyPercent}% basic salary cap of GH₵${Number(latenessThresholdAlert.penaltyLimit || 0).toFixed(2)}`
                      : ` of GH₵${Number(latenessThresholdAlert.penaltyLimit || 0).toFixed(2)}`}
                    ).
                  </p>
                </div>
                <a
                  href="#lateness-deductions-line-chart-card"
                  className={`${ui.btnSecondary} ${ui.btnSm} self-start sm:self-center`}
                >
                  View audit
                </a>
              </div>
            )}

          {/* Today's shift */}
          <section className="space-y-4" aria-label="Today's shift">
            <DailyShiftClock
              attendanceData={attendanceData}
              hasClockedIn={hasClockedIn}
              hasClockedOut={hasClockedOut}
              isLoading={isLoading}
              isCheckingStatus={isCheckingStatus || contextIsCheckingStatus}
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              workEndTime={settings?.workEndTime || settings?.attendance?.workEndTime || "19:00"}
              workStartTime={settings?.workStartTime || settings?.attendance?.workStartTime || "08:00"}
            />
          </section>

          {/* Daily metrics */}
          <section className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Today at a glance">
            {statsCards.map((stat) => (
              <StatCard
                key={stat.title}
                label={stat.title}
                value={stat.value}
                hint={stat.description}
                icon={stat.icon}
                tone={stat.tone}
              />
            ))}
          </section>

          {/* Attendance summary & leave balance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader icon={UserCheck} title="Attendance summary" description="This payroll cycle" />
              <div className="mt-4">
                <DataRow label="Total days" value={attendanceSummary.totalDays} />
                <DataRow label="Present" value={attendanceSummary.present} valueClassName={tones.success.text} />
                <DataRow label="Late" value={attendanceSummary.late} valueClassName={tones.warning.text} />
                <DataRow label="Absent" value={attendanceSummary.absent} valueClassName={tones.danger.text} />
              </div>
            </Card>

            <Card>
              <CardHeader icon={CalendarDays} tone="success" title="Leave balance" description="Annual entitlement" />
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {leaveBalance.remaining}
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1.5">days left</span>
                  </p>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{leaveUsedPercent}% used</span>
                </div>
                <div
                  className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={leaveUsedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Leave used"
                >
                  <div className="h-full rounded-full bg-[#002185] dark:bg-blue-500 transition-[width] duration-500" style={{ width: `${leaveUsedPercent}%` }} />
                </div>
              </div>
              <div className="mt-4">
                <DataRow label="Total leave" value={`${leaveBalance.total} days`} />
                <DataRow label="Used" value={`${leaveBalance.used} days`} valueClassName={tones.warning.text} />
                <DataRow label="Remaining" value={`${leaveBalance.remaining} days`} valueClassName={tones.success.text} />
              </div>
            </Card>
          </div>

          {/* Company announcements */}
          <AnnouncementBoard role="employee" />

          {/* Attendance analytics */}
          <WeeklyAttendanceChart
            attendanceLogs={attendanceLogs}
            title="Weekly Attendance & Shift Performance"
            subtitle="Monitor weekly attendance patterns and total hours worked against shift requirements"
          />

          <MonthlyAttendanceCalendarCard
            attendanceLogs={attendanceLogs}
            employeeId={user?._id || user?.id}
            role="employee"
            title="My Monthly Attendance Calendar"
            subtitle="Visual monthly attendance status (Present, Late, Absent) at a glance with daily shift details"
            refreshKey={analyticsRefreshKey}
          />

          <LatenessDeductionsLineChart
            employeeId={user?._id || user?.id}
            title="My Monthly Lateness Deductions"
            subtitle="Visualize your daily and cumulative lateness penalty deductions over the current payroll month"
            refreshKey={analyticsRefreshKey}
            onThresholdChange={setLatenessThresholdAlert}
          />

          {/* Leave requests */}
          <EmployeeLeaveRequestsManagement onLeaveApplied={() => fetchEmployeeDashboardData()} />

          <EmployeeLeaveChart onApplyLeave={() => setShowApplyLeaveModal(true)} />

          {/* Payroll history */}
          <EmployeePayrollHistory />
        </div>
      )}

      {showApplyLeaveModal && (
        <ApplyLeaveModal
          onClose={() => setShowApplyLeaveModal(false)}
          onSuccess={async () => {
            await fetchEmployeeDashboardData();
            setShowToast({
              message: "Leave request submitted successfully!",
              type: "success",
              show: true,
            });
          }}
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;
