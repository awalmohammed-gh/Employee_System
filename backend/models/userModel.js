import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: "",
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "employee", "company_admin", "hr", "staff"],
      default: "employee",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      default: null,
      index: true,
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanySettings",
      index: true,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "on leave", "on-leave", "terminated"],
      default: "active",
    },

    isActive: {
      type: Boolean,
      default: true,
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

    profile_image_url: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("validate", function () {
  if (!this.fullName && this.name) this.fullName = this.name;
  if (!this.name && this.fullName) this.name = this.fullName;
});

// Pre-save hook for password hashing (prevents double-hashing)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (
    typeof this.password === "string" &&
    (this.password.startsWith("$2a$") || this.password.startsWith("$2b$") || this.password.startsWith("$2y$"))
  ) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password instance method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ role: 1, status: 1 });

export const User = mongoose.models.User || mongoose.model("User", userSchema);

