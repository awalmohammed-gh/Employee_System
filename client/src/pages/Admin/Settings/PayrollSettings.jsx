import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Calendar, Banknote, Plus, X, CheckCircle2 } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updatePayrollSettings } from "../../../apis/fontApis";

const defaultPayroll = {
  currency: "GHS",
  currencySymbol: "₵",
  payrollFrequency: "Monthly",
  paymentDate: 25,
  paymentMethods: ["Bank Transfer", "Mobile Money", "Cash"],
  taxEnabled: true,
  overtimeEnabled: true,
};

const PayrollSettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [payroll, setPayroll] = useState(defaultPayroll);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings?.payroll) {
          setPayroll((prev) => ({
            ...prev,
            ...res.data.settings.payroll,
          }));
        }
      } catch (err) {
        console.warn("Failed to load payroll settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setPayroll((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddPaymentMethod = () => {
    setPayroll((prev) => ({
      ...prev,
      paymentMethods: [...(prev.paymentMethods || []), ""],
    }));
  };

  const handleRemovePaymentMethod = (index) => {
    setPayroll((prev) => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).filter((_, i) => i !== index),
    }));
  };

  const handlePaymentMethodChange = (index, value) => {
    setPayroll((prev) => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).map((item, i) =>
        i === index ? value : item
      ),
    }));
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updatePayrollSettings(payroll);
      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Payroll preferences updated successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save payroll settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update payroll settings.",
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
            Currency
          </label>
          <div className="relative">
            <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={payroll.currency}
              onChange={(e) => {
                const val = e.target.value;
                const symbols = { GHS: "₵", USD: "$", EUR: "€", GBP: "£" };
                setPayroll((prev) => ({
                  ...prev,
                  currency: val,
                  currencySymbol: symbols[val] || prev.currencySymbol,
                }));
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            >
              <option value="GHS">GHS - Ghana Cedis (GH₵)</option>
              <option value="USD">USD - US Dollar ($)</option>
              <option value="EUR">EUR - Euro (€)</option>
              <option value="GBP">GBP - British Pound (£)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Currency Symbol
          </label>
          <div className="relative">
            <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={payroll.currencySymbol}
              onChange={(e) => handleChange("currencySymbol", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Payroll Frequency
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={payroll.payrollFrequency}
              onChange={(e) => handleChange("payrollFrequency", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            >
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Bi-Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Payment Date (Day of Month)
          </label>
          <div className="relative">
            <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="1"
              max="31"
              value={payroll.paymentDate}
              onChange={(e) =>
                handleChange("paymentDate", parseInt(e.target.value) || 25)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Accepted Payment Methods
        </label>
        <div className="space-y-2.5">
          {(payroll.paymentMethods || []).map((method, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={method}
                onChange={(e) => handlePaymentMethodChange(index, e.target.value)}
                placeholder="e.g. Bank Transfer, Mobile Money"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemovePaymentMethod(index)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
                disabled={(payroll.paymentMethods || []).length <= 1}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddPaymentMethod}
            className="flex items-center gap-1.5 text-xs font-bold text-[#ff5500] hover:text-[#002185] transition mt-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment Method</span>
          </button>
        </div>
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
          <span>{isSaving ? "Saving Payroll..." : "Save Payroll Settings"}</span>
        </button>
      </div>
    </form>
  );
};

export default PayrollSettings;
