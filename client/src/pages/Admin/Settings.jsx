import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  User,
  Shield,
  Building2,
  Clock,
  Calendar,
  Users,
  AlertTriangle,
  RefreshCw,
  History,
  Palette,
  Banknote,
} from "lucide-react";
import { useManagement } from "../../context/ManagementContextProvider";
import { getAdminProfile, getSettings } from "../../apis/fontApis";
import ErrorBoundary from "../../components/ErrorBoundary";
import { useBranding } from "../../context/BrandingContext";
import { ui } from "./ui/tokens";

// Tab Sub-Components
import ProfileSettings from "./Settings/ProfileSettings";
import SecuritySettings from "./Settings/SecuritySettings";
import CompanySettings from "./Settings/CompanySettings";
import PayrollSettings from "./Settings/PayrollSettings";
import AttendanceSettings from "./Settings/AttendanceSettings";
import PenaltySettings from "./Settings/PenaltySettings";
import LeaveSettings from "./Settings/LeaveSettings";
import EmployeeSettings from "./Settings/EmployeeSettings";
import AuditLogView from "../../components/AuditLogView";
import ThemePreferenceCard from "../../components/ThemePreferenceCard";

const TABS = [
  { id: "profile", label: "Profile Info", icon: User, desc: "Personal & admin account credentials" },
  { id: "appearance", label: "Appearance & Theme", icon: Palette, desc: "Light, dark & system color mode selection" },
  { id: "security", label: "Security", icon: Shield, desc: "2FA, session policies & login defense" },
  { id: "company", label: "Company", icon: Building2, desc: "Organization profile, appearance, hours & currency" },
  { id: "payroll", label: "Payroll", icon: Banknote, desc: "Payment cycles, taxes & disbursement" },
  { id: "attendance", label: "Attendance", icon: Clock, desc: "Work schedules, grace periods & overtime" },
  { id: "penalties", label: "Penalties & Deductions", icon: AlertTriangle, desc: "Absence deductions & lateness penalty tiers" },
  { id: "leave", label: "Leave Policy", icon: Calendar, desc: "Annual, sick leave quotas & approvals" },
  { id: "employee", label: "Employee Rules", icon: Users, desc: "ID prefixes, probation & notice periods" },
  { id: "audit", label: "Audit Trail & Logs", icon: History, desc: "Track who modified penalty rates and settings" },
];

const SettingsContent = () => {
  const { user, setUser, setShowToast } = useManagement();
  const [activeTab, setActiveTab] = useState("profile");
  const sectionRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Safe fetch data on mount without triggering re-render loops
  const fetchAllSettings = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [profileRes] = await Promise.allSettled([
        getAdminProfile(),
        getSettings(),
      ]);

      // Handle profile data
      if (profileRes.status === "fulfilled" && profileRes.value?.data?.success && profileRes.value.data.admin) {
        const adm = profileRes.value.data.admin;
        setUser((prev) => {
          // Prevent unnecessary context updates if data is identical
          if (
            prev?.id === adm.id &&
            prev?.fullName === adm.fullName &&
            prev?.email === adm.email
          ) {
            return prev;
          }
          return { ...prev, ...adm };
        });
      }
    } catch (err) {
      console.warn("Failed to load settings data:", err?.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    fetchAllSettings();
  }, [fetchAllSettings]);

  const handleRefresh = () => {
    fetchAllSettings(true);
    setShowToast({
      show: true,
      message: "Syncing settings with database...",
      type: "info",
    });
  };

  const handleSaveNotification = () => {
    // Silently re-sync in background after tab saves
    fetchAllSettings(true);
  };

  const { companyName } = useBranding() || {};

  if (isLoading) {
    const orgTitle = companyName ? `${companyName} System Settings` : "System Settings";
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 text-center bg-white dark:bg-[#111927] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="relative mb-4">
          <div className="h-12 w-12 rounded-2xl bg-[#002185]/10 dark:bg-blue-900/30 flex items-center justify-center text-[#002185] dark:text-blue-400">
            <WorkspaceLoader inline />
          </div>
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Loading {orgTitle}...
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Fetching live administration configuration and account parameters from database...
        </p>
      </div>
    );
  }

  // On phones/tablets the section content sits below the navigation grid; bring it into view.
  const selectTab = (id) => {
    setActiveTab(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveIcon = activeTabMeta.icon;

  return (
    <div className={`${ui.page} overflow-x-hidden`}>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
        {/* Section navigation: wrapping grid below lg (every section visible on phones), vertical list on desktop */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6 min-w-0">
          <div className={`${ui.card} p-2 lg:p-3`}>
            <p className={`${ui.eyebrow} hidden lg:block px-3 pt-1 pb-2`}>Configuration</p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:flex lg:flex-col gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <li key={tab.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => selectTab(tab.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative w-full h-full flex items-center gap-2 lg:gap-3 px-2.5 lg:px-3 py-2 lg:py-2.5 rounded-xl text-left lg:whitespace-nowrap transition-colors cursor-pointer ${ui.focusRing} ${
                        isActive
                          ? "bg-[#002185]/[0.07] text-[#002185] dark:bg-blue-500/10 dark:text-blue-300"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white"
                      }`}
                    >
                      {isActive && (
                        <span aria-hidden="true" className="hidden lg:block absolute left-0 top-2.5 bottom-2.5 w-0.75 rounded-r-full bg-[#ff5500]" />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-slate-400"}`} />
                      <span className="min-w-0">
                        <span className={`block text-xs sm:text-sm leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
                        <span className="hidden lg:block text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{tab.desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:flex items-center gap-3 mt-3 pt-3 px-3 pb-1 border-t border-slate-100 dark:border-slate-800">
              <span className="w-8 h-8 rounded-lg grid place-items-center text-xs font-semibold bg-[#002185] text-white dark:bg-blue-600 shrink-0">
                {(user?.fullName || user?.full_name || "A").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user?.fullName || user?.full_name || "Administrator"}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || ""}</span>
              </span>
            </div>
          </div>
        </nav>

        {/* Active section */}
        <section ref={sectionRef} className={`${ui.card} p-5 sm:p-7 min-w-0 scroll-mt-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-10 h-10 rounded-xl shrink-0 bg-[#002185]/[0.07] text-[#002185] dark:bg-blue-500/10 dark:text-blue-300">
                <ActiveIcon className="w-5 h-5" />
              </span>
              <div>
                <h2 className={ui.h2}>{activeTabMeta.label}</h2>
                <p className={ui.caption}>{activeTabMeta.desc}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`${ui.btnSecondary} ${ui.btnSm} self-start sm:self-auto`}
              title="Reload settings from database"
            >
              {(isRefreshing) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>

          {activeTab === "profile" && <ProfileSettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <ThemePreferenceCard />
            </div>
          )}
          {activeTab === "security" && <SecuritySettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "company" && <CompanySettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "payroll" && <PayrollSettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "attendance" && <AttendanceSettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "penalties" && <PenaltySettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "leave" && <LeaveSettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "employee" && <EmployeeSettings onSaveSuccess={handleSaveNotification} />}
          {activeTab === "audit" && <AuditLogView />}
        </section>
      </div>
    </div>
  );
};

const Settings = () => {
  return (
    <ErrorBoundary title="Admin Settings View">
      <SettingsContent />
    </ErrorBoundary>
  );
};

export default Settings;
