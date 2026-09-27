import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: [true, "Password hash is required"],
    },
    role: {
      type: String,
      default: "admin",
      enum: ["admin", "manager"],
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
      index: true,
      default: null,
    },
    profile_image_url: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    profilePicture: {
      type: String,
      default: "",
    },
    profile_picture: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password_hash;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password_hash;
        return ret;
      },
    },
  }
);

// Virtual alias for compatibility with frontend if needed
if (!adminSchema.paths.fullName) {
  adminSchema.virtual("fullName").get(function () {
    return this.full_name;
  });
}

adminSchema.index({ role: 1 });

export const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
export default Admin;
