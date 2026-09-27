import { protect, authorize } from "./authMiddleware.js";

/**
 * employeeAuth middleware
 * Authenticates active session and authorizes employee, hr, manager, and admin users.
 */
export const employeeAuth = (req, res, next) => {
  protect(req, res, (err) => {
    if (err) return next(err);
    return authorize("employee", "manager", "hr", "admin", "company_admin")(req, res, next);
  });
};

export default employeeAuth;
