import mongoose from "mongoose";

const latenessTierSchema = new mongoose.Schema(
  {
    tier: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    minMinutes: {
      type: Number,
      required: true,
      default: 0,
    },
    maxMinutes: {
      type: Number,
      required: true,
      default: 9999,
    },
    fine: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const shiftPolicySchema = new mongoose.Schema(
  {
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
    shiftName: {
      type: String,
      default: "Standard Operations Shift",
      trim: true,
    },
    workStartTime: {
      type: String,
      default: "08:00",
      trim: true,
    },
    workEndTime: {
      type: String,
      default: "19:00",
      trim: true,
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    autoCheckoutGraceTime: {
      type: String,
      default: "19:30",
      trim: true,
    },
    midnightResetTime: {
      type: String,
      default: "00:00",
      trim: true,
    },
    absenceDeductionRate: {
      type: Number,
      default: 15,
      min: 0,
    },
    lateTier1_amount: {
      type: Number,
      default: 10,
      min: 0,
    },
    lateTier2_amount: {
      type: Number,
      default: 30,
      min: 0,
    },
    lateTier3_amount: {
      type: Number,
      default: 50,
      min: 0,
    },
    lateTier4_amount: {
      type: Number,
      default: 75,
      min: 0,
    },
    lateTier5_amount: {
      type: Number,
      default: 100,
      min: 0,
    },
    lateTier6_amount: {
      type: Number,
      default: 150,
      min: 0,
    },
    maxLatenessPenaltyDeductionPercent: {
      type: Number,
      default: 15,
      min: 1,
      max: 100,
    },
    latenessWarningThresholdPercent: {
      type: Number,
      default: 80,
      min: 1,
      max: 100,
    },
    defaultMonthlyPenaltyCap: {
      type: Number,
      default: 200,
      min: 0,
    },
    latenessTiers: {
      type: [latenessTierSchema],
      default: () => [
        { tier: 1, name: "Tier 1 (1–30 mins)", minMinutes: 1, maxMinutes: 30, fine: 10 },
        { tier: 2, name: "Tier 2 (31–60 mins)", minMinutes: 31, maxMinutes: 60, fine: 30 },
        { tier: 3, name: "Tier 3 (61–120 mins / 1–2 hrs)", minMinutes: 61, maxMinutes: 120, fine: 50 },
        { tier: 4, name: "Tier 4 (121–180 mins / 2–3 hrs)", minMinutes: 121, maxMinutes: 180, fine: 75 },
        { tier: 5, name: "Tier 5 (181–240 mins / 3–4 hrs)", minMinutes: 181, maxMinutes: 240, fine: 100 },
        { tier: 6, name: "Tier 6 (241+ mins / 4+ hrs)", minMinutes: 241, maxMinutes: 9999, fine: 150 },
      ],
    },
  },
  {
    timestamps: true,
  }
);

shiftPolicySchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

export const ShiftPolicy =
  mongoose.models.ShiftPolicy || mongoose.model("ShiftPolicy", shiftPolicySchema);

export default ShiftPolicy;
