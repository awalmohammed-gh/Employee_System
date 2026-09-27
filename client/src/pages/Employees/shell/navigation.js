import { LayoutDashboard, Clock3, CalendarDays, Settings, Banknote } from "lucide-react";

/**
 * Employee navigation. `match` lists every route alias that should highlight the item,
 * so /leaves and /payroll (existing aliases in the router) activate the right entry.
 */
export const employeeNavItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    path: "/employee/dashboard",
    icon: LayoutDashboard,
    exact: true,
    title: "Dashboard",
  },
  {
    key: "attendance",
    label: "Attendance",
    shortLabel: "Attendance",
    path: "/employee/dashboard/attendance",
    icon: Clock3,
    match: ["/employee/dashboard/attendance"],
    title: "Attendance",
  },
  {
    key: "payslips",
    label: "Payslips",
    shortLabel: "Payslips",
    path: "/employee/dashboard/payslips",
    icon: Banknote,
    match: ["/employee/dashboard/payslips", "/employee/dashboard/payroll"],
    title: "Payslips",
  },
  {
    key: "leave",
    label: "Leave",
    shortLabel: "Leave",
    path: "/employee/dashboard/leave",
    icon: CalendarDays,
    match: ["/employee/dashboard/leave", "/employee/dashboard/leaves"],
    title: "Leave",
  },
  {
    key: "settings",
    label: "Settings",
    shortLabel: "Settings",
    path: "/employee/dashboard/settings",
    icon: Settings,
    match: ["/employee/dashboard/settings"],
    title: "Settings",
  },
];

const trimSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export const isNavItemActive = (item, pathname) => {
  const path = trimSlash(pathname);
  if (item.exact) return path === item.path;
  return (item.match || [item.path]).some((m) => path === m || path.startsWith(`${m}/`));
};

export const getActiveNavItem = (pathname) =>
  employeeNavItems.find((item) => isNavItemActive(item, pathname)) || employeeNavItems[0];
