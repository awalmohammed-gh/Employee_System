import { useState, useEffect, useMemo, memo } from "react";
import { Building2, Briefcase, IdCard, Mail } from "lucide-react";
import Avatar from "./Avatar";
import { useManagement } from "../context/ManagementContextProvider";
import { Badge } from "../pages/Employees/ui/primitives";
import { ui } from "../pages/Employees/ui/tokens";

const EmployeeProfileIdentityBannerComponent = ({
  employeeData,
  todayAttendance,
}) => {
  const { user } = useManagement();

  // Merge employee data from props and context
  const emp = useMemo(() => ({
    ...(user || {}),
    ...(employeeData || {}),
  }), [user, employeeData]);

  const fullName = emp.fullName || emp.full_name || emp.name || "Employee";
  const employeeId = emp.employeeId || emp.empId || emp.id || "EMP-1001";
  const department = emp.department || "Operations";
  const position = emp.position || emp.jobTitle || emp.role || "Team Member";
  const email = emp.email || "";

  // Dynamic avatar URL resolution with multi-level fallback
  const resolvedAvatar = useMemo(() => {
    return (
      employeeData?.avatar ||
      employeeData?.avatarUrl ||
      employeeData?.profilePicture ||
      employeeData?.profile_image_url ||
      employeeData?.profile_picture ||
      user?.avatar ||
      user?.avatarUrl ||
      user?.profilePicture ||
      user?.profile_image_url ||
      user?.profile_picture ||
      emp.avatar ||
      emp.profilePicture ||
      ""
    );
  }, [employeeData, user, emp.avatar, emp.profilePicture]);

  const [currentAvatar, setCurrentAvatar] = useState(resolvedAvatar);

  useEffect(() => {
    if (resolvedAvatar) {
      setCurrentAvatar(resolvedAvatar);
    }
  }, [resolvedAvatar]);

  // Listen for global avatar updates
  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      if (e.detail && typeof e.detail.avatarUrl !== "undefined") {
        setCurrentAvatar(e.detail.avatarUrl);
      }
    };
    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    return () => window.removeEventListener("avatarUpdated", handleAvatarUpdate);
  }, []);

  // Determine current attendance / shift status
  const isClockedIn = Boolean(todayAttendance?.clockIn && !todayAttendance?.clockOut);
  const isCompletedShift = Boolean(todayAttendance?.clockIn && todayAttendance?.clockOut);

  const shiftStatus = isClockedIn
    ? { label: "Active shift", tone: "success", dot: "bg-emerald-500", pulse: true }
    : isCompletedShift
    ? { label: "Shift completed", tone: "info", dot: "bg-blue-500", pulse: false }
    : { label: "Not clocked in", tone: "neutral", dot: "bg-slate-400", pulse: false };

  const meta = [
    { icon: Briefcase, value: position },
    { icon: Building2, value: department },
    { icon: IdCard, value: employeeId, mono: true },
    ...(email ? [{ icon: Mail, value: email, hideOnMobile: true }] : []),
  ];

  return (
    <section
      id="employee-visual-identity-banner"
      className={`${ui.card} relative overflow-hidden p-5 sm:p-6`}
    >
      {/* Brand accent strip */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#002185] via-[#002185] to-[#ff5500]" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative shrink-0 self-start sm:self-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-4 ring-slate-50 dark:ring-slate-800/60 bg-slate-100 dark:bg-slate-800 select-none">
            <Avatar
              src={currentAvatar}
              name={fullName}
              size="2xl"
              className="w-full h-full text-2xl font-bold"
              shape="rounded"
            />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-white dark:border-[#111927] ${shiftStatus.dot} ${shiftStatus.pulse ? "animate-pulse" : ""}`}
            title={shiftStatus.label}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white truncate">
              {fullName}
            </h2>
            <Badge tone={shiftStatus.tone} dot pulse={shiftStatus.pulse}>
              {shiftStatus.label}
            </Badge>
          </div>

          <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {meta.map(({ icon: Icon, value, mono, hideOnMobile }) => (
              <li
                key={`${value}`}
                className={`${hideOnMobile ? "hidden md:flex" : "flex"} items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 min-w-0`}
              >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={`truncate max-w-60 ${mono ? "font-mono text-[13px]" : ""}`}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export const EmployeeProfileIdentityBanner = memo(EmployeeProfileIdentityBannerComponent);
export default EmployeeProfileIdentityBanner;
