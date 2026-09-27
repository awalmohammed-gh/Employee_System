// Sidebar.jsx - Desktop Persistent Navigation Sidebar
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import { useManagement } from "../context/ManagementContextProvider";
import { useBranding } from "../context/BrandingContext";
import DefaultPlatformLogo from "./DefaultPlatformLogo";

export const Sidebar = ({
  children,
  role: propRole,
}) => {
  const navigate = useNavigate();
  const { role: contextRole, user, logout, company, companyLogoUrl } = useManagement();
  const { companyName, logoUrl } = useBranding();

  const resolvedLogo = company?.logoUrl || companyLogoUrl || logoUrl;
  const resolvedName = company?.name || company?.companyName || companyName || "WorkPulse";

  const isAdmin =
    propRole === "admin" ||
    (contextRole === "admin" && propRole !== "employee");

  const userRoleTitle = isAdmin
    ? "Administrator"
    : user?.position || "Staff Member";

  const handleLogout = async () => {
    if (logout) {
      await logout(isAdmin ? "admin" : "employee");
    }
    navigate("/welcome");
  };

  return (
    <aside
      id="desktop-persistent-sidebar"
      className="hidden md:flex flex-col h-full w-64 bg-white dark:bg-slate-900 border-r border-[#E2E8F0] dark:border-slate-800 shadow-xs shrink-0 z-10 transition-colors duration-200"
    >
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
        {/* Sidebar Brand Header */}
        <div className="h-16 px-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <motion.div layout key={resolvedLogo || resolvedName} className="shrink-0">
            {resolvedLogo ? (
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0">
                <motion.img
                  layout
                  src={resolvedLogo}
                  alt={resolvedName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Graceful fallback if image fails to resolve
                    e.target.style.display = "none";
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = "flex";
                    }
                  }}
                />
                {/* Fallback Icon if custom image fails to load */}
                <div className="hidden w-full h-full items-center justify-center bg-[#0B1E48] text-white font-bold text-sm rounded-lg">
                  {resolvedName.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <DefaultPlatformLogo className="w-10 h-10" />
            )}
          </motion.div>

          {/* Dynamic Company Label */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {resolvedName}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Workforce Suite
            </span>
          </div>
        </div>

        {/* User Role Badge */}
        <div className="mx-4 mt-4 mb-2 p-2.5 rounded-xl bg-[#002185] dark:bg-blue-700 text-white shadow-xs border border-[#002185]/20 dark:border-blue-500/30">
          <div className="flex items-center justify-center gap-2">
            {isAdmin ? (
              <ShieldCheck className="w-4 h-4 text-[#ff5500]" />
            ) : (
              <User className="w-4 h-4 text-[#ff5500]" />
            )}
            <span className="text-xs font-bold tracking-wide">{userRoleTitle}</span>
          </div>
        </div>

        {/* Navigation Links List */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {children}
        </nav>

        {/* Sidebar Footer with Logout */}
        <div className="px-3 pb-5 pt-3 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/50">
          <button
            id="sidebar-logout-button"
            type="button"
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 rounded-xl text-xs font-bold text-[#DC2626] dark:text-red-400 hover:bg-[#FEF2F2] dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer group border border-transparent hover:border-[#FEE2E2] dark:hover:border-red-900/30"
          >
            <LogOut className="w-4 h-4 text-[#DC2626] dark:text-red-400 group-hover:translate-x-0.5 transition-transform" />
            <span className="ml-2.5">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
