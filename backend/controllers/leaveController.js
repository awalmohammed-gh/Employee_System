import mongoose from "mongoose";
import { Leave } from "../models/leaveModel.js";
import { Employee } from "../models/employeeModel.js";
import { Notification } from "../models/notificationModel.js";
import { createNotificationRecord } from "./notificationController.js";
import { emitToEmployee, emitToAll } from "../utils/socket.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

// Live reactive store for newly submitted and managed leaves (populated from real submissions and DB)
export const liveLeaveStore = [];

// Helper to get employee info directly from Database
const resolveEmployeeInfo = async (employeeIdOrObj, orgId = null) => {
  try {
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};
    if (employeeIdOrObj && typeof employeeIdOrObj === "string" && isValidObjectId(employeeIdOrObj)) {
      const emp = await Employee.findOne({ _id: employeeIdOrObj, ...orgScope }).select("fullName employeeId department position email usedLeaveDays totalLeaveDays leaveBalance organizationId companyId").lean();
      if (emp) return emp;
    } else if (employeeIdOrObj) {
      const emp = await Employee.findOne({
        $or: [{ employeeId: employeeIdOrObj }, { email: employeeIdOrObj }],
        ...orgScope,
      }).select("fullName employeeId department position email usedLeaveDays totalLeaveDays leaveBalance organizationId companyId").lean();
      if (emp) return emp;
    }
  } catch (err) {
    console.warn("Could not query DB for employee in resolveEmployeeInfo:", err.message);
  }

  return null;
};

// Employee submits leave request
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: "All fields (leave type, start date, end date, and reason) are required.",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format provided.",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date.",
      });
    }

    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const employeeId = req.employee?.id || req.employee?._id;
    const requestOrgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId || req.employee?.organizationId;
    const employeeInfo = await resolveEmployeeInfo(employeeId, requestOrgId);

    if (!employeeInfo) {
      return res.status(401).json({
        success: false,
        message: "Employee profile not found. Please log in again.",
      });
    }
    validateOrganizationAccess(employeeInfo, req);

    let savedLeave = null;

    const resolvedOrgId = req.organizationId || employeeInfo.organizationId || employeeInfo.companyId || req.employee?.organizationId || req.user?.organizationId || null;

    // 1. Attempt writing to MongoDB if valid ObjectId
    if (isValidObjectId(employeeInfo._id)) {
      try {
        const doc = await Leave.create({
          employee: employeeInfo._id,
          leaveType,
          startDate: start,
          endDate: end,
          totalDays: days,
          reason,
          status: "Pending",
          ...(resolvedOrgId ? { organizationId: resolvedOrgId, companyId: resolvedOrgId } : {}),
        });

        if (doc) {
          savedLeave = doc.toObject ? doc.toObject() : doc;
          savedLeave.employee = employeeInfo;
        }
      } catch (dbErr) {
        console.warn("Database storage fallback in applyLeave:", dbErr.message);
      }
    }

    // 2. If DB is unavailable or on memory fallback, generate consistent leave record
    if (!savedLeave) {
      savedLeave = {
        _id: "leave_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        employee: employeeInfo,
        leaveType,
        startDate: typeof startDate === "string" ? startDate : start.toISOString().split("T")[0],
        endDate: typeof endDate === "string" ? endDate : end.toISOString().split("T")[0],
        totalDays: days,
        reason,
        status: "Pending",
        ...(resolvedOrgId ? { organizationId: resolvedOrgId, companyId: resolvedOrgId } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      savedLeave.employee = employeeInfo;
      if (resolvedOrgId) {
        savedLeave.organizationId = resolvedOrgId;
        savedLeave.companyId = resolvedOrgId;
      }
    }

    // Prepend to in-memory reactive store
    liveLeaveStore.unshift(savedLeave);

    // Broadcast real-time event to Admin & Socket
    emitToAll("leave_created", savedLeave);
    emitToAll("leave_status_changed", savedLeave);

    // Generate real-time notification for Admin
    try {
      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(employeeInfo._id || employeeInfo.employeeId || "emp_001"),
        sender_role: "employee",
        sender_name: employeeInfo.fullName || "Employee",
        title: `New ${leaveType} Submitted`,
        message: `${employeeInfo.fullName || "An employee"} (${employeeInfo.department || "General"}) submitted a ${days}-day ${leaveType} request (${savedLeave.startDate} to ${savedLeave.endDate}) pending approval.`,
        type: "leave_request",
        category: "leave",
        priority: "high",
        action_url: "/admin/leave",
        action_label: "Review Leave",
        metadata: {
          leaveId: savedLeave._id,
          employeeName: employeeInfo.fullName,
          department: employeeInfo.department,
          leaveType,
          totalDays: days,
          startDate: savedLeave.startDate,
          endDate: savedLeave.endDate,
        },
      });
    } catch (notifErr) {
      console.warn("Could not dispatch admin leave notification:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully.",
      leave: savedLeave,
    });
  } catch (error) {
    console.error("Error in applyLeave:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error submitting leave request."),
    });
  }
};

// Get all leaves for admin
export const getAllLeaves = async (req, res) => {
  try {
    let leaves = [];
    const orgId = req.organizationId || req.companyId || req.user?.organizationId || req.user?.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    try {
      const dbLeaves = await Leave.find(orgQuery)
        .populate("employee", "fullName department position employeeId email usedLeaveDays totalLeaveDays leaveBalance organizationId companyId")
        .sort({ createdAt: -1 })
        .lean();

      if (dbLeaves && dbLeaves.length > 0) {
        leaves = dbLeaves;
      }
    } catch (dbErr) {
      console.warn("DB fallback for getAllLeaves:", dbErr.message);
    }

    // Merge with in-memory live store to ensure all recently submitted requests are always visible
    const existingIds = new Set(leaves.map((l) => String(l._id)));
    const merged = [...leaves];

    liveLeaveStore.forEach((liveItem) => {
      if (orgId) {
        const itemOrg = String(liveItem.organizationId || liveItem.companyId || liveItem.employee?.organizationId || liveItem.employee?.companyId || "");
        if (itemOrg && itemOrg !== String(orgId)) return;
      }
      if (!existingIds.has(String(liveItem._id))) {
        merged.unshift(liveItem);
      }
    });

    res.status(200).json({
      success: true,
      totalLeaves: merged.length,
      leaves: merged,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Manager / Admin Leave Approval API (PATCH /api/admin/leave/:id/status)
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const rawStatus = req.body.status || "";
    const adminNotes = req.body.adminNotes || req.body.adminRemark || req.body.comments || req.body.rejectionReason || "";
    const reviewerName = req.admin?.fullName || req.user?.fullName || "Management";
    const reviewerId = String(req.admin?.id || req.admin?._id || req.user?._id || req.user?.id || "admin");

    if (!rawStatus) {
      return res.status(400).json({
        success: false,
        message: "Leave status is required.",
      });
    }

    const normalizedLower = rawStatus.toLowerCase();
    let normalizedStatus = "Pending";
    if (normalizedLower === "approved") {
      normalizedStatus = "Approved";
    } else if (normalizedLower === "rejected") {
      normalizedStatus = "Rejected";
    } else if (normalizedLower === "pending") {
      normalizedStatus = "Pending";
    } else {
      return res.status(400).json({
        success: false,
        message: "Status must be Approved, Rejected, or Pending.",
      });
    }

    const reviewedAtDate = new Date();
    let targetEmployeeId = null;
    let targetLeaveRecord = null;
    let daysCount = 1;
    let startDateFormatted = "";
    let endDateFormatted = "";
    let leaveTypeFormatted = "Leave";

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;

    // 1. Update in live store
    const storeItem = liveLeaveStore.find((l) => String(l._id) === String(id) || String(l.id) === String(id));
    if (storeItem) {
      validateOrganizationAccess(storeItem, req);
      storeItem.status = normalizedStatus;
      storeItem.adminNotes = adminNotes;
      storeItem.adminRemark = adminNotes;
      storeItem.approvedBy = reviewerName;
      storeItem.reviewedBy = reviewerName;
      storeItem.reviewedAt = reviewedAtDate.toISOString();
      storeItem.approvedAt = reviewedAtDate.toISOString();
      storeItem.updatedAt = reviewedAtDate.toISOString();
      targetLeaveRecord = storeItem;
      targetEmployeeId = storeItem.employee?._id || storeItem.employee?.employeeId || storeItem.employee?.id;
      daysCount = Number(storeItem.totalDays) || 1;
      startDateFormatted = typeof storeItem.startDate === "string" ? storeItem.startDate.split("T")[0] : new Date(storeItem.startDate).toLocaleDateString();
      endDateFormatted = typeof storeItem.endDate === "string" ? storeItem.endDate.split("T")[0] : new Date(storeItem.endDate).toLocaleDateString();
      leaveTypeFormatted = storeItem.leaveType || "Leave";
    }

    // 2. Update in MongoDB Database
    let dbUpdatedLeave = null;
    try {
      if (isValidObjectId(id)) {
        const orgQuery = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};
        const leaveDoc = await Leave.findOne({ _id: id, ...orgQuery }).populate("employee");
        if (leaveDoc) {
          validateOrganizationAccess(leaveDoc, req);
          leaveDoc.status = normalizedStatus;
          leaveDoc.adminNotes = adminNotes;
          leaveDoc.adminRemark = adminNotes;
          leaveDoc.approvedBy = reviewerName;
          leaveDoc.reviewedAt = reviewedAtDate;
          leaveDoc.approvedAt = reviewedAtDate;
          await leaveDoc.save();

          dbUpdatedLeave = leaveDoc.toObject ? leaveDoc.toObject() : leaveDoc;
          targetLeaveRecord = dbUpdatedLeave;
          targetEmployeeId = leaveDoc.employee?._id || leaveDoc.employee;
          daysCount = Number(leaveDoc.totalDays) || 1;
          startDateFormatted = leaveDoc.startDate ? new Date(leaveDoc.startDate).toISOString().split("T")[0] : "";
          endDateFormatted = leaveDoc.endDate ? new Date(leaveDoc.endDate).toISOString().split("T")[0] : "";
          leaveTypeFormatted = leaveDoc.leaveType || "Leave";

          // Update Employee Leave Balance: Deduct approved working days from employee's leave balance
          if (normalizedStatus === "Approved" && targetEmployeeId) {
            try {
              const empDoc = await Employee.findOne({ _id: targetEmployeeId, ...orgQuery });
              if (empDoc) {
                validateOrganizationAccess(empDoc, req);
                const prevUsed = Number(empDoc.usedLeaveDays) || 0;
                const totalAllowed = Number(empDoc.totalLeaveDays) || 20;
                empDoc.usedLeaveDays = prevUsed + daysCount;
                empDoc.leaveBalance = Math.max(0, totalAllowed - empDoc.usedLeaveDays);
                await empDoc.save();
              }
            } catch (empErr) {
              console.warn("Could not update employee leave balance in DB:", empErr.message);
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("DB fallback for updateLeaveStatus:", dbErr.message);
    }

    if (!targetLeaveRecord) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found or access denied.",
      });
    }

    const finalLeave = targetLeaveRecord;

    // Format start & end date strings if missing
    if (!startDateFormatted && finalLeave.startDate) {
      startDateFormatted = new Date(finalLeave.startDate).toISOString().split("T")[0];
    }
    if (!endDateFormatted && finalLeave.endDate) {
      endDateFormatted = new Date(finalLeave.endDate).toISOString().split("T")[0];
    }

    // 3. Real-Time Notification Trigger
    let notifRecord = null;
    try {
      const recipientEmpId = String(targetEmployeeId || (finalLeave.employee?._id || finalLeave.employee?.employeeId || ""));
      const isApproved = normalizedStatus === "Approved";
      const notifTitle = isApproved ? "Leave Request Approved" : "Leave Request Rejected";
      const notifMsg = isApproved
        ? `Your leave request for ${startDateFormatted || "selected period"} to ${endDateFormatted || "selected period"} has been approved by management.`
        : `Your leave request for ${startDateFormatted || "selected period"} to ${endDateFormatted || "selected period"} was rejected by management.${adminNotes ? ` Note: "${adminNotes}"` : ""}`;

      if (recipientEmpId) {
        notifRecord = await createNotificationRecord({
          recipient_id: recipientEmpId,
          recipient_role: "employee",
          sender_id: reviewerId,
          sender_role: "admin",
          sender_name: reviewerName,
          title: notifTitle,
          message: notifMsg,
          type: "leave_status_update",
          category: "leave",
          priority: isApproved ? "high" : "medium",
          action_url: "/employee/dashboard/leave",
          action_label: "View Leave Status",
          metadata: {
            leaveId: id,
            status: normalizedStatus,
            adminNotes,
            leaveType: leaveTypeFormatted,
            totalDays: daysCount,
            startDate: startDateFormatted,
            endDate: endDateFormatted,
            reviewedBy: reviewerName,
            reviewedAt: reviewedAtDate.toISOString(),
          },
        });
      }
    } catch (notifErr) {
      console.warn("Could not dispatch employee leave status notification:", notifErr.message);
    }

    // 4. Emit WebSocket Event (io.to(employeeId).emit('leave_status_changed', updatedLeave))
    try {
      const empIdStr = String(targetEmployeeId || (finalLeave.employee?._id || finalLeave.employee?.employeeId || ""));
      emitToEmployee(empIdStr, "leave_status_changed", {
        leaveId: id,
        leave: finalLeave,
        status: normalizedStatus,
        adminNotes,
        reviewedBy: reviewerName,
        reviewedAt: reviewedAtDate.toISOString(),
        notification: notifRecord,
      });

      emitToAll("leave_status_changed", {
        leaveId: id,
        leave: finalLeave,
        status: normalizedStatus,
        adminNotes,
        reviewedBy: reviewerName,
        reviewedAt: reviewedAtDate.toISOString(),
        notification: notifRecord,
      });

      if (notifRecord) {
        emitToEmployee(empIdStr, "notification", notifRecord);
      }
    } catch (wsErr) {
      console.warn("WebSocket leave event error:", wsErr.message);
    }

    // 5. Compliance Audit Logging
    try {
      if (normalizedStatus === "Approved") {
        const empName = finalLeave.employee?.fullName || finalLeave.employeeName || "Employee";
        await logAuditAction({
          req,
          action: "APPROVE_LEAVE",
          category: "Leave",
          organizationId: finalLeave.organizationId || finalLeave.companyId || req.organizationId || null,
          companyId: finalLeave.organizationId || finalLeave.companyId || req.organizationId || null,
          target: `Employee: ${empName}`,
          targetModel: "Leave",
          summary: `Approved ${leaveTypeFormatted} request for ${empName} (${daysCount} day${daysCount > 1 ? "s" : ""}, ${startDateFormatted} to ${endDateFormatted}).`,
          details: `Leave application ID '${id}' was reviewed and approved by ${reviewerName}.${adminNotes ? ` Remark: "${adminNotes}"` : ""}`,
          metadata: {
            leaveId: id,
            leaveType: leaveTypeFormatted,
            totalDays: daysCount,
            startDate: startDateFormatted,
            endDate: endDateFormatted,
            reviewerName,
          },
        });
      }
    } catch (auditErr) {
      console.warn("Leave review audit logging notice:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Leave request ${normalizedStatus.toLowerCase()} successfully`,
      leave: finalLeave,
      data: finalLeave,
    });
  } catch (error) {
    console.error("Error in updateLeaveStatus:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update leave status."),
    });
  }
};

// Get employee leaves for currently authenticated employee (GET /api/employee/leave-requests)
export const getEmployeeLeave = async (req, res) => {
  try {
    const rawEmployeeId = req.employee?.id || req.employee?._id || req.user?.id || req.user?._id;
    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};
    let validObjectId = null;

    if (isValidObjectId(rawEmployeeId)) {
      validObjectId = rawEmployeeId;
    } else if (rawEmployeeId) {
      try {
        const emp = await Employee.findOne({
          $or: [{ employeeId: rawEmployeeId }, { email: rawEmployeeId }],
          ...orgScope,
        }).select("_id usedLeaveDays totalLeaveDays leaveBalance organizationId companyId").lean();
        if (emp) {
          validateOrganizationAccess(emp, req);
          validObjectId = emp._id.toString();
        }
      } catch (err) {
        console.warn("DB employee lookup in getEmployeeLeave:", err.message);
      }
    }

    let leaves = [];

    if (validObjectId) {
      try {
        const dbLeaves = await Leave.find({
          employee: validObjectId,
          ...orgScope,
        })
          .populate("employee", "fullName employeeId department position usedLeaveDays totalLeaveDays leaveBalance organizationId companyId")
          .sort({ createdAt: -1 })
          .lean();

        if (dbLeaves && dbLeaves.length > 0) {
          leaves = dbLeaves;
        }
      } catch (dbErr) {
        console.warn("DB query for getEmployeeLeave:", dbErr.message);
      }
    }

    // Merge with in-memory live store for this employee
    if (liveLeaveStore.length > 0 && (rawEmployeeId || validObjectId)) {
      const existingIds = new Set(leaves.map((l) => String(l._id)));
      liveLeaveStore.forEach((liveItem) => {
        if (orgId) {
          const itemOrg = String(liveItem.organizationId || liveItem.companyId || liveItem.employee?.organizationId || liveItem.employee?.companyId || "");
          if (itemOrg && itemOrg !== String(orgId)) return;
        }
        const isMatch =
          String(liveItem.employee?._id) === String(validObjectId) ||
          String(liveItem.employee?._id) === String(rawEmployeeId) ||
          liveItem.employee?.employeeId === rawEmployeeId ||
          String(liveItem.employee) === String(validObjectId) ||
          String(liveItem.employee) === String(rawEmployeeId);

        if (isMatch && !existingIds.has(String(liveItem._id))) {
          leaves.unshift(liveItem);
        }
      });
    }

    // Get current employee leave balance data
    let employeeData = null;
    if (validObjectId) {
      try {
        employeeData = await Employee.findOne({ _id: validObjectId, ...orgScope }).select("usedLeaveDays totalLeaveDays leaveBalance fullName organizationId companyId").lean();
        if (employeeData) {
          validateOrganizationAccess(employeeData, req);
        }
      } catch {
        // ignore
      }
    }

    return res.status(200).json({
      success: true,
      leaves,
      data: leaves,
      total: leaves.length,
      employeeBalance: {
        totalDays: employeeData?.totalLeaveDays || 20,
        usedDays: employeeData?.usedLeaveDays || 0,
        availableDays: employeeData?.leaveBalance !== undefined ? employeeData.leaveBalance : Math.max(0, (employeeData?.totalLeaveDays || 20) - (employeeData?.usedLeaveDays || 0)),
      },
    });
  } catch (error) {
    console.error("Error in getEmployeeLeave:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Delete leave request permanently from database
export const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Leave request ID is required.",
      });
    }

    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "admin" ||
      req.employee?.role === "admin"
    );
    const requestingEmpId = req.employee?._id || req.employee?.id || req.user?._id || req.user?.id;

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    // 1. Remove from in-memory reactive store
    const storeIdx = liveLeaveStore.findIndex(
      (l) => String(l._id) === String(id) || String(l.id) === String(id)
    );
    if (storeIdx !== -1) {
      const liveItem = liveLeaveStore[storeIdx];
      validateOrganizationAccess(liveItem, req);
      // Permission check if employee
      if (!isAdmin && requestingEmpId) {
        const itemEmpId = String(liveItem.employee?._id || liveItem.employee?.id || liveItem.employee?.employeeId || "");
        if (itemEmpId !== String(requestingEmpId)) {
          return res.status(403).json({
            success: false,
            message: "You are not authorized to delete this leave request.",
          });
        }
      }
      liveLeaveStore.splice(storeIdx, 1);
    }

    // 2. Remove from MongoDB Database
    let deletedDoc = null;
    try {
      if (isValidObjectId(id)) {
        const existingDoc = await Leave.findOne({ _id: id, ...orgScope });
        if (existingDoc) {
          validateOrganizationAccess(existingDoc, req);
        }
        if (isAdmin) {
          deletedDoc = await Leave.findOneAndDelete({ _id: id, ...orgScope });
        } else if (requestingEmpId && isValidObjectId(requestingEmpId)) {
          deletedDoc = await Leave.findOneAndDelete({
            _id: id,
            employee: requestingEmpId,
            ...orgScope,
          });
        } else {
          deletedDoc = await Leave.findOneAndDelete({ _id: id, ...orgScope });
        }
      } else {
        deletedDoc = await Leave.findOneAndDelete({ _id: id, ...orgScope });
      }
    } catch (dbErr) {
      if (dbErr.message === "Unauthorized" || dbErr.statusCode === 403) {
        throw dbErr;
      }
      console.warn("DB delete leave error:", dbErr.message);
    }

    if (storeIdx === -1 && !deletedDoc) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found or access denied.",
      });
    }

    // 3. Cascade delete any notifications referencing this leave request
    try {
      await Notification.deleteMany({
        $or: [
          { "metadata.leaveId": id },
          { "metadata.leave_id": id },
          { "metadata.leaveId": String(id) },
        ],
      }).catch(() => {});
    } catch (notifErr) {
      console.warn("Cascade notification delete error for leave:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Leave request permanently deleted from database.",
      id,
    });
  } catch (error) {
    console.error("Error in deleteLeave:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete leave request."),
    });
  }
};

// Filter strictly by the authenticated user's ID (req.user._id or req.employee.id)
export const getLeaveEmployeeStats = async (req, res) => {
  try {
    const rawUserId =
      req.user?._id ||
      req.user?.id ||
      req.employee?._id ||
      req.employee?.id;

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgScope = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    let employeeObjectId = null;

    if (isValidObjectId(rawUserId)) {
      employeeObjectId = new mongoose.Types.ObjectId(rawUserId);
    } else if (rawUserId) {
      try {
        const emp = await Employee.findOne({
          $or: [{ employeeId: rawUserId }, { email: rawUserId }],
          ...orgScope,
        })
          .select("_id organizationId companyId")
          .lean();
        if (emp && isValidObjectId(emp._id)) {
          validateOrganizationAccess(emp, req);
          employeeObjectId = new mongoose.Types.ObjectId(emp._id);
        }
      } catch (err) {
        console.warn("DB employee lookup in getLeaveEmployeeStats:", err.message);
      }
    }

    const defaultStats = {
      "Annual Leave": 0,
      "Casual Leave": 0,
      "Sick Leave": 0,
      "Maternity/Study": 0,
      total: 0,
    };

    if (!employeeObjectId) {
      return res.status(200).json(defaultStats);
    }

    let aggregationResult = [];
    try {
      const userOrgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
      const orgFilter = userOrgId
        ? {
            $or: [
              { organizationId: String(userOrgId) },
              ...(isValidObjectId(userOrgId) ? [{ organizationId: new mongoose.Types.ObjectId(userOrgId) }] : []),
              { companyId: String(userOrgId) },
              ...(isValidObjectId(userOrgId) ? [{ companyId: new mongoose.Types.ObjectId(userOrgId) }] : []),
            ],
          }
        : orgScope;

      const startMatch = {
        employee: employeeObjectId,
        ...orgFilter,
      };
      aggregationResult = await Leave.aggregate([
        { $match: startMatch },
        {
          $group: {
            _id: "$leaveType",
            count: { $sum: 1 },
          },
        },
      ]);
    } catch (dbErr) {
      console.warn("DB aggregation error in getLeaveEmployeeStats:", dbErr.message);
    }

    // Merge any live in-memory store records for this employee
    if (liveLeaveStore.length > 0) {
      const inMemoryMatching = liveLeaveStore.filter(
        (l) => {
          if (orgId) {
            const itemOrg = String(l.organizationId || l.companyId || l.employee?.organizationId || l.employee?.companyId || "");
            if (itemOrg && itemOrg !== String(orgId)) return false;
          }
          return (
            String(l.employee?._id) === String(employeeObjectId) ||
            String(l.employee?._id) === String(rawUserId) ||
            l.employee?.employeeId === rawUserId
          );
        }
      );

      if (inMemoryMatching.length > 0) {
        const countsMap = {};
        aggregationResult.forEach((item) => {
          countsMap[item._id] = item.count;
        });

        inMemoryMatching.forEach((l) => {
          const type = l.leaveType || "Annual Leave";
          // avoid double counting if it has an ObjectId that was in DB
          if (!isValidObjectId(l._id)) {
            countsMap[type] = (countsMap[type] || 0) + 1;
          }
        });

        aggregationResult = Object.entries(countsMap).map(([_id, count]) => ({
          _id,
          count,
        }));
      }
    }

    if (!aggregationResult || aggregationResult.length === 0) {
      return res.status(200).json(defaultStats);
    }

    const stats = {
      "Annual Leave": 0,
      "Casual Leave": 0,
      "Sick Leave": 0,
      "Maternity/Study": 0,
      total: 0,
    };

    let totalCount = 0;

    aggregationResult.forEach((item) => {
      const type = (item._id || "").trim();
      const count = Number(item.count) || 0;
      totalCount += count;

      const lower = type.toLowerCase();
      if (lower.includes("annual")) {
        stats["Annual Leave"] += count;
      } else if (lower.includes("casual")) {
        stats["Casual Leave"] += count;
      } else if (lower.includes("sick")) {
        stats["Sick Leave"] += count;
      } else if (
        lower.includes("maternity") ||
        lower.includes("study") ||
        lower.includes("paternity")
      ) {
        stats["Maternity/Study"] += count;
      } else {
        // preserve other custom leave types if present
        stats[type] = (stats[type] || 0) + count;
      }
    });

    stats.total = totalCount;

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error in getLeaveEmployeeStats:", error);
    return res.status(200).json({
      "Annual Leave": 0,
      "Casual Leave": 0,
      "Sick Leave": 0,
      "Maternity/Study": 0,
      total: 0,
    });
  }
};


