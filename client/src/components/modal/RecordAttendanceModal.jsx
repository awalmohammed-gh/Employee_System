import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useEffect, useMemo } from "react";
import { X, Clock, CheckCircle2, AlertCircle, Sparkles, CalendarCheck, User } from "lucide-react";
import { allEmployees, namesList, createManualAttendanceRecord } from "../../apis/fontApis";
import { useManagement } from "../../context/ManagementContextProvider";
import CustomSelect from "../CustomSelect";

export const RecordAttendanceModal = ({ isOpen = true, onClose, onSuccess }) => {
  const { setShowToast } = useManagement();
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [formData, setFormData] = useState({
    employeeId: "",
    date: todayStr,
    status: "Present",
    clockIn: "08:30",
    clockOut: "17:00",
    notes: "Recorded via Quick Actions",
  });

  const [errors, setErrors] = useState({});

  const employeeOptions = useMemo(() => {
    return employees.map((emp) => ({
      value: emp._id || emp.employeeId || emp.id,
      label: `${emp.fullName} (${emp.employeeId || "EMP"})`,
      sublabel: emp.department || "General Staff",
    }));
  }, [employees]);

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "Present", label: "Present / On Time" },
      { value: "Late", label: "Late Clock-in" },
      { value: "Half Day", label: "Half Day Shift" },
      { value: "Absent", label: "Absent (Deduction applies)" },
      { value: "On Leave", label: "Approved Leave" },
    ],
    []
  );

  // Fetch employees list
  useEffect(() => {
    let isMounted = true;
    const loadEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const res = await allEmployees();
        const data = res?.data;
        let list = [];
        if (data && data.success && Array.isArray(data.employees)) {
          list = data.employees;
        } else if (Array.isArray(data)) {
          list = data;
        } else {
          // Fallback to namesList
          const fallbackRes = await namesList();
          if (fallbackRes?.data?.success && Array.isArray(fallbackRes.data.employees)) {
            list = fallbackRes.data.employees;
          }
        }

        if (isMounted) {
          setEmployees(list);
          if (list.length > 0) {
            setFormData((prev) =>
              prev.employeeId
                ? prev
                : {
                    ...prev,
                    employeeId: list[0]._id || list[0].employeeId || list[0].id,
                  }
            );
          }
        }
      } catch (err) {
        console.warn("Could not load employee directory for attendance modal:", err);
      } finally {
        if (isMounted) setIsLoadingEmployees(false);
      }
    };

    if (isOpen) {
      loadEmployees();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Selected employee object
  const selectedEmployeeObj = useMemo(() => {
    return employees.find(
      (e) =>
        e._id === formData.employeeId ||
        e.employeeId === formData.employeeId ||
        e.id === formData.employeeId
    );
  }, [employees, formData.employeeId]);

  // Handle status preset changes
  const handleStatusChange = (status) => {
    if (status === "Present" || status === "On Time") {
      setFormData((prev) => ({
        ...prev,
        status,
        clockIn: "08:30",
        clockOut: "17:00",
      }));
    } else if (status === "Late") {
      setFormData((prev) => ({
        ...prev,
        status: "Late",
        clockIn: "09:15",
        clockOut: "17:00",
      }));
    } else if (status === "Half Day") {
      setFormData((prev) => ({
        ...prev,
        status: "Half Day",
        clockIn: "08:30",
        clockOut: "12:30",
      }));
    } else if (status === "Absent") {
      setFormData((prev) => ({
        ...prev,
        status: "Absent",
        clockIn: "",
        clockOut: "",
      }));
    } else if (status === "On Leave") {
      setFormData((prev) => ({
        ...prev,
        status: "On Leave",
        clockIn: "",
        clockOut: "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, status }));
    }
  };

  // Quick Preset Handlers
  const applyPreset = (presetType) => {
    const now = new Date();
    const curHour = String(now.getHours()).padStart(2, "0");
    const curMin = String(now.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${curHour}:${curMin}`;

    switch (presetType) {
      case "standard":
        setFormData((prev) => ({
          ...prev,
          status: "Present",
          clockIn: "08:30",
          clockOut: "17:00",
        }));
        break;
      case "clockInNow":
        setFormData((prev) => ({
          ...prev,
          status: parseInt(curHour, 10) >= 9 ? "Late" : "Present",
          clockIn: currentTimeStr,
          clockOut: "",
        }));
        break;
      case "late":
        setFormData((prev) => ({
          ...prev,
          status: "Late",
          clockIn: "09:30",
          clockOut: "17:00",
        }));
        break;
      case "absent":
        setFormData((prev) => ({
          ...prev,
          status: "Absent",
          clockIn: "",
          clockOut: "",
        }));
        break;
      default:
        break;
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.employeeId) {
      newErrors.employeeId = "Please select an employee.";
    }
    if (!formData.date) {
      newErrors.date = "Attendance date is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        employeeId: formData.employeeId,
        date: formData.date,
        status: formData.status,
        clockIn: formData.clockIn || null,
        clockOut: formData.clockOut || null,
        notes: formData.notes?.trim() || "Recorded via Quick Actions",
      };

      const res = await createManualAttendanceRecord(payload);
      if (res?.data?.success || res?.status === 200 || res?.status === 201) {
        setShowToast({
          show: true,
          message: `Attendance for ${selectedEmployeeObj?.fullName || "employee"} recorded successfully!`,
          type: "success",
        });

        if (onSuccess) {
          onSuccess(res?.data?.attendance);
        }
        if (onClose) {
          onClose();
        }
      } else {
        throw new Error(res?.data?.message || "Failed to record attendance.");
      }
    } catch (err) {
      console.error("Error creating attendance record:", err);
      setShowToast({
        show: true,
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to record attendance record.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="record-attendance-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
    >
      <div
        id="record-attendance-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-4 bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Record Attendance
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Quick Action
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Log employee check-in, check-out, or manual attendance entry
              </p>
            </div>
          </div>
          <button
            id="close-record-attendance-modal-btn"
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
          {/* Employee Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="record-attendance-employee-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
              >
                Staff Member <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {employees.length} employees available
              </span>
            </div>

            <CustomSelect
              id="record-attendance-employee-select"
              name="employeeId"
              value={formData.employeeId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, employeeId: e.target.value }))
              }
              options={employeeOptions}
              icon={User}
              placeholder="-- Choose employee --"
              searchable={true}
              searchPlaceholder="Filter employees..."
              disabled={isLoadingEmployees}
              required
            />

            {errors.employeeId && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.employeeId}
              </p>
            )}

            {/* Selected Employee Preview Chip */}
            {selectedEmployeeObj && (
              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162033]/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[11px]">
                    {selectedEmployeeObj.fullName?.charAt(0) || "E"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {selectedEmployeeObj.fullName}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {selectedEmployeeObj.position || "Staff"} • {selectedEmployeeObj.department || "General"}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {selectedEmployeeObj.employeeId || "EMP"}
                </span>
              </div>
            )}
          </div>

          {/* Date & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Date Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="record-attendance-date-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Date <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, date: todayStr }))}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Today
                </button>
              </div>
              <input
                id="record-attendance-date-input"
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
              {errors.date && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.date}
                </p>
              )}
            </div>

            {/* Attendance Status */}
            <div>
              <label
                htmlFor="record-attendance-status-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Status <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                id="record-attendance-status-select"
                name="status"
                value={formData.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Quick Shift Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                id="preset-standard-day"
                onClick={() => applyPreset("standard")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-[#162033] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Full Day (08:30 – 17:00)
              </button>
              <button
                type="button"
                id="preset-clock-in-now"
                onClick={() => applyPreset("clockInNow")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 transition-colors cursor-pointer"
              >
                Clock-In Now
              </button>
              <button
                type="button"
                id="preset-late-entry"
                onClick={() => applyPreset("late")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 transition-colors cursor-pointer"
              >
                Late Check-In (09:30)
              </button>
              <button
                type="button"
                id="preset-mark-absent"
                onClick={() => applyPreset("absent")}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 transition-colors cursor-pointer"
              >
                Mark Absent
              </button>
            </div>
          </div>

          {/* Time Fields (hidden if Absent or On Leave) */}
          {formData.status !== "Absent" && formData.status !== "On Leave" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="record-attendance-clockin-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Clock In Time (24h)
                </label>
                <div className="relative">
                  <input
                    id="record-attendance-clockin-input"
                    type="time"
                    value={formData.clockIn}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, clockIn: e.target.value }))
                    }
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                  <Clock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="record-attendance-clockout-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Clock Out Time (24h)
                </label>
                <div className="relative">
                  <input
                    id="record-attendance-clockout-input"
                    type="time"
                    value={formData.clockOut}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, clockOut: e.target.value }))
                    }
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                  <Clock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Notes / Remarks */}
          <div>
            <label
              htmlFor="record-attendance-notes-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Remarks / Justification
            </label>
            <input
              id="record-attendance-notes-input"
              type="text"
              placeholder="e.g., Quick check-in via dashboard action, verified by manager"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Automated Calculation Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold block">Automatic Policy Evaluation</span>
              <span>
                Work hours, tardiness minutes, and tier penalty deductions will be calculated
                automatically based on company shift policy.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              id="cancel-record-attendance-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-record-attendance-btn"
              type="submit"
              disabled={isSubmitting || isLoadingEmployees}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Saving Record...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Attendance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordAttendanceModal;
