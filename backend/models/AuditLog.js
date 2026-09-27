import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
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
      ],
      default: "System Administration",
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
      default: null,
    },
    performedBy: {
      id: { type: String, default: "" },
      name: { type: String, default: "Administrator" },
      email: { type: String, default: "admin@system.local" },
      role: { type: String, default: "admin" },
    },
    target: {
      type: String,
      default: "Global Settings",
    },
    targetModel: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: function () {
        return this.details || this.action || "System event logged";
      },
      trim: true,
    },
    details: {
      type: String,
      default: "",
    },
    changes: [
      {
        field: { type: String, required: true },
        label: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.pre("validate", function () {
  if (!this.summary) {
    this.summary = this.details || this.action || "System event logged";
  }
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;

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
  if (this.category && !validCategories.includes(this.category)) {
    const match = validCategories.find(
      (c) => c.toLowerCase() === String(this.category).trim().toLowerCase()
    );
    this.category = match || "System Administration";
  }
});

auditLogSchema.index({ companyId: 1, _id: 1 });
auditLogSchema.index({ organizationId: 1, _id: 1 });
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, category: 1 });
auditLogSchema.index({ companyId: 1, category: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
