import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, apiService } from "../apis/axios";
import { adminLogout, employeeLogout } from "../apis/fontApis";

const AuthContext = createContext(null);

/**
 * Explicitly clears all authentication session data, tokens, and persistent local keys.
 */
export const clearAllAuthSessionData = () => {
  if (typeof window === "undefined") return;
  try {
    apiService.clearToken();
    // Tokens
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("employeeToken");
    // User profile and session keys
    localStorage.removeItem("adminData");
    localStorage.removeItem("employeeData");
    localStorage.removeItem("app_user");
    localStorage.removeItem("user");
    localStorage.removeItem("admin");
    localStorage.removeItem("employee");
    localStorage.removeItem("userRole");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("companyName");
    // Session storage
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("employeeToken");
    sessionStorage.removeItem("adminData");
    sessionStorage.removeItem("employeeData");
    sessionStorage.removeItem("app_user");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.clear();
  } catch (err) {
    console.warn("Failed to clear local auth session keys:", err);
  }
};

/**
 * Authentication Context Provider
 * Uses HTTP-only cookies and in-memory context state.
 * Automatically hydrates user session via persistent checkSession effect on initial load and refresh.
 * Provides isInitializing state so ProtectedRoute can wait before deciding to redirect,
 * preserving the current route and eliminating redirection flicker.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Must default to true

  // Persistent Session Hydration restoring user session data from API call
  const checkSession = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data?.success && (res.data?.user || res.data?.employee || res.data?.admin)) {
        const fetchedUser = res.data.user || res.data.employee || res.data.admin;
        const resolvedRole = res.data.role || fetchedUser.role || (res.data.admin ? "admin" : "employee");
        const fullUser = {
          ...fetchedUser,
          role: resolvedRole,
        };
        setUser(fullUser);

        // Notify attendance if shift is active
        if (res.data.activeShift || res.data.hasActiveShift || res.data.todayRecord) {
          const ongoing = res.data.activeShift || res.data.todayRecord;
          if (ongoing && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("attendance-updated", {
                detail: { action: "auth_me_active_shift", data: ongoing },
              })
            );
          }
        }
        return fullUser;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false); // Only release the barrier after verification
    }
  }, []);

  // Persistent checkSession effect on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login handler
  const login = (userData, userRole = "admin", userToken = null, authPayload = null) => {
    const resolvedRole = userData?.role || userRole;

    if (userToken) {
      apiService.setToken(userToken);
      try {
        localStorage.setItem("token", userToken);
        localStorage.setItem("auth_token", userToken);
      } catch (err) {
        console.warn("Storage error saving token:", err);
      }
    }
    const resolvedUser = userData
      ? {
          ...userData,
          role: resolvedRole,
        }
      : null;
    setUser(resolvedUser);

    if (authPayload && typeof window !== "undefined") {
      const activeShift = authPayload.activeShift;
      const todayRec = authPayload.todayRecord || authPayload.attendance;
      const ongoing =
        activeShift ||
        (todayRec && (todayRec.clockIn || todayRec.clockInTime) && (!todayRec.clockOut && !todayRec.clockOutTime)
          ? todayRec
          : null);

      if (ongoing) {
        window.dispatchEvent(
          new CustomEvent("attendance-updated", {
            detail: { action: "auth_login_shift", data: ongoing },
          })
        );
      } else if (todayRec) {
        window.dispatchEvent(
          new CustomEvent("attendance-updated", {
            detail: { action: "auth_login_record", data: todayRec },
          })
        );
      }
    }
  };

  // Logout handler: explicitly clears session cookies, tokens, and local persistent keys,
  // then navigates the user to the Welcome Page to ensure a clean state
  const logout = async (customRedirectTarget = null) => {
    let redirectTarget = "/welcome";
    let roleToLogout = user?.role || "admin";

    if (
      customRedirectTarget === "admin" ||
      customRedirectTarget === "employee" ||
      customRedirectTarget === "manager"
    ) {
      roleToLogout = customRedirectTarget;
      redirectTarget = "/welcome";
    } else if (
      typeof customRedirectTarget === "string" &&
      (customRedirectTarget.startsWith("/") || customRedirectTarget.startsWith("#"))
    ) {
      redirectTarget = customRedirectTarget;
    }

    try {
      await api.post("/auth/logout").catch(() => {});
      if (roleToLogout === "admin" || roleToLogout === "manager") {
        await adminLogout().catch(() => {});
      } else {
        await employeeLogout().catch(() => {});
      }
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      clearAllAuthSessionData();
      setUser(null);

      // Navigate to /welcome to ensure a clean state
      if (typeof window !== "undefined") {
        const hashTarget = redirectTarget.startsWith("#")
          ? redirectTarget
          : redirectTarget.startsWith("/")
          ? `#${redirectTarget}`
          : `/#/${redirectTarget}`;
        if (window.location.hash !== hashTarget) {
          window.location.hash = hashTarget;
        }
      }
    }
  };

  const role = user ? user.role : null;
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        role,
        setRole: (newRole) => {
          setUser((prev) => (prev ? { ...prev, role: newRole } : prev));
        },
        token: user ? (apiService.getToken() || "cookie-session") : null,
        setToken: (token) => {
          if (token) apiService.setToken(token);
          else apiService.clearToken();
        },
        isAuthenticated,
        isLoading,
        isInitializing: isLoading,
        loading: isLoading,
        login,
        logout,
        checkSession,
        checkAuthSession: checkSession,
        refreshUser: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
