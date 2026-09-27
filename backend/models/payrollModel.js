import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
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

    payslipNumber: {
      type: String,
      required: true,
    },

    payMonth: {
      type: String,
      required: true,
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    baseSalary: {
      type: Number,
      min: 0,
    },

    absentDaysDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    latenessDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAttendanceDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalAbsenceDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalLatenessDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },

    penaltyOverride: {
      isWaived: { type: Boolean, default: false },
      waivedAbsenceDeduction: { type: Number, default: 0 },
      waivedLatenessDeduction: { type: Number, default: 0 },
      totalWaived: { type: Number, default: 0 },
      reason: { type: String, default: "" },
      waivedBy: { type: String, default: "" },
      waivedAt: { type: Date },
    },

    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },

    absenceDeductionDetails: {
      daysCount: { type: Number, default: 0 },
      ratePerDay: { type: Number, default: 10 },
      totalAmount: { type: Number, default: 0 },
    },

    latenessDeductionDetails: {
      totalLateMinutes: { type: Number, default: 0 },
      lateDaysCount: { type: Number, default: 0 },
      tierBreakdown: { type: Array, default: [] },
      totalAmount: { type: Number, default: 0 },
    },

    customDeductions: {
      type: [
        {
          title: { type: String },
          description: { type: String },
          amount: { type: Number, default: 0 },
        },
      ],
      default: [],
    },

    deductions: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },

    earnings: {
      type: [
        {
          title: { type: String },
          description: { type: String },
          amount: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },

    breakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    netPay: {
      type: Number,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "Mobile Money", "Cash"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Paid", "Pending", "Published", "Draft", "published", "paid", "pending", "draft", "Failed"],
      default: "Published",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

payrollSchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

// Unique payslip and month indexes
payrollSchema.index({ payslipNumber: 1 }, { unique: true });
payrollSchema.index({ employee: 1, payMonth: 1 }, { unique: true });
payrollSchema.index({ employee: 1, status: 1 });
payrollSchema.index({ payMonth: 1, status: 1 });

export const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);
