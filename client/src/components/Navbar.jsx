import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Calendar,
  ExternalLink,
  CheckCircle2,
  History,
} from "lucide-react";
import { useManagement } from "../context/ManagementContextProvider";
import NotificationBell from "./NotificationBell";
import Avatar from "./Avatar";

// Helper to extract dynamic initials from full name
const getInitials = (name, fallback = "EM") => {
  if (!name || typeof name !== "string") return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Navbar = ({ role: propsRole }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, admin, role: contextRole, logout } = useManagement();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Derive active role: strictly differentiate Employee vs Admin
  const isEmployeeRoute = location.pathname.startsWith("/employee");
  const isAdminRoute = location.pathname.startsWith("/admin");

  const isAdmin =
    propsRole === "admin" ||
    (!propsRole && isAdminRoute) ||
    ((user?.role === "admin" || user?.is_admin === true || contextRole === "admin") &&
      !isEmployeeRoute &&
      propsRole !== "employee");

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Handle Logout
  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    await logout(isAdmin ? "admin" : "employee");
    navigate("/welcome");
  };

  // Role-specific Data Resolution
  const employeeFullName = (
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    "Staff Member"
  ).trim();
  const employeeEmail = user?.email || "";
  const employeePosition = user?.position || user?.job_title || "Staff Member";
  const employeeInitials = getInitials(employeeFullName, "EM");

  const adminFullName = (
    admin?.fullName ||
    admin?.full_name ||
    admin?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    "Administrator"
  ).trim();
  const adminTitle = user?.role === "manager" ? "Manager" : "Administrator";
  const adminInitials = getInitials(adminFullName, "AD");

  return (
    <header
      id="unified-dashboard-navbar"
      className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-slate-800 shadow-xs transition-colors duration-200"
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end h-16 w-full">
          {/* Right Section: Notification Bell + User Profile Menu */}
          <div className="flex items-center justify-end ml-auto gap-2 sm:gap-3.5">
            {/* Notification Bell */}
            <div className="relative shrink-0">
              <NotificationBell
                role={isAdmin ? "admin" : "employee"}
                userId={user?.id || user?._id || user?.employeeId}
              />
            </div>

            {/* User Profile Badge Trigger & Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                id="user-profile-menu-trigger"
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className={`flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isProfileMenuOpen
                    ? "bg-[#F8FAFC] dark:bg-slate-800 border-[#002185] dark:border-blue-500 shadow-md scale-[1.02]"
                    : "bg-white dark:bg-slate-900 border-[#E2E8F0] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:border-[#CBD5E1] dark:hover:border-slate-600 hover:shadow-sm"
                }`}
              >
                {/* Dynamic Avatar with Initials */}
                <div className="relative shrink-0">
                  <Avatar
                    src={
                      isAdmin
                        ? admin?.profile_image_url || admin?.avatar || user?.profile_image_url || user?.avatar
                        : user?.profilePicture || user?.avatar || user?.profile_image_url || user?.profile_picture
                    }
                    name={isAdmin ? adminTitle : employeeFullName}
                    size="sm"
                    shape="rounded"
                    className="w-8 h-8 sm:w-9 sm:h-9 shadow-md"
                    fallbackInitials={isAdmin ? adminInitials : employeeInitials}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#16A34A] border-2 border-white dark:border-slate-900 rounded-full shadow-sm"></span>
                </div>

                {/* Profile Display Text (Right Side) */}
                <div className="hidden sm:block text-left max-w-[130px] md:max-w-[170px] lg:max-w-[200px]">
                  {isAdmin ? (
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate leading-tight">
                      {adminTitle}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate leading-tight">
                        {employeeFullName}
                      </p>
                      <p
                        className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium truncate leading-tight mt-0.5"
                        title={employeeEmail}
                      >
                        {employeeEmail}
                      </p>
                    </>
                  )}
                </div>

                {/* Dropdown Chevron */}
                <ChevronDown
                  className={`w-4 h-4 text-[#64748B] dark:text-slate-400 transition-all duration-300 shrink-0 ${
                    isProfileMenuOpen ? "rotate-180 text-[#002185] dark:text-blue-400" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div
                  id="user-profile-dropdown-menu"
                  className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl z-[1001] py-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {/* Dropdown Header Card */}
                  <div className="px-4 py-3.5 border-b border-[#F1F5F9] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-850">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={
                          isAdmin
                            ? admin?.profile_image_url || admin?.avatar || user?.profile_image_url || user?.avatar
                            : user?.profilePicture || user?.avatar || user?.profile_image_url || user?.profile_picture
                        }
                        name={isAdmin ? adminTitle : employeeFullName}
                        size="md"
                        shape="rounded"
                        className="w-11 h-11 shadow-md"
                        fallbackInitials={isAdmin ? adminInitials : employeeInitials}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F172A] dark:text-slate-100 truncate">
                          {isAdmin ? adminTitle : employeeFullName}
                        </p>
                        {!isAdmin && (
                          <p className="text-xs text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                            {employeeEmail}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isAdmin
                                ? "bg-[#002185] text-white shadow-sm"
                                : "bg-[#ff5500] text-white shadow-sm"
                            }`}
                          >
                            {isAdmin ? adminTitle : employeePosition}
                          </span>
                          <span className="text-[10px] text-[#64748B] dark:text-slate-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Meta Information */}
                  <div className="px-4 py-3 border-b border-[#F1F5F9] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400 space-y-2 bg-white dark:bg-slate-900">
                    {!isAdmin && user?.employeeId && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#94A3B8]" />
                          Employee ID
                        </span>
                        <span className="font-semibold text-[#002185] dark:text-blue-400">
                          {user.employeeId}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1 px-2 space-y-0.5">
                    <Link
                      to={
                        isAdmin
                          ? "/admin/dashboard/settings"
                          : "/employee/dashboard/settings"
                      }
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#002185] dark:hover:text-blue-400 rounded-xl transition-colors duration-150"
                      role="menuitem"
                    >
                      <Settings className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                      <span>Profile & Account Settings</span>
                    </Link>

                    <Link
                      to={
                        isAdmin
                          ? "/admin/dashboard/leave"
                          : "/employee/dashboard/leave"
                      }
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#002185] dark:hover:text-blue-400 rounded-xl transition-colors duration-150"
                      role="menuitem"
                    >
                      <Calendar className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                      <span>Leave & Time Off</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin/dashboard/activity"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-[#0F172A] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#002185] dark:hover:text-blue-400 rounded-xl transition-colors duration-150"
                        role="menuitem"
                      >
                        <History className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                        <span>Activity Audit Trail</span>
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        to="/employee/dashboard"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#64748B] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#002185] dark:hover:text-blue-400 rounded-xl transition-colors duration-150"
                        role="menuitem"
                      >
                        <span className="flex items-center gap-3">
                          <ExternalLink className="w-4 h-4 text-[#64748B] dark:text-slate-400" />
                          <span>Switch to Employee View</span>
                        </span>
                        <span className="text-[10px] bg-[#E2E8F0] dark:bg-slate-800 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                          Preview
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[#F1F5F9] dark:border-slate-800 my-1" />

                  {/* Logout Button */}
                  <div className="px-2 py-1">
                    <button
                      id="navbar-logout-btn"
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-[#DC2626] dark:text-red-400 hover:bg-[#FEF2F2] dark:hover:bg-red-950/30 rounded-xl transition-all duration-200 group cursor-pointer"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                      <span>Log out of account</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
