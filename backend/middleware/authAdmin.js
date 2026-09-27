import { protect, authorize } from "./authMiddleware.js";

/**
 * verifyAdmin middleware
 * Dedicated to Administrators and Managers.
 */
export const verifyAdmin = (req, res, next) => {
  protect(req, res, (err) => {
    if (err) return next(err);
    return authorize("admin", "company_admin", "manager")(req, res, next);
  });
};

export default verifyAdmin;
