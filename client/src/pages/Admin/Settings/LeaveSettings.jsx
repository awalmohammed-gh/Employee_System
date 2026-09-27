import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Calendar, CheckCircle2 } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updateLeaveSettings } from "../../../apis/fontApis";

const defaultLeave = {
  annualLeaveDays: 20,
  sickLeaveDays: 10,
  casualLeaveDays: 5,
  maternityLeaveDays: 90,
  paternityLeaveDays: 5,
  requireApproval: true,
};

const LeaveSettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [leave, setLeave] = useState(defaultLeave);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings?.leave) {
          setLeave((prev) => ({
            ...prev,
            ...res.data.settings.leave,
          }));
        }
      } catch (err) {
        console.warn("Failed to load leave settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setLeave((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updateLeaveSettings(leave);
      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Leave policy configurations saved successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save leave settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update leave settings.",
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
            Annual Leave (Days/Year)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="0"
              max="100"
              value={leave.annualLeaveDays}
              onChange={(e) =>
                handleChange("annualLeaveDays", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Sick Leave (Days/Year)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="0"
              max="100"
              value={leave.sickLeaveDays}
              onChange={(e) =>
                handleChange("sickLeaveDays", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Casual Leave (Days/Year)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="0"
              max="100"
              value={leave.casualLeaveDays}
              onChange={(e) =>
                handleChange("casualLeaveDays", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Maternity Leave (Days)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="0"
              max="365"
              value={leave.maternityLeaveDays}
              onChange={(e) =>
                handleChange("maternityLeaveDays", parseInt(e.target.value) || 0)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Approval Toggle */}
      <div className="space-y-3.5 bg-slate-50 dark:bg-[#162033]/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={leave.requireApproval}
            onChange={(e) =>
              handleChange("requireApproval", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Require Manager / Admin Approval for All Leaves
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              When checked, leave requests remain in 'pending' status until reviewed
            </span>
          </div>
        </label>
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
          <span>{isSaving ? "Saving Leave Policy..." : "Save Leave Policy"}</span>
        </button>
      </div>
    </form>
  );
};

export default LeaveSettings;
