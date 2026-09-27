import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { ActivityLog } from "../models/ActivityLog.js";

// In-memory fallback ring buffer for audit logs (holds up to 200 recent events)
export const inMemoryAuditLogs = [];

const MAX_IN_MEMORY_LOGS = 200;

/**
 * Initializes and synchronizes the activitylogs collection from auditlogs or seeds
 */
export const syncActivityLogsCollection = async () => {
  // Startup may run without a configured database.  There is nothing to sync
  // until a MongoDB connection has completed.
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true };
  }

  try {
    const activityCount = await ActivityLog.countDocuments();
    if (activityCount === 0) {
      console.log("[AuditLogger] Populating activitylogs collection from existing audit records...");
      const auditDocs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
      if (auditDocs && auditDocs.length > 0) {
        const toInsert = auditDocs.map((doc) => {
          const { _id, __v, ...rest } = doc;
          return rest;
        });
        await ActivityLog.insertMany(toInsert, { ordered: false });
        console.log(`[AuditLogger] Synchronized ${toInsert.length} records into activitylogs.`);
      } else {
        // Seed default foundational administrative events
        await ActivityLog.insertMany([
          {
            action: "SYSTEM_INITIALIZED",
            category: "System Administration",
            target: "Global System Settings",
            targetModel: "PlatformSettings",
            summary: "Administrative control plane and enterprise workforce monitoring initialized.",
            details: "Core modules activated: Attendance tracking, Automated penalty tiers, Payroll calculation, Real-time telemetry.",
            performedBy: {
              id: "admin_master",
              name: "System Administrator",
              email: "admin@system.local",
              role: "admin",
            },
            createdAt: new Date(Date.now() - 3600000 * 24 * 3),
          },
          {
            action: "UPDATE_PROFILE",
            category: "Security",
            target: "Principal Administrator",
            targetModel: "Admin",
            summary: "Administrator profile details and security privileges verified.",
            details: "Profile settings updated with high-privilege administrative access.",
            performedBy: {
              id: "admin_master",
              name: "Principal Administrator",
              email: "admin@system.local",
              role: "admin",
            },
            createdAt: new Date(Date.now() - 3600000 * 12),
          },
          {
            action: "PAYROLL_FINALIZED",
            category: "Payroll",
            target: "Monthly Executive Payroll Cycle",
            targetModel: "Payroll",
            summary: "Executed and verified monthly payroll batch processing for active personnel.",
            details: "Standard salary structure computed with tax, allowance, and attendance adjustments applied.",
            performedBy: {
              id: "admin_master",
              name: "Principal Administrator",
              email: "admin@system.local",
              role: "admin",
            },
            createdAt: new Date(Date.now() - 3600000 * 6),
          },
        ]);
        console.log("[AuditLogger] Seeded initial activity logs into activitylogs.");
      }
    }
  } catch (err) {
    console.warn("[AuditLogger] Error syncing activitylogs:", err.message);
  }
};

/**
 * Logs a critical user action into MongoDB AuditLog collection and in-memory buffer.
 *
 * @param {Object} params
 * @param {Object} [params.req] - Express request object for IP, user-agent, and actor resolution
 * @param {string} params.action - Machine-readable action code (e.g. 'CREATE_EMPLOYEE', 'PAYROLL_FINALIZED')
 * @param {string} [params.category='Admin Settings'] - Audit category
 * @param {string} [params.target='Global'] - Entity target name/identifier
 * @param {string} [params.targetModel=''] - Model name (e.g. 'Employee', 'Payroll')
 * @param {string} params.summary - Human-readable narrative description of the event
 * @param {string} [params.details=''] - Additional contextual details
 * @param {Array} [params.changes=[]] - Array of { field, label, oldValue, newValue }
 * @param {Object} [params.metadata={}] - Structured metadata
 * @param {Object} [params.performedBy] - Explicit actor override if req not provided
 * @param {string} [params.organizationId] - Tenant organization ID
 */
/**
 * AuditLog / ActivityLog require `field` and `label` on every change entry. Some callers only pass
 * `field` (or a `key`), which made the save fail validation; derive a readable label instead.
 */
const humanizeField = (field) =>
  String(field)
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const normalizeAuditChanges = (changes) => {
  if (!Array.isArray(changes)) return [];
  return changes
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const field = String(c.field || c.key || c.name || c.label || "value");
      return {
        ...c,
        field,
        label: String(c.label || c.fieldLabel || humanizeField(field)),
      };
    });
};

export const logAuditAction = async ({
  req = null,
  action,
  category = "Admin Settings",
  target = "Global",
  targetModel = "",
  summary,
  details = "",
  changes = [],
  metadata = {},
  performedBy = null,
  organizationId = null,
}) => {
  if (!action || !summary) {
    console.warn("[AuditLogger] Missing required action or summary parameters.");
    return null;
  }

  // 1. Resolve Actor
  let actor = performedBy;
  if (!actor && req) {
    const user = req.admin || req.user || req.employee;
    actor = {
      id: String(user?._id || user?.id || user?.employeeId || "system_admin"),
      name: user?.fullName || user?.full_name || user?.name || "Administrator",
      email: user?.email || "admin@system.local",
      role: user?.role || (req.admin ? "admin" : "employee"),
    };
  }

  if (!actor) {
    actor = {
      id: "system",
      name: "System Administrator",
      email: "system@internal.local",
      role: "admin",
    };
  }

  // 2. Resolve Tenant
  const resolvedOrgId =
    organizationId ||
    req?.organizationId ||
    req?.admin?.organizationId ||
    req?.user?.organizationId ||
    null;

  // 3. Resolve Network Information
  const ipAddress =
    req?.ip ||
    req?.headers?.["x-forwarded-for"] ||
    req?.connection?.remoteAddress ||
    "127.0.0.1";

  const userAgent = req?.headers?.["user-agent"] || "";

  // 4. Construct Audit Record
  const validCategories = [
    "Penalties & Deductions",
    "Admin Settings",
    "Payroll",
    "Attendance",
    "Leave",
    "Employees",
    "Security",
    "Authentication",
    "Companies",
    "Departments",
    "Settings",
    "Platform",
    "Tenant Setup",
    "Organization Setup",
    "Tenant Lifecycle",
    "Workspace Management",
    "System Administration",
    "System",
  ];
  let normalizedCategory = category;
  if (!validCategories.includes(normalizedCategory)) {
    const match = validCategories.find(
      (c) => c.toLowerCase() === String(category || "").trim().toLowerCase()
    );
    normalizedCategory = match || "System Administration";
  }

  const logEntry = {
    _id: "audit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    action: action.trim().toUpperCase(),
    category: normalizedCategory,
    organizationId: resolvedOrgId,
    performedBy: actor,
    target,
    targetModel,
    summary: summary.trim(),
    details: details ? details.trim() : summary.trim(),
    changes: normalizeAuditChanges(changes),
    metadata: metadata || {},
    ipAddress,
    userAgent,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 5. Store in In-Memory ring buffer
  inMemoryAuditLogs.unshift(logEntry);
  if (inMemoryAuditLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryAuditLogs.pop();
  }

  // 6. Persist to MongoDB AuditLog and ActivityLog collections
  try {
    const docPayload = {
      action: logEntry.action,
      category: logEntry.category,
      organizationId: resolvedOrgId && mongoose.Types.ObjectId.isValid(resolvedOrgId) ? resolvedOrgId : null,
      performedBy: logEntry.performedBy,
      target: logEntry.target,
      targetModel: logEntry.targetModel,
      summary: logEntry.summary,
      details: logEntry.details,
      changes: logEntry.changes,
      metadata: logEntry.metadata,
      ipAddress: logEntry.ipAddress,
      userAgent: logEntry.userAgent,
    };

    const [createdDoc] = await Promise.all([
      AuditLog.create(docPayload).catch((e) => {
        console.warn("[AuditLogger] AuditLog collection save fallback:", e.message);
        return null;
      }),
      ActivityLog.create(docPayload).catch((e) => {
        console.warn("[AuditLogger] ActivityLog collection save fallback:", e.message);
        return null;
      }),
    ]);

    return createdDoc || logEntry;
  } catch (dbErr) {
    console.warn("[AuditLogger] MongoDB save notice (relying on in-memory log):", dbErr.message);
    return logEntry;
  }
};

export default logAuditAction;
