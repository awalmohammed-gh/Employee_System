import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { User, Mail, Phone, Briefcase, Key, CheckCircle2, Lock } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getAdminProfile, updateAdminProfile, changeAdminPassword } from "../../../apis/fontApis";
import ProfilePictureUploader from "../../../components/ProfilePictureUploader";

const ProfileSettings = ({ onSaveSuccess }) => {
  const { user, setUser, admin, setAdmin, setShowToast } = useManagement();

  const [formData, setFormData] = useState({
    fullName: user?.fullName || user?.full_name || "Administrator",
    email: user?.email || "admin@eyenit.com",
    phone: user?.phone || "",
    role: "Administrator",
    position: user?.position || "Principal Administrator",
    department: user?.department || "Executive Management",
    avatar: user?.avatar || user?.profile_image_url || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Sync profile when user context updates safely
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const res = await getAdminProfile();
        if (isMounted && res?.data?.success && res.data.admin) {
          const adm = res.data.admin;
          setFormData({
            fullName: adm.fullName || adm.full_name || "Administrator",
            email: adm.email || "admin@eyenit.com",
            phone: adm.phone || "",
            role: "Administrator",
            position: adm.position || "Principal Administrator",
            department: adm.department || "Executive Management",
            avatar: adm.avatar || adm.profile_image_url || "",
          });
        }
      } catch (err) {
        console.warn("Failed to fetch admin profile in ProfileSettings:", err?.message);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field, value) => {
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    if (!formData.fullName.trim()) {
      setShowToast({
        show: true,
        message: "Full Name cannot be empty.",
        type: "error",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const avatarUrlToSave = formData.avatar || formData.profile_image_url || "";
      const res = await updateAdminProfile({
        fullName: formData.fullName.trim(),
        full_name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        avatar: avatarUrlToSave,
        profile_image_url: avatarUrlToSave,
        position: formData.position,
        department: formData.department,
      });

      if (res?.data?.success) {
        const updatedAdmin = res.data.admin || { ...formData, avatar: avatarUrlToSave, profile_image_url: avatarUrlToSave };
        setUser((prev) => ({ ...prev, ...updatedAdmin }));
        if (typeof setAdmin === "function") setAdmin(updatedAdmin);
        setShowToast({
          show: true,
          message: "Profile information updated successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Profile update error:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || "Failed to update profile.",
        type: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setPasswordError("");
    setPasswordSuccess("");

    if (!passwordData.currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changeAdminPassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      if (res?.data?.success) {
        setPasswordSuccess("Password updated successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setShowToast({
          show: true,
          message: "Password changed successfully!",
          type: "success",
        });
        setTimeout(() => {
          setShowPasswordSection(false);
          setPasswordSuccess("");
        }, 2000);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update password.";
      setPasswordError(msg);
      setShowToast({
        show: true,
        message: msg,
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Header Block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <ProfilePictureUploader
          currentAvatarUrl={formData.avatar || admin?.profile_image_url || admin?.avatar}
          userName={formData.fullName}
          userRole="Admin"
          onAvatarUpdated={(newUrl) => {
            setFormData((prev) => ({ ...prev, avatar: newUrl }));
          }}
          size="lg"
        />

        <div className="space-y-1 text-right hidden lg:block">
          <div className="flex items-center gap-2 justify-end">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              Active System Account
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {formData.email} • <span className="text-[#002185] dark:text-blue-400 font-semibold">{formData.role}</span>
          </p>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleProfileSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Administrator Name"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="admin@eyenit.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+233 XX XXX XXXX"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Department
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
                placeholder="Executive Management"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSavingProfile}
            className="flex items-center gap-2 rounded-xl bg-[#002185] dark:bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#001760] dark:hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSavingProfile ? (
              <WorkspaceLoader inline />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{isSavingProfile ? "Saving Profile..." : "Save Profile Details"}</span>
          </button>
        </div>
      </form>

      {/* Change Password Card */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#ff5500]" />
              Account Security & Password
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Change your administrative password to protect system access
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordSection((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#162033] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-[#ff5500]" />
            <span>{showPasswordSection ? "Hide Password Form" : "Change Password"}</span>
          </button>
        </div>

        {showPasswordSection && (
          <form
            onSubmit={handleChangePasswordSubmit}
            className="mt-5 p-5 bg-slate-50 dark:bg-[#162033]/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in duration-200"
          >
            {passwordError && (
              <div className="p-3 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                {passwordSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordSection(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center gap-2 px-4 py-2 bg-[#002185] hover:bg-[#001760] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isChangingPassword ? <><WorkspaceLoader inline /> Updating...</> : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileSettings;
