import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    payrollPeriod: {
      month: { type: String, required: true }, // e.g., "September"
      year: { type: Number, required: true }, // e.g., 2026
    },
    baseSalary: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: {
      latenessDeductions: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    netPay: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Draft", "Published", "Paid"],
      default: "Published",
    },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

payslipSchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

payslipSchema.index({ companyId: 1, _id: 1 });
payslipSchema.index({ organizationId: 1, _id: 1 });
payslipSchema.index({ organizationId: 1, employeeId: 1, "payrollPeriod.year": 1, "payrollPeriod.month": 1 });
payslipSchema.index({ companyId: 1, employeeId: 1, "payrollPeriod.year": 1, "payrollPeriod.month": 1 });
payslipSchema.index({ companyId: 1, status: 1 });

export const Payslip = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);
export default Payslip;
