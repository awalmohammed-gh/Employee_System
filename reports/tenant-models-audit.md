# Multi-Tenant Mongoose Model Audit & Organization Deletion Plan
*Generated on: 2026-09-21T13:07:00.381Z*

## Executive Summary
This report analyzes all Mongoose schemas in the WorkPulse codebase to identify models with tenant-reference fields (`organizationId`, `companyId`, `tenantId`). It outlines the cascading deletion workflow for `DELETE /api/super-admin/organizations/:organizationId`, ensuring zero orphaned records while strictly preserving Super Admin platform data.

---

## 1. Tenant-Referencing Models Overview

| Model Name | MongoDB Collection | Tenant Fields | Category | Cascade Deletion Action |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admins` | `organizationId`, `companyId` | Hybrid / Multi-Role Identity | Cascade delete tenant users/admins ONLY. Must EXCLUDE Super Admin accounts (isSuperAdmin: true / role: superAdmin) |
| **Announcement** | `announcements` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Attendance** | `attendances` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **AuditLog** | `auditlogs` | `organizationId`, `companyId` | Audit & Compliance | Purge tenant-specific logs (matching organizationId / companyId). Preserve platform-level Super Admin audit records |
| **Company** | `organizations` | `companyId`, `organizationId` | Tenant Root Entity | Delete target organization document and associated branding assets |
| **Department** | `departments` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Employee** | `employees` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Leave** | `leave_requests` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Notification** | `notifications` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Organization** | `organizations` | `organizationId`, `companyId` | Tenant Root Entity | Delete target organization document and associated branding assets |
| **Payroll** | `payrolls` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Payslip** | `payslips` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **Settings** | `settings` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **ShiftPolicy** | `shiftpolicies` | `organizationId`, `companyId` | Tenant-Owned Data | Cascade delete all records matching organizationId / companyId |
| **User** | `users` | `companyId`, `organizationId` | Hybrid / Multi-Role Identity | Cascade delete tenant users/admins ONLY. Must EXCLUDE Super Admin accounts (isSuperAdmin: true / role: superAdmin) |

---

## 2. Platform-Level Models (Exempt from Deletion)

| Model Name | MongoDB Collection | Tenant Reference | Safety Requirement |
| :--- | :--- | :--- | :--- |
| **PlatformSettings** | `platformsettings` | None (Global) | **PRESERVED**: Never deleted on tenant teardown | 

---

## 3. Critical Super Admin Platform Data Protection Rules

During the execution of `DELETE /api/super-admin/organizations/:organizationId`:
1. **User Collection Guard**:
   - Query filter MUST explicitly filter:
     ```js
     {
       $and: [
         tenantFilter,
         {
           role: { $nin: ["superAdmin", "super_admin", "superadmin"] },
           isSuperAdmin: { $ne: true }
         }
       ]
     }
     ```
   - Prevents accidental deletion of Platform Super Administrators residing in the `users` collection.
2. **Admin Collection Guard**:
   - Super Admin accounts in the `admins` collection have `role: "superAdmin"` and `companyId: null` / `organizationId: null`. The exclusion filter ensures they are never purged.
3. **Platform Settings**:
   - The `PlatformSettings` collection has zero tenant fields and stores system-wide policies; it is never touched during tenant deletion.
4. **External Asset Purge**:
   - Organization branding assets (`logoUrl`, `welcomeBackgroundUrl`, Cloudinary public IDs) are removed from storage.
   - Tenant employee/user avatar assets stored in `uploads/avatars` or Cloudinary are deleted.

---

## 4. Transactional Integrity
The deletion is orchestrated within a **MongoDB Transaction** (`session.withTransaction`), guaranteeing that either all tenant-owned documents across all collections are purged cleanly, or the transaction aborts with zero data corruption.
