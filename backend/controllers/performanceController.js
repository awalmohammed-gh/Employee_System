import mongoose from "mongoose";
import { PerformanceReview } from "../models/PerformanceReview.js";
import { Employee } from "../models/employeeModel.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { normalizeRole } from "../utils/roles.js";

// Roles allowed to read and record other employees' reviews. Everyone else only sees their own.
const REVIEWER_ROLES = new Set(["admin", "manager", "company_admin"]);
const COMPETENCY_FIELDS = ["productivityScore", "qualityScore", "teamworkScore", "initiativeScore", "attendanceScore"];
const EMPLOYEE_FIELDS = "fullName employeeId department position avatar profilePicture profile_image_url email";

// Helper to determine performance tier based on 1-5 rating scale
const calculatePerformanceTier = (rating) => {
  if (rating >= 4.7) return "Outstanding (Top 5%)";
  if (rating >= 4.3) return "Exceeds Expectations";
  if (rating >= 3.8) return "Meets Expectations";
  if (rating >= 3.0) return "Developing Competency";
  return "Needs Improvement Plan";
};

const isReviewer = (req) => REVIEWER_ROLES.has(normalizeRole(req.user?.role || req.admin?.role));

const findEmployee = async (rawId) => {
  if (!rawId) return null;
  const id = String(rawId).trim();
  if (mongoose.Types.ObjectId.isValid(id)) {
    const byId = await Employee.findById(id).select(EMPLOYEE_FIELDS).lean();
    if (byId) return byId;
  }
  const byCode = await Employee.findOne({ employeeId: id }).select(EMPLOYEE_FIELDS).lean();
  if (byCode) return byCode;
  if (id.includes("@")) {
    return Employee.findOne({ email: id.toLowerCase() }).select(EMPLOYEE_FIELDS).lean();
  }
  return null;
};

// The employee profile belonging to the authenticated account (token identity only).
const findSelf = async (req) => {
  const authId = req.user?._id || req.user?.id || req.employee?._id || req.employee?.id;
  const authEmail = String(req.user?.email || req.employee?.email || "").toLowerCase().trim();
  const authCode = req.user?.employeeId || req.employee?.employeeId;

  if (authId && mongoose.Types.ObjectId.isValid(String(authId))) {
    const byId = await Employee.findById(authId).select(EMPLOYEE_FIELDS).lean();
    if (byId) return byId;
  }
  if (authEmail) {
    const byEmail = await Employee.findOne({ email: authEmail }).select(EMPLOYEE_FIELDS).lean();
    if (byEmail) return byEmail;
  }
  if (authCode) return Employee.findOne({ employeeId: authCode }).select(EMPLOYEE_FIELDS).lean();
  return null;
};

const round = (value, digits) => parseFloat(Number(value).toFixed(digits));

/** Summary figures derived only from recorded reviews; null wherever nothing has been recorded. */
const buildSummary = (reviews) => {
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      latestRating: null,
      previousRating: null,
      growthRatePct: null,
      growthDirection: null,
      averageRating: null,
      targetRating: null,
      targetMet: null,
      currentTier: null,
      promotionEligible: false,
      latestQuarter: null,
      goalsCompleted: null,
      totalGoals: null,
      ...Object.fromEntries(COMPETENCY_FIELDS.map((f) => [f, null])),
    };
  }

  const latest = reviews[totalReviews - 1];
  const previous = totalReviews > 1 ? reviews[totalReviews - 2] : null;
  const latestRating = Number(latest.overallRating);
  const previousRating = previous ? Number(previous.overallRating) : null;

  let growthRatePct = null;
  let growthDirection = null;
  if (previousRating) {
    growthRatePct = round(((latestRating - previousRating) / previousRating) * 100, 1);
    growthDirection = growthRatePct > 0 ? "up" : growthRatePct < 0 ? "down" : "stable";
  }

  const targetRating = latest.targetRating ?? null;

  return {
    totalReviews,
    latestRating,
    previousRating,
    growthRatePct,
    growthDirection,
    averageRating: round(reviews.reduce((acc, r) => acc + Number(r.overallRating || 0), 0) / totalReviews, 2),
    targetRating,
    targetMet: targetRating != null ? latestRating >= targetRating : null,
    currentTier: latest.performanceTier || calculatePerformanceTier(latestRating),
    promotionEligible: !!latest.promotionEligible,
    latestQuarter: latest.quarter,
    goalsCompleted: latest.goalsCompleted ?? null,
    totalGoals: latest.totalGoals ?? null,
    ...Object.fromEntries(COMPETENCY_FIELDS.map((f) => [f, latest[f] ?? null])),
  };
};

const sendReviews = async (res, employee) => {
  const reviews = await PerformanceReview.find({ employee: employee._id })
    .sort({ year: 1, quarterNumber: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    employee: {
      _id: employee._id,
      fullName: employee.fullName,
      employeeId: employee.employeeId,
      department: employee.department,
      position: employee.position,
      avatar: employee.avatar || employee.profilePicture || employee.profile_image_url || "",
    },
    reviews,
    summary: buildSummary(reviews),
  });
};

/**
 * GET /api/admin/employees/:id/performance
 * GET /api/employees/:id/performance
 *
 * Quarterly performance reviews recorded for an employee. Admins/managers may view anyone;
 * employees may only view their own reviews.
 */
export const getEmployeeQuarterlyReviews = async (req, res) => {
  try {
    const rawId = req.params.id || req.params.employeeId || req.query.employeeId;
    if (!rawId) {
      return res.status(400).json({ success: false, message: "Employee ID is required." });
    }

    const employee = await findEmployee(rawId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    if (!isReviewer(req)) {
      const self = await findSelf(req);
      if (!self || String(self._id) !== String(employee._id)) {
        return res.status(403).json({ success: false, message: "You can only view your own performance reviews." });
      }
    }

    return sendReviews(res, employee);
  } catch (error) {
    console.error("Error in getEmployeeQuarterlyReviews:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve employee quarterly review metrics."),
    });
  }
};

/**
 * GET /api/employee/performance
 *
 * Current logged-in employee views their own quarterly performance reviews.
 */
export const getMyQuarterlyReviews = async (req, res) => {
  try {
    const employee = await findSelf(req);
    if (!employee) {
      return res.status(404).json({ success: false, message: "No employee profile is linked to this account." });
    }
    return sendReviews(res, employee);
  } catch (error) {
    console.error("Error in getMyQuarterlyReviews:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve your performance reviews."),
    });
  }
};

// Optional numeric input: undefined when left blank, NaN when present but not a number.
const optionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return Number(value);
};

/**
 * POST /api/admin/employees/:id/performance
 *
 * Record (or replace) a quarterly performance review. Only what the reviewer enters is stored;
 * optional scores and goals left blank stay empty.
 */
export const addQuarterlyReview = async (req, res) => {
  try {
    const employee = await findEmployee(req.params.id || req.body.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const {
      quarter,
      overallRating,
      reviewer,
      feedbackSummary = "",
      strengths = [],
      growthOpportunities = [],
      promotionEligible = false,
      status = "Completed",
    } = req.body;

    const quarterLabel = String(quarter || "").trim();
    const labelMatch = quarterLabel.match(/Q([1-4])\D*(\d{4})/i);
    const quarterNumber = Number(req.body.quarterNumber) || (labelMatch ? Number(labelMatch[1]) : NaN);
    const year = Number(req.body.year) || (labelMatch ? Number(labelMatch[2]) : NaN);

    if (!quarterLabel || !year || overallRating === undefined || overallRating === "") {
      return res.status(400).json({
        success: false,
        message: "Quarter (e.g. 'Q3 2026'), Year, and Overall Rating are required.",
      });
    }
    if (!(quarterNumber >= 1 && quarterNumber <= 4)) {
      return res.status(400).json({ success: false, message: "Quarter must be Q1, Q2, Q3 or Q4 (e.g. 'Q3 2026')." });
    }

    const numRating = Number(overallRating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: "Overall rating must be a valid number between 1.0 and 5.0." });
    }

    const targetRating = optionalNumber(req.body.targetRating);
    if (targetRating !== undefined && (isNaN(targetRating) || targetRating < 1 || targetRating > 5)) {
      return res.status(400).json({ success: false, message: "Target rating must be between 1.0 and 5.0." });
    }

    const scores = {};
    for (const field of COMPETENCY_FIELDS) {
      const value = optionalNumber(req.body[field]);
      if (value === undefined) continue;
      if (isNaN(value) || value < 0 || value > 100) {
        return res.status(400).json({ success: false, message: "Competency scores must be between 0 and 100." });
      }
      scores[field] = value;
    }

    const goalsCompleted = optionalNumber(req.body.goalsCompleted);
    const totalGoals = optionalNumber(req.body.totalGoals);
    if (totalGoals !== undefined && (isNaN(totalGoals) || totalGoals < 1)) {
      return res.status(400).json({ success: false, message: "Total goals must be at least 1." });
    }
    if (goalsCompleted !== undefined && (isNaN(goalsCompleted) || goalsCompleted < 0 || (totalGoals !== undefined && goalsCompleted > totalGoals))) {
      return res.status(400).json({ success: false, message: "Goals completed must be between 0 and the total number of goals." });
    }

    const toList = (value) =>
      (Array.isArray(value) ? value : String(value || "").split(","))
        .map((s) => String(s).trim())
        .filter(Boolean);

    const set = {
      employee: employee._id,
      employeeId: employee.employeeId,
      quarter: quarterLabel,
      year,
      quarterNumber,
      overallRating: numRating,
      reviewer: String(reviewer || "").trim() || req.user?.fullName || req.admin?.name || "",
      reviewDate: new Date(),
      status,
      feedbackSummary: String(feedbackSummary || "").trim(),
      strengths: toList(strengths),
      growthOpportunities: toList(growthOpportunities),
      promotionEligible: !!promotionEligible,
      performanceTier: calculatePerformanceTier(numRating),
      ...scores,
    };
    if (targetRating !== undefined) set.targetRating = targetRating;
    if (goalsCompleted !== undefined) set.goalsCompleted = goalsCompleted;
    if (totalGoals !== undefined) set.totalGoals = totalGoals;

    // Fields left blank are cleared, so re-recording a quarter never keeps stale values.
    const unset = {};
    for (const field of [...COMPETENCY_FIELDS, "targetRating", "goalsCompleted", "totalGoals"]) {
      if (!(field in set)) unset[field] = "";
    }

    const updatedReview = await PerformanceReview.findOneAndUpdate(
      { employee: employee._id, quarter: quarterLabel },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    return res.status(201).json({
      success: true,
      message: `Quarterly review for ${quarterLabel} saved successfully.`,
      review: updatedReview,
    });
  } catch (error) {
    console.error("Error in addQuarterlyReview:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to record quarterly performance review."),
    });
  }
};
