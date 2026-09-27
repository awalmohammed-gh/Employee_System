import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  Filter,
  CheckCircle2,
  Clock,
  CalendarCheck,
  AlertTriangle,
} from "lucide-react";

export const TeamLeaveCalendar = ({
  leaves = [],
  employees = [],
  onDateSelect,
  onLeaveSelect,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [selectedDayLeaves, setSelectedDayLeaves] = useState(null);
  const [selectedDayDate, setSelectedDayDate] = useState(null);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDayLeaves(null);
    setSelectedDayDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDayLeaves(null);
    setSelectedDayDate(null);
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
    setSelectedDayLeaves(null);
    setSelectedDayDate(null);
  };

  // Extract distinct departments
  const departments = useMemo(() => {
    const set = new Set();
    leaves.forEach((l) => {
      const dept = l.employee?.department || l.department;
      if (dept) set.add(dept);
    });
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return ["All", ...Array.from(set)];
  }, [leaves, employees]);

  // Extract distinct leave types
  const leaveTypes = useMemo(() => {
    const set = new Set();
    leaves.forEach((l) => {
      if (l.leaveType) set.add(l.leaveType);
    });
    return ["All", ...Array.from(set)];
  }, [leaves]);

  // Filter approved leaves for conflict visualization
  const approvedLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      const status = (leave.status || "").toLowerCase();
      // Consider approved leaves, plus pending for visualization if relevant
      const isApproved = status === "approved";
      if (!isApproved) return false;

      const dept = leave.employee?.department || leave.department || "";
      const matchesDept = selectedDepartment === "All" || dept === selectedDepartment;
      const matchesType = selectedLeaveType === "All" || leave.leaveType === selectedLeaveType;

      return matchesDept && matchesType;
    });
  }, [leaves, selectedDepartment, selectedLeaveType]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Map leaves by date string (YYYY-MM-DD)
  const leavesByDate = useMemo(() => {
    const map = {};

    approvedLeaves.forEach((leave) => {
      if (!leave.startDate || !leave.endDate) return;

      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      // Normalize to midnight UTC/local
      const cur = new Date(start);
      while (cur <= end) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, "0");
        const dd = String(cur.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!map[dateKey]) {
          map[dateKey] = [];
        }
        // Avoid duplicates
        if (!map[dateKey].some((item) => String(item._id || item.id) === String(leave._id || leave.id))) {
          map[dateKey].push(leave);
        }

        cur.setDate(cur.getDate() + 1);
      }
    });

    return map;
  }, [approvedLeaves]);

  // Handle day cell click
  const handleDayClick = (dayNumber) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(dayNumber).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    const dayLeaves = leavesByDate[dateKey] || [];

    setSelectedDayDate(new Date(year, month, dayNumber));
    setSelectedDayLeaves(dayLeaves);

    if (typeof onDateSelect === "function") {
      onDateSelect(dateKey, dayLeaves);
    }
  };

  // Leave badge colors by type
  const getLeaveTypeStyle = (type) => {
    const t = String(type || "").toLowerCase();
    if (t.includes("annual") || t.includes("vacation")) {
      return { bg: "bg-[#002185]/10 text-[#002185] border-[#002185]/30", dot: "bg-[#002185]" };
    }
    if (t.includes("sick") || t.includes("medical")) {
      return { bg: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30", dot: "bg-[#DC2626]" };
    }
    if (t.includes("maternity") || t.includes("paternity")) {
      return { bg: "bg-[#9333EA]/10 text-[#9333EA] border-[#9333EA]/30", dot: "bg-[#9333EA]" };
    }
    if (t.includes("casual") || t.includes("personal")) {
      return { bg: "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/30", dot: "bg-[#F59E0B]" };
    }
    return { bg: "bg-[#ff5500]/10 text-[#ff5500] border-[#ff5500]/30", dot: "bg-[#ff5500]" };
  };

  // Format date helper
  const formatDateDisplay = (dateObj) => {
    if (!dateObj) return "";
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#002185] text-white flex items-center justify-center shadow-xs">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#002185] flex items-center gap-2">
              <span>Team Leave Calendar</span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/20">
                Live Conflicts Detector
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Visualize approved leaves across departments to prevent coverage gaps and staffing overlaps
            </p>
          </div>
        </div>

        {/* Filters & Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-transparent font-medium text-[#0F172A] focus:outline-hidden cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "All" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>

          {/* Leave Type Filter */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
              className="bg-transparent font-medium text-[#0F172A] focus:outline-hidden cursor-pointer"
            >
              {leaveTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "All" ? "All Leave Types" : t}
                </option>
              ))}
            </select>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:text-[#002185] text-[#64748B] transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-[#002185] min-w-[130px] text-center select-none">
              {monthName}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:text-[#002185] text-[#64748B] transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={resetToToday}
            className="px-3 py-1.5 bg-[#002185]/10 hover:bg-[#002185] hover:text-white text-[#002185] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main 7-Column Month Grid */}
        <div className="lg:col-span-3 space-y-2">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-[#64748B] uppercase tracking-wider py-1.5 border-b border-[#E2E8F0]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank offset days for previous month */}
            {Array.from({ length: firstDayIndex }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="h-28 bg-[#F8FAFC]/50 rounded-xl border border-dashed border-[#E2E8F0]/60 opacity-40 select-none"
              />
            ))}

            {/* Actual Days of the current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNumber = idx + 1;
              const mm = String(month + 1).padStart(2, "0");
              const dd = String(dayNumber).padStart(2, "0");
              const dateKey = `${year}-${mm}-${dd}`;
              const dayLeaves = leavesByDate[dateKey] || [];

              const isToday =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNumber;

              const isSelected =
                selectedDayDate &&
                selectedDayDate.getFullYear() === year &&
                selectedDayDate.getMonth() === month &&
                selectedDayDate.getDate() === dayNumber;

              const hasConflict = dayLeaves.length >= 2;

              return (
                <div
                  key={`day-${dayNumber}`}
                  onClick={() => handleDayClick(dayNumber)}
                  className={`h-28 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group overflow-hidden ${
                    isSelected
                      ? "border-[#002185] bg-[#002185]/5 shadow-sm ring-2 ring-[#002185]/20"
                      : isToday
                      ? "border-[#ff5500] bg-[#FFF7ED]"
                      : hasConflict
                      ? "border-[#FCA5A5] bg-[#FEF2F2]/60 hover:border-[#DC2626]"
                      : dayLeaves.length > 0
                      ? "border-[#CBD5E1] bg-white hover:border-[#002185]"
                      : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                  }`}
                >
                  {/* Date Header inside cell */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-[#ff5500] text-white"
                          : isSelected
                          ? "bg-[#002185] text-white"
                          : "text-[#0F172A]"
                      }`}
                    >
                      {dayNumber}
                    </span>

                    {/* Conflict Badge */}
                    {hasConflict && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#DC2626] text-white"
                        title={`${dayLeaves.length} employees on leave simultaneously (potential coverage conflict)`}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {dayLeaves.length} Out
                      </span>
                    )}

                    {!hasConflict && dayLeaves.length === 1 && (
                      <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    )}
                  </div>

                  {/* Leave previews inside cell */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayLeaves.slice(0, 2).map((l, i) => {
                      const empName = l.employee?.fullName || l.fullName || "Staff";
                      const style = getLeaveTypeStyle(l.leaveType);
                      return (
                        <div
                          key={l._id || i}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${style.bg}`}
                          title={`${empName} - ${l.leaveType} (${l.employee?.department || "Department"})`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
                          <span className="truncate">{empName}</span>
                        </div>
                      );
                    })}
                    {dayLeaves.length > 2 && (
                      <div className="text-[9px] font-bold text-[#64748B] text-center">
                        +{dayLeaves.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Cell footer indicator */}
                  <div className="text-[9px] text-[#94A3B8] font-medium truncate">
                    {dayLeaves.length > 0 ? `${dayLeaves.length} on leave` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Inspector Sidebar */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#002185] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#ff5500]" />
                <span>Day Details</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                {selectedDayDate ? formatDateDisplay(selectedDayDate) : "Click any day on the calendar"}
              </p>
            </div>

            {/* List of staff on leave for this specific date */}
            {selectedDayLeaves && selectedDayLeaves.length > 0 ? (
              <div className="space-y-3">
                {selectedDayLeaves.length >= 2 && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#DC2626] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Coverage Alert:</strong> {selectedDayLeaves.length} employees are away on this date.
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {selectedDayLeaves.map((leave, idx) => {
                    const emp = leave.employee || {};
                    const style = getLeaveTypeStyle(leave.leaveType);
                    const initials = (emp.fullName || leave.fullName || "E")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={leave._id || idx}
                        onClick={() => typeof onLeaveSelect === "function" && onLeaveSelect(leave)}
                        className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-2xs hover:border-[#002185] transition-all space-y-2 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#002185] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#0F172A] truncate">
                              {emp.fullName || leave.fullName || "Staff Member"}
                            </h4>
                            <p className="text-[11px] text-[#64748B] truncate">
                              {emp.department || "General Department"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E2E8F0]/60">
                          <span className={`px-2 py-0.5 rounded-md font-semibold border ${style.bg}`}>
                            {leave.leaveType}
                          </span>
                          <span className="text-[#64748B] font-mono">
                            {leave.workingDays || leave.duration || 1} day(s)
                          </span>
                        </div>

                        {leave.reason && (
                          <p className="text-[10px] text-[#64748B] italic bg-[#F8FAFC] p-1.5 rounded-lg border border-[#E2E8F0]/40">
                            "{leave.reason}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : selectedDayDate ? (
              <div className="text-center py-8 text-[#64748B] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto opacity-70" />
                <p className="text-xs font-medium">Full Attendance Available</p>
                <p className="text-[11px] text-[#94A3B8]">No approved leaves on this day.</p>
              </div>
            ) : (
              <div className="text-center py-8 text-[#64748B] space-y-2">
                <CalendarIcon className="w-8 h-8 text-[#002185] mx-auto opacity-40" />
                <p className="text-xs font-medium">Select a Date</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Click on any calendar day to inspect staff schedules and potential conflicts.
                </p>
              </div>
            )}
          </div>

            {/* Monthly stats snapshot */}
          <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[#64748B]">
              <span>Approved Leaves in {currentDate.toLocaleDateString("en-US", { month: "short" })}:</span>
              <strong className="text-[#002185]">{approvedLeaves.length}</strong>
            </div>
            <div className="flex items-center justify-between text-[#64748B]">
              <span>Active Conflicts:</span>
              <strong className="text-[#DC2626]">
                {Object.values(leavesByDate).filter((arr) => arr.length >= 2).length}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLeaveCalendar;
