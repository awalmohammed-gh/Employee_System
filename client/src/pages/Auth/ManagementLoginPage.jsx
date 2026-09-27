import AuthPanel from "./AuthPanel";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  ArrowRight,
  Mail,
  User,
  Phone,
} from "lucide-react";
import { authService } from "../../services/authService";
import { brandingService } from "../../services/brandingService";
import { useManagement } from "../../context/ManagementContextProvider";
import { useAuth } from "../../context/AuthContext";
import { MotionSpinner } from "../../components/ui/MotionSpinner";

export const ManagementLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode: "login" or "signup"
  const initialMode =
    searchParams.get("mode") === "signup" || location.pathname.includes("register")
      ? "signup"
      : "login";
  const [mode, setMode] = useState(initialMode);

  // Sync mode with URL if updated via search params
  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "signup" && mode !== "signup") {
      setMode("signup");
    } else if (qMode === "login" && mode !== "login") {
      setMode("login");
    }
  }, [searchParams]);

  const [branding, setBranding] = useState({
    companyName: "WorkPulse",
    logoUrl: "",
  });

  // Login Form State
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: true,
  });

  // Sign Up Form State
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { setShowToast, setUser: setManagementUser, setRole: setManagementRole } =
    useManagement();
  const { login: contextLogin } = useAuth();

  // Load company branding
  useEffect(() => {
    let isMounted = true;
    brandingService
      .getPublicBranding()
      .then((res) => {
        if (!isMounted) return;
        const brand = res?.branding || res?.company || res || {};
        const companyName = brand.companyName || brand.name || "WorkPulse";
        const logoUrl = brand.logoUrl || brand.logo || "";
        setBranding({ companyName, logoUrl });
        if (typeof document !== "undefined") {
          document.title = `${companyName} | Admin Authentication`;
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setSearchParams({ mode: newMode });
  };

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle Admin Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const email = loginData.email.trim();
    const password = loginData.password;

    if (!email || !password) {
      setError("Please enter your admin email address and password.");
      return;
    }

    try {
      setIsLoading(true);

      const result = await authService.login({
        identifier: email,
        email,
        password,
        role: "admin",
        rememberMe: loginData.rememberMe,
      });

      if (result?.success) {
        const userObj = result.admin || result.user;
        const userRole = (userObj?.role || "admin").toLowerCase();

        // Only manager or admin roles allowed in admin portal
        if (userRole !== "admin" && userRole !== "manager") {
          setError(
            "Access restricted. This portal is reserved for Managers and System Administrators only. Employees must use the Employee Login portal."
          );
          setIsLoading(false);
          return;
        }

        const userToken = result.token;

        if (typeof contextLogin === "function") {
          contextLogin(userObj, userRole, userToken, result);
        }
        if (typeof setManagementUser === "function") {
          setManagementUser(userObj);
        }
        if (typeof setManagementRole === "function") {
          setManagementRole(userRole);
        }

        if (typeof setShowToast === "function") {
          setShowToast({
            show: true,
            message: `Welcome back, ${userObj.fullName || userObj.full_name || "Administrator"}! Signed in to Admin Dashboard.`,
            type: "success",
          });
        }

        navigate("/admin/dashboard", {
          replace: true,
          state: { role: userRole },
        });
      } else {
        setError(
          result?.message ||
            "Invalid admin credentials. Please verify your email and password."
        );
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.normalizedMessage ||
        err.message ||
        "Authentication failed. Please verify your credentials and try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Admin Sign Up
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const fullName = signUpData.fullName.trim();
    const email = signUpData.email.trim();
    const phone = signUpData.phone.trim();
    const password = signUpData.password;
    const confirmPassword = signUpData.confirmPassword;

    if (!fullName || !email || !password) {
      setError("Full Name, Email Address, and Password are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both password entries.");
      return;
    }

    try {
      setIsLoading(true);

      const result = await authService.registerAdmin({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
      });

      if (result?.success) {
        const userObj = result.admin || result.user;
        const userRole = (userObj?.role || "admin").toLowerCase();
        const userToken = result.token;

        if (typeof contextLogin === "function") {
          contextLogin(userObj, userRole, userToken, result);
        }
        if (typeof setManagementUser === "function") {
          setManagementUser(userObj);
        }
        if (typeof setManagementRole === "function") {
          setManagementRole(userRole);
        }

        if (typeof setShowToast === "function") {
          setShowToast({
            show: true,
            message: `Admin account created successfully! Welcome, ${userObj.fullName || userObj.full_name || "Administrator"}!`,
            type: "success",
          });
        }

        navigate("/admin/dashboard", {
          replace: true,
          state: { role: userRole },
        });
      } else {
        setError(
          result?.message ||
            "Failed to create admin account. Please verify your details."
        );
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.normalizedMessage ||
        err.message ||
        "Registration failed. Please check your information and try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="admin-auth-page"
      className="min-h-screen w-full bg-[#F4F7FB] dark:bg-slate-950 flex flex-col justify-between items-center px-4 py-6 font-sans selection:bg-[#0B1E48]/10 selection:text-[#0B1E48]"
    >
      {/* Top Header Navigation */}
      <header className="w-full max-w-md flex items-center justify-between py-2">
        <Link
          to="/welcome"
          id="link-admin-back-welcome"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-white transition-colors"
        >
          <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center">
            <ArrowLeft className="w-3.5 h-3.5" />
          </div>
          <span>Back to Welcome</span>
        </Link>

        <Link
          to="/"
          id="link-admin-overview"
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-white"
        >
          Overview
        </Link>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-md my-auto py-8 sm:py-10">
        <AuthPanel branding={branding} title={mode === "login" ? "Management sign in" : "Create your account"} description={mode === "login" ? "Welcome back. Your team workspace is ready." : "Enter your details to set up management access."}>
          {/* Segmented Control / Tabs: [ Login ] [ Sign Up ] */}
          <div className="mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center gap-1">
            <button
              type="button"
              id="tab-admin-login"
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                mode === "login"
                  ? "bg-white dark:bg-slate-900 text-[#0B1E48] dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              id="tab-admin-signup"
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                mode === "signup"
                  ? "bg-white dark:bg-slate-900 text-[#0B1E48] dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              id="auth-error-banner"
              role="alert"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* FORM 1: ADMIN LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="admin-login-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Admin Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    placeholder="admin@company.com"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="admin-login-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    id="btn-toggle-admin-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={0}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="admin-remember-me"
                    name="rememberMe"
                    checked={loginData.rememberMe}
                    onChange={handleLoginChange}
                    className="w-4 h-4 rounded border-slate-300 text-[#0B1E48] focus:ring-[#0B1E48] cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Remember this device
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="admin-login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#0B1E48] hover:bg-[#071534] dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-60 shadow-md shadow-[#0B1E48]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <MotionSpinner size="sm" className="text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Login to Admin Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Switch to Sign Up */}
              <div className="pt-4 text-center">
                <button
                  type="button"
                  id="btn-switch-to-signup"
                  onClick={() => switchMode("signup")}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Don't have an admin account?{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Sign Up
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* FORM 2: ADMIN SIGN UP */}
          {mode === "signup" && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              {/* FULL NAME */}
              <div>
                <label
                  htmlFor="admin-signup-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-signup-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={signUpData.fullName}
                    onChange={handleSignUpChange}
                    placeholder="e.g. Mohammed Awal"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="admin-signup-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={signUpData.email}
                    onChange={handleSignUpChange}
                    placeholder="admin@company.com"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* PHONE */}
              <div>
                <label
                  htmlFor="admin-signup-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-signup-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={signUpData.phone}
                    onChange={handleSignUpChange}
                    placeholder="+1 (555) 000-0000"
                    disabled={isLoading}
                    className="w-full pl-10 pr-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="admin-signup-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={signUpData.password}
                    onChange={handleSignUpChange}
                    placeholder="At least 6 characters"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-2 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    id="btn-toggle-signup-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={0}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label
                  htmlFor="admin-signup-confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={signUpData.confirmPassword}
                    onChange={handleSignUpChange}
                    placeholder="Repeat your password"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-2 bg-slate-50/60 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 focus:border-[#0B1E48] focus:ring-2 focus:ring-[#0B1E48]/10 transition-all outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    id="btn-toggle-signup-confirm-password"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={0}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="admin-signup-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#0B1E48] hover:bg-[#071534] dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-60 shadow-md shadow-[#0B1E48]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <MotionSpinner size="sm" className="text-white" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Admin Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Switch to Login */}
              <div className="pt-3 text-center">
                <button
                  type="button"
                  id="btn-switch-to-login"
                  onClick={() => switchMode("login")}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Already have an account?{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Login
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Portal Switcher Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 text-center">
            <button
              type="button"
              id="link-switch-to-employee"
              onClick={() => navigate("/employee/login")}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-[#0B1E48] dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Employee looking to clock in?</span>
              <span className="text-[#ff5500] dark:text-orange-400 font-bold hover:underline">
                Employee Login &rarr;
              </span>
            </button>
          </div>
        </AuthPanel>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-2 text-xs text-slate-400 dark:text-slate-500">
        &copy; {new Date().getFullYear()} {branding.companyName}. Internal Workforce Operating System.
      </footer>
    </div>
  );
};

export default ManagementLoginPage;
