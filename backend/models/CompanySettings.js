import mongoose from "mongoose";

const latenessTierSchema = new mongoose.Schema(
  {
    tier: { type: Number, required: true },
    name: { type: String, default: "" },
    minMinutes: { type: Number, required: true, default: 0 },
    maxMinutes: { type: Number, required: true, default: 9999 },
    fine: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: "WorkPulse",
      trim: true,
    },
    name: {
      type: String,
      default: "WorkPulse",
      trim: true,
    },
    slug: {
      type: String,
      default: "workpulse",
      trim: true,
      lowercase: true,
    },
    logo: {
      type: String,
      default: "",
      trim: true,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    companyLogo: {
      type: String,
      default: "",
      trim: true,
    },
    companyLogoPublicId: {
      type: String,
      default: "",
    },
    welcomeBackgroundUrl: {
      type: String,
      default: "",
      trim: true,
    },
    primaryColor: {
      type: String,
      default: "#0B1E48",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },

    // First working day ("YYYY-MM-DD") covered by automatic closing-time absence recording.
    // Set once on the first run so enabling the feature never back-fills older history.
    absenceTrackingStartedOn: {
      type: String,
      default: "",
    },

    // Work / Attendance policies
    workingHours: {
      workStartTime: { type: String, default: "08:00" },
      workEndTime: { type: String, default: "19:00" },
      workingDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      },
    },

    attendanceSettings: {
      workingDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      },
      workStartTime: { type: String, default: "08:00" },
      workEndTime: { type: String, default: "19:00" },
      lateAfterMinutes: { type: Number, default: 15 },
      gracePeriodMinutes: { type: Number, default: 15 },
      autoCheckoutTime: { type: String, default: "19:30" },
      autoCheckoutGraceTime: { type: String, default: "19:30" },
      absenceDeductionRate: { type: Number, default: 15 },
      overtimeEnabled: { type: Boolean, default: true },
      latenessTiers: {
        type: [latenessTierSchema],
        default: [
          { tier: 1, name: "Grace Period", minMinutes: 0, maxMinutes: 15, fine: 0 },
          { tier: 2, name: "Minor Lateness", minMinutes: 16, maxMinutes: 30, fine: 5 },
          { tier: 3, name: "Moderate Lateness", minMinutes: 31, maxMinutes: 60, fine: 10 },
          { tier: 4, name: "Severe Lateness", minMinutes: 61, maxMinutes: 9999, fine: 20 },
        ],
      },
    },

    leaveSettings: {
      annualLeaveDays: { type: Number, default: 15 },
      sickLeaveDays: { type: Number, default: 10 },
      casualLeaveDays: { type: Number, default: 5 },
      maternityLeaveDays: { type: Number, default: 90 },
      paternityLeaveDays: { type: Number, default: 14 },
      requireApproval: { type: Boolean, default: true },
    },

    payrollSettings: {
      currency: { type: String, default: "GHS" },
      currencySymbol: { type: String, default: "₵" },
      payrollFrequency: {
        type: String,
        enum: ["Weekly", "Biweekly", "Monthly"],
        default: "Monthly",
      },
      paymentDate: { type: Number, default: 25 },
      paymentMethods: {
        type: [String],
        default: ["Bank Transfer", "Mobile Money", "Cash"],
      },
    },

    securitySettings: {
      twoFactorAuthentication: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 30 },
      maxLoginAttempts: { type: Number, default: 5 },
      passwordExpiryDays: { type: Number, default: 90 },
    },

    isConfigured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Synchronize duplicated aliases so callers referencing .logo or .logoUrl or .name get expected values
companySettingsSchema.pre("save", function () {
  if (this.companyName && !this.name) this.name = this.companyName;
  if (this.name && !this.companyName) this.companyName = this.name;
  if (this.logo && !this.logoUrl) this.logoUrl = this.logo;
  if (this.logoUrl && !this.logo) this.logo = this.logoUrl;
  if (this.logo && !this.companyLogo) this.companyLogo = this.logo;
  if (this.email && !this.contactEmail) this.contactEmail = this.email;
  if (this.contactEmail && !this.email) this.email = this.contactEmail;
  if (this.phone && !this.contactPhone) this.contactPhone = this.phone;
  if (this.contactPhone && !this.phone) this.phone = this.contactPhone;
});

/**
 * Singleton getter: returns the deployment CompanySettings document or fallback unconfigured metadata.
 */
companySettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    return {
      companyName: "",
      name: "",
      slug: "",
      primaryColor: "#0B1E48",
      logoUrl: "",
      logo: "",
      isConfigured: false,
    };
  }
  return settings;
};

export const CompanySettings =
  mongoose.models.CompanySettings || mongoose.model("CompanySettings", companySettingsSchema);

// Backward-compatibility exports for controllers and models during single-tenant refactor
export const Company = CompanySettings;
export const Organization = CompanySettings;
export const Workspace = CompanySettings;
export const Settings = CompanySettings;

export default CompanySettings;
