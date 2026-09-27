import mongoose from "mongoose";
import { normalizeAttendanceDate } from "../utils/attendanceDate.js";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },

    employeeId: {
      type: String,
      default: "",
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

    date: {
      type: String,
      required: true,
      // Normalise Date objects / long date strings to the shared "YYYY-MM-DD" day key so the
      // unique { employee, date } index reliably prevents duplicate records for a working day.
      set: normalizeAttendanceDate,
    },

    clockIn: {
      type: Date,
      default: null,
    },

    clockInTime: {
      type: Date,
      default: null,
    },

    clockOut: {
      type: Date,
      default: null,
    },

    clockOutTime: {
      type: Date,
      default: null,
    },

    workHours: {
      type: Number,
      default: 0,
      min: 0,
      set: (v) => (v === null || v === undefined || isNaN(v) ? 0 : Number(Number(v).toFixed(2))),
    },

    status: {
      type: String,
      default: "Absent",
    },

    delayMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    latePenalty: {
      type: Number,
      default: 0,
      min: 0,
    },

    penaltyTier: {
      type: String,
      default: "",
    },

    shiftStatus: {
      type: String,
      default: "In-Progress",
    },

    autoClosedAt: {
      type: Date,
      default: null,
    },

    autoClockedOut: {
      type: Boolean,
      default: false,
    },

    lateReason: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // "system" when the record was created by the automatic closing-time absence processor
    absenceSource: {
      type: String,
      default: "",
    },

    recordedAbsentAt: {
      type: Date,
      default: null,
    },

    isExcused: {
      type: Boolean,
      default: false,
    },

    excuseReason: {
      type: String,
      trim: true,
      default: "",
    },

    excusedBy: {
      type: String,
      default: "",
    },

    excusedAt: {
      type: Date,
      default: null,
    },

    flaggedForReview: {
      type: Boolean,
      default: false,
    },

    flagReason: {
      type: String,
      trim: true,
      default: "",
    },

    flaggedBy: {
      type: String,
      default: "",
    },

    flaggedAt: {
      type: Date,
      default: null,
    },

    auditLog: {
      adminId: { type: String, default: "" },
      adminName: { type: String, default: "" },
      reason: { type: String, default: "" },
      timestamp: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

attendanceSchema.pre("validate", function () {
  if (!this.organizationId && this.companyId) this.organizationId = this.companyId;
  if (!this.companyId && this.organizationId) this.companyId = this.organizationId;
});

// Indexes for fast range queries, employee history, and unique check-ins per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ employee: 1, status: 1 });
attendanceSchema.index({ employee: 1, createdAt: -1 });

export const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

