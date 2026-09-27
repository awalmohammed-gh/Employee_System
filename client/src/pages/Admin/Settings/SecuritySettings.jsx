import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { Shield, Clock, Key, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updateSecuritySettings } from "../../../apis/fontApis";

const defaultSecurity = {
  twoFactorAuthentication: false,
  maxLoginAttempts: 5,
  sessionTimeout: 30,
  passwordExpiryDays: 90,
  loginNotifications: true,
};

const SecuritySettings = ({ onSaveSuccess }) => {
  const { setShowToast } = useManagement();
  const [security, setSecurity] = useState(defaultSecurity);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        if (isMounted && res?.data?.success && res.data.settings?.security) {
          setSecurity((prev) => ({
            ...prev,
            ...res.data.settings.security,
          }));
        }
      } catch (err) {
        console.warn("Failed to load security settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setSecurity((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      const res = await updateSecuritySettings(security);
      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Security preferences updated successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save security settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update security settings.",
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
            Max Login Attempts
          </label>
          <div className="relative">
            <AlertTriangle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="1"
              max="20"
              value={security.maxLoginAttempts}
              onChange={(e) =>
                handleChange("maxLoginAttempts", parseInt(e.target.value) || 5)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Session Timeout (Minutes)
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="5"
              max="1440"
              value={security.sessionTimeout}
              onChange={(e) =>
                handleChange("sessionTimeout", parseInt(e.target.value) || 30)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Password Expiry (Days)
          </label>
          <div className="relative">
            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="15"
              max="365"
              value={security.passwordExpiryDays}
              onChange={(e) =>
                handleChange("passwordExpiryDays", parseInt(e.target.value) || 90)
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Security Checkbox Preferences */}
      <div className="space-y-3.5 bg-slate-50 dark:bg-[#162033]/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={security.twoFactorAuthentication}
            onChange={(e) =>
              handleChange("twoFactorAuthentication", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Enable Two-Factor Authentication (2FA)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Require an OTP or authenticator code during admin sign-in
            </span>
          </div>
        </label>

        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={security.loginNotifications}
            onChange={(e) =>
              handleChange("loginNotifications", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Send Login Activity Notifications
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Notify system administrators of new login sessions and IP changes
            </span>
          </div>
        </label>
      </div>

      {/* Security Guidance Note */}
      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              Security Best Practices
            </h4>
            <ul className="text-[11px] text-amber-800/80 dark:text-amber-400/80 space-y-0.5">
              <li>• Always enforce session timeouts of 30 minutes or less on shared workstations</li>
              <li>• Restrict consecutive failed login attempts to prevent brute-force intrusion</li>
            </ul>
          </div>
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
          <span>{isSaving ? "Saving Security..." : "Save Security Settings"}</span>
        </button>
      </div>
    </form>
  );
};

export default SecuritySettings;
