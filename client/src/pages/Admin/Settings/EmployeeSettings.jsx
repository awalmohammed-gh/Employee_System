import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Users, CheckCircle2 } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updateEmployeeSettings } from "../../../apis/fontApis";

const defaultEmployee = {
  autoGenerateEmployeeId: true,
  employeeIdPrefix: "EMP-",
  defaultProbationMonths: 3,
  defaultNoticePeriodDays: 30,
};

const EmployeeSettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [employee, setEmployee] = useState(defaultEmployee);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings?.employee) {
          setEmployee((prev) => ({
            ...prev,
            ...res.data.settings.employee,
          }));
        }
      } catch (err) {
        console.warn("Failed to load employee settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setEmployee((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updateEmployeeSettings(employee);
      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Employee defaults saved successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save employee settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update employee settings.",
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
            Employee ID Prefix
          </label>
          <div className="relative">
            <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={employee.employeeIdPrefix}
              onChange={(e) => handleChange("employeeIdPrefix", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Default Probation Period (Months)
          </label>
          <input
            type="number"
            min="0"
            max="24"
            value={employee.defaultProbationMonths}
            onChange={(e) =>
              handleChange(
                "defaultProbationMonths",
                parseInt(e.target.value) || 0
              )
            }
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Default Notice Period (Days)
          </label>
          <input
            type="number"
            min="0"
            max="180"
            value={employee.defaultNoticePeriodDays}
            onChange={(e) =>
              handleChange(
                "defaultNoticePeriodDays",
                parseInt(e.target.value) || 0
              )
            }
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="space-y-3.5 bg-slate-50 dark:bg-[#162033]/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={employee.autoGenerateEmployeeId}
            onChange={(e) =>
              handleChange("autoGenerateEmployeeId", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Auto-generate sequential Employee ID for new staff
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              System automatically computes and assigns the next available unique employee identifier
            </span>
          </div>
        </label>
      </div>

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
          <span>{isSaving ? "Saving Employee Defaults..." : "Save Employee Settings"}</span>
        </button>
      </div>
    </form>
  );
};

export default EmployeeSettings;
