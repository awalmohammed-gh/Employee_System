import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAuth } from "../context/AuthContext";
import WorkspaceLoader from "../components/ui/WorkspaceLoader";

const ProtectedRoute = ({ allowRole }) => {
  const location = useLocation();
  const { user, role: authRole, isLoading: isAuthLoading, isInitializing } = useAuth();
  const { isLoading: isAdminLoading, adminExists, isAuthorized } = useAdminAuth();

  const effectiveRole = String(authRole || user?.role || "").toLowerCase().trim();

  // 1. Barrier: Wait for session hydration to complete before evaluating redirects.
  // This guarantees strict page persistence on browser refresh and avoids flash redirects.
  if (isInitializing || isAuthLoading || (allowRole === "admin" && isAdminLoading)) {
    return (
      <WorkspaceLoader
        fullScreen
        mode="auto"
      />
    );
  }

  // 2. Unauthenticated Barrier: Redirect to appropriate role login endpoint preserving location state
  if (!user) {
    const loginTarget = allowRole === "employee" ? "/employee/login" : "/admin/auth";
    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  // 3. Admin Protected Route Evaluation
  if (allowRole === "admin") {
    const isAdminUser =
      effectiveRole === "admin" ||
      effectiveRole === "company_admin" ||
      effectiveRole === "manager" ||
      isAuthorized;

    if (!isAdminUser) {
      // If a logged-in employee tries to access admin routes, keep them in employee portal
      if (effectiveRole === "employee") {
        return <Navigate to="/employee/dashboard" replace state={{ from: location }} />;
      }
      return <Navigate to="/admin/auth" replace state={{ from: location }} />;
    }

    if (adminExists === false && !isAuthorized && !isAdminUser) {
      return <Navigate to="/admin/auth" replace state={{ from: location }} />;
    }

    return <Outlet />;
  }

  // 4. Employee Protected Route Evaluation
  if (allowRole === "employee") {
    const isEmployeeAuthenticated =
      effectiveRole === "employee" ||
      effectiveRole === "admin" ||
      effectiveRole === "company_admin" ||
      effectiveRole === "manager" ||
      isAuthorized ||
      Boolean(user?.employeeId) ||
      Boolean(user?._id || user?.id);

    if (!isEmployeeAuthenticated) {
      return <Navigate to="/employee/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
