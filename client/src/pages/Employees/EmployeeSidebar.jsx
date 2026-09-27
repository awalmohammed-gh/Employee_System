import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAttendance } from "../../context/AttendanceContext";
import { useManagement } from "../../context/ManagementContextProvider";
import Avatar from "../../components/Avatar";
import BrandMark, { useCompanyIdentity } from "./shell/BrandMark";
import { employeeNavItems, isNavItemActive } from "./shell/navigation";
import { ui } from "./ui/tokens";

/**
 * Employee sidebar.
 * md (tablet): compact 76px icon rail. lg and up: full 256px sidebar with labels.
 */
const EmployeeSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isClockedIn, isClockedOut } = useAttendance();
  const { user, logout } = useManagement();
  const { name: companyName } = useCompanyIdentity();

  const fullName = (user?.fullName || user?.full_name || user?.name || "Staff Member").trim();
  const position = user?.position || user?.job_title || "Staff Member";
  const avatarSrc = user?.profilePicture || user?.avatar || user?.profile_image_url || user?.profile_picture;

  const handleLogout = async () => {
    if (logout) await logout("employee");
    navigate("/welcome");
  };

  // Live shift indicator next to Attendance (same states as before: "On" while clocked in, "Done" after clock-out)
  const attendanceBadge = isClockedOut
    ? { label: "Done", className: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", dot: "bg-blue-500" }
    : isClockedIn
    ? { label: "On", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500 animate-pulse" }
    : null;

  return (
    <aside
      id="employee-sidebar"
      aria-label="Employee navigation"
      className="hidden md:flex flex-col h-full w-19 lg:w-64 shrink-0 bg-white dark:bg-[#111927] border-r border-slate-200/80 dark:border-slate-800 transition-[width] duration-200"
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-4 lg:px-5 border-b border-slate-100 dark:border-slate-800 justify-center lg:justify-start">
        <BrandMark />
        <div className="hidden lg:flex flex-col min-w-0">
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{companyName}</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Employee workspace</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-5">
        <p className={`${ui.eyebrow} hidden lg:block px-3 mb-2`}>Menu</p>
        <ul className="space-y-1">
          {employeeNavItems.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            const badge = item.key === "attendance" ? attendanceBadge : null;
            return (
              <li key={item.key}>
                <Link
                  to={item.path}
                  state={{ role: "employee" }}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 h-10 rounded-xl px-3 justify-center lg:justify-start text-sm transition-colors duration-150 ${ui.focusRing} ${
                    active
                      ? "bg-[#002185]/[0.07] text-[#002185] font-semibold dark:bg-blue-500/10 dark:text-blue-300"
                      : "text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full bg-[#ff5500]" />
                  )}
                  <span className="relative shrink-0">
                    <Icon
                      className={`w-4.5 h-4.5 ${
                        active ? "" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                      }`}
                      strokeWidth={active ? 2.2 : 2}
                    />
                    {badge && (
                      <span className={`lg:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#111927] ${badge.dot}`} />
                    )}
                  </span>
                  <span className="hidden lg:inline truncate">{item.label}</span>
                  {badge && (
                    <span
                      className={`hidden lg:inline-flex ml-auto items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${badge.className}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-3">
        <div className="hidden lg:flex items-center gap-3 px-2 py-2 mb-1 rounded-xl">
          <Avatar src={avatarSrc} name={fullName} size="sm" shape="rounded" className="w-9 h-9" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{fullName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{position}</p>
          </div>
        </div>
        <button
          id="sidebar-logout-button"
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className={`w-full flex items-center justify-center lg:justify-start gap-3 h-10 px-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors cursor-pointer ${ui.focusRing}`}
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          <span className="hidden lg:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default EmployeeSidebar;
