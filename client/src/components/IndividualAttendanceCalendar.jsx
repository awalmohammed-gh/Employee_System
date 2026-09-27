import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Plane,
  RefreshCw,
  Timer,
  XCircle,
} from "lucide-react";

/**
 * Individual attendance/absence calendar.
 * Renders only what the backend has stored for ONE employee (history from
 * /attendance/employee/:id/history or /attendance/my-history). Nothing is inferred:
 * a day without a stored record is shown as "No record", never as absent.
 */

const BUCKETS = {
  present: {
    label: "Present",
    cell: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/25",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    icon: CheckCircle2,
  },
  late: {
    label: "Late",
    cell: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/25",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    icon: Clock,
  },
  absent: {
    label: "Absent",
    cell: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/25",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
    icon: XCircle,
  },
  leave: {
    label: "On leave",
    cell: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/25",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    icon: Plane,
  },
  other: {
    label: "Other record",
    cell: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    icon: CalendarDays,
  },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const todayKey = () => {
  const t = new Date();
  return keyOf(t.getFullYear(), t.getMonth(), t.getDate());
};
const formatTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const formatLongDate = (key) =>
  fromKey(key).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const Tile = ({ label, value, hint, tone }) => (
  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111927] p-3.5">
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${BUCKETS[tone]?.dot || "bg-slate-400"}`} />
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
    <p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">{value}</p>
    {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
      {label}
    </span>
    <span className="text-sm font-medium text-slate-900 dark:text-white text-right">{value}</span>
  </div>
);

const IndividualAttendanceCalendar = ({
  history = [],
  approvedLeaves = [],
  summary = null,
  workSchedule = null,
  isLoading = false,
  error = null,
  onRetry,
  emptyMessage = "No attendance has been recorded yet.",
}) => {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState(todayKey());

  const recordsByDay = useMemo(() => {
    const map = new Map();
    history.forEach((h) => h?.date && map.set(h.date, h));
    return map;
  }, [history]);

  const leaveFor = useMemo(() => {
    const ranges = approvedLeaves.filter((l) => l.startDate && l.endDate);
    return (key) => ranges.find((l) => key >= l.startDate && key <= l.endDate) || null;
  }, [approvedLeaves]);

  const workingDays = useMemo(
    () => new Set((workSchedule?.workingDays || []).map((d) => String(d).toLowerCase())),
    [workSchedule]
  );

  // Jump to the most recent month with records when data first arrives and the current month is empty
  useEffect(() => {
    if (history.length === 0) return;
    const prefix = `${cursor.y}-${pad(cursor.m + 1)}`;
    if (history.some((h) => h.date?.startsWith(prefix))) return;
    const latest = history[0]?.date;
    if (latest) {
      const d = fromKey(latest);
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
      setSelectedKey(latest);
    }
    // only on data change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const statusFor = (key) => {
    const record = recordsByDay.get(key);
    if (record) return { bucket: BUCKETS[record.bucket] ? record.bucket : "other", record, leave: leaveFor(key) };
    const leave = leaveFor(key);
    if (leave) return { bucket: "leave", record: null, leave };
    return { bucket: null, record: null, leave: null };
  };

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // Monday-first grid
    const list = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) list.push(keyOf(cursor.y, cursor.m, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GH", { month: "long", year: "numeric" });
  const monthCounts = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    cells.forEach((key) => {
      if (!key) return;
      const { bucket } = statusFor(key);
      if (bucket && counts[bucket] !== undefined) counts[bucket] += 1;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, recordsByDay, leaveFor]);

  // Legend lists only statuses that actually occur in this employee's data
  const legendBuckets = useMemo(() => {
    const present = new Set(history.map((h) => (BUCKETS[h.bucket] ? h.bucket : "other")));
    if (approvedLeaves.length > 0) present.add("leave");
    return ["present", "late", "absent", "leave", "other"].filter((b) => present.has(b));
  }, [history, approvedLeaves]);

  const moveMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const goToday = () => {
    const t = new Date();
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
    setSelectedKey(todayKey());
  };

  const recentAbsences = history.filter((h) => h.bucket === "absent").slice(0, 6);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-[#002185] dark:text-blue-400" />
        <p className="text-sm">Loading attendance history…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-12">
        <AlertCircle className="w-6 h-6 text-rose-500" />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:bg-[#162033] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        )}
      </div>
    );
  }

  const selected = selectedKey ? statusFor(selectedKey) : null;
  const selectedDate = selectedKey ? fromKey(selectedKey) : null;
  const selectedIsWorkingDay =
    selectedDate && workingDays.size > 0 ? workingDays.has(WEEKDAY_NAMES[selectedDate.getDay()].toLowerCase()) : true;

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Tile label="Present days" value={summary.present} tone="present" />
          <Tile label="Late days" value={summary.late} tone="late" />
          <Tile
            label="Absent days"
            value={summary.absent}
            tone="absent"
            hint={summary.automaticAbsences > 0 ? `${summary.automaticAbsences} recorded at closing time` : undefined}
          />
          <Tile label="Approved leave requests" value={summary.approvedLeaveRequests} tone="leave" />
          <Tile label="Hours recorded" value={`${summary.totalWorkHours}h`} tone="other" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* Calendar */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111927] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">{monthLabel}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {monthCounts.present} present · {monthCounts.late} late · {monthCounts.absent} absent
                {monthCounts.leave > 0 ? ` · ${monthCounts.leave} on leave` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToday}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Previous month"
                className="grid place-items-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Next month"
                className="grid place-items-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-center text-[11px] font-medium text-slate-400 dark:text-slate-500 py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={`Attendance for ${monthLabel}`}>
            {cells.map((key, i) => {
              if (!key) return <span key={`pad-${i}`} aria-hidden="true" />;
              const { bucket } = statusFor(key);
              const style = bucket ? BUCKETS[bucket] : null;
              const date = fromKey(key);
              const nonWorking = workingDays.size > 0 && !workingDays.has(WEEKDAY_NAMES[date.getDay()].toLowerCase());
              const isSelected = key === selectedKey;
              const isToday = key === todayKey();
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${formatLongDate(key)}: ${style ? style.label : nonWorking ? "Non-working day" : "No record"}`}
                  onClick={() => setSelectedKey(key)}
                  className={`relative aspect-square min-h-9 rounded-lg border text-xs sm:text-sm font-medium flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002185]/40 ${
                    style
                      ? style.cell
                      : nonWorking
                      ? "bg-slate-50/60 text-slate-300 border-transparent dark:bg-transparent dark:text-slate-600"
                      : "bg-white text-slate-600 border-slate-100 hover:border-slate-300 dark:bg-[#111927] dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-600"
                  } ${isSelected ? "ring-2 ring-[#002185] dark:ring-blue-400 ring-offset-1 ring-offset-white dark:ring-offset-[#111927]" : ""}`}
                >
                  <span className={isToday ? "underline decoration-2 underline-offset-2 decoration-[#ff5500]" : ""}>{date.getDate()}</span>
                  {style && <span className={`hidden sm:block w-1.5 h-1.5 rounded-full ${style.dot}`} />}
                </button>
              );
            })}
          </div>

          {legendBuckets.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {legendBuckets.map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className={`w-2.5 h-2.5 rounded-sm ${BUCKETS[b].dot}`} />
                  {BUCKETS[b].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm border border-slate-300 dark:border-slate-600" />
                No record
              </span>
            </div>
          )}
          {history.length === 0 && approvedLeaves.length === 0 && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">{emptyMessage}</p>
          )}
        </div>

        {/* Selected day */}
        <aside className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111927] p-4 sm:p-5 h-fit" aria-live="polite">
          {selectedKey && (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Selected day</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{formatLongDate(selectedKey)}</p>

              {selected?.bucket ? (
                <span className={`inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 rounded-md border text-xs font-semibold ${BUCKETS[selected.bucket].badge}`}>
                  {(() => {
                    const Icon = BUCKETS[selected.bucket].icon;
                    return <Icon className="w-3.5 h-3.5" />;
                  })()}
                  {selected.record?.status || BUCKETS[selected.bucket].label}
                </span>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {selectedIsWorkingDay ? "No attendance record for this day." : "Non-working day — no attendance expected."}
                </p>
              )}

              {selected?.record && (
                <div className="mt-3">
                  {selected.bucket !== "absent" && (
                    <>
                      <DetailRow icon={LogIn} label="Check-in" value={formatTime(selected.record.clockIn)} />
                      <DetailRow icon={LogOut} label="Check-out" value={formatTime(selected.record.clockOut)} />
                    </>
                  )}
                  <DetailRow icon={Timer} label="Hours worked" value={`${selected.record.workHours || 0} hrs`} />
                  {selected.record.lateMinutes > 0 && (
                    <DetailRow icon={Clock} label="Late by" value={`${selected.record.lateMinutes} min`} />
                  )}
                  {selected.record.latePenalty > 0 && (
                    <DetailRow label="Lateness deduction" value={`GH₵${Number(selected.record.latePenalty).toFixed(2)}`} />
                  )}
                  {selected.record.autoClockedOut && <DetailRow label="Clock-out" value="Closed automatically" />}
                  {selected.record.isExcused && (
                    <DetailRow label="Excused" value={selected.record.excuseReason || "Yes"} />
                  )}
                  {selected.bucket === "absent" && (
                    <DetailRow
                      label="Recorded"
                      value={
                        selected.record.automaticAbsence
                          ? `Automatically at closing time${selected.record.recordedAbsentAt ? ` (${formatTime(selected.record.recordedAbsentAt)})` : ""}`
                          : "By administrator"
                      }
                    />
                  )}
                  {(selected.record.lateReason || selected.record.notes) && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#162033] rounded-lg p-3">
                      {selected.record.lateReason || selected.record.notes}
                    </p>
                  )}
                </div>
              )}

              {selected?.leave && (
                <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                  <p className="font-semibold">{selected.leave.leaveType} (approved)</p>
                  <p className="mt-0.5">
                    {formatLongDate(selected.leave.startDate)} – {formatLongDate(selected.leave.endDate)}
                  </p>
                </div>
              )}
            </>
          )}

          {recentAbsences.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-2">Recent absences</p>
              <ul className="space-y-1">
                {recentAbsences.map((a) => (
                  <li key={a.date}>
                    <button
                      type="button"
                      onClick={() => {
                        const d = fromKey(a.date);
                        setCursor({ y: d.getFullYear(), m: d.getMonth() });
                        setSelectedKey(a.date);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm text-slate-700 hover:bg-rose-50 dark:text-slate-300 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      <span>{fromKey(a.date).toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="text-[11px] text-slate-400">{a.automaticAbsence ? "Auto" : "Admin"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default IndividualAttendanceCalendar;
