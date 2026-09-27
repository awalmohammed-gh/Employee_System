import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { X, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";

const FLAG_CATEGORIES = [
  { id: "unverified", label: "Unverified / Chronic Tardiness Pattern" },
  { id: "discrepancy", label: "Clock Punch Discrepancy / Early Departure" },
  { id: "unapproved_ot", label: "Unapproved Overtime / Irregular Hours" },
  { id: "disciplinary", label: "Escalated for HR Disciplinary Hearing" },
  { id: "policy", label: "Time & Attendance Policy Violation" },
  { id: "custom", label: "Custom Review Notice..." },
];

const FlagAttendanceModal = ({
  isOpen,
  onClose,
  record,
  onConfirm,
  isLoading = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState("unverified");
  const [customReason, setCustomReason] = useState("");
  const [severity, setSeverity] = useState("warning");

  useEffect(() => {
    if (record) {
      setSelectedCategory("unverified");
      setCustomReason(record.flagReason || "");
      setSeverity("warning");
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const empName =
    record.employee?.fullName ||
    record.employee?.name ||
    record.employeeName ||
    "Employee";
  const empCode =
    record.employee?.employeeId ||
    record.employeeId ||
    record.employee?._id ||
    "EMP";
  const empDept = record.employee?.department || "General";

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason =
      selectedCategory === "custom" || !selectedCategory
        ? customReason.trim() || "Flagged for administrative review"
        : FLAG_CATEGORIES.find((c) => c.id === selectedCategory)?.label +
          (customReason.trim() ? ` — ${customReason.trim()}` : "");

    onConfirm({
      reason: finalReason,
      severity,
    });
  };

  return (
    <div
      id="modal-flag-attendance"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-auto bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#162033]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#002185] dark:text-blue-300">
                Flag Attendance Record
              </h3>
              <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-slate-400">
                Mark entry for HR investigation, supervisor audit, or policy enforcement
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-flag-modal"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#002185] dark:hover:text-slate-200 hover:bg-[#E2E8F0]/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1 text-sm">
          {/* Employee & Record Brief */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#162033]/50 border border-[#E2E8F0] dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#002185] text-white flex items-center justify-center text-xs font-bold">
                  {empName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-[#002185] dark:text-blue-300 text-sm">{empName}</p>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    ID: {empCode} • {empDept}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-3 h-3" />
                {record.status || "Attendance Log"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0] dark:border-slate-700 text-xs">
              <div>
                <span className="text-[#64748B] dark:text-slate-400">Log Date: </span>
                <span className="font-semibold text-[#334155] dark:text-slate-200">
                  {record.date}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] dark:text-slate-400">Hours: </span>
                <span className="font-semibold text-[#334155] dark:text-slate-200">
                  {record.workHours || 0} hrs
                </span>
              </div>
            </div>
          </div>

          {/* Preset Categories */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#002185] dark:text-blue-300 uppercase tracking-wider">
              Flag Reason Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FLAG_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs"
                        : "bg-white dark:bg-[#162033] border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-300 hover:border-amber-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="truncate pr-1">{cat.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#002185] dark:text-blue-300">
              Alert Severity Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSeverity("info")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                  severity === "info"
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                    : "border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                }`}
              >
                Informational
              </button>
              <button
                type="button"
                onClick={() => setSeverity("warning")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                  severity === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300 shadow-2xs"
                    : "border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                }`}
              >
                Warning
              </button>
              <button
                type="button"
                onClick={() => setSeverity("high")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                  severity === "high"
                    ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300 shadow-2xs"
                    : "border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800"
                }`}
              >
                High
              </button>
            </div>
          </div>

          {/* Detailed Comment */}
          <div className="space-y-1.5">
            <label
              htmlFor="flag-custom-notes"
              className="block text-xs font-bold text-[#002185] dark:text-blue-300"
            >
              Auditor / Manager Investigation Note
            </label>
            <textarea
              id="flag-custom-notes"
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g. Employee clocked in 45m after shift start without advance notice. Escalate to HR."
              className="w-full rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#162033] px-3 py-2 text-xs text-[#334155] dark:text-slate-200 placeholder-[#94A3B8] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-[#E2E8F0] dark:border-slate-800">
            <button
              type="button"
              id="btn-cancel-flag"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-white bg-white dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-slate-700 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-flag"
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Flagging...</span>
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5" />
                  <span>Flag for Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlagAttendanceModal;
