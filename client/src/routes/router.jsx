import {
  createHashRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from "react-router-dom";

import Attendance from "../pages/Admin/Attendance";
import Employees from "../pages/Admin/Employees";
import Payslips from "../pages/Admin/Payslips";
import PrintPayslips from "../pages/Admin/PrintPayslips";
import Settings from "../pages/Admin/Settings";
import AdminLayout from "../layout/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingPage from "../pages/LandingPage";
import WelcomePage from "../pages/WelcomePage";
import EmployeeLoginPage from "../pages/Auth/EmployeeLoginPage";
import ManagementLoginPage from "../pages/Auth/ManagementLoginPage";
import OnboardingGate from "./OnboardingGate";
import EmployeesLayout from "../layout/EmployeesLayout";
import EmployeesAttendance from "../pages/Employees/EmployeesAttendance";
import EmployeeLeave from "../pages/Employees/EmployeeLeave";
import EmployeePayslips from "../pages/Employees/EmployeePayslips";
import EmployeeSettings from "../pages/Employees/EmployeeSettings";
import EmployeeDashboard from "../pages/Employees/EmployeeDashboard";
import AdminDashboard from "../pages/Admin/AdminDashboard";
import Leave from "../pages/Admin/Leave";
import AdminAnnouncements from "../pages/Admin/Announcements";
import Activity from "../pages/Admin/Activity";

export const router = createHashRouter(
  createRoutesFromElements(
    <>
      {/* Public Landing Page */}
      <Route
        path="/"
        element={
          <OnboardingGate>
            <LandingPage />
          </OnboardingGate>
        }
      />
      <Route path="/landing" element={<Navigate to="/" replace />} />

      {/* Internal Welcome Portal (Role Selection Gateway) */}
      <Route
        path="/welcome"
        element={
          <OnboardingGate>
            <WelcomePage />
          </OnboardingGate>
        }
      />

      {/* Consolidated Admin Authentication (Unified Login & Sign Up) */}
      <Route
        path="/admin/auth"
        element={
          <OnboardingGate>
            <ManagementLoginPage />
          </OnboardingGate>
        }
      />
      <Route path="/admin/login" element={<Navigate to="/admin/auth" replace />} />
      <Route
        path="/management/login"
        element={<Navigate to="/admin/auth" replace />}
      />
      <Route path="/login/admin" element={<Navigate to="/admin/auth" replace />} />
      <Route path="/admin/register" element={<Navigate to="/admin/auth?mode=signup" replace />} />
      <Route path="/register/admin" element={<Navigate to="/admin/auth?mode=signup" replace />} />

      {/* Employee Authentication (Internal access) */}
      <Route
        path="/login"
        element={
          <OnboardingGate>
            <EmployeeLoginPage />
          </OnboardingGate>
        }
      />
      <Route
        path="/employee/login"
        element={
          <OnboardingGate>
            <EmployeeLoginPage />
          </OnboardingGate>
        }
      />
      <Route path="/login/employee" element={<Navigate to="/employee/login" replace />} />

      {/* Obsolete Multi-Tenant & Setup Route Redirects */}
      <Route path="/workspace" element={<Navigate to="/" replace />} />
      <Route path="/workspace/*" element={<Navigate to="/" replace />} />
      <Route path="/register-organization" element={<Navigate to="/" replace />} />
      {/* Retired setup URLs return to the landing page */}
      <Route path="/setup" element={<Navigate to="/" replace />} />
      <Route path="/admin/setup" element={<Navigate to="/" replace />} />
      <Route path="/system-setup" element={<Navigate to="/" replace />} />
      <Route path="/setup-company" element={<Navigate to="/" replace />} />
      <Route path="/setup-admin" element={<Navigate to="/" replace />} />

      {/* Admin Protected Routes */}
      <Route element={<ProtectedRoute allowRole="admin" />}>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="payroll" element={<Payslips />} />
          <Route path="payslips" element={<Payslips />} />
          <Route path="leave" element={<Leave />} />
          <Route path="leaves" element={<Leave />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="activity" element={<Activity />} />
          <Route path="activity-logs" element={<Activity />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        {/* Direct aliases */}
        <Route path="/admin/employees" element={<Navigate to="/admin/dashboard/employees" replace />} />
        <Route path="/admin/attendance" element={<Navigate to="/admin/dashboard/attendance" replace />} />
        <Route path="/admin/payroll" element={<Navigate to="/admin/dashboard/payroll" replace />} />
        <Route path="/admin/payslips" element={<Navigate to="/admin/dashboard/payroll" replace />} />
        <Route path="/admin/leave" element={<Navigate to="/admin/dashboard/leave" replace />} />
        <Route path="/admin/leaves" element={<Navigate to="/admin/dashboard/leave" replace />} />
        <Route path="/admin/announcements" element={<Navigate to="/admin/dashboard/announcements" replace />} />
        <Route path="/admin/activity" element={<Navigate to="/admin/dashboard/activity" replace />} />
        <Route path="/admin/activity-logs" element={<Navigate to="/admin/dashboard/activity" replace />} />
        <Route path="/admin/settings" element={<Navigate to="/admin/dashboard/settings" replace />} />
        <Route path="/print-payslips/:id" element={<PrintPayslips />} />
      </Route>

      {/* Employee Protected Routes */}
      <Route element={<ProtectedRoute allowRole="employee" />}>
        <Route path="/employee" element={<Navigate to="/employee/dashboard" replace />} />
        <Route path="/employee/dashboard" element={<EmployeesLayout />}>
          <Route index element={<EmployeeDashboard />} />
          <Route path="attendance" element={<EmployeesAttendance />} />
          <Route path="leave" element={<EmployeeLeave />} />
          <Route path="leaves" element={<EmployeeLeave />} />
          <Route path="payslips" element={<EmployeePayslips />} />
          <Route path="payroll" element={<EmployeePayslips />} />
          <Route path="settings" element={<EmployeeSettings />} />
        </Route>
        {/* Direct aliases */}
        <Route path="/employee/attendance" element={<Navigate to="/employee/dashboard/attendance" replace />} />
        <Route path="/employee/leave" element={<Navigate to="/employee/dashboard/leave" replace />} />
        <Route path="/employee/leaves" element={<Navigate to="/employee/dashboard/leave" replace />} />
        <Route path="/employee/payslips" element={<Navigate to="/employee/dashboard/payslips" replace />} />
        <Route path="/employee/payroll" element={<Navigate to="/employee/dashboard/payslips" replace />} />
        <Route path="/employee/settings" element={<Navigate to="/employee/dashboard/settings" replace />} />
      </Route>

      {/* Catch all - Redirect to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </>,
  ),
);

export default router;
