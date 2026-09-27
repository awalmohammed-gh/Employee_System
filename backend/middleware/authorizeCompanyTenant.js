/**
 * Enterprise Architecture - Authorize Company Tenant Pass-through
 */

export const authorizeCompanyTenant = (req, _res, next) => {
  req.tenantScope = {};
  req.getTenantScope = (filter) => filter || {};
  req.scopedTenantQuery = (baseQuery = {}) => baseQuery;
  req.assertTenantOwnership = () => true;
  req.validateOrganizationAccess = () => true;
  next();
};

export default authorizeCompanyTenant;
