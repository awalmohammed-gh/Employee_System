import { Link, useLocation } from "react-router-dom";
import { useAttendance } from "../../../context/AttendanceContext";
import { employeeNavItems, isNavItemActive } from "./navigation";

/** Fixed bottom tab bar for phones (< md). Sign-out lives in the top bar account menu. */
const EmployeeMobileNav = () => {
  const { pathname } = useLocation();
  const { isClockedIn, isClockedOut } = useAttendance();
  const onShift = isClockedIn && !isClockedOut;

  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="Employee navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 dark:bg-[#111927]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 safe-bottom"
    >
      <ul className="grid grid-cols-5 max-w-lg mx-auto px-2 pt-1.5">
        {employeeNavItems.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.path}
                state={{ role: "employee" }}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 py-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002185]/40"
              >
                <span
                  className={`relative grid place-items-center w-12 h-7 rounded-full transition-colors duration-150 ${
                    active
                      ? "bg-[#002185]/10 text-[#002185] dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-slate-500 group-active:bg-slate-100 dark:text-slate-400 dark:group-active:bg-slate-800"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 2} />
                  {item.key === "attendance" && onShift && (
                    <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111927]" />
                  )}
                </span>
                <span
                  className={`text-[10.5px] leading-none ${
                    active ? "font-semibold text-[#002185] dark:text-blue-300" : "font-medium text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {item.shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default EmployeeMobileNav;
