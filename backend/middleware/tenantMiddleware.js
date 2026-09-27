/**
 * Enterprise Architecture - Tenant Middleware Pass-through
 * No cross-tenant query rewriting or multi-workspace isolation needed.
 */

export const tenantStorage = {
  run: (_store, callback) => (typeof callback === "function" ? callback() : undefined),
  getStore: () => null,
};

export const tenantPlugin = (_schema) => {
  // No-op
};

export const tenantMiddleware = (req, _res, next) => {
  req.organizationId = null;
  req.companyId = null;
  req.tenantId = null;
  req.tenantQuery = (query = {}) => query;
  req.ensureTenant = () => true;
  next();
};

export const requireTenant = (_req, _res, next) => {
  next();
};

export const enforceCompanyTenant = (_req, _res, next) => {
  next();
};

export default tenantMiddleware;
