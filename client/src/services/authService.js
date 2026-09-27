import { apiService } from "../apis/axios";

/**
 * Centralized Authentication Service
 * Interacts with backend authentication endpoints via secure HTTP-only cookies.
 * Zero localStorage usage for tokens, credentials, or user profile records.
 */
export const authService = {
  /**
   * Unified login method supporting both Administrator and Employee roles
   */
  login: async ({ identifier, email, password, role = "admin", rememberMe = false }) => {
    const loginEmail = (identifier || email || "").trim();
    const loginPassword = password ? password.trim() : "";

    if (role === "admin") {
      const response = await apiService.post("/auth/admin/login", {
        identifier: loginEmail.toLowerCase(),
        email: loginEmail.toLowerCase(),
        password: loginPassword,
        rememberMe: Boolean(rememberMe),
        rememberDevice: Boolean(rememberMe),
      });

      if (response.data?.token) {
        apiService.setToken(response.data.token);
        authService.saveAuthSession(response.data.token, response.data.admin || response.data.user, "admin");
      }

      return response.data;
    } else {
      const response = await apiService.post("/auth/employee/login", {
        email: loginEmail, // supports both email and employeeId
        password: loginPassword,
        rememberMe: Boolean(rememberMe),
        rememberDevice: Boolean(rememberMe),
      });

      if (response.data?.token) {
        apiService.setToken(response.data.token);
        authService.saveAuthSession(response.data.token, response.data.employee || response.data.user, "employee");
      }

      // Verify and auto-populate active shift state immediately upon login via event
      if (response.data?.success) {
        const activeShift = response.data.activeShift;
        const todayRecord = response.data.todayRecord || response.data.attendance;
        const activeRecord =
          activeShift ||
          (todayRecord && (todayRecord.clockIn || todayRecord.clockInTime) && (!todayRecord.clockOut && !todayRecord.clockOutTime)
            ? todayRecord
            : null);

        if (activeRecord && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("attendance-updated", {
              detail: { action: "login_active_shift", data: activeRecord },
            })
          );
        } else if (todayRecord && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("attendance-updated", {
              detail: { action: "login_today_record", data: todayRecord },
            })
          );
        }
      }

      return response.data;
    }
  },

  /**
   * Dedicated Admin login method
   */
  adminLogin: async (credentials) => {
    return authService.login({ ...credentials, role: "admin" });
  },

  /**
   * Dedicated Employee login method
   */
  employeeLogin: async (credentials) => {
    return authService.login({ ...credentials, role: "employee" });
  },

  /**
   * Checks if an administrator account has been set up in the database
   */
  checkAdminExists: async () => {
    const response = await apiService.get("/auth/admin/exists");
    return response.data;
  },

  /**
   * Registers primary admin account
   */
  registerAdmin: async (data) => {
    const response = await apiService.post("/auth/admin/register", data);
    if (response.data?.token) {
      apiService.setToken(response.data.token);
      authService.saveAuthSession(response.data.token, response.data.admin || response.data.user, "admin");
    }
    return response.data;
  },

  /**
   * Retrieves current authenticated user profile using HTTP-only cookie or Bearer token
   */
  getCurrentUser: async () => {
    const response = await apiService.get("/auth/me");
    return response.data;
  },

  /**
   * Logs out user from backend session, explicitly clears local persistent keys and tokens,
   * and navigates to the public Welcome page
   */
  logout: async (role = "admin") => {
    try {
      if (role === "admin") {
        await apiService.post("/auth/admin/logout").catch(() => {});
      } else {
        await apiService.post("/auth/employee/logout").catch(() => {});
      }
      await apiService.post("/auth/logout").catch(() => {});
    } finally {
      authService.clearAuthSession();
      if (typeof window !== "undefined") {
        window.location.hash = "#/welcome";
      }
    }
  },

  /**
   * Persists authentication session
   */
  saveAuthSession: (token, user, role) => {
    if (typeof window === "undefined") return;
    try {
      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("auth_token", token);
      }
      if (user) {
        localStorage.setItem("app_user", JSON.stringify(user));
      }
      if (role) {
        localStorage.setItem("userRole", role);
      }
    } catch {
      // ignore
    }
  },

  /**
   * Clears all authentication session keys, tokens, and storage
   */
  clearAuthSession: () => {
    if (typeof window === "undefined") return;
    try {
      apiService.clearToken();
      // Tokens
      localStorage.removeItem("token");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("employeeToken");
      // User data and session keys
      localStorage.removeItem("adminData");
      localStorage.removeItem("employeeData");
      localStorage.removeItem("userRole");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("app_user");
      localStorage.removeItem("user");
      localStorage.removeItem("admin");
      localStorage.removeItem("employee");
      // Session storage
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("auth_token");
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("employeeToken");
      sessionStorage.removeItem("adminData");
      sessionStorage.removeItem("employeeData");
      sessionStorage.removeItem("userRole");
      sessionStorage.removeItem("isLoggedIn");
      sessionStorage.removeItem("app_user");
      sessionStorage.removeItem("user");
      sessionStorage.clear();
    } catch {
      // ignore
    }
  },

  /**
   * Sets active JWT token
   */
  setStoredToken: (token) => {
    apiService.setToken(token);
    if (typeof window !== "undefined" && token) {
      localStorage.setItem("token", token);
      localStorage.setItem("auth_token", token);
    }
  },

  /**
   * Retrieves active JWT token
   */
  getStoredToken: () => apiService.getToken(),

  /**
   * Retrieves active stored user
   */
  getStoredUser: () => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("app_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  /**
   * Retrieves active stored role (derived from location if context not ready)
   */
  getStoredRole: () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("userRole");
      if (saved) return saved;
      if (window.location.pathname.startsWith("/employee")) {
        return "employee";
      }
    }
    return "admin";
  },
};

export default authService;
