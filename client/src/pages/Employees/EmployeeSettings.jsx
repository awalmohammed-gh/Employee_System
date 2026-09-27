import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { User, Mail, Phone, Building2, Briefcase, Shield, Save, Lock, Eye, EyeOff, Palette, Bell, CheckCircle2, Clock, Globe, ShieldCheck, Volume2, Hash, Award, Banknote } from "lucide-react";
import { useManagement } from "../../context/ManagementContextProvider";
import ThemePreferenceCard from "../../components/ThemePreferenceCard";
import {
  getEmployeeMe,
  updateEmployeeMe,
  changeEmployeePassword,
} from "../../apis/fontApis";
import ProfilePictureUploader from "../../components/ProfilePictureUploader";
import QuarterlyPerformanceVisualizer from "../../components/QuarterlyPerformanceVisualizer";
import Loading from "../../ui/Loading";
import ErrorMessage from "../../ui/ErrorMessage";
import { ui, selectChevronStyle } from "./ui/tokens";
import { Badge, Card, CardHeader } from "./ui/primitives";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "performance", label: "Performance", icon: Award },
  { id: "security", label: "Security", icon: Shield },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const PREFERENCES_STORAGE_KEY = "employee_user_preferences";
const NOTIFICATIONS_STORAGE_KEY = "employee_user_notifications";

const EmployeeSettings = () => {
  const { user, setUser, setShowToast } = useManagement();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form State
  const [profile, setProfile] = useState({
    fullName: user?.fullName || user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
    position: user?.position || "",
    employeeId: user?.employeeId || user?.employee_id || "",
    employmentDate: user?.employmentDate || user?.employment_date || "",
    role: user?.role || "employee",
    avatar: user?.avatar || user?.profile_image_url || user?.profile_picture || "",
    status: user?.status || "active",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isError, setIsError] = useState(null);

  // Security Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Theme & Preferences State
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    return {
      currency: "GHS",
      timeFormat: "12h",
      dateFormat: "DD/MM/YYYY",
      weekStart: "monday",
      language: "en-US",
    };
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    return {
      emailPayslip: true,
      emailLeaveStatus: true,
      emailAnnouncements: true,
      emailAttendanceReminders: false,
      inAppUrgentAlerts: true,
      inAppSound: true,
      weeklySummary: false,
    };
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Fetch initial profile
  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setIsError(null);
      const res = await getEmployeeMe();
      if (res?.data?.success && res.data.employee) {
        const emp = res.data.employee;
        const resolvedData = {
          fullName: emp.fullName || emp.full_name || "",
          email: emp.email || "",
          phone: emp.phone || "",
          department: emp.department || "",
          position: emp.position || "",
          employeeId: emp.employeeId || emp.employee_id || "",
          employmentDate: emp.employmentDate || emp.employment_date || "",
          role: emp.role || "employee",
          avatar: emp.profilePicture || emp.avatar || emp.profile_image_url || emp.profile_picture || emp.avatarUrl || "",
          status: emp.status || "active",
        };
        setProfile(resolvedData);
        setUser((prev) => ({ ...prev, ...resolvedData }));
      } else if (user) {
        setProfile({
          fullName: user.fullName || user.full_name || "",
          email: user.email || "",
          phone: user.phone || "",
          department: user.department || "",
          position: user.position || "",
          employeeId: user.employeeId || user.employee_id || "",
          employmentDate: user.employmentDate || user.employment_date || "",
          role: user.role || "employee",
          avatar: user.profilePicture || user.avatar || user.profile_image_url || user.profile_picture || user.avatarUrl || "",
          status: user.status || "active",
        });
      }
    } catch (err) {
      console.warn("Error fetching employee profile:", err.message);
      if (user) {
        setProfile({
          fullName: user.fullName || user.full_name || "",
          email: user.email || "",
          phone: user.phone || "",
          department: user.department || "",
          position: user.position || "",
          employeeId: user.employeeId || user.employee_id || "",
          employmentDate: user.employmentDate || user.employment_date || "",
          role: user.role || "employee",
          avatar: user.profilePicture || user.avatar || user.profile_image_url || user.profile_picture || user.avatarUrl || "",
          status: user.status || "active",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Save Profile Handler
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const avatarUrlToSave =
        profile.avatar ||
        profile.profilePicture ||
        profile.profile_image_url ||
        "";

      const res = await updateEmployeeMe({
        fullName: profile.fullName,
        phone: profile.phone,
        avatar: avatarUrlToSave,
        profilePicture: avatarUrlToSave,
        profile_picture: avatarUrlToSave,
        profile_image_url: avatarUrlToSave,
      });

      if (res?.data?.success) {
        const updated = res.data.employee || profile;
        const merged = {
          ...profile,
          ...updated,
          avatar: avatarUrlToSave,
          profilePicture: avatarUrlToSave,
        };
        setUser((prev) => ({ ...prev, ...merged }));
        setShowToast({
          show: true,
          message: "Profile details updated successfully!",
          type: "success",
        });
      } else {
        setShowToast({
          show: true,
          message: res?.data?.message || "Failed to update profile details.",
          type: "error",
        });
      }
    } catch (err) {
      setShowToast({
        show: true,
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to save profile.",
        type: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password Strength Calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "None", color: "bg-slate-200 dark:bg-slate-700", text: "text-slate-400" };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
      case 2:
        return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
      case 3:
        return { score: 3, label: "Good", color: "bg-blue-600", text: "text-blue-600 dark:text-blue-400" };
      case 4:
        return { score: 4, label: "Strong", color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
      default:
        return { score: 0, label: "Very Weak", color: "bg-rose-400", text: "text-rose-500" };
    }
  };

  const passwordStrength = calculatePasswordStrength(passwordForm.newPassword);

  // Update Password Handler
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setShowToast({
        show: true,
        message: "Please fill in all password fields.",
        type: "error",
      });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setShowToast({
        show: true,
        message: "New password must be at least 6 characters long.",
        type: "error",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setShowToast({
        show: true,
        message: "New passwords do not match.",
        type: "error",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await changeEmployeePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: res.data.message || "Password updated successfully!",
          type: "success",
        });
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setShowToast({
          show: true,
          message: res?.data?.message || "Failed to update password.",
          type: "error",
        });
      }
    } catch (err) {
      setShowToast({
        show: true,
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to update password.",
        type: "error",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Save Preferences Handler
  const handleSavePreferences = (e) => {
    e.preventDefault();
    setIsSavingPreferences(true);
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      setTimeout(() => {
        setIsSavingPreferences(false);
        setShowToast({
          show: true,
          message: "Preferences saved successfully!",
          type: "success",
        });
      }, 300);
    } catch {
      setIsSavingPreferences(false);
      setShowToast({
        show: true,
        message: "Failed to save preferences to local storage.",
        type: "error",
      });
    }
  };

  // Save Notifications Handler
  const handleSaveNotifications = (e) => {
    e.preventDefault();
    setIsSavingNotifications(true);
    try {
      localStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(notifications)
      );
      setTimeout(() => {
        setIsSavingNotifications(false);
        setShowToast({
          show: true,
          message: "Notification preferences updated successfully!",
          type: "success",
        });
      }, 300);
    } catch {
      setIsSavingNotifications(false);
      setShowToast({
        show: true,
        message: "Failed to save notification settings.",
        type: "error",
      });
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={isError}
        onRetry={fetchProfile}
        onClose={() => setIsError(null)}
      />
    );
  }

  const readOnlyFields = [
    { key: "fullName", label: "Full legal name", icon: User, value: profile.fullName },
    { key: "email", label: "Official work email", icon: Mail, value: profile.email, type: "email" },
    { key: "department", label: "Assigned department", icon: Building2, value: profile.department },
    { key: "position", label: "Designation / role title", icon: Briefcase, value: profile.position },
    { key: "employeeId", label: "Official staff ID", icon: Hash, value: profile.employeeId, mono: true },
  ];

  const passwordFields = [
    { key: "currentPassword", label: "Current password", show: showCurrentPassword, toggle: setShowCurrentPassword, autoComplete: "current-password" },
    { key: "newPassword", label: "New password", show: showNewPassword, toggle: setShowNewPassword, autoComplete: "new-password" },
    { key: "confirmPassword", label: "Confirm new password", show: showConfirmPassword, toggle: setShowConfirmPassword, autoComplete: "new-password" },
  ];

  const passwordRules = [
    { label: "8+ characters", ok: passwordForm.newPassword.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(passwordForm.newPassword) },
    { label: "Number", ok: /[0-9]/.test(passwordForm.newPassword) },
    { label: "Special symbol", ok: /[^A-Za-z0-9]/.test(passwordForm.newPassword) },
  ];

  const preferenceFields = [
    {
      key: "currency",
      label: "Currency display",
      icon: Banknote,
      options: [
        ["GHS", "GHS (GH₵) - Ghanaian Cedi"],
        ["USD", "USD ($) - US Dollar"],
        ["EUR", "EUR (€) - Euro"],
        ["GBP", "GBP (£) - British Pound"],
      ],
    },
    {
      key: "timeFormat",
      label: "Time display format",
      icon: Clock,
      options: [
        ["12h", "12-Hour Format (09:30 AM / 05:00 PM)"],
        ["24h", "24-Hour Format (09:30 / 17:00)"],
      ],
    },
    {
      key: "dateFormat",
      label: "Calendar date format",
      icon: Clock,
      options: [
        ["DD/MM/YYYY", "DD/MM/YYYY (e.g. 28/08/2026)"],
        ["MM/DD/YYYY", "MM/DD/YYYY (e.g. 08/28/2026)"],
        ["YYYY-MM-DD", "YYYY-MM-DD (e.g. 2026-08-28)"],
      ],
    },
    {
      key: "language",
      label: "Interface language",
      icon: Globe,
      options: [
        ["en-US", "English (United States)"],
        ["en-GB", "English (United Kingdom)"],
        ["fr-FR", "Français (French)"],
      ],
    },
  ];

  const notificationGroups = [
    {
      title: "Email notifications",
      icon: Mail,
      items: [
        { key: "emailPayslip", title: "Monthly payslip published", desc: "Receive an email notification as soon as your monthly salary payslip is released." },
        { key: "emailLeaveStatus", title: "Leave request decisions", desc: "Get notified immediately when management approves or updates your leave applications." },
        { key: "emailAnnouncements", title: "Company bulletins & announcements", desc: "Receive important executive updates and official staff announcements." },
        { key: "emailAttendanceReminders", title: "Daily attendance reminders", desc: "Receive subtle morning reminders to clock in before shift starts." },
      ],
    },
    {
      title: "In-app audio & visual alerts",
      icon: Volume2,
      items: [
        { key: "inAppUrgentAlerts", title: "Top navigation bell badges", desc: "Display real-time notification count badges in the top navigation bar." },
        { key: "inAppSound", title: "Audible cue on clock in & out", desc: "Play subtle chime confirmation when shifts are clocked in and out." },
      ],
    },
  ];

  return (
    <div className={`${ui.page} relative`}>

      {/* Identity & avatar */}
      <Card id="profile-avatar-appearance-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <ProfilePictureUploader
            currentAvatarUrl={profile.avatar || user?.profilePicture || user?.avatar}
            userName={profile.fullName || user?.fullName}
            userRole="Employee"
            onAvatarUpdated={(newUrl) => {
              setProfile((prev) => ({
                ...prev,
                avatar: newUrl,
                profilePicture: newUrl,
                profile_image_url: newUrl,
              }));
            }}
            size="lg"
          />

          <div className="md:text-right space-y-3 border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-5 md:pt-0">
            <div className="flex flex-wrap md:justify-end items-center gap-2">
              <Badge tone="success" dot pulse>
                Active account
              </Badge>
              <Badge tone="brand">
                <Shield className="w-3 h-3" />
                {profile.role ? profile.role.toUpperCase() : "EMPLOYEE"}
              </Badge>
              {(profile.employeeId || user?.employeeId) && (
                <Badge tone="neutral" className="font-mono">
                  ID: {profile.employeeId || user?.employeeId}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap md:justify-end items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              {(profile.department || user?.department) && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {profile.department || user?.department}
                </span>
              )}
              <span className="flex items-center gap-1.5 min-w-0">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{profile.email || user?.email}</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 items-start">
        {/* Section navigation: horizontal on small screens, vertical on desktop */}
        <nav aria-label="Settings sections" className={`${ui.card} p-2 lg:sticky lg:top-6`}>
          <ul className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id} className="shrink-0">
                  <button
                    id={`tab-btn-${tab.id}`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative w-full flex items-center gap-2.5 h-10 px-3 rounded-xl text-sm whitespace-nowrap transition-colors cursor-pointer ${ui.focusRing} ${
                      isActive
                        ? "bg-white text-slate-900 font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.08)] border border-slate-200/80 dark:bg-[#111927] dark:text-white dark:border-slate-800"
                        : "text-slate-600 font-medium border border-transparent hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#111927]/60 dark:hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <span aria-hidden="true" className="hidden lg:block absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full bg-[#ff5500]" />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#002185] dark:text-blue-400" : "text-slate-400"}`} />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* Profile */}
          {activeTab === "profile" && (
            <Card>
              <SectionHeader
                icon={User}
                title="Personal & employment details"
                description="View your official credentials and update your direct contact phone number."
                aside={
                  <Badge tone="neutral">
                    <Lock className="w-3 h-3" />
                    Protected fields locked by HR
                  </Badge>
                }
              />

              <form onSubmit={handleProfileSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {readOnlyFields.slice(0, 2).map((f) => (
                    <ReadOnlyField key={f.key} {...f} />
                  ))}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="settings-phone" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Direct phone contact <span className="text-rose-500">*</span>
                      </label>
                      <Badge tone="success">Editable</Badge>
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="settings-phone"
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className={`${ui.input} pl-10`}
                        placeholder="+233 XX XXX XXXX"
                      />
                    </div>
                  </div>

                  {readOnlyFields.slice(2).map((f) => (
                    <ReadOnlyField key={f.key} {...f} />
                  ))}
                </div>

                <FormFooter note="Changes take effect immediately across all employee services">
                  <button type="submit" disabled={isSavingProfile} className={ui.btnPrimary}>
                    {isSavingProfile ? <WorkspaceLoader inline /> : <Save className="w-4 h-4" />}
                    {isSavingProfile ? "Saving profile..." : "Save profile changes"}
                  </button>
                </FormFooter>
              </form>
            </Card>
          )}

          {/* Performance */}
          {activeTab === "performance" && (
            <Card>
              <QuarterlyPerformanceVisualizer
                employeeId={user?._id || user?.id || user?.employeeId}
                employeeData={user}
                isAdmin={false}
                self
              />
            </Card>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <Card>
              <SectionHeader
                icon={Lock}
                title="Change account password"
                description="Ensure your account is protected with a strong, unique password."
              />

              <form onSubmit={handlePasswordUpdate}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {passwordFields.map(({ key, label, show, toggle, autoComplete }) => (
                    <div key={key}>
                      <label htmlFor={`settings-${key}`} className={ui.label}>
                        {label}
                      </label>
                      <div className="relative">
                        <input
                          id={`settings-${key}`}
                          type={show ? "text" : "password"}
                          value={passwordForm[key]}
                          onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                          className={`${ui.input} pr-10`}
                          placeholder="••••••••"
                          autoComplete={autoComplete}
                        />
                        <button
                          type="button"
                          onClick={() => toggle(!show)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          tabIndex={-1}
                          aria-label={show ? "Hide password" : "Show password"}
                        >
                          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {passwordForm.newPassword && (
                  <div className={`${ui.subtle} mt-5 p-4 space-y-3`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Password strength</span>
                      <span className={`font-semibold ${passwordStrength.text}`}>{passwordStrength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`rounded-full transition-colors duration-300 ${
                            passwordStrength.score >= step ? passwordStrength.color : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                      {passwordRules.map(({ label, ok }) => (
                        <li
                          key={label}
                          className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <FormFooter note="Password is encrypted with secure salted hashing">
                  <button type="submit" disabled={isUpdatingPassword} className={ui.btnPrimary}>
                    {isUpdatingPassword ? <WorkspaceLoader inline /> : <CheckCircle2 className="w-4 h-4" />}
                    {isUpdatingPassword ? "Updating password..." : "Update password"}
                  </button>
                </FormFooter>
              </form>
            </Card>
          )}

          {/* Preferences */}
          {activeTab === "preferences" && (
            <>
              <ThemePreferenceCard />

              <Card>
                <SectionHeader
                  icon={Globe}
                  title="Regional & localization settings"
                  description="Set your preferred time representation, calendar orientation, and currency symbols."
                />
                <form onSubmit={handleSavePreferences}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    {preferenceFields.map(({ key, label, icon: Icon, options }) => (
                      <div key={key}>
                        <label htmlFor={`pref-${key}`} className={`${ui.label} flex items-center gap-1.5`}>
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          {label}
                        </label>
                        <select
                          id={`pref-${key}`}
                          value={preferences[key]}
                          onChange={(e) => setPreferences({ ...preferences, [key]: e.target.value })}
                          className={ui.select}
                          style={selectChevronStyle}
                        >
                          {options.map(([value, text]) => (
                            <option key={value} value={value}>
                              {text}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <FormFooter>
                    <button type="submit" disabled={isSavingPreferences} className={ui.btnPrimary}>
                      {isSavingPreferences ? <WorkspaceLoader inline /> : <Save className="w-4 h-4" />}
                      {isSavingPreferences ? "Saving preferences..." : "Save preferences"}
                    </button>
                  </FormFooter>
                </form>
              </Card>
            </>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <Card>
              <SectionHeader
                icon={Bell}
                title="Notification & alert delivery"
                description="Choose what updates you want delivered to your email inbox and in-app activity bell."
              />
              <form onSubmit={handleSaveNotifications} className="space-y-6">
                {notificationGroups.map(({ title, icon: GroupIcon, items }) => (
                  <fieldset key={title}>
                    <legend className={`${ui.eyebrow} flex items-center gap-1.5 mb-3`}>
                      <GroupIcon className="w-3.5 h-3.5" />
                      {title}
                    </legend>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                      {items.map(({ key, title: itemTitle, desc }) => (
                        <label
                          key={key}
                          htmlFor={`notif-${key}`}
                          className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#162033]/40 transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900 dark:text-white">{itemTitle}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</span>
                          </span>
                          <span className="relative inline-flex items-center shrink-0">
                            <input
                              id={`notif-${key}`}
                              type="checkbox"
                              checked={notifications[key]}
                              onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                              className="sr-only peer"
                            />
                            <span className="w-10 h-6 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors peer-checked:bg-[#002185] dark:peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-[#002185]/40 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-[#111927]" />
                            <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}

                <FormFooter>
                  <button type="submit" disabled={isSavingNotifications} className={ui.btnPrimary}>
                    {isSavingNotifications ? <WorkspaceLoader inline /> : <Save className="w-4 h-4" />}
                    {isSavingNotifications ? "Saving notifications..." : "Save notification preferences"}
                  </button>
                </FormFooter>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon, title, description, aside }) => (
  <div className="pb-5 mb-6 border-b border-slate-100 dark:border-slate-800">
    <CardHeader icon={icon} title={title} description={description} action={aside} />
  </div>
);

const FormFooter = ({ note, children }) => (
  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-5 mt-6 border-t border-slate-100 dark:border-slate-800">
    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
      {note && (
        <>
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          {note}
        </>
      )}
    </span>
    {children}
  </div>
);

/** Locked, HR-managed profile field. */
const ReadOnlyField = ({ label, icon: Icon, value, type = "text", mono = false }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500">Read-only</span>
    </div>
    <div className="relative">
      <Icon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={type}
        value={value}
        disabled
        aria-label={label}
        className={`${ui.input} pl-10 pr-10 ${mono ? "font-mono" : ""}`}
      />
      <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
    </div>
  </div>
);

export default EmployeeSettings;
