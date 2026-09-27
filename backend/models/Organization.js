import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    companyName: { type: String, default: "" },
    companySlug: { type: String, default: "" },
    slug: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    status: { type: String, default: "active" },
    subscriptionStatus: { type: String, default: "active" },
    isConfigured: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

organizationSchema.pre("validate", function () {
  if (!this.name && this.companyName) {
    this.name = this.companyName;
  }
  if (!this.companyName && this.name) {
    this.companyName = this.name;
  }
});

export const Organization =
  mongoose.models.Organization || mongoose.model("Organization", organizationSchema);

export default Organization;
