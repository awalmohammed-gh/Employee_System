import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const employeeSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
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

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    position: {
      type: String,
      required: true,
      trim: true,
    },

    employmentDate: {
      type: Date,
      required: true,
      default: Date.now,
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

    baseSalary: {
      type: Number,
      default: 0,
      min: 0,
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

    totalLeaveDays: {
      type: Number,
      default: 20,
      min: 0,
    },

    usedLeaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    leaveBalance: {
      type: Number,
      default: 20,
      min: 0,
    },

    role: {
      type: String,
      enum: ["admin", "employee", "manager", "hr", "staff"],
      default: "employee",
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
  },
  {
    timestamps: true,
  },
);

employeeSchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

// Pre-save hook for password hashing (prevents double-hashing)
employeeSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (
    typeof this.password === "string" &&
    (this.password.startsWith("$2a$") || this.password.startsWith("$2b$") || this.password.startsWith("$2y$"))
  ) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password helper method
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Post-hook for cascading delete when employee document is removed
employeeSchema.post("findOneAndDelete", async function (doc) {
  if (!doc) return;
  try {
    const empId = doc._id;
    const empCode = doc.employeeId;
    const AttendanceModel = mongoose.models.Attendance;
    const PayrollModel = mongoose.models.Payroll;
    const LeaveModel = mongoose.models.Leave;
    const NotificationModel = mongoose.models.Notification;

    const promises = [];
    if (AttendanceModel) {
      promises.push(
        AttendanceModel.deleteMany({
          $or: [{ employee: empId }, { employeeId: empCode }, { employeeId: String(empId) }],
        }).catch(() => {})
      );
    }
    if (PayrollModel) {
      promises.push(
        PayrollModel.deleteMany({
          $or: [{ employee: empId }, { employeeId: empCode }, { employeeId: String(empId) }],
        }).catch(() => {})
      );
    }
    if (LeaveModel) {
      promises.push(
        LeaveModel.deleteMany({
          $or: [{ employee: empId }, { employeeId: empCode }, { employeeId: String(empId) }],
        }).catch(() => {})
      );
    }
    if (NotificationModel) {
      promises.push(
        NotificationModel.deleteMany({
          $or: [
            { recipient_id: String(empId) },
            { recipient_id: empCode },
            { recipient: empId },
            { "metadata.employeeId": empCode },
            { "metadata.employee_id": String(empId) },
          ],
        }).catch(() => {})
      );
    }
    await Promise.all(promises);
  } catch (err) {
    console.warn("[Employee Model] Cascading post-hook warning:", err.message);
  }
});

employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ status: 1, role: 1 });

export const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

