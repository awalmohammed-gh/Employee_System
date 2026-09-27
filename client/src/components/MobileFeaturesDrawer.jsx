import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Clock,
  Banknote,
  Calendar,
  Megaphone,
  Activity,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import { useManagement } from "../context/ManagementContextProvider";

export const MobileFeaturesDrawer = ({
  isOpen = false,
  onClose = () => {},
  userRole = "employee",
}) => {
  const dragControls = useDragControls();
  const { logout } = useManagement();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    if (logout) {
      await logout(userRole === "admin" ? "admin" : "employee");
    }
    navigate("/welcome");
  };

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Back navigation / Esc key trigger dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const adminNavItems = [
    {
      to: "/admin/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      tint: "text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50",
    },
    {
      to: "/admin/dashboard/employees",
      label: "Staff",
      icon: Users,
      tint: "text-indigo-600 dark:text-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/50",
    },
    {
      to: "/admin/dashboard/attendance",
      label: "Clock",
      icon: Clock,
      tint: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50",
    },
    {
      to: "/admin/dashboard/payroll",
      label: "Payroll",
      icon: Banknote,
      tint: "text-amber-600 dark:text-amber-400 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50",
    },
    {
      to: "/admin/dashboard/leave",
      label: "Calendar",
      icon: Calendar,
      tint: "text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900/50",
    },
    {
      to: "/admin/dashboard/announcements",
      label: "Notices",
      icon: Megaphone,
      tint: "text-purple-600 dark:text-purple-400 bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/50",
    },
    {
      to: "/admin/dashboard/activity",
      label: "Activity",
      icon: Activity,
      tint: "text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50",
    },
    {
      to: "/admin/dashboard/settings",
      label: "Settings",
      icon: Settings,
      tint: "text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60",
    },
  ];

  const employeeNavItems = [
    {
      to: "/employee/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      tint: "text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50",
    },
    {
      to: "/employee/dashboard/attendance",
      label: "Clock",
      icon: Clock,
      tint: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50",
    },
    {
      to: "/employee/dashboard/payslips",
      label: "Payroll",
      icon: Banknote,
      tint: "text-amber-600 dark:text-amber-400 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50",
    },
    {
      to: "/employee/dashboard/leave",
      label: "Calendar",
      icon: Calendar,
      tint: "text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-900/50",
    },
    {
      to: "/employee/dashboard/settings",
      label: "Settings",
      icon: User,
      tint: "text-indigo-600 dark:text-indigo-400 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/50",
    },
  ];

  const currentNavItems = userRole === "admin" ? adminNavItems : employeeNavItems;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          {/* Native Scrim / Backdrop Overlay with Material Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Edge-to-Edge Android Material Bottom Sheet Container */}
          <motion.div
            id="mobile-features-drawer-sheet"
            variants={{
              hidden: { y: "100%" },
              visible: {
                y: 0,
                transition: {
                  type: "spring",
                  damping: 20,
                  stiffness: 280,
                  mass: 0.8,
                  restSpeed: 0.5,
                },
              },
              exit: {
                y: "100%",
                transition: {
                  duration: 0.22,
                  ease: [0.32, 0, 0.67, 0],
                },
              },
            }}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragSnapToOrigin={true}
            dragElastic={{ top: 0.04, bottom: 0.8 }}
            onDragEnd={(_event, info) => {
              // Natural dismissal when user drags down
              if (info.offset.y > 50 || info.velocity.y > 150) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-50 w-full rounded-t-[28px] bg-[#F8FAFC] dark:bg-[#1A2234] border-t border-slate-200/90 dark:border-slate-700/60 shadow-[0_-12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_-12px_36px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden select-none pb-5 safe-bottom"
          >
            {/* Touch-Sensitive Drag-Handle Pill Header */}
            <div
              className="w-full pt-3.5 pb-2.5 flex justify-center items-center touch-none cursor-grab active:cursor-grabbing group select-none"
              onPointerDown={(e) => dragControls.start(e)}
              onClick={onClose}
              role="button"
              tabIndex={0}
              aria-label="Drag down or tap to close sheet"
            >
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full transition-all group-hover:bg-slate-400 dark:group-hover:bg-slate-500 group-active:scale-95 group-active:bg-slate-500" />
            </div>

            {/* Structured 4-Column Android App Drawer Grid */}
            <div className="px-4 sm:px-6 pt-1.5 pb-2">
              <div className="grid grid-cols-4 gap-y-4 gap-x-2.5 max-w-sm mx-auto">
                {currentNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to.endsWith("/dashboard")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      className="group flex flex-col items-center justify-center gap-1.5 focus:outline-hidden"
                    >
                      {({ isActive }) => (
                        <>
                          {/* Android Material-Style Squircle Tile Container with Ripple / Active State Feedback */}
                          <div
                            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-150 overflow-hidden active:scale-[0.92] select-none cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:bg-current after:opacity-0 active:after:opacity-15 after:transition-opacity ${
                              isActive
                                ? "bg-[#0B1E48] text-white dark:bg-blue-600 dark:text-white shadow-md shadow-blue-950/20 ring-2 ring-[#0B1E48]/20 dark:ring-blue-400/40"
                                : `${item.tint} hover:shadow-xs`
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 shrink-0 stroke-[2.2] transition-transform ${
                                isActive ? "-translate-y-0.5" : ""
                              }`}
                            />
                            {/* Inner subtle pill indicator directly beneath the icon */}
                            {isActive && (
                              <span className="absolute bottom-1.5 w-5 h-1 rounded-full bg-white/85 dark:bg-white/90 shadow-2xs animate-in fade-in zoom-in-75 duration-200" />
                            )}
                          </div>

                          {/* Subtle pill-shaped indicator beneath the icon tile */}
                          <div className="h-1 flex items-center justify-center -my-0.5">
                            {isActive ? (
                              <span className="w-5 h-1 rounded-full bg-[#0B1E48] dark:bg-blue-400 shadow-2xs transition-all animate-in fade-in zoom-in-75 duration-200" />
                            ) : (
                              <span className="w-5 h-1 rounded-full bg-transparent" />
                            )}
                          </div>

                          {/* Clear Legible Micro-Label */}
                          <span
                            className={`text-[11px] leading-tight text-center tracking-tight truncate w-full px-0.5 ${
                              isActive
                                ? "font-bold text-[#0B1E48] dark:text-blue-400"
                                : "font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"
                            }`}
                          >
                            {item.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="w-full px-5 sm:px-7 my-1">
              <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80 max-w-sm mx-auto" />
            </div>

            {/* Dedicated Danger-Red Logout Action Button */}
            <div className="px-4 sm:px-6 pt-1 max-w-sm mx-auto w-full">
              <button
                type="button"
                id="mobile-features-drawer-logout-btn"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-red-50/85 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200/70 dark:border-red-900/50 text-xs font-semibold hover:bg-red-100/80 dark:hover:bg-red-950/60 active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-2xs group select-none"
              >
                <LogOut className="w-4 h-4 shrink-0 stroke-[2.2] transition-transform duration-150 group-hover:-translate-x-0.5 group-active:scale-90" />
                <span className="tracking-tight">Logout</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MobileFeaturesDrawer;

