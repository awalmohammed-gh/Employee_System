import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { useAttendance } from "../../../context/AttendanceContext";
import NotificationBell from "../../../components/NotificationBell";
import Avatar from "../../../components/Avatar";
import BrandMark, { useCompanyIdentity } from "./BrandMark";
import { getActiveNavItem } from "./navigation";
import { ui } from "../ui/tokens";

const todayLabel = () =>
  new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Employee top bar: page title (desktop) or brand (mobile), shift chip, notifications and account menu. */
const EmployeeTopbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useManagement();
  const { isClockedIn, isClockedOut } = useAttendance();
  const { name: companyName } = useCompanyIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeItem = getActiveNavItem(pathname);
  const fullName = (user?.fullName || user?.full_name || user?.name || "Staff Member").trim();
  const email = user?.email || "";
  const position = user?.position || user?.job_title || "Staff Member";
  const avatarSrc = user?.profilePicture || user?.avatar || user?.profile_image_url || user?.profile_picture;

  // Close the menu on outside click, Escape, or route change
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout("employee");
    navigate("/welcome");
  };

  const shift = isClockedOut
    ? { label: "Shift complete", dot: "bg-blue-500", className: "text-blue-700 bg-blue-50 border-blue-200/70 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20" }
    : isClockedIn
    ? { label: "On shift", dot: "bg-emerald-500 animate-pulse", className: "text-emerald-700 bg-emerald-50 border-emerald-200/70 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20" }
    : { label: "Not clocked in", dot: "bg-slate-400", className: "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700" };

  return (
    <header
      id="unified-dashboard-navbar"
      className="sticky top-0 z-30 w-full h-16 shrink-0 bg-white/85 dark:bg-[#111927]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="h-full w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">
        {/* Mobile: logo + current page. Tablet/desktop: current page + date */}
        <div className="flex md:hidden items-center gap-2.5 min-w-0">
          <BrandMark size="w-8 h-8" />
          <span className="flex flex-col min-w-0">
            <span className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight truncate">
              {activeItem.title}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{companyName}</span>
          </span>
        </div>
        <div className="hidden md:flex flex-col min-w-0">
          <span className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight truncate">
            {activeItem.title}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {todayLabel()}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <Link
            to="/employee/dashboard/attendance"
            className={`hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full border text-xs font-semibold transition-opacity hover:opacity-80 ${shift.className} ${ui.focusRing}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${shift.dot}`} />
            {shift.label}
          </Link>

          <div className="relative shrink-0">
            <NotificationBell role="employee" userId={user?.id || user?._id || user?.employeeId} />
          </div>

          <div className="relative" ref={menuRef}>
            <button
              id="user-profile-menu-trigger"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-2 rounded-xl border transition-colors cursor-pointer ${ui.focusRing} ${
                menuOpen
                  ? "bg-slate-50 border-slate-300 dark:bg-slate-800 dark:border-slate-600"
                  : "border-transparent hover:bg-slate-50 hover:border-slate-200 dark:hover:bg-slate-800/70 dark:hover:border-slate-700"
              }`}
            >
              <Avatar src={avatarSrc} name={fullName} size="sm" shape="rounded" className="w-8 h-8" />
              <span className="hidden lg:block text-left max-w-40">
                <span className="block text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                  {fullName}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                  {position}
                </span>
              </span>
              <ChevronDown
                className={`hidden sm:block w-4 h-4 text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  id="user-profile-dropdown-menu"
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] overflow-hidden z-50"
                >
                  <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                    <Avatar src={avatarSrc} name={fullName} size="md" shape="rounded" className="w-11 h-11" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{fullName}</p>
                      {email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>}
                      <p className="text-[11px] font-medium text-[#ff5500] mt-1 truncate">{position}</p>
                    </div>
                  </div>

                  {user?.employeeId && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Employee ID</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{user.employeeId}</span>
                    </div>
                  )}

                  <div className="p-1.5">
                    {[
                      { to: "/employee/dashboard/settings", label: "Profile & account settings", icon: Settings },
                      { to: "/employee/dashboard/leave", label: "Leave & time off", icon: CalendarDays },
                      { to: "/employee/dashboard/attendance", label: "My attendance", icon: UserRound },
                    ].map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 h-9 px-3 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors ${ui.focusRing}`}
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                        {label}
                      </Link>
                    ))}
                  </div>

                  <div className="p-1.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                      id="navbar-logout-btn"
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer ${ui.focusRing}`}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default EmployeeTopbar;
