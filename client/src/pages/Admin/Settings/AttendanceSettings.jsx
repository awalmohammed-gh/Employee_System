import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Clock, CheckCircle2 } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updateAttendanceSettings } from "../../../apis/fontApis";
import { setWorkingDays } from "../../../utils/workSchedule";

const defaultAttendance = {
  workStartTime: "08:00",
  workEndTime: "19:00",
  gracePeriodMinutes: 15,
  halfDayHours: 4,
  overtimeThresholdHours: 8,
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const allDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const AttendanceSettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [attendance, setAttendance] = useState(defaultAttendance);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings?.attendance) {
          setAttendance((prev) => ({
            ...prev,
            ...res.data.settings.attendance,
          }));
        }
      } catch (err) {
        console.warn("Failed to load attendance settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setAttendance((prev) => ({ ...prev, [field]: value }));
  };

  const handleDayToggle = (day) => {
    if (day === "Sunday") return; // Sunday is always the rest day
    setAttendance((prev) => {
      const current = prev.workingDays || [];
      const updated = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day];
      return { ...prev, workingDays: updated };
    });
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updateAttendanceSettings({
        ...attendance,
        workingDays: (attendance.workingDays || []).filter((d) => d !== "Sunday"),
      });
      if (res?.data?.success) {
        setWorkingDays(res.data.attendance?.workingDays || attendance.workingDays);
        setShowToast({
          show: true,
          message: "Attendance rules saved successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save attendance settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update attendance settings.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Work Start Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={attendance.workStartTime}
              onChange={(e) => handleChange("workStartTime", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Work End Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={attendance.workEndTime}
              onChange={(e) => handleChange("workEndTime", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Late Grace Period (Minutes)
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="0"
              max="120"
              value={attendance.gracePeriodMinutes}
              onChange={(e) =>
                handleChange("gracePeriodMinutes", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Overtime Threshold (Hours/Day)
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="1"
              max="24"
              value={attendance.overtimeThresholdHours}
              onChange={(e) =>
                handleChange(
                  "overtimeThresholdHours",
                  parseInt(e.target.value) || 8
                )
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Official Working Days
        </label>
        <div className="flex flex-wrap gap-2.5">
          {allDays.map((day) => {
            const isRestDay = day === "Sunday";
            const isSelected = !isRestDay && (attendance.workingDays || []).includes(day);
            return (
              <button
                type="button"
                key={day}
                onClick={() => handleDayToggle(day)}
                disabled={isRestDay}
                title={isRestDay ? "Sunday is the company rest day" : undefined}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isRestDay
                    ? "bg-slate-50 dark:bg-[#111927] text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed"
                    : isSelected
                    ? "bg-[#002185] text-white shadow-sm cursor-pointer"
                    : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                }`}
              >
                {day}
                {isRestDay && <span className="ml-1 font-medium">(rest day)</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Selected days are working days for attendance, absences, payroll and calendars. Sunday is always a rest day.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#002185] dark:bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#001760] dark:hover:bg-blue-700 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <WorkspaceLoader inline />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <span>{isSaving ? "Saving Attendance..." : "Save Attendance Settings"}</span>
        </button>
      </div>
    </form>
  );
};

export default AttendanceSettings;
