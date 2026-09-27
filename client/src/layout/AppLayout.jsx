import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AdminSidebar from "../pages/Admin/AdminSidebar";
import EmployeeSidebar from "../pages/Employees/EmployeeSidebar";
import Navbar from "../components/Navbar";
import MobileBottomNav from "../components/MobileBottomNav";
import ErrorBoundary from "../components/ErrorBoundary";
import { pageVariants, reducedPageVariants } from "../utils/motion";

/**
 * AppLayout
 * Root layout component that conditionally renders the desktop Sidebar only on screens 'md' and above,
 * completely hiding it on mobile devices and tablet viewports to favor the mobile navigation drawer exclusively.
 */
export const AppLayout = ({ role: propRole }) => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  // Derive active role (admin vs employee)
  const isEmployee =
    propRole === "employee" || location.pathname.startsWith("/employee");
  const role = isEmployee ? "employee" : "admin";

  const activePageVariants = shouldReduceMotion ? reducedPageVariants : pageVariants;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-hidden">
      {/* Desktop Sidebar: Conditionally rendered only on screens 'md' and above (hidden on mobile) */}
      <aside className="hidden md:flex shrink-0 h-full z-20">
        {role === "admin" ? <AdminSidebar /> : <EmployeeSidebar />}
      </aside>

      {/* Main Content Viewport: Full-width on mobile without desktop sidebar offsets */}
      <div className="flex-1 w-full flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Unified Top Navigation Bar with right-aligned theme, bell, and user profile */}
        <Navbar role={role} />

        {/* Scrollable Page Content Area with Bottom Padding for Mobile Bottom Bar */}
        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-[#F8FAFC] dark:bg-slate-900 transition-colors duration-200 pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={activePageVariants}
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
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile-Exclusive Navigation Bar & Slide-Up Features Drawer */}
        <div className="block md:hidden">
          <MobileBottomNav userRole={role} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
