import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
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
        "Employees",
        "Payroll",
        "Attendance",
        "Leave",
        "Security",
        "Authentication",
        "Admin Settings",
        "Penalties & Deductions",
        "Departments",
        "Settings",
        "Platform",
        "Tenant Setup",
        "Organization Setup",
        "System Administration",
        "System",
        "Companies",
        "Tenant Lifecycle",
        "Workspace Management",
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
      default: "System",
    },
    targetModel: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      required: true,
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

activityLogSchema.pre("validate", function () {
  if (!this.summary) {
    this.summary = this.details || this.action || "Administrative event logged";
  }
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;

  const validCategories = [
    "Employees",
    "Payroll",
    "Attendance",
    "Leave",
    "Security",
    "Authentication",
    "Admin Settings",
    "Penalties & Deductions",
    "Departments",
    "Settings",
    "Platform",
    "Tenant Setup",
    "Organization Setup",
    "System Administration",
    "System",
    "Companies",
    "Tenant Lifecycle",
    "Workspace Management",
  ];
  if (this.category && !validCategories.includes(this.category)) {
    const match = validCategories.find(
      (c) => c.toLowerCase() === String(this.category).trim().toLowerCase()
    );
    this.category = match || "System Administration";
  }
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

export const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema, "activitylogs");

export default ActivityLog;
