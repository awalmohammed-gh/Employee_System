import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import EmployeeSidebar from "../pages/Employees/EmployeeSidebar";
import EmployeeTopbar from "../pages/Employees/shell/EmployeeTopbar";
import EmployeeMobileNav from "../pages/Employees/shell/EmployeeMobileNav";
import ErrorBoundary from "../components/ErrorBoundary";
import { LoaderScopeContext } from "../components/ui/loaderScope";
import { pageVariants, reducedPageVariants } from "../utils/motion";

/**
 * Employee application shell (employee side only; admin keeps the shared AppLayout).
 * Sidebar from md up (icon rail on tablet, full on desktop), sticky top bar, bottom tab bar on phones.
 */
const EmployeesLayout = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const variants = shouldReduceMotion ? reducedPageVariants : pageVariants;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <EmployeeSidebar />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <EmployeeTopbar />

        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden pb-24 md:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full min-h-full"
            >
              <ErrorBoundary
                key={location.pathname}
                title="Failed to Load View"
                message="A client-side error occurred while rendering this page. You can try reloading the section or returning to the dashboard."
              >
                <LoaderScopeContext.Provider value="content">
                  <Outlet />
                </LoaderScopeContext.Provider>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        <EmployeeMobileNav />
      </div>
    </div>
  );
};

export default EmployeesLayout;
