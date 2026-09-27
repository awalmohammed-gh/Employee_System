import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { adminNavGroups, adminNavItems, isNavItemActive } from "./navigation";
import { ui } from "../ui/tokens";

// Four primary destinations in the tab bar; everything is reachable from "More".
const PRIMARY = ["dashboard", "employees", "attendance", "payroll"];
const SHORT = { dashboard: "Home", employees: "Staff", attendance: "Attendance", payroll: "Payroll" };

/** Admin navigation for phones (< md): bottom tab bar plus a "More" sheet with every section. */
const AdminMobileNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useManagement();
  const [sheetOpen, setSheetOpen] = useState(false);

  const primaryItems = PRIMARY.map((k) => adminNavItems.find((i) => i.key === k));
  const moreActive = !primaryItems.some((i) => isNavItemActive(i, pathname));

  useEffect(() => setSheetOpen(false), [pathname]);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const handleLogout = async () => {
    setSheetOpen(false);
    if (logout) await logout("admin");
    navigate("/welcome");
  };

  const tabClass = (active) =>
    `relative grid place-items-center w-12 h-7 rounded-full transition-colors duration-150 ${
      active ? "bg-[#002185]/10 text-[#002185] dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"
    }`;
  const labelClass = (active) =>
    `text-[10.5px] leading-none ${active ? "font-semibold text-[#002185] dark:text-blue-300" : "font-medium text-slate-500 dark:text-slate-400"}`;

  return (
    <>
      <nav
        id="mobile-bottom-navigation-bar"
        aria-label="Admin navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 dark:bg-[#111927]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 safe-bottom"
      >
        <ul className="grid grid-cols-5 max-w-lg mx-auto px-2 pt-1.5">
          {primaryItems.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  to={item.path}
                  state={{ role: "admin" }}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1 py-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002185]/40"
                >
                  <span className={tabClass(active)}>
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 2} />
                  </span>
                  <span className={labelClass(active)}>{SHORT[item.key]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              id="btn-center-mobile-menu"
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="w-full flex flex-col items-center gap-1 py-1 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002185]/40"
            >
              <span className={tabClass(moreActive)}>
                <MoreHorizontal className="w-5 h-5" />
              </span>
              <span className={labelClass(moreActive)}>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {sheetOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            <motion.div
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSheetOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              id="mobile-features-drawer-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="All sections"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-[#111927] border-t border-slate-200/80 dark:border-slate-800 safe-bottom"
            >
              <div className="sticky top-0 flex items-center justify-between px-5 pt-4 pb-3 bg-white dark:bg-[#111927] border-b border-slate-100 dark:border-slate-800">
                <p className={ui.h2}>All sections</p>
                <button type="button" onClick={() => setSheetOpen(false)} className={ui.iconBtn} aria-label="Close">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="px-3 py-3 space-y-4">
                {adminNavGroups.map((group) => (
                  <div key={group.label}>
                    <p className={`${ui.eyebrow} px-2 mb-1.5`}>{group.label}</p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isNavItemActive(item, pathname);
                        const Icon = item.icon;
                        return (
                          <li key={item.key}>
                            <Link
                              to={item.path}
                              state={{ role: "admin" }}
                              aria-current={active ? "page" : undefined}
                              className={`flex items-center gap-3 h-11 px-3 rounded-xl text-sm transition-colors ${
                                active
                                  ? "bg-[#002185]/[0.07] text-[#002185] font-semibold dark:bg-blue-500/10 dark:text-blue-300"
                                  : "text-slate-700 font-medium hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              }`}
                            >
                              <Icon className={`w-4.5 h-4.5 ${active ? "" : "text-slate-400"}`} />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="px-3 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  id="mobile-features-drawer-logout-btn"
                  type="button"
                  onClick={handleLogout}
                  className="w-full mt-3 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminMobileNav;
