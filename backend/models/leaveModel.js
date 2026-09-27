import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
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

    leaveType: {
      type: String,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "pending", "approved", "rejected"],
      default: "Pending",
    },

    adminRemark: {
      type: String,
      default: "",
      trim: true,
    },

    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

leaveSchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ employee: 1, startDate: 1 });
leaveSchema.index({ status: 1, createdAt: -1 });

export const Leave =
  mongoose.models.Leave ||
  mongoose.model("Leave", leaveSchema, "leave_requests");

export const LeaveRequest = Leave;

export default Leave;
