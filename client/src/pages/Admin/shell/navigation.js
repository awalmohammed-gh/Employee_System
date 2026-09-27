import { LayoutDashboard, Users, CalendarCheck, CalendarDays, Megaphone, Activity, Settings, Banknote } from "lucide-react";

/**
 * Admin navigation, grouped for the sidebar. `match` lists the router aliases that
 * should highlight an item (e.g. /payslips -> Payroll, /activity-logs -> Activity).
 */
export const adminNavGroups = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard, exact: true, title: "Dashboard" },
    ],
  },
  {
    label: "People",
    items: [
      { key: "employees", label: "Employees", path: "/admin/dashboard/employees", icon: Users, title: "Employees" },
      { key: "attendance", label: "Attendance", path: "/admin/dashboard/attendance", icon: CalendarCheck, title: "Attendance" },
      {
        key: "leave",
        label: "Leave requests",
        path: "/admin/dashboard/leave",
        icon: CalendarDays,
        match: ["/admin/dashboard/leave", "/admin/dashboard/leaves"],
        title: "Leave requests",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        key: "payroll",
        label: "Payroll",
        path: "/admin/dashboard/payroll",
        icon: Banknote,
        match: ["/admin/dashboard/payroll", "/admin/dashboard/payslips"],
        title: "Payroll",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { key: "announcements", label: "Announcements", path: "/admin/dashboard/announcements", icon: Megaphone, title: "Announcements" },
      {
        key: "activity",
        label: "Activity",
        path: "/admin/dashboard/activity",
        icon: Activity,
        match: ["/admin/dashboard/activity", "/admin/dashboard/activity-logs"],
        title: "Activity log",
      },
      { key: "settings", label: "Settings", path: "/admin/dashboard/settings", icon: Settings, title: "Settings" },
    ],
  },
];

export const adminNavItems = adminNavGroups.flatMap((g) => g.items);

const trimSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export const isNavItemActive = (item, pathname) => {
  const path = trimSlash(pathname);
  if (item.exact) return path === item.path;
  return (item.match || [item.path]).some((m) => path === m || path.startsWith(`${m}/`));
};

export const getActiveNavItem = (pathname) => adminNavItems.find((item) => isNavItemActive(item, pathname)) || adminNavItems[0];
