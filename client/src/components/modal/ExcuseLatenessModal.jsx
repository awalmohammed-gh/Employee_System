import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { X, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import CustomSelect from "../CustomSelect";

const PRESET_EXCUSES = [
  { id: "medical", label: "Medical Emergency / Doctor's Note" },
  { id: "transit", label: "Severe Weather / Public Transit Delay" },
  { id: "duty", label: "Approved External Client Meeting / Official Duty" },
  { id: "biometric", label: "Biometric Device / Scanner Glitch" },
  { id: "manager", label: "Manager Discretionary Exception" },
  { id: "custom", label: "Custom Justification..." },
];

const EXCUSE_STATUS_OPTIONS = [
  { value: "Present", label: "Present (Excused)" },
  { value: "On Time", label: "On Time" },
  { value: "Late", label: "Keep 'Late' (Penalty 0 Only)" },
];

const ExcuseLatenessModal = ({
  isOpen,
  onClose,
  record,
  onConfirm,
  isLoading = false,
}) => {
  const [selectedPreset, setSelectedPreset] = useState("medical");
  const [customReason, setCustomReason] = useState("");
  const [targetStatus, setTargetStatus] = useState("Present");
  const [waivePenalty, setWaivePenalty] = useState(true);

  useEffect(() => {
    if (record) {
      setSelectedPreset("medical");
      setCustomReason(record.excuseReason || "");
      setTargetStatus("Present");
      setWaivePenalty(true);
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
  const lateMin = record.delayMinutes || record.lateMinutes || 0;
  const lateFee = record.latePenalty || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason =
      selectedPreset === "custom" || !selectedPreset
        ? customReason.trim() || "Excused by manager"
        : PRESET_EXCUSES.find((p) => p.id === selectedPreset)?.label +
          (customReason.trim() ? ` — ${customReason.trim()}` : "");

    onConfirm({
      reason: finalReason,
      status: targetStatus,
      waivePenalty,
    });
  };

  return (
    <div
      id="modal-excuse-lateness"
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
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#002185] dark:text-blue-300">
                Excuse Lateness Entry
              </h3>
              <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-slate-400">
                Waive payroll penalties and record management justification
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-excuse-modal"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#002185] dark:hover:text-slate-200 hover:bg-[#E2E8F0]/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[85vh] sm:max-h-[80vh] flex-1 text-sm">
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
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3 h-3" />
                {lateMin > 0 ? `${lateMin} min delay` : "Marked Late"}
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
                <span className="text-[#64748B] dark:text-slate-400">Current Penalty: </span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  GH₵ {Number(lateFee).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Preset Reasons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#002185] dark:text-blue-300 uppercase tracking-wider">
              Select Justification Reason
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_EXCUSES.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs"
                        : "bg-white dark:bg-[#162033] border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-300 hover:border-emerald-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="truncate pr-1">{preset.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Notes / Custom Explanation */}
          <div className="space-y-1.5">
            <label
              htmlFor="excuse-custom-notes"
              className="block text-xs font-bold text-[#002185] dark:text-blue-300"
            >
              Manager Notes / Specific Details
            </label>
            <textarea
              id="excuse-custom-notes"
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g. Doctor's receipt confirmed via email. Waived per HR policy."
              className="w-full rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[#162033] px-3 py-2 text-xs text-[#334155] dark:text-slate-200 placeholder-[#94A3B8] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition-all"
            />
          </div>

          {/* Configuration Options */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0] dark:border-slate-700">
            <div className="space-y-1.5">
              <label
                htmlFor="target-status-select"
                className="block text-xs font-semibold text-[#334155] dark:text-slate-300"
              >
                Update Attendance Status to:
              </label>
              <CustomSelect
                id="target-status-select"
                name="targetStatus"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                options={EXCUSE_STATUS_OPTIONS}
              />
            </div>

            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 cursor-pointer">
              <input
                type="checkbox"
                checked={waivePenalty}
                onChange={(e) => setWaivePenalty(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span className="text-xs text-emerald-900 dark:text-emerald-300 font-medium">
                Waive payroll lateness deduction (Sets penalty to GH₵ 0.00)
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-[#E2E8F0] dark:border-slate-800">
            <button
              type="button"
              id="btn-cancel-excuse"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#002185] dark:hover:text-white bg-white dark:bg-[#162033] border border-[#E2E8F0] dark:border-slate-700 rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-slate-700 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-excuse"
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Excuse Lateness</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExcuseLatenessModal;
