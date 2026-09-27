import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect, useId } from "react";
import { AlertTriangle, Clock, CheckCircle2, Info, Layers, History } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { useBranding } from "../../../context/BrandingContext";
import { getPenaltySettings, updatePenaltySettings } from "../../../apis/fontApis";
import AuditLogView from "../../../components/AuditLogView";

const defaultPenaltyConfig = {
  workStartTime: "08:00",
  absenceDeductionRate: 10,
  lateTier1_amount: 0,
  lateTier2_amount: 0,
  lateTier3_amount: 0,
  lateTier4_amount: 0,
  lateTier5_amount: 0,
  lateTier6_amount: 0,
};

const LATENESS_TIER_META = [
  {
    key: "lateTier1_amount",
    label: "Tier 1: 1 - 30 Minutes Late",
    range: "1 - 30 mins",
    desc: "Minor lateness penalty per occurrence",
    badge: "Short Delay",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "lateTier2_amount",
    label: "Tier 2: 31 - 60 Minutes (1 hr) Late",
    range: "31 - 60 mins",
    desc: "Moderate lateness up to 1 hour delay",
    badge: "1 Hour Delay",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "lateTier3_amount",
    label: "Tier 3: 1 - 2 Hours Late",
    range: "61 - 120 mins",
    desc: "Significant morning delay (1 - 2 hrs)",
    badge: "1-2 Hours",
    badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    key: "lateTier4_amount",
    label: "Tier 4: 2 - 3 Hours Late",
    range: "121 - 180 mins",
    desc: "Substantial work shift disruption (2 - 3 hrs)",
    badge: "2-3 Hours",
    badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    key: "lateTier5_amount",
    label: "Tier 5: 3 - 4 Hours Late",
    range: "181 - 240 mins",
    desc: "Near half-day absence delay (3 - 4 hrs)",
    badge: "3-4 Hours",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  {
    key: "lateTier6_amount",
    label: "Tier 6: 4 - 5+ Hours Late",
    range: "241 - 300+ mins",
    desc: "Severe delay exceeding half of standard shift",
    badge: "4-5+ Hours",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  },
];

const PenaltySettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [penalties, setPenalties] = useState(defaultPenaltyConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const workStartTimeId = useId();
  const absenceRateId = useId();

  const fetchPenalties = async () => {
    try {
      setIsLoading(true);
      const res = await getPenaltySettings();
      if (res?.data?.success) {
        const data = res.data.settings || res.data.penalties || {};
        setPenalties({
          workStartTime: data.workStartTime || "08:00",
          absenceDeductionRate: Number(data.absenceDeductionRate !== undefined ? data.absenceDeductionRate : 10),
          lateTier1_amount: Number(data.lateTier1_amount || 0),
          lateTier2_amount: Number(data.lateTier2_amount || 0),
          lateTier3_amount: Number(data.lateTier3_amount || 0),
          lateTier4_amount: Number(data.lateTier4_amount || 0),
          lateTier5_amount: Number(data.lateTier5_amount || 0),
          lateTier6_amount: Number(data.lateTier6_amount || 0),
        });
      }
    } catch (err) {
      console.warn("Failed to load penalty settings:", err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPenalties();
  }, []);

  const handleChange = (field, value) => {
    setPenalties((prev) => ({
      ...prev,
      [field]: field === "workStartTime" ? value : Math.max(0, Number(value) || 0),
    }));
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updatePenaltySettings(penalties);
      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Attendance penalty settings saved and synchronized across all active employees successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      } else {
        setShowToast({
          show: true,
          message: res?.data?.message || "Failed to update penalty settings.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Failed to save penalty settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to save penalty settings.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const { companyName } = useBranding() || {};

  if (isLoading) {
    const displayName = companyName || "Workspace";
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#111927] rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
        <WorkspaceLoader compact title="" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Loading {displayName} deduction and penalty configuration...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Overview Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-blue-50/60 dark:bg-[#111927] p-6 sm:p-8 border border-blue-100 dark:border-blue-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#002185] text-white flex items-center justify-center shadow-md shadow-[#002185]/20 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Attendance Penalty & Deduction Rules
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                Configure global deduction rules for unexcused employee absences and tiered lateness penalties.
                These values are stored as the company singleton standard and automatically applied by the payroll engine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              id="btn-open-penalty-audit-modal"
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              View Audit History
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Payroll Engine Active
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Work Shift & Absence Policy */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-[#002185] dark:text-blue-400 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Shift Baseline & Absence Deduction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set standard work start time and flat daily deduction for unexcused absences
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Work Shift Start Time */}
          <div className="space-y-2">
            <label
              htmlFor={workStartTimeId}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Standard Work Shift Start Time
            </label>
            <div className="relative">
              <input
                id={workStartTimeId}
                type="time"
                value={penalties.workStartTime}
                onChange={(e) => handleChange("workStartTime", e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162033] text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002185]/20 focus:border-[#002185]"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check-ins recorded after this time will be classified as Late and matched to penalty tiers.
            </p>
          </div>

          {/* Absence Deduction Rate */}
          <div className="space-y-2">
            <label
              htmlFor={absenceRateId}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Per Day Absence Deduction (GH₵)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                GH₵
              </div>
              <input
                id={absenceRateId}
                type="number"
                min="0"
                step="1"
                value={penalties.absenceDeductionRate}
                onChange={(e) => handleChange("absenceDeductionRate", e.target.value)}
                className="w-full h-11 pl-12 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162033] text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002185]/20 focus:border-[#002185]"
                placeholder="10"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Flat deduction applied globally to all employees for each recorded unexcused absent day.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Dynamic Lateness Penalty Tiers */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Dynamic Lateness Penalty Tiers (6 Tiers)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specify the flat penalty in GH₵ deducted per occurrence based on minutes delayed
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300">
            Per-Event Deductions
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LATENESS_TIER_META.map((tier) => (
            <div
              key={tier.key}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033]/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {tier.range}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${tier.badgeColor}`}>
                  {tier.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">
                {tier.desc}
              </p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                  GH₵
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={penalties[tier.key]}
                  onChange={(e) => handleChange(tier.key, e.target.value)}
                  className="w-full h-10 pl-11 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162033] text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#002185]/20 focus:border-[#002185]"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="h-4 w-4 text-[#002185] dark:text-blue-400 shrink-0" />
          <span>
            Changes take immediate effect across all monthly payroll calculations and payslips.
          </span>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-[#002185] hover:bg-[#001866] text-white font-bold text-sm shadow-md shadow-[#002185]/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <WorkspaceLoader inline />
              Saving Rules...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Save Penalty Settings
            </>
          )}
        </button>
      </div>

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <AuditLogView
              filterCategory="Penalties & Deductions"
              isModal={true}
              onClose={() => setShowAuditModal(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
};

export default PenaltySettings;
