import { useState, useEffect, useCallback } from "react";
import { checkAdminExists, getAdminMe } from "../apis/fontApis";
import { useManagement } from "../context/ManagementContextProvider";
import { useAuth } from "../context/AuthContext";

/**
 * Custom React hook that verifies the existence of an admin account on mount
 * and provides a loading and authorized state to protect Admin dashboard routes.
 * Relies strictly on HTTP-only cookies and in-memory context state with zero localStorage.
 */
export const useAdminAuth = () => {
  const auth = useAuth();
  const { user: mgmtUser, role: mgmtRole, setUser, setRole } = useManagement();

  const user = auth?.user || mgmtUser;
  const role = auth?.role || mgmtRole || user?.role;
  const isAuthInitializing = auth?.isLoading || auth?.isInitializing;

  const [isLoading, setIsLoading] = useState(true);
  const [adminExists, setAdminExists] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(null);

  const isAdminRole = (r) => {
    const normalized = String(r || "").toLowerCase().trim();
    return (
      normalized === "admin" ||
      normalized === "company_admin" ||
      normalized === "manager"
    );
  };

  const verifyAdminStatus = useCallback(async () => {
    // If auth is still initializing session in AuthContext, do not evaluate
    if (isAuthInitializing) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. If active user in AuthContext is already an admin, authorize immediately
      if (user && (isAdminRole(user.role) || isAdminRole(role))) {
        setIsAuthorized(true);
        setAdminExists(true);
        setIsLoading(false);
        return { adminExists: true, isAuthorized: true };
      }

      // If user is actively logged in as employee, deny admin access
      if (user && user.role === "employee" && !isAdminRole(user.role)) {
        setIsAuthorized(false);
        setAdminExists(true);
        setIsLoading(false);
        return { adminExists: true, isAuthorized: false };
      }

      // 2. Check if an admin account exists in the database
      const existsRes = await checkAdminExists();
      const exists = Boolean(existsRes.data?.exists);
      setAdminExists(exists);

      if (!exists) {
        // No admin registered yet -> self-setup is required
        setIsAuthorized(false);
        setIsLoading(false);
        return { adminExists: false, isAuthorized: false };
      }

      // 3. Attempt server verification via HTTP-only cookie
      try {
        const profileRes = await getAdminMe();
        if (profileRes.data?.success && profileRes.data?.admin) {
          const adminUser = profileRes.data.admin;
          if (setUser) setUser(adminUser);
          if (setRole) setRole("admin");
          if (auth?.setUser) auth.setUser(adminUser);
          setIsAuthorized(true);
          setIsLoading(false);
          return { adminExists: true, isAuthorized: true };
        }
      } catch {
        // Cookie missing or not authorized
      }

      setIsAuthorized(false);
      setIsLoading(false);
      return { adminExists: true, isAuthorized: false };
    } catch (err) {
      console.warn("useAdminAuth verification error:", err);
      setError(err.message || "Failed to verify admin status.");
      const hasAdminAuth = role === "admin" || user?.role === "admin";
      setIsAuthorized(hasAdminAuth);
      setIsLoading(false);
      return { adminExists: true, isAuthorized: hasAdminAuth };
    }
  }, [user, role, setUser, setRole, isAuthInitializing, auth]);

  useEffect(() => {
    let isMounted = true;

    verifyAdminStatus().then(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [verifyAdminStatus]);

  const effectiveLoading = isLoading || Boolean(isAuthInitializing);

  return {
    isLoading: effectiveLoading,
    loading: effectiveLoading,
    adminExists,
    isAuthorized,
    isAuthenticated: isAuthorized,
    user,
    error,
    recheck: verifyAdminStatus,
  };
};

export default useAdminAuth;
