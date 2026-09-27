import { api } from "./axios";

// function for admin to create account / add employee
export const employeeAccount = (data) => {
  return api.post("/employee/employee-account", data);
};
export const createEmployee = (data) => {
  return api.post("/employee/employee-account", data);
};
export const addEmployee = (data) => {
  return api.post("/employee/employee-account", data);
};

// employee directory & listing
export const allEmployees = () => {
  return api.get("/employee/all-employees");
};
export const getEmployees = () => {
  return api.get("/employee/all-employees");
};
export const fetchEmployeeDirectory = () => {
  return api.get("/employee/all-employees");
};

export const getEmployeeProfile = (id) => {
  return api.get(`/employee/profile/${id}`);
};

export const namesList = () => {
  return api.get("/employee/list-employee-name");
};

export const getEmployee = () => {
  return api.get("/employee/me");
};
export const getEmployeeMe = () => {
  return api.get("/employee/me");
};
export const updateEmployeeMe = (data) => {
  return api.put("/employee/me", data);
};
export const changeEmployeePassword = (data) => {
  return api.put("/employee/change-password", data);
};

export const updateEmployeeStatus = (id, status) => {
  return api.put(`/admin/employees/${id}/status`, { status });
};

export const bulkUpdateEmployees = (employeeIds, updates) => {
  return api.patch("/admin/employees/bulk-update", { employeeIds, updates });
};

export const bulkDeleteEmployees = (employeeIds) => {
  return api.post("/admin/employees/bulk-delete", { employeeIds });
};

export const deleteEmployee = (id) => {
  return api.delete(`/admin/employees/${id}`);
};

// authentication & registration endpoints
export const checkAdminExists = () => {
  return api.get("/auth/admin/exists");
};

export const adminRegister = (data) => {
  return api.post("/auth/admin/register", data);
};

export const adminLogin = (data) => {
  return api.post("/auth/admin/login", data);
};

export const employeeLogin = (data) => {
  return api.post("/auth/employee/login", data);
};

export const authLogout = () => {
  return api.post("/auth/logout");
};

export const getAuthMe = () => {
  return api.get("/auth/me");
};

export const employeeLogout = () => {
  return api.post("/auth/employee/logout");
};

// admin user & employee management
export const createUserAccount = (data) => {
  return api.post("/admin/create-user", data);
};

export const createEmployeeUser = (data) => {
  return api.post("/admin/create-user", data);
};

export const bulkUploadEmployees = (dataOrFormData) => {
  if (dataOrFormData instanceof FormData) {
    return api.post("/employee/bulk-upload", dataOrFormData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  return api.post("/employee/bulk-upload", dataOrFormData);
};

export const bulkImportEmployees = bulkUploadEmployees;

// legacy aliases for backward compatibility
export const adminLog = (data) => {
  return api.post("/auth/admin/login", data);
};
export const adminLogout = () => {
  return api.post("/auth/admin/logout");
};
export const getAdminMe = () => {
  return api.get("/admin/me");
};
export const getAdminProfile = () => {
  return api.get("/admin/me");
};
export const updateAdminProfile = (data) => {
  return api.put("/admin/profile", data);
};
export const changeAdminPassword = (data) => {
  return api.put("/admin/change-password", data);
};
export const updateAdminSettings = (data) => {
  return api.put("/admin/settings", data);
};
export const getPenaltySettings = () => {
  return api.get("/admin/settings/penalties");
};
export const updatePenaltySettings = (data) => {
  return api.put("/admin/settings/penalties", data);
};
export const createAdminAccount = (data) => {
  return api.post("/auth/admin/register", data);
};


//generate payroll
export const payrollGenerate = (data) => {
  return api.post("/admin/payroll/generate", data).catch(() => {
    return api.post("/pay/generate", data);
  });
};

export const calculateEmployeePayroll = (params) => {
  return api.get("/admin/payroll/calculate-employee", { params }).catch(() => {
    return api.get("/pay/calculate-summary", { params });
  });
};

export const calculatePayrollSummary = (params) => {
  return api.get("/admin/payroll/calculate-employee", { params }).catch(() => {
    return api.get("/pay/calculate-summary", { params });
  });
};

export const getAllPayslips = (params) => {
  const config = params && params.params ? params : { params };
  return api.get("/admin/payroll/records", config).catch(() => {
    return api.get("/pay/payslips", config);
  });
};

export const getPayrollRecords = (params) => {
  const config = params && params.params ? params : { params };
  return api.get("/admin/payroll/records", config).catch(() => {
    return api.get("/pay/records", config).catch(() => {
      return api.get("/pay/payslips", config);
    });
  });
};

export const getPayrollById = (id) => {
  return api.get(`/pay/${id}`);
};

export const getPayslipDetails = (id) => {
  return api.get(`/pay/payslip/${id}`);
};

export const updatePayrollStatus = (id, data) => {
  return api.put(`/pay/status/${id}`, data);
};

export const deletePayroll = (id) => {
  return api.delete(`/admin/payroll/${id}`).catch(() => {
    return api.delete(`/pay/${id}`);
  });
};

export const exportPayrollReport = (params) => {
  return api.get("/pay/export", { params });
};

export const getPayrollAnalytics = (params) => {
  return api.get("/pay/analytics", { params });
};

export const getPayrollCycles = (params) => {
  return api.get("/admin/payroll/cycles", { params }).catch(() => {
    return api.get("/pay/cycles", { params });
  });
};

export const getPenaltyImpactAnalytics = (params) => {
  return api.get("/admin/analytics/penalty-impact", { params }).catch(() => {
    return api.get("/pay/penalty-impact", { params });
  });
};

export const getMonthlyLatenessAnalytics = (params) => {
  return api
    .get("/admin/analytics/monthly-lateness-deductions", { params })
    .catch(() => api.get("/pay/monthly-lateness-deductions", { params }))
    .catch(() => api.get("/employee/monthly-lateness-deductions", { params }));
};

export const getEmployeeLivePayrollSummary = (params) => {
  return api.get("/pay/live-summary", { params });
};

export const getMonthlyPayrollRun = (params) => {
  return api.get("/admin/payroll/monthly-run", { params }).catch(() => {
    return api.get("/pay/monthly-run", { params });
  });
};

export const getSalaryProjection = (params) => {
  return api.get("/employee/salary-projection/current", { params });
};

export const getCurrentSalaryProjection = (params) => {
  return api.get("/employee/salary-projection/current", { params });
};

export const calculateSalaryProjection = (data) => {
  return api.post("/employee/salary-projection", data);
};

export const getEmployeePayslip = () => {
  return api.get("/employee/payslips/my-payslips").catch(() => {
    return api.get("/pay/employee-payslip");
  });
};

export const getMyPayslips = () => {
  return api.get("/employee/payslips/my-payslips").catch(() => {
    return api.get("/pay/employee-payslip");
  });
};

export const syncAttendance = (data = {}) => {
  return api.post("/attendance/sync", data);
};

export const syncAttendancePenalties = (data = {}) => {
  return api.post("/attendance/sync-penalties", data);
};

//attendance
export const attendanceClockIn = (data = {}) => {
  return api.post("/attendance/clock-in", data);
};

export const attendanceClockOut = (data = {}) => {
  return api.post("/attendance/clock-out", data);
};

export const getTodayAttendance = () => {
  return api.get("/attendance/today");
};

export const getTodayAttendanceStatus = () => {
  return api.get("/attendance/today-status");
};

export const getEmployeeAttendance = () => {
  return api.get("/attendance/attendance");
};

// Signed-in employee's own attendance/absence history (server resolves the employee from the token)
export const getMyAttendanceHistory = () => {
  return api.get("/attendance/my-history");
};

// Admin: attendance/absence history for one employee (Employee Details → Attendance)
export const getEmployeeAttendanceHistory = (employeeId) => {
  return api.get(`/attendance/employee/${encodeURIComponent(employeeId)}/history`);
};

export const getAllAttendance = () =>{
  return api.get("/attendance/all");
}

export const getDailyStats = () => {
  return api.get("/admin/daily-stats");
};

export const getAdminDailyStats = () => {
  return api.get("/admin/daily-stats");
};

export const getCompanyProfile = () => {
  return api.get("/company/profile");
};

export const getNowAttendance = () =>{
  return api.get("/attendance/now");
}

export const updateAttendanceRecord = (id, data) => {
  return api.put(`/attendance/record/${id}`, data);
};

export const excuseAttendanceRecord = (id, data) => {
  return api.put(`/attendance/record/${id}/excuse`, data);
};

export const flagAttendanceRecord = (id, data) => {
  return api.put(`/attendance/record/${id}/flag`, data);
};

export const unflagAttendanceRecord = (id) => {
  return api.put(`/attendance/record/${id}/unflag`);
};

export const recalculateAttendanceRecord = (id) => {
  return api.put(`/attendance/record/${id}/recalculate`);
};

export const deleteAttendanceRecord = (id) => {
  return api.delete(`/attendance/${id}`);
};

export const createManualAttendanceRecord = (data) => {
  return api.post("/attendance/manual-record", data);
};

export const overrideAttendanceRecord = (data, id = null) => {
  if (id) {
    return api.put(`/admin/attendance/${id}/override`, data).catch(() => api.put(`/attendance/record/${id}`, data));
  }
  return api.post("/admin/attendance/override", data).catch(() => api.post("/attendance/manual-record", data));
};


export const bulkUploadBiometricAttendance = (data) => {
  return api.post("/attendance/bulk-upload", data);
};




//dashboard
export const adminDashboardOverview = () =>{
  return api.get("/dashboard/admin-dashboard")
}

export const getAdminDashboardStats = () => {
  return api.get("/admin/dashboard-stats");
};

export const getAdminPayrollSummary = (params) => {
  const queryParams = typeof params === "string" ? { month: params } : params;
  return api.get("/admin/payroll/summary", { params: queryParams });
};

export const employeeDashboardOverview = () =>{
  return api.get("/dashboard/employee-dashboard");
}

export const getDashboardNotifications = (params) => {
  return api.get("/notifications", { params });
};

export const getNotifications = (params) => {
  return api.get("/notifications", { params });
};

export const markNotificationAsRead = (id) => {
  return api.put(`/notifications/${id}/read`, {});
};

export const markNotificationAsUnread = (id) => {
  return api.put(`/notifications/${id}/unread`, {});
};

export const toggleNotificationRead = (id) => {
  return api.patch(`/notifications/${id}/toggle`, {});
};

export const markAllNotificationsAsRead = (params) => {
  return api.patch("/notifications/read-all", {}, { params });
};

export const deleteNotification = (id) => {
  return api.delete(`/notifications/${id}`);
};

export const deleteAllNotifications = (params) => {
  return api.delete("/notifications", { params });
};



// leave
export const applyForLeave = (data) => {
  return api.post("/leave/apply", data).catch(() => {
    return api.post("/employee/leave/apply", data);
  });
};

export const myLeave = () => {
  return api.get("/employee/leave-requests").catch(() => {
    return api.get("/leave/my-leaves");
  });
};

export const getEmployeeLeaveRequests = () => {
  return api.get("/employee/leave-requests").catch(() => {
    return api.get("/leave/my-leaves");
  });
};

export const allLeaves = () => {
  return api.get("/admin/leave/all").catch(() => {
    return api.get("/leave/all");
  });
};

export const updateStatus = (id, status, adminRemark = "", adminNotes = "") => {
  const payload = {
    status,
    adminRemark: adminRemark || adminNotes,
    adminNotes: adminNotes || adminRemark,
  };
  return api.patch(`/admin/leave/${id}/status`, payload).catch(() => {
    return api.put(`/admin/leave/${id}/status`, payload).catch(() => {
      return api.put(`/leave/status/${id}`, payload);
    });
  });
};

export const updateLeaveStatusAdmin = (id, payload) => {
  const body = typeof payload === "string" ? { status: payload } : payload;
  return api.patch(`/admin/leave/${id}/status`, body).catch(() => {
    return api.put(`/admin/leave/${id}/status`, body).catch(() => {
      return api.put(`/leave/status/${id}`, body);
    });
  });
};

export const getEmployeeLeaveStats = () => {
  return api.get("/employee/leave/stats").catch(() => {
    return api.get("/leave/employee-stats");
  });
};

export const deleteLeave = (id) => {
  return api.delete(`/admin/leave/${id}`).catch(() => {
    return api.delete(`/leave/${id}`);
  });
};

export const deleteLeaveRequest = (id) => {
  return api.delete(`/leave/${id}`);
};


// announcements (Supporting both /admin/announcements and /announcements)
export const getAdminAnnouncements = (params) => {
  return api.get("/admin/announcements", { params });
};

export const createAdminAnnouncement = (data) => {
  return api.post("/admin/announcements", data);
};

export const deleteAdminAnnouncement = (id) => {
  return api.delete(`/admin/announcements/${id}`);
};

export const getAnnouncements = (params) => {
  return api.get("/announcements", { params });
};

export const getAnnouncementById = (id, params) => {
  return api.get(`/announcements/${id}`, { params });
};

export const getAdminAnnouncementById = (id, params) => {
  return api.get(`/admin/announcements/${id}`, { params });
};

export const createAnnouncement = (data) => {
  return api.post("/admin/announcements", data);
};

export const updateAnnouncement = (id, data) => {
  return api.put(`/admin/announcements/${id}`, data);
};

export const togglePinAnnouncement = (id) => {
  return api.patch(`/admin/announcements/${id}/pin`, {});
};

export const deleteAnnouncement = (id) => {
  return api.delete(`/admin/announcements/${id}`);
};

// settings
export const getSettings = () => {
  return api.get("/settings/get-settings");
};

export const updateCompanySettings = (data) => {
  return api.put("/settings/company", data);
};

export const updateEmployeeSettings = (data) => {
  return api.put("/settings/employee", data);
};

export const updatePayrollSettings = (data) => {
  return api.put("/settings/payroll", data);
};

export const updateLeaveSettings = (data) => {
  return api.put("/settings/leave", data);
};

export const updateAttendanceSettings = (data) => {
  return api.put("/settings/attendance", data);
};

export const updateSecuritySettings = (data) => {
  return api.put("/settings/security", data);
};

// Admin Settings Audit Logs & Activity Trail
export const getAuditLogs = (params) => {
  return api.get("/admin/activity-logs", { params }).catch(() => {
    return api.get("/admin/audit-logs", { params });
  });
};

// Profile Picture & Avatar Management
export const uploadProfilePicture = (payload) => {
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    return api.patch("/users/profile-picture", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }
  return api.patch("/users/profile-picture", payload);
};

export const removeProfilePicture = () => {
  return api.delete("/users/profile-picture");
};

// Recent Activity Feed API (Last 5 logs from Attendance and Payroll collections)
export const getRecentActivity = (params) => {
  return api.get("/dashboard/admin-dashboard/recent-activity", { params }).catch(() => {
    return api.get("/admin/dashboard/recent-activity", { params }).catch(() => {
      return api.get("/dashboard/recent-activity", { params });
    });
  });
};

export const getRecentActivityFeed = getRecentActivity;

// Payroll Forecasting Tool APIs (End-of-Month Lateness Deductions Projections)
export const getPayrollForecasting = (params = {}) => {
  return api.get("/payroll/forecasting", { params });
};

export const getEmployeeForecasting = (employeeId, params = {}) => {
  return api.get(`/payroll/forecasting/employee/${employeeId}`, { params });
};

export const getMyPayrollForecasting = (params = {}) => {
  return api.get("/payroll/forecasting/me", { params });
};

export const exportPayrollForecastingCSV = (params = {}) => {
  return api.get("/payroll/forecasting/export", {
    params,
    responseType: "blob",
  });
};

// HR Employee Database CSV Export
export const exportEmployeesCSV = (params = {}) => {
  return api.get("/admin/employees/export-csv", {
    params,
    responseType: "blob",
  });
};

// Base-salary history derived from the employee's recorded payroll runs (admin only)
export const getEmployeeSalaryHistory = (employeeId) => {
  return api.get(`/admin/employees/${employeeId}/salary-history`);
};

// Quarterly Employee Performance & Growth Trends
export const getEmployeePerformanceReviews = (employeeId) => {
  return api.get(`/admin/employees/${employeeId}/performance`).catch(() => {
    return api.get(`/employee/profile/${employeeId}/performance`);
  });
};

export const addEmployeePerformanceReview = (employeeId, reviewData) => {
  return api.post(`/admin/employees/${employeeId}/performance`, reviewData);
};

export const getMyPerformanceReviews = () => {
  return api.get("/employee/my-performance");
};

// Admin Live Data Endpoints (Strictly Single-Tenant Global)
export const getDashboardStats = (params = {}) => {
  return api.get("/admin/dashboard-stats", { params });
};

export const getAdminAttendanceList = (params = {}) => {
  return api.get("/admin/attendance", { params });
};

export const getAdminAttendance = getAdminAttendanceList;

export const getAdminEmployeesList = (params = {}) => {
  return api.get("/admin/employees", { params });
};

export const getAdminEmployees = getAdminEmployeesList;

// System Onboarding & Initialization (Strictly Single-Tenant Global)
export const getSetupStatus = () => {
  return api.get("/setup/status");
};

export const initializeSystem = (data, isFormData = false) => {
  return api.post(
    "/setup/initialize",
    data,
    isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {}
  );
};

// High-Priority Late Attendance & Attention Required Feeds
export const getLateAttendanceAlerts = (params = {}) => {
  return api.get("/admin/attendance/late-unclocked", { params });
};

export const notifyLateEmployees = (payload) => {
  return api.post("/admin/attendance/notify-late", payload);
};

export const excuseLateEmployee = (payload) => {
  return api.post("/admin/attendance/excuse-late", payload);
};

// Administrative Activity Logs / Audit Trail (Fetched from ActivityLog MongoDB collection)
export const getActivityLogs = (params = {}) => {
  return api.get("/admin/activity-logs", { params });
};

export const getActivityLogStats = () => {
  return api.get("/admin/activity-logs/stats");
};






