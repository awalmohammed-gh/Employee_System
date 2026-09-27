import mongoose from "mongoose";
import { ActivityLog } from "../models/ActivityLog.js";
import { inMemoryAuditLogs } from "../utils/auditLogger.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

/**
 * GET /api/admin/activity-logs or /api/activity-log
 * Retrieves administrative actions from the ActivityLog MongoDB collection
 */
export const getActivityLogs = async (req, res) => {
  try {
    const { category, search, limit = 50, page = 1, action } = req.query;
    const query = {};

    if (category && category !== "All" && category !== "all") {
      query.category = category;
    }

    if (action && action !== "All") {
      query.action = action;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { summary: regex },
        { details: regex },
        { target: regex },
        { action: regex },
        { "performedBy.name": regex },
        { "performedBy.email": regex },
      ];
    }

    const numLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const numPage = Math.max(Number(page) || 1, 1);
    const skip = (numPage - 1) * numLimit;

    let logs = [];
    let total = 0;

    try {
      total = await ActivityLog.countDocuments(query);
      logs = await ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numLimit)
        .lean();
    } catch (dbErr) {
      console.warn("[ActivityLogController] DB query error, falling back to buffer:", dbErr.message);
      logs = inMemoryAuditLogs.slice(skip, skip + numLimit);
      total = inMemoryAuditLogs.length;
    }

    // Category breakdown counts for real-time dashboard filter pills
    let categoryCounts = {};
    try {
      const grouped = await ActivityLog.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]);
      (grouped || []).forEach((g) => {
        if (g._id) categoryCounts[g._id] = g.count;
      });
    } catch {
      // fallback
    }

    return res.status(200).json({
      success: true,
      data: logs,
      logs,
      total,
      page: numPage,
      limit: numLimit,
      categoryCounts,
    });
  } catch (error) {
    console.error("[ActivityLogController] Error in getActivityLogs:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve activity audit trail."),
    });
  }
};

/**
 * GET /api/admin/activity-logs/stats
 * Quick summary of administrative actions by category & timeframe
 */
export const getActivityLogStats = async (req, res) => {
  try {
    const totalLogs = await ActivityLog.countDocuments();
    const employeeActions = await ActivityLog.countDocuments({ category: "Employees" });
    const payrollActions = await ActivityLog.countDocuments({ category: "Payroll" });
    const securityActions = await ActivityLog.countDocuments({ category: { $in: ["Security", "Authentication"] } });
    const settingsActions = await ActivityLog.countDocuments({ category: { $in: ["Admin Settings", "Settings", "System Administration", "System"] } });

    // Recent 5 critical actions
    const recentCritical = await ActivityLog.find({
      action: { $in: ["DELETE_EMPLOYEE", "PAYROLL_FINALIZED", "UPDATE_PROFILE", "SYSTEM_INITIALIZED"] }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      stats: {
        totalLogs,
        employeeActions,
        payrollActions,
        securityActions,
        settingsActions,
        recentCritical,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: safeErrorMessage(err) });
  }
};
