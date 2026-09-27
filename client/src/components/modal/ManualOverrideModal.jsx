import { useState, useEffect, useMemo } from "react";
import {
  Edit3,
  Clock,
  X,
  AlertCircle,
  CheckCircle2,
  Zap,
  User,
} from "lucide-react";
import { getPenaltySettings, getSettings } from "../../apis/fontApis";
import CustomSelect from "../CustomSelect";
import AnimatedModal from "../ui/AnimatedModal";
import { motion } from "framer-motion";
import { buttonPressProps } from "../../utils/motion";

// Strict Regex pattern for 24-hour HH:MM format (00:00 to 23:59)
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Extended pattern supporting optional seconds or AM/PM
const TIME_FLEX_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(\s*(?:AM|PM|am|pm))?$/;

/**
 * Validates whether a given time string is in a valid format.
 */
export const isValidTimeFormat = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return true;
  const trimmed = timeStr.trim();
  if (!trimmed) return true;
  return TIME_24H_REGEX.test(trimmed) || TIME_FLEX_REGEX.test(trimmed);
};

/**
 * Helper to parse HH:MM into total minutes from midnight
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

/**
 * Converts 24-hour HH:MM to friendly 12-hour display string
 */
export const format12Hour = (time24) => {
  if (!time24 || typeof time24 !== "string" || !time24.includes(":")) return time24 || "--";
  const [hStr, mStr] = time24.trim().split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(displayH)}:${pad(m)} ${ampm}`;
};

export const DEFAULT_FALLBACK_TIERS = [
  { tier: 1, name: "Tier 1 (1–30 mins)", minMinutes: 1, maxMinutes: 30, fine: 10 },
  { tier: 2, name: "Tier 2 (31–60 mins)", minMinutes: 31, maxMinutes: 60, fine: 30 },
  { tier: 3, name: "Tier 3 (61–120 mins / 1–2 hrs)", minMinutes: 61, maxMinutes: 120, fine: 50 },
  { tier: 4, name: "Tier 4 (121–180 mins / 2–3 hrs)", minMinutes: 121, maxMinutes: 180, fine: 75 },
  { tier: 5, name: "Tier 5 (181–240 mins / 3–4 hrs)", minMinutes: 181, maxMinutes: 240, fine: 100 },
  { tier: 6, name: "Tier 6 (241+ mins / 4+ hrs)", minMinutes: 241, maxMinutes: 9999, fine: 150 },
];

export const ManualOverrideModal = ({
  isOpen,
  onClose,
  formData = {},
  setFormData,
  onSave,
  employeesList = [],
  isSaving = false,
}) => {
  const [errors, setErrors] = useState({});
  const [companySettings, setCompanySettings] = useState({
    workStartTime: "08:00",
    workEndTime: "19:00",
    latenessTiers: DEFAULT_FALLBACK_TIERS,
  });
  const [isWaived, setIsWaived] = useState(false);
  const [userManuallySetStatus, setUserManuallySetStatus] = useState(false);

  const employeeOptions = useMemo(() => {
    return employeesList.map((emp) => ({
      value: emp.employeeId || emp._id,
      label: `${emp.fullName} (${emp.employeeId || "EMP"})`,
      sublabel: emp.department || "General Staff",
    }));
  }, [employeesList]);

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "On Time", label: "On Time" },
      { value: "Late", label: "Late" },
      { value: "Present", label: "Present" },
      { value: "Absent", label: "Absent" },
      { value: "On Leave", label: "On Leave" },
    ],
    []
  );

  // 1. Dynamic fetch of company settings (single source of truth)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchActiveSettings = async () => {
      try {
        const [penRes, setRes] = await Promise.allSettled([
          getPenaltySettings(),
          getSettings(),
        ]);

        let start = "08:00";
        let end = "19:00";
        let tiers = DEFAULT_FALLBACK_TIERS;

        if (penRes.status === "fulfilled" && penRes.value?.data?.settings) {
          const s = penRes.value.data.settings;
          if (s.workStartTime) start = s.workStartTime;
          if (s.workEndTime) end = s.workEndTime;
          if (Array.isArray(s.latenessTiers) && s.latenessTiers.length > 0) {
            tiers = s.latenessTiers;
          }
        }

        if (setRes.status === "fulfilled" && setRes.value?.data?.settings) {
          const gen = setRes.value.data.settings;
          const att = gen.attendance || {};
          const comp = gen.company || {};
          if (att.workStartTime || comp.workStartTime) {
            start = att.workStartTime || comp.workStartTime || start;
          }
          if (att.workEndTime || comp.workEndTime) {
            end = att.workEndTime || comp.workEndTime || end;
          }
        }

        if (isMounted) {
          setCompanySettings({
            workStartTime: start || "08:00",
            workEndTime: end || "19:00",
            latenessTiers: tiers,
          });

          // If creating a brand new record, populate defaults dynamically from active settings
          if (!formData.id && setFormData) {
            setFormData((prev) => ({
              ...prev,
              clockIn: prev.clockIn || start || "08:00",
              clockOut: prev.clockOut || end || "19:00",
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch settings for ManualOverrideModal:", err.message);
      }
    };

    fetchActiveSettings();
    setIsWaived(Boolean(formData.isWaived || formData.isExcused));
    setUserManuallySetStatus(Boolean(formData.id));

    return () => {
      isMounted = false;
    };
  }, [isOpen, formData.id]);

  // Reset errors on open
  useEffect(() => {
    if (isOpen) {
      setErrors({});
    }
  }, [isOpen]);

  // 2. Dynamic Lateness & Penalty Calculation using Active Company Settings
  const latenessCalculation = useMemo(() => {
    const clockInVal = formData.clockIn;
    const startTimeVal = companySettings.workStartTime || "08:00";

    const inMin = parseTimeToMinutes(clockInVal);
    const startMin = parseTimeToMinutes(startTimeVal);

    if (inMin === null || startMin === null) {
      return {
        isLate: false,
        delayMinutes: 0,
        latePenalty: 0,
        tierName: "On Time",
        calculatedStatus: "On Time",
      };
    }

    const delay = inMin - startMin;
    if (delay <= 0) {
      return {
        isLate: false,
        delayMinutes: 0,
        latePenalty: 0,
        tierName: "On Time",
        calculatedStatus: "On Time",
      };
    }

    // Delay > 0 => Late. Match active tiers
    const tiers = companySettings.latenessTiers || DEFAULT_FALLBACK_TIERS;
    let matched = tiers.find((t) => delay >= t.minMinutes && delay <= t.maxMinutes);
    if (!matched) {
      matched = tiers[tiers.length - 1];
    }

    const fineAmount = Number(matched.fine ?? matched.penalty ?? matched.amount ?? 0);
    const safeFine = isNaN(fineAmount) || fineAmount < 0 ? 0 : fineAmount;

    return {
      isLate: true,
      delayMinutes: delay,
      latePenalty: isWaived ? 0 : safeFine,
      rawPenalty: safeFine,
      tierName: matched.name || `Tier ${matched.tier}`,
      calculatedStatus: "Late",
    };
  }, [formData.clockIn, companySettings, isWaived]);

  // 3. Work Hours Calculation
  const workHoursCalculated = useMemo(() => {
    const inMin = parseTimeToMinutes(formData.clockIn);
    const outMin = parseTimeToMinutes(formData.clockOut);
    if (inMin === null || outMin === null) return 0;
    let diff = outMin - inMin;
    if (diff < 0) diff += 24 * 60;
    return Number((diff / 60).toFixed(2));
  }, [formData.clockIn, formData.clockOut]);

  // Auto-sync calculated status and penalty unless manually overridden by admin
  useEffect(() => {
    if (!isOpen || !setFormData) return;

    setFormData((prev) => {
      const updates = {
        ...prev,
        workHours: workHoursCalculated,
        delayMinutes: latenessCalculation.delayMinutes,
        latePenalty: isWaived ? 0 : latenessCalculation.latePenalty,
        penaltyTier: latenessCalculation.tierName,
        isWaived,
      };

      // If user hasn't explicitly chosen a different status from the dropdown
      if (!userManuallySetStatus) {
        updates.status = latenessCalculation.calculatedStatus;
      }

      return updates;
    });
  }, [
    isOpen,
    latenessCalculation,
    workHoursCalculated,
    isWaived,
    userManuallySetStatus,
  ]);

  if (!isOpen) return null;

  const validateField = (name, value) => {
    let err = "";
    if (name === "clockIn" || name === "clockOut") {
      if (value && !isValidTimeFormat(value)) {
        err = "Please enter a valid time (e.g. 08:00 or 19:00)";
      }
    }
    return err;
  };

  const handleTimeChange = (field, value) => {
    const newErrors = { ...errors };
    const fieldError = validateField(field, value);
    if (fieldError) {
      newErrors[field] = fieldError;
    } else {
      delete newErrors[field];
    }
    setErrors(newErrors);

    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleBlur = (field) => {
    const err = validateField(field, formData[field]);
    setErrors((prev) => ({
      ...prev,
      [field]: err,
    }));
  };

  const handleStatusChange = (newStatus) => {
    setUserManuallySetStatus(true);
    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        status: newStatus,
        latePenalty:
          newStatus === "On Time" || newStatus === "Present" || isWaived
            ? 0
            : latenessCalculation.rawPenalty,
      }));
    }
  };

  const handleToggleWaive = (checked) => {
    setIsWaived(checked);
    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        isWaived: checked,
        latePenalty: checked ? 0 : latenessCalculation.rawPenalty,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = {};
    if (formData.clockIn && !isValidTimeFormat(formData.clockIn)) {
      newErrors.clockIn = "Invalid Clock In format (use HH:MM in 24-hour time)";
    }
    if (formData.clockOut && !isValidTimeFormat(formData.clockOut)) {
      newErrors.clockOut = "Invalid Clock Out format (use HH:MM in 24-hour time)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onSave) {
      onSave(e);
    }
  };

  return (
    <AnimatedModal
      isOpen={true}
      onClose={onClose}
      id="manual-override-modal-backdrop"
      className="max-w-lg"
    >
      <div
        id="manual-override-modal-container"
        className="w-full mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-4 bg-slate-50/90 dark:bg-[#162033]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1E48] text-white shadow-xs shrink-0">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0B1E48] dark:text-blue-100 tracking-tight">
                {formData.id ? "Admin Attendance Adjustment" : "Manual Attendance Override"}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {formData.id
                  ? `Modifying record for ${formData.employeeName || "selected employee"}`
                  : "Create a verified retroactive attendance entry"}
              </p>
            </div>
          </div>
          <motion.button
            id="close-manual-override-modal-btn"
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Standard Shift Banner */}
        <div className="bg-slate-100 dark:bg-[#162033]/80 px-5 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#002185] dark:text-blue-400 shrink-0" />
            <span className="font-semibold">Company Standard Shift:</span>
            <span className="font-bold text-[#0B1E48] dark:text-blue-200">
              {format12Hour(companySettings.workStartTime)} – {format12Hour(companySettings.workEndTime)}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Single Source of Truth
          </span>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
          {/* Employee Selector (Only shown for new records) */}
          {!formData.id && (
            <div>
              <label htmlFor="override-employee-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select Employee <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                id="override-employee-select"
                name="employeeId"
                value={formData.employeeId || ""}
                onChange={(e) =>
                  setFormData &&
                  setFormData((prev) => ({
                    ...prev,
                    employeeId: e.target.value,
                  }))
                }
                options={employeeOptions}
                icon={User}
                placeholder="-- Choose an employee --"
                searchable={true}
                searchPlaceholder="Search employees..."
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Date Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Attendance Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="override-date-input"
                type="date"
                required
                value={formData.date || ""}
                onChange={(e) =>
                  setFormData &&
                  setFormData((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1E48]/20 focus:border-[#0B1E48] dark:focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Attendance Status */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="override-status-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status <span className="text-rose-500">*</span>
                </label>
                {latenessCalculation.isLate && !userManuallySetStatus && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                    Auto-selected
                  </span>
                )}
              </div>
              <CustomSelect
                id="override-status-select"
                name="status"
                value={formData.status || "On Time"}
                onChange={(e) => handleStatusChange(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Time Fields (24-hour HH:MM) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Clock In Time
                </label>
                <span className="text-[10px] text-slate-400">Default: {companySettings.workStartTime}</span>
              </div>
              <div className="relative">
                <input
                  id="override-clockin-input"
                  type="time"
                  step="60"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  placeholder="08:00"
                  value={formData.clockIn || ""}
                  onChange={(e) => handleTimeChange("clockIn", e.target.value)}
                  onBlur={() => handleBlur("clockIn")}
                  className={`w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 transition-colors ${
                    errors.clockIn
                      ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-[#0B1E48]/20 focus:border-[#0B1E48] dark:focus:border-blue-500"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              {errors.clockIn && (
                <p className="flex items-center gap-1 text-[11px] text-rose-500 font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.clockIn}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Clock Out Time
                </label>
                <span className="text-[10px] text-slate-400">Default: {companySettings.workEndTime}</span>
              </div>
              <div className="relative">
                <input
                  id="override-clockout-input"
                  type="time"
                  step="60"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  placeholder="19:00"
                  value={formData.clockOut || ""}
                  onChange={(e) => handleTimeChange("clockOut", e.target.value)}
                  onBlur={() => handleBlur("clockOut")}
                  className={`w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 transition-colors ${
                    errors.clockOut
                      ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-[#0B1E48]/20 focus:border-[#0B1E48] dark:focus:border-blue-500"
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              {errors.clockOut && (
                <p className="flex items-center gap-1 text-[11px] text-rose-500 font-medium mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.clockOut}
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Lateness & Shift Calculation Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/80 dark:bg-[#162033]/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Calculated Work Duration:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {workHoursCalculated.toFixed(2)} hours
              </span>
            </div>

            {latenessCalculation.isLate ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Lateness Detected:</span>
                  </div>
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    +{latenessCalculation.delayMinutes} mins past {companySettings.workStartTime}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Penalty Tier:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {latenessCalculation.tierName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Deduction Fine:</span>
                  <span
                    className={`font-bold ${
                      isWaived
                        ? "text-emerald-600 dark:text-emerald-400 line-through"
                        : latenessCalculation.rawPenalty === 0
                        ? "text-[#002185] dark:text-blue-400 font-semibold"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {isWaived
                      ? `GH₵${latenessCalculation.rawPenalty.toFixed(2)}`
                      : latenessCalculation.rawPenalty === 0
                      ? "GH₵0.00 (No deduction applied)"
                      : `GH₵${latenessCalculation.rawPenalty.toFixed(2)}`}
                  </span>
                </div>

                {/* Waive Penalty Toggle */}
                <div className="pt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isWaived}
                      onChange={(e) => handleToggleWaive(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-[#002185] focus:ring-[#002185]/25 w-4 h-4"
                    />
                    <span>Waive Lateness Penalty</span>
                  </label>
                  {isWaived && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Fine Waived (GH₵0.00)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>On-time arrival (at or before {companySettings.workStartTime}). No penalty fine applies.</span>
              </div>
            )}
          </div>

          {/* Reason / Adjustment Note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Adjustment Reason & Audit Log Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="override-notes-input"
              rows={2}
              required
              placeholder="e.g. Approved manual correction by HR administrator due to official duty offsite."
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData &&
                setFormData((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1E48]/20 focus:border-[#0B1E48] dark:focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <motion.button
              id="cancel-override-btn"
              type="button"
              {...buttonPressProps}
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center cursor-pointer"
            >
              Cancel
            </motion.button>
            <motion.button
              id="save-override-btn"
              type="submit"
              {...buttonPressProps}
              disabled={isSaving || Object.keys(errors).some((k) => Boolean(errors[k]))}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0B1E48] hover:bg-[#002185] active:scale-[0.98] rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSaving ? (
                <span>Saving Record...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Override</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
};

export default ManualOverrideModal;
