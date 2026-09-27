import mongoose from "mongoose";

// Only what a reviewer records is stored: optional scores/goals have no defaults, so an
// unrated competency stays empty instead of showing an invented number.
const performanceReviewSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      default: "",
      trim: true,
    },
    quarter: {
      type: String,
      required: true,
      trim: true,
    }, // e.g. "Q3 2026"
    year: {
      type: Number,
      required: true,
    },
    quarterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    }, // Rating out of 5.0 (e.g. 4.6)
    targetRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    productivityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    teamworkScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    initiativeScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    attendanceScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    reviewer: {
      type: String,
      default: "",
      trim: true,
    },
    reviewDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Draft"],
      default: "Completed",
    },
    feedbackSummary: {
      type: String,
      default: "",
      trim: true,
    },
    strengths: [
      {
        type: String,
        trim: true,
      },
    ],
    growthOpportunities: [
      {
        type: String,
        trim: true,
      },
    ],
    goalsCompleted: {
      type: Number,
      min: 0,
    },
    totalGoals: {
      type: Number,
      min: 1,
    },
    promotionEligible: {
      type: Boolean,
      default: false,
    },
    performanceTier: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per employee + quarter
performanceReviewSchema.index({ employee: 1, quarter: 1 }, { unique: true });

export const PerformanceReview =
  mongoose.models.PerformanceReview ||
  mongoose.model("PerformanceReview", performanceReviewSchema);

export default PerformanceReview;
