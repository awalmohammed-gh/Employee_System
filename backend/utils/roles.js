/**
 * The system has two tiers only: admin/manager and employee.
 * Accounts created by older seed scripts may still carry a legacy "super_admin" role;
 * those are treated as regular admins so they keep working without a database migration.
 */
const LEGACY_ADMIN_ROLES = new Set(["super_admin", "superadmin", "super-admin"]);

export const normalizeRole = (role, fallback = "employee") => {
  const cleaned = String(role || fallback).trim().toLowerCase();
  return LEGACY_ADMIN_ROLES.has(cleaned) ? "admin" : cleaned;
};

export default normalizeRole;
