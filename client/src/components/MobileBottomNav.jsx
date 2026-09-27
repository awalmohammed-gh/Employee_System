import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Clock, Banknote, Calendar, Menu } from "lucide-react";
import MobileFeaturesDrawer from "./MobileFeaturesDrawer";

export const MobileBottomNav = ({ userRole = "employee" }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const homePath = userRole === "admin" ? "/admin/dashboard" : "/employee/dashboard";
  const attendancePath =
    userRole === "admin" ? "/admin/dashboard/attendance" : "/employee/dashboard/attendance";
  const payrollPath =
    userRole === "admin" ? "/admin/dashboard/payroll" : "/employee/dashboard/payslips";
  const leavesPath =
    userRole === "admin" ? "/admin/dashboard/leave" : "/employee/dashboard/leave";

  return (
    <>
      {/* Mobile-First Fixed Bottom Navigation Bar (< md) */}
      <nav
        aria-label="Mobile Navigation"
        id="mobile-bottom-navigation-bar"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-3 py-1.5 shadow-xl safe-bottom"
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Item 1: Home */}
          <NavLink
            to={homePath}
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-[#0B1E48] dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Home</span>
          </NavLink>

          {/* Item 2: Attendance */}
          <NavLink
            to={attendancePath}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-[#0B1E48] dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Attendance</span>
          </NavLink>

          {/* Item 3: Center Floating Menu Button */}
          <div className="relative -top-4 flex justify-center">
            <button
              type="button"
              id="btn-center-mobile-menu"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open Full Menu"
              className="w-12 h-12 rounded-full bg-[#0B1E48] text-white flex items-center justify-center shadow-lg shadow-blue-950/40 ring-4 ring-white dark:ring-slate-900 active:scale-95 transition-transform cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Item 4: Payslips / Payroll (Banknote Icon) */}
          <NavLink
            to={payrollPath}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-[#0B1E48] dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <Banknote className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">
              {userRole === "admin" ? "Payroll" : "Payslips"}
            </span>
          </NavLink>

          {/* Item 5: Leaves */}
          <NavLink
            to={leavesPath}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-[#0B1E48] dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`
            }
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">Leaves</span>
          </NavLink>
        </div>
      </nav>

      {/* Features Drawer with Icon-Only Grid & Floating Tooltips */}
      <MobileFeaturesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        userRole={userRole}
      />
    </>
  );
};

export default MobileBottomNav;
