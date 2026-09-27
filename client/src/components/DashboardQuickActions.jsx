import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  X,
  UserPlus,
  CalendarCheck,
  Banknote,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { buttonPressProps } from "../utils/motion";

export const DashboardQuickActions = ({
  onOpenAddEmployee,
  onOpenRecordAttendance,
  onOpenProcessPayroll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleActionClick = (actionFn) => {
    setIsOpen(false);
    if (typeof actionFn === "function") {
      actionFn();
    }
  };

  return (
    <div
      ref={menuRef}
      id="dashboard-floating-quick-actions-container"
      className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 md:right-8 z-40"
    >
      {/* Popover Speed Dial Menu with Framer Motion Blooming Animation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="dashboard-quick-actions-popover"
            role="menu"
            aria-label="Quick Actions Menu"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="absolute bottom-full mb-3 right-0 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-2xl bg-white/95 dark:bg-[#111927]/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-950/20 p-3 z-50 origin-bottom-right"
          >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-blue-500/10 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Quick Actions
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
                  Instant administrative workflows
                </span>
              </div>
            </div>
            <button
              id="btn-close-quick-actions-menu"
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action 1: Add Employee */}
          <button
            id="quick-action-add-employee"
            type="button"
            role="menuitem"
            onClick={() => handleActionClick(onOpenAddEmployee)}
            className="w-full text-left p-2.5 rounded-xl sm:rounded-2xl transition-all duration-150 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800/60 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 block transition-colors">
                  Add Employee
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Register new staff member & credentials
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Action 2: Record Attendance */}
          <button
            id="quick-action-record-attendance"
            type="button"
            role="menuitem"
            onClick={() => handleActionClick(onOpenRecordAttendance)}
            className="w-full text-left p-2.5 rounded-xl sm:rounded-2xl transition-all duration-150 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 group border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/60 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 block transition-colors">
                  Record Attendance
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Log check-in, check-out, or manual entry
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Action 3: Process Payroll */}
          <button
            id="quick-action-process-payroll"
            type="button"
            role="menuitem"
            onClick={() => handleActionClick(onOpenProcessPayroll)}
            className="w-full text-left p-2.5 rounded-xl sm:rounded-2xl transition-all duration-150 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 group border border-transparent hover:border-amber-200 dark:hover:border-amber-800/60 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 block transition-colors">
                  Process Payroll
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Generate payslip & itemized salary calculation
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Direct Navigation Quick Shortcuts */}
          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between px-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Jump To
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <button
                id="quick-link-employees"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/admin/dashboard/employees");
                }}
                className="px-2 py-1 rounded-md text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Directory
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                id="quick-link-attendance"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/admin/dashboard/attendance");
                }}
                className="px-2 py-1 rounded-md text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Attendance
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <button
                id="quick-link-payroll"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/admin/dashboard/payroll");
                }}
                className="px-2 py-1 rounded-md text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Payroll
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Floating Trigger Button (FAB) */}
      <motion.button
        id="floating-quick-actions-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.12 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex items-center gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full text-white font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-lg ${
          isOpen
            ? "bg-slate-900 dark:bg-[#162033] ring-4 ring-blue-500/20 shadow-slate-950/30"
            : "bg-[#002185] hover:bg-[#081b5c] dark:bg-blue-600 dark:hover:bg-blue-700 shadow-blue-900/30 hover:shadow-xl hover:shadow-blue-900/40"
        }`}
        title="Quick Actions Menu"
      >
        <span className="relative flex items-center justify-center">
          <Zap
            className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-300 ${
              isOpen ? "rotate-90 text-amber-400" : "group-hover:rotate-12 text-white"
            }`}
          />
        </span>
        <span className="tracking-tight whitespace-nowrap">Quick Actions</span>
        <span
          className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] transition-colors ${
            isOpen
              ? "bg-white/20 text-white"
              : "bg-white/20 text-white group-hover:bg-white/30"
          }`}
        >
          {isOpen ? "×" : "+"}
        </span>
      </motion.button>
    </div>
  );
};

export default DashboardQuickActions;
