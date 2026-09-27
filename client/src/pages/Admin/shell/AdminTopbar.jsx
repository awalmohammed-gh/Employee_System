import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, ExternalLink, History, LogOut, Settings } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import NotificationBell from "../../../components/NotificationBell";
import Avatar from "../../../components/Avatar";
import BrandMark from "./BrandMark";
import { getActiveNavItem } from "./navigation";
import { ui } from "../ui/tokens";

const todayLabel = () =>
  new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Admin top bar: current page title (+ date), notifications and the account menu. */
const AdminTopbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, admin, logout } = useManagement();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeItem = getActiveNavItem(pathname);
  const fullName = (admin?.fullName || admin?.full_name || admin?.name || user?.fullName || user?.full_name || user?.name || "Administrator").trim();
  const roleTitle = user?.role === "manager" ? "Manager" : "Administrator";
  const email = admin?.email || user?.email || "";
  const avatarSrc = admin?.profile_image_url || admin?.avatar || user?.profile_image_url || user?.avatar;

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
    await logout("admin");
    navigate("/welcome");
  };

  const menuLinks = [
    { to: "/admin/dashboard/settings", label: "Profile & account settings", icon: Settings },
    { to: "/admin/dashboard/leave", label: "Leave & time off", icon: CalendarDays },
    { to: "/admin/dashboard/activity", label: "Activity audit trail", icon: History },
  ];

  return (
    <header
      id="unified-dashboard-navbar"
      className="sticky top-0 z-30 w-full h-16 shrink-0 bg-white/85 dark:bg-[#111927]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800"
    >
      <div className="h-full w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="md:hidden">
            <BrandMark size="w-8 h-8" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight truncate">{activeItem.title}</span>
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
              <CalendarDays className="hidden sm:block w-3.5 h-3.5 shrink-0" />
              {todayLabel()}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <div className="relative shrink-0">
            <NotificationBell role="admin" userId={user?.id || user?._id || user?.employeeId} />
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
              <Avatar src={avatarSrc} name={roleTitle} size="sm" shape="rounded" className="w-8 h-8" />
              <span className="hidden lg:block text-left max-w-40">
                <span className="block text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">{fullName}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">{roleTitle}</span>
              </span>
              <ChevronDown className={`hidden sm:block w-4 h-4 text-slate-400 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
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
                    <Avatar src={avatarSrc} name={roleTitle} size="md" shape="rounded" className="w-11 h-11" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{fullName}</p>
                      {email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>}
                      <p className="text-[11px] font-medium text-[#002185] dark:text-blue-300 mt-1">{roleTitle}</p>
                    </div>
                  </div>

                  <div className="p-1.5">
                    {menuLinks.map(({ to, label, icon: Icon }) => (
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
                    <Link
                      to="/employee/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between gap-3 h-9 px-3 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors ${ui.focusRing}`}
                    >
                      <span className="flex items-center gap-3">
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                        Switch to employee view
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Preview
                      </span>
                    </Link>
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

export default AdminTopbar;
