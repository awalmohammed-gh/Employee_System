import WorkspaceLoader from "../../../components/ui/WorkspaceLoader";
import { useState, useEffect, useRef } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Banknote,
  Bell,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { getSettings, updateCompanySettings } from "../../../apis/fontApis";
import { brandingService } from "../../../services/brandingService";
import { useBranding } from "../../../context/BrandingContext";
import ThemePreferenceCard from "../../../components/ThemePreferenceCard";

const defaultCompany = {
  companyName: "",
  logo: "",
  logoUrl: "",
  welcomeBackgroundUrl: "",
  primaryColor: "#0B1E48",
  address: "",
  phone: "",
  email: "",
  website: "",
  workStartTime: "08:00",
  workEndTime: "19:00",
  defaultCurrency: "GHS",
  emailNotifications: true,
  systemAlerts: true,
};

const CompanySettings = ({ onSaveSuccess }) => {
  const { setShowToast, fetchCompanyProfile, setCompanyLogoUrl } = useManagement();
  const { refreshBranding } = useBranding();
  const [company, setCompany] = useState(defaultCompany);
  const [isSaving, setIsSaving] = useState(false);

  // Brand asset uploads state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState("");

  const logoInputRef = useRef(null);
  const bgInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const [settingsRes, brandRes] = await Promise.allSettled([
          getSettings(),
          brandingService.getAdminBranding(),
        ]);

        if (isMounted) {
          let merged = { ...defaultCompany };

          if (settingsRes.status === "fulfilled" && settingsRes.value?.data?.success) {
            const comp = settingsRes.value.data.settings?.company || {};
            const att = settingsRes.value.data.settings?.attendance || {};
            const pay = settingsRes.value.data.settings?.payroll || {};
            merged = {
              ...merged,
              ...comp,
              workStartTime: att.workStartTime || merged.workStartTime,
              workEndTime: att.workEndTime || merged.workEndTime,
              defaultCurrency: pay.currency || merged.defaultCurrency,
            };
          }

          if (brandRes.status === "fulfilled" && brandRes.value?.success && brandRes.value.company) {
            const brandComp = brandRes.value.company;
            merged = {
              ...merged,
              companyName: brandComp.companyName || merged.companyName,
              logoUrl: brandComp.logoUrl || merged.logoUrl,
              logo: brandComp.logoUrl || merged.logo,
              welcomeBackgroundUrl: brandComp.welcomeBackgroundUrl || "",
              primaryColor: brandComp.primaryColor || merged.primaryColor,
              email: brandComp.contactEmail || merged.email,
            };
            if (brandComp.logoUrl) {
              setLogoPreview(brandComp.logoUrl);
            }
            if (brandComp.welcomeBackgroundUrl) {
              setBgPreview(brandComp.welcomeBackgroundUrl);
            }
          }

          setCompany(merged);
        }
      } catch (err) {
        console.warn("Failed to load company settings:", err?.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setShowToast({
        show: true,
        message: "Please select an image file for the company logo.",
        type: "error",
      });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBgFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setShowToast({
        show: true,
        message: "Please select an image file for the welcome background.",
        type: "error",
      });
      return;
    }
    setBgFile(file);
    const reader = new FileReader();
    reader.onload = () => setBgPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    setIsSaving(true);
    try {
      // 1. Submit white-label branding changes (supports multipart/form-data for image files)
      const brandFormData = new FormData();
      brandFormData.append("companyName", company.companyName || "");
      brandFormData.append("primaryColor", company.primaryColor || "#0B1E48");
      brandFormData.append("contactEmail", company.email || "");
      if (logoFile) {
        brandFormData.append("logo", logoFile);
      }
      if (bgFile) {
        brandFormData.append("welcomeBackground", bgFile);
      }

      const brandRes = await brandingService.updateAdminBranding(brandFormData);
      // The branding endpoint is the single place the logo is saved; use the stored URL it returns
      const savedLogoUrl = brandRes?.company?.logoUrl ?? brandRes?.company?.logo;
      if (typeof savedLogoUrl === "string") {
        setCompany((prev) => ({ ...prev, logoUrl: savedLogoUrl, logo: savedLogoUrl }));
        setLogoPreview(savedLogoUrl);
        setLogoFile(null);
        if (typeof setCompanyLogoUrl === "function") setCompanyLogoUrl(savedLogoUrl);
      }

      // 2. Synchronize standard company preferences
      const res = await updateCompanySettings({
        companyName: company.companyName,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        workStartTime: company.workStartTime,
        workEndTime: company.workEndTime,
        defaultCurrency: company.defaultCurrency,
        emailNotifications: company.emailNotifications,
        systemAlerts: company.systemAlerts,
      });

      // 3. Refresh every client-side copy of the branding so sidebars, headers, loaders and exports update immediately
      await Promise.allSettled([refreshBranding(), typeof fetchCompanyProfile === "function" ? fetchCompanyProfile() : null]);

      if (res?.data?.success) {
        setShowToast({
          show: true,
          message: "Brand assets and company preferences saved successfully!",
          type: "success",
        });
        if (typeof onSaveSuccess === "function") {
          onSaveSuccess();
        }
      }
    } catch (err) {
      console.error("Failed to save company settings:", err);
      setShowToast({
        show: true,
        message: err?.response?.data?.message || err?.normalizedMessage || "Failed to update company settings.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Brand Identity / Logo & Background Customization Header */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#0B1E48] dark:text-blue-400" />
              White-Label Brand Assets & Colors
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize your company emblem, portals background, and primary theme hue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Primary Hue:</span>
            <input
              type="color"
              value={company.primaryColor || "#0B1E48"}
              onChange={(e) => handleChange("primaryColor", e.target.value)}
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-[#162033]"
            />
            <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
              {company.primaryColor || "#0B1E48"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Company Logo Customization */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#111927]/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Company Logo</span>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0B1E48] text-white hover:bg-opacity-90 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload New Logo
              </button>
            </div>
            <div className="h-24 rounded-lg bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 overflow-hidden">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Recommended: Transparent PNG or SVG. Max 10MB.
            </p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoFileChange}
              className="hidden"
            />
          </div>

          {/* Welcome Background Customization */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#111927]/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Login Welcome Background</span>
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0B1E48] text-white hover:bg-opacity-90 cursor-pointer shadow-xs"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Upload Background
              </button>
            </div>
            <div className="h-24 rounded-lg bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative">
              {bgPreview ? (
                <img
                  src={bgPreview}
                  alt="Welcome Background"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-[11px]">Using default subtle theme gradient</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Recommended: 1920x1080 Landscape JPEG or PNG.
            </p>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleBgFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Company / Organization Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={company.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Business Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={company.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Phone Contact
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={company.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Physical Office Address
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={company.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Website URL
          </label>
          <div className="relative">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={company.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://www.example.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Default Operating Currency
          </label>
          <div className="relative">
            <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={company.defaultCurrency}
              onChange={(e) => handleChange("defaultCurrency", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            >
              <option value="GHS">GHS (Ghana Cedis - GH₵)</option>
              <option value="USD">USD (US Dollar - $)</option>
              <option value="EUR">EUR (Euro - €)</option>
              <option value="GBP">GBP (British Pound - £)</option>
            </select>
          </div>
        </div>

        {/* Work Hours Configuration */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Standard Work Start Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={company.workStartTime}
              onChange={(e) => handleChange("workStartTime", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Standard Work End Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={company.workEndTime}
              onChange={(e) => handleChange("workEndTime", e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#002185] dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Appearance & Theme Selector Section */}
      <ThemePreferenceCard />

      {/* Notification Toggles */}
      <div className="space-y-3.5 bg-slate-50 dark:bg-[#162033]/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-[#002185] dark:text-blue-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            System & Notification Toggles
          </h4>
        </div>

        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={company.emailNotifications}
            onChange={(e) =>
              handleChange("emailNotifications", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Enable Email Dispatch Notifications
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Send automatic email alerts for payroll approvals and leave requests
            </span>
          </div>
        </label>

        <label className="flex items-center gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={company.systemAlerts}
            onChange={(e) =>
              handleChange("systemAlerts", e.target.checked)
            }
            className="w-4 h-4 text-[#002185] dark:text-blue-500 border-slate-300 dark:border-slate-600 rounded focus:ring-[#002185]/25 cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Enable Real-time Dashboard Bell Alerts
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Show pop-up and badge notifications in the top bar for instant awareness
            </span>
          </div>
        </label>
      </div>

      {/* Save Action Button */}
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
          <span>{isSaving ? "Saving Company Settings..." : "Save Company Preferences"}</span>
        </button>
      </div>
    </form>
  );
};

export default CompanySettings;
