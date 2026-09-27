import mongoose from "mongoose";
import { Employee } from "../models/Employee.js";
import { Attendance } from "../models/Attendance.js";
import { Payroll } from "../models/Payroll.js";
import { Leave } from "../models/Leave.js";

/**
 * Helper to extract authenticated user's organization/tenant ID
 */
export const extractUserOrgId = (req) => {
  if (!req) return null;
  return (
    req.user?.organizationId ||
    req.user?.companyId ||
    req.admin?.organizationId ||
    req.admin?.companyId ||
    req.employee?.organizationId ||
    req.employee?.companyId ||
    req.organizationId ||
    req.companyId ||
    req.tenantId ||
    null
  );
};

/**
 * Helper to extract authenticated user's ID
 */
export const extractUserId = (req) => {
  if (!req) return "anonymous";
  return (
    req.user?._id ||
    req.user?.id ||
    req.admin?._id ||
    req.admin?.id ||
    req.employee?._id ||
    req.employee?.id ||
    "anonymous"
  );
};

/**
 * Helper to extract resource's organization ID
 */
export const extractResourceOrgId = (resource) => {
  if (!resource) return null;
  return (
    resource.organizationId ||
    resource.companyId ||
    (resource.organization && (resource.organization._id || resource.organization)) ||
    (resource.company && (resource.company._id || resource.company)) ||
    (resource.employee && typeof resource.employee === "object"
      ? resource.employee.organizationId || resource.employee.companyId
      : null)
  );
};

/**
 * Direct check: validates that a resource's organizationId matches the authenticated user's organizationId.
 * Throws Error('Unauthorized') on cross-tenant mismatch.
 *
 * @param {Object} resource - The document or entity to check
 * @param {Object} req - The Express request object containing user context
 * @throws {Error} Throws Error('Unauthorized') on cross-tenant mismatch
 * @returns {boolean} Returns true if validation succeeds
 */
export const checkOrganizationAccess = (resource, req) => {
  if (!resource) {
    const error = new Error("Resource not found");
    error.statusCode = 404;
    error.status = 404;
    throw error;
  }

  const userId = extractUserId(req);
  const userOrgId = extractUserOrgId(req);
  const resourceOrgId = extractResourceOrgId(resource);

  const resourceOrgStr = resourceOrgId ? String(resourceOrgId).trim() : null;
  const userOrgStr = userOrgId ? String(userOrgId).trim() : null;
  const resourceId = resource._id || resource.id || resource.employeeId || resource.payslipNumber || "unknown";

  if (!resourceOrgStr || !userOrgStr || resourceOrgStr !== userOrgStr) {
    console.warn(
      `[TENANT_AUDIT] Cross-tenant access BLOCKED: Authenticated User ID: ${userId} (Org ${userOrgStr}) attempted to access Resource ${resourceId} belonging to Org ${resourceOrgStr}`
    );
    const error = new Error("Unauthorized");
    error.statusCode = 403;
    error.status = 403;
    error.code = "CROSS_TENANT_VIOLATION";
    throw error;
  }

  return true;
};

/**
 * Resolves the Mongoose model from model argument or request route path
 */
const resolveModel = (modelHint, req) => {
  if (modelHint) {
    if (typeof modelHint === "function" && modelHint.modelName) return modelHint;
    if (typeof modelHint === "string") {
      const lower = modelHint.toLowerCase();
      if (lower.includes("employee")) return Employee;
      if (lower.includes("attendance")) return Attendance;
      if (lower.includes("payroll") || lower.includes("payslip")) return Payroll;
      if (lower.includes("leave")) return Leave;
    }
  }

  const path = (req.baseUrl || "") + (req.path || "") + (req.originalUrl || "");
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("employee")) return Employee;
  if (lowerPath.includes("attendance")) return Attendance;
  if (lowerPath.includes("payroll") || lowerPath.includes("payslip")) return Payroll;
  if (lowerPath.includes("leave")) return Leave;

  return null;
};

/**
 * Creates or executes the validateOrganizationAccess middleware handler
 */
const createMiddlewareHandler = (targetModel = null) => {
  return async (req, res, next) => {
    try {
      const resourceId =
        req.params.id ||
        req.params.employeeId ||
        req.params.recordId ||
        req.params.payslipId ||
        req.params.leaveId;

      // If no resource ID parameter in route, proceed to controller
      if (!resourceId) {
        return next();
      }

      // If req already has a validated resource attached, check that
      if (req.resource) {
        checkOrganizationAccess(req.resource, req);
        return next();
      }

      const Model = resolveModel(targetModel, req);
      if (!Model) {
        return next();
      }

      const queryConditions = [];
      if (mongoose.Types.ObjectId.isValid(resourceId)) {
        queryConditions.push({ _id: new mongoose.Types.ObjectId(resourceId) });
      }
      if (Model.modelName === "Employee") {
        queryConditions.push({ employeeId: resourceId });
      } else if (Model.modelName === "Payroll" || Model.modelName === "Payslip") {
        queryConditions.push({ payslipNumber: resourceId });
      }

      const mongoQuery = queryConditions.length === 1 ? queryConditions[0] : { $or: queryConditions };

      const resourceDoc = await Model.findOne(mongoQuery).lean();

      if (!resourceDoc) {
        // Resource not found in DB - let the downstream controller return its standard 404 response
        return next();
      }

      // Check organization access
      const userId = extractUserId(req);
      const userOrgId = extractUserOrgId(req);
      const resourceOrgId = extractResourceOrgId(resourceDoc);
      const resourceOrgStr = resourceOrgId ? String(resourceOrgId).trim() : null;
      const userOrgStr = userOrgId ? String(userOrgId).trim() : null;

      if (!resourceOrgStr || !userOrgStr || resourceOrgStr !== userOrgStr) {
        console.warn(
          `[TENANT_AUDIT] Cross-tenant access BLOCKED [${req.method} ${req.originalUrl}]: Authenticated User ID: ${userId} (Org ${userOrgStr}) attempted to access Resource ${resourceId} belonging to Org ${resourceOrgStr}`
        );
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Resource does not belong to your organization.",
          code: "CROSS_TENANT_VIOLATION",
        });
      }

      req.resource = resourceDoc;
      return next();
    } catch (err) {
      if (err.statusCode === 403 || err.code === "CROSS_TENANT_VIOLATION") {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Resource does not belong to your organization.",
          code: "CROSS_TENANT_VIOLATION",
        });
      }
      return next(err);
    }
  };
};

/**
 * Universal validateOrganizationAccess implementation.
 * Supports:
 *   1. Direct check: validateOrganizationAccess(resource, req)
 *   2. Direct Express middleware: validateOrganizationAccess(req, res, next)
 *   3. Express middleware factory: validateOrganizationAccess(Model) -> returns (req, res, next)
 */
export const validateOrganizationAccess = (arg1, arg2, arg3) => {
  // Case 1: Direct Express middleware usage: validateOrganizationAccess(req, res, next)
  if (arg1 && typeof arg1 === "object" && arg2 && typeof arg2.status === "function" && typeof arg3 === "function") {
    return createMiddlewareHandler()(arg1, arg2, arg3);
  }

  // Case 2: Direct resource validation helper: validateOrganizationAccess(resource, req)
  if (arg1 && typeof arg1 === "object" && arg2 && typeof arg2 === "object" && !arg3) {
    // If arg2 has request-like properties (headers, method, user, or params)
    if (arg2.headers || arg2.method || arg2.user !== undefined || arg2.organizationId !== undefined || arg2.companyId !== undefined) {
      return checkOrganizationAccess(arg1, arg2);
    }
  }

  // Case 3: Middleware factory: validateOrganizationAccess(Model) or validateOrganizationAccess()
  return createMiddlewareHandler(arg1);
};

export default validateOrganizationAccess;
