/**
 * Enterprise Architecture - Tenant Scope Neutralizer
 * All queries execute cleanly across the company's dedicated database.
 */

export const getTenantId = () => null;

export const combineTenantScope = (_scopeOrReq, query = {}) => {
  return query || {};
};

export const buildTenantScope = (_reqOrTenantId, additionalFilter = null) => {
  return additionalFilter || {};
};

export const validateOrganizationAccess = () => true;

export default buildTenantScope;
