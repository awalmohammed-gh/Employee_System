import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Building2,
  MapPin,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Palette,
  X,
} from "lucide-react";
import { initializeSystem, getSetupStatus } from "../../apis/fontApis";
import { useAuth } from "../../context/AuthContext";
import { useManagement } from "../../context/ManagementContextProvider";
import { useBranding } from "../../context/BrandingContext";
import { MotionSpinner } from "../../components/ui/MotionSpinner";

export const SystemSetup = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { setShowToast, setUser: setManagementUser, setRole: setManagementRole } = useManagement();
  const { refreshBranding } = useBranding();

  // Wizard Step: 1 = Admin Registration, 2 = Global Company Configuration
  const [currentStep, setCurrentStep] = useState(1);

  // System status check
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);
  const [existingCompanyData, setExistingCompanyData] = useState(null);

  // Step 1: Administrator Registration Form State
  const [adminData, setAdminData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Step 2: Global Company Configuration Form State
  const [companyData, setCompanyData] = useState({
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    address: "",
    primaryColor: "#0B1E48",
    website: "",
  });

  // Logo file upload state
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Check if system is already initialized
  useEffect(() => {
    let isMounted = true;
    getSetupStatus()
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success && res.data?.isInitialized) {
          setAlreadyConfigured(true);
          setExistingCompanyData(res.data.company);
        }
      })
      .catch((err) => {
        console.debug("Setup status check notice:", err.message);
      })
      .finally(() => {
        if (isMounted) setIsCheckingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Admin Input Changes
  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  // Handle Company Input Changes
  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  // Handle Logo Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("Logo file size must not exceed 10MB.");
        return;
      }
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
      setError(null);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview("");
    }
  };

  // Step 1 Validation & Advance
  const handleStep1Next = (e) => {
    e.preventDefault();
    setError(null);

    const fullName = adminData.fullName.trim();
    const email = adminData.email.trim();
    const password = adminData.password;
    const confirmPassword = adminData.confirmPassword;

    if (!fullName) {
      setError("Please provide the Administrator Full Name.");
      return;
    }

    if (!email || !email.includes("@")) {
      setError("Please enter a valid administrator email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both password entries.");
      return;
    }

    // Auto-prefill company contact email and phone if company fields are empty
    setCompanyData((prev) => ({
      ...prev,
      companyEmail: prev.companyEmail || email,
      companyPhone: prev.companyPhone || adminData.phone.trim(),
    }));

    // Advance to Step 2
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Step 2 Submission (Combined Payload)
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const companyName = companyData.companyName.trim();
    if (!companyName) {
      setError("Please provide your Company / Organization Name.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Build multipart FormData for combined step 1 + step 2 submission
      const formData = new FormData();

      // Step 1: Admin Details
      formData.append("fullName", adminData.fullName.trim());
      formData.append("adminFullName", adminData.fullName.trim());
      formData.append("email", adminData.email.trim().toLowerCase());
      formData.append("adminEmail", adminData.email.trim().toLowerCase());
      formData.append("phone", adminData.phone.trim());
      formData.append("adminPhone", adminData.phone.trim());
      formData.append("password", adminData.password);
      formData.append("adminPassword", adminData.password);
      formData.append("confirmPassword", adminData.confirmPassword);

      // Step 2: Global Company Configuration
      formData.append("companyName", companyName);
      formData.append("companyEmail", (companyData.companyEmail || adminData.email).trim().toLowerCase());
      formData.append("companyPhone", (companyData.companyPhone || adminData.phone).trim());
      formData.append("address", companyData.address.trim());
      formData.append("primaryColor", companyData.primaryColor || "#0B1E48");
      if (companyData.website) {
        formData.append("website", companyData.website.trim());
      }

      // Attach logo if uploaded
      if (logoFile) {
        formData.append("logo", logoFile);
        formData.append("companyLogo", logoFile);
      }

      const res = await initializeSystem(formData, true);

      if (res.data?.success) {
        const userObj = res.data.user || res.data.admin;
        const userRole = (userObj?.role || "admin").toLowerCase();
        const userToken = res.data.token;

        // Auto-authenticate in React context
        if (typeof authLogin === "function") {
          authLogin(userObj, userRole, userToken, res.data);
        }
        if (typeof setManagementUser === "function") {
          setManagementUser(userObj);
        }
        if (typeof setManagementRole === "function") {
          setManagementRole(userRole);
        }

        // Refresh global branding
        if (typeof refreshBranding === "function") {
          refreshBranding();
        }

        if (typeof setShowToast === "function") {
          setShowToast({
            show: true,
            message: `System setup complete! Welcome, ${userObj.fullName || "Administrator"}.`,
            type: "success",
          });
        }

        // Seamless redirect to Admin Dashboard
        navigate("/admin/dashboard", {
          replace: true,
          state: { role: userRole },
        });
      } else {
        setError(res.data?.message || "Failed to initialize the system.");
      }
    } catch (err) {
      console.error("[SystemSetup] Error initializing system:", err);
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred during setup initialization. Please try again.";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <MotionSpinner size="lg" />
          <p className="text-xs text-slate-400 font-medium">Checking system setup status...</p>
        </div>
      </div>
    );
  }

  // If already configured and user visits /setup
  if (alreadyConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            System Already Configured
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            The workforce management system for{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {existingCompanyData?.companyName || "WorkPulse"}
            </span>{" "}
            has already been initialized. Administrator credentials are active.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/auth?mode=login")}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Log In to Admin Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setAlreadyConfigured(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Run Setup Again (Update Credentials)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const presetColors = [
    { name: "Navy", hex: "#0B1E48" },
    { name: "Royal", hex: "#2563EB" },
    { name: "Emerald", hex: "#059669" },
    { name: "Slate", hex: "#1E293B" },
    { name: "Crimson", hex: "#B91C1C" },
    { name: "Purple", hex: "#6D28D9" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0B1528] to-slate-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Background Decorative Blur */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold tracking-wide uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Enterprise System Onboarding</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            WorkPulse Initial Setup
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Configure your master administrator account and corporate workspace in 2 simple steps.
          </p>
        </div>

        {/* 2-Step Sequential Wizard Indicator */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-3">
            {/* Step 1 Pill */}
            <div
              onClick={() => {
                if (currentStep === 2) setCurrentStep(1);
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                currentStep === 1
                  ? "bg-blue-600/15 border-blue-500 text-white shadow-sm"
                  : currentStep > 1
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-pointer hover:bg-emerald-500/15"
                  : "bg-slate-800/40 border-slate-800 text-slate-400"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 1
                    ? "bg-blue-600 text-white"
                    : currentStep > 1
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Step 1: Admin Account</p>
                <p className="text-[10px] text-slate-400 truncate">Master login credentials</p>
              </div>
            </div>

            {/* Step 2 Pill */}
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                currentStep === 2
                  ? "bg-blue-600/15 border-blue-500 text-white shadow-sm"
                  : "bg-slate-800/40 border-slate-800 text-slate-400"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 2 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                2
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Step 2: Company Profile</p>
                <p className="text-[10px] text-slate-400 truncate">Global workspace & branding</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wizard Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Global Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: ADMINISTRATOR REGISTRATION                                         */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-5">
              <div className="pb-3 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <User className="w-4 h-4" />
                  </div>
                  <span>Step 1: Administrator Registration</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Create your master administrator credentials. This primary email will be used for
                  managing employees, shifts, and payroll.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={adminData.fullName}
                    onChange={handleAdminChange}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Admin Email (Used for Login) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={adminData.email}
                    onChange={handleAdminChange}
                    placeholder="admin@company.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  This email will be the master administrator identifier across the platform.
                </p>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={adminData.phone}
                    onChange={handleAdminChange}
                    placeholder="+233 24 000 0000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      minLength={6}
                      value={adminData.password}
                      onChange={handleAdminChange}
                      placeholder="Min 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Confirm Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      required
                      minLength={6}
                      value={adminData.confirmPassword}
                      onChange={handleAdminChange}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button: Next */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <Link
                  to="/admin/auth?mode=login"
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Already have credentials? Log In
                </Link>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition cursor-pointer"
                >
                  <span>Next: Setup Company Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: GLOBAL COMPANY CONFIGURATION                                      */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <form onSubmit={handleFinalSubmit} className="space-y-5">
              <div className="pb-3 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span>Step 2: Global Company Configuration</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure enterprise details, contact channels, and corporate branding.
                </p>
              </div>

              {/* Summary of Step 1 Administrator */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {adminData.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{adminData.fullName}</p>
                    <p className="text-[10px] text-blue-300 truncate">{adminData.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer shrink-0"
                >
                  Edit Admin Details
                </button>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Company / Organization Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="companyName"
                    required
                    value={companyData.companyName}
                    onChange={handleCompanyChange}
                    placeholder="e.g. Acme Global Logistics"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Company Email & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Company Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Company Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      name="companyEmail"
                      value={companyData.companyEmail}
                      onChange={handleCompanyChange}
                      placeholder="info@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Company Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Company Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      name="companyPhone"
                      value={companyData.companyPhone}
                      onChange={handleCompanyChange}
                      placeholder="+233 30 000 0000"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Address */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Physical Office Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="address"
                    value={companyData.address}
                    onChange={handleCompanyChange}
                    placeholder="e.g. 100 Commercial Avenue, Accra, Ghana"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Branding Elements: Logo Upload & Theme Color */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Branding & Visual Identity (Optional)</span>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Company Logo
                  </label>

                  {logoPreview ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700">
                      <div className="w-12 h-12 rounded-lg bg-white p-1 border border-slate-600 flex items-center justify-center shrink-0">
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {logoFile?.name || "Uploaded Logo"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {logoFile?.size ? `${Math.round(logoFile.size / 1024)} KB` : "Ready"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                        title="Remove Logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-4 bg-slate-900/60 cursor-pointer transition">
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-300">
                        Click to upload company logo
                      </span>
                      <span className="text-[10px] text-slate-500">
                        PNG, JPEG, WEBP or SVG up to 10MB
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Theme Color Picker */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Brand Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {presetColors.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() =>
                          setCompanyData((prev) => ({ ...prev, primaryColor: color.hex }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          companyData.primaryColor === color.hex
                            ? "border-white bg-white/10 text-white"
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: color.hex }}
                        ></span>
                        <span>{color.name}</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Palette className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="color"
                        value={companyData.primaryColor}
                        onChange={(e) =>
                          setCompanyData((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="pt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCurrentStep(1);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Admin Details</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <MotionSpinner size="sm" />
                      <span>Initializing System...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup & Launch Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSetup;
