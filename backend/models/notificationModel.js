import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: String,
      required: true,
      index: true,
    },
    recipient_role: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
      index: true,
    },
    sender_id: {
      type: String,
      default: "system",
    },
    sender_role: {
      type: String,
      enum: ["admin", "employee", "system"],
      default: "system",
    },
    sender_name: {
      type: String,
      default: "System",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: "system_update",
      trim: true,
    },
    category: {
      type: String,
      default: "system",
      trim: true,
    },
    priority: {
      type: String,
      default: "medium",
      trim: true,
    },
    action_url: {
      type: String,
      default: "",
    },
    action_label: {
      type: String,
      default: "View Details",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      default: null,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.pre("validate", async function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
  if (!this.companyId && mongoose.connection.readyState === 1) {
    try {
      const comp = await mongoose.model("CompanySettings").findOne().select("_id").lean();
      if (comp && comp._id) {
        this.companyId = comp._id;
        if (!this.organizationId) this.organizationId = comp._id;
      }
    } catch {
      // ignore
    }
  }
});

// Helpful index for querying notifications by role and recipient
notificationSchema.index({ companyId: 1, _id: 1 });
notificationSchema.index({ organizationId: 1, _id: 1 });
notificationSchema.index({ recipient_role: 1, recipient_id: 1, created_at: -1 });
notificationSchema.index({ organizationId: 1, recipient_role: 1, recipient_id: 1 });
notificationSchema.index({ companyId: 1, recipient_role: 1, recipient_id: 1 });
notificationSchema.index({ companyId: 1, is_read: 1, created_at: -1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema, "notifications");
