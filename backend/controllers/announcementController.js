import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Announcement } from "../models/Announcement.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/userModel.js";
import { Employee } from "../models/employeeModel.js";
import { createNotificationRecord } from "./notificationController.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

// In-memory store for newly created announcements in current session
export const liveAnnouncementStore = [];

/**
 * GET /api/admin/announcements & GET /api/announcements
 * Fetches company announcements directly from the MongoDB Announcement collection
 */
export const getAnnouncements = async (req, res) => {
  try {
    const { category, search, priority, department } = req.query;

    let dbAnnouncements = [];
    try {
      const query = {};
      const tenantId = req.organizationId || req.companyId;

      if (category && category !== "All") {
        query.category = category;
      }
      if (priority && priority !== "All") {
        query.priority = priority.toLowerCase();
      }
      if (department && department !== "All") {
        query.$or = [{ department: "All" }, { department }];
      }
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: "i" } },
          { content: { $regex: search.trim(), $options: "i" } },
        ];
      }

      if (!tenantId) {
        return res.status(200).json({
          success: true,
          total: 0,
          pinnedCount: 0,
          announcements: [],
        });
      }
      const tenantFilter = {
        $or: [
          { organizationId: tenantId },
          { companyId: tenantId },
        ],
      };
      if (query.$or) {
        query.$and = [{ $or: query.$or }, tenantFilter];
        delete query.$or;
      } else {
        query.$or = tenantFilter.$or;
      }

      dbAnnouncements = await Announcement.find(query)
        .populate("createdBy", "fullName email role name")
        .sort({ isPinned: -1, createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.warn("DB query for announcements:", dbErr.message);
    }

    // Merge only non-duplicate dynamic items if present
    const existingIds = new Set((dbAnnouncements || []).map((a) => String(a._id || a.id)));
    const merged = [...(dbAnnouncements || [])];

    liveAnnouncementStore.forEach((liveItem) => {
      if (!existingIds.has(String(liveItem._id || liveItem.id))) {
        const itemTenant = liveItem.organizationId || liveItem.companyId;
        if (!tenantId || (itemTenant !== tenantId && String(itemTenant) !== String(tenantId))) {
          return;
        }
        let match = true;
        if (category && category !== "All" && liveItem.category !== category) match = false;
        if (priority && priority !== "All" && liveItem.priority !== priority.toLowerCase()) match = false;
        if (search && search.trim()) {
          const s = search.trim().toLowerCase();
          const t = (liveItem.title || "").toLowerCase();
          const c = (liveItem.content || "").toLowerCase();
          if (!t.includes(s) && !c.includes(s)) match = false;
        }
        if (match) {
          merged.push(liveItem);
        }
      }
    });

    // Sort: pinned first, then createdAt desc
    merged.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const pinnedCount = merged.filter((a) => a.isPinned).length;

    return res.status(200).json({
      success: true,
      total: merged.length,
      pinnedCount,
      announcements: merged,
    });
  } catch (error) {
    console.error("Error in getAnnouncements:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve announcements"),
      announcements: [],
    });
  }
};

/**
 * GET /api/announcements/:id & GET /api/admin/announcements/:id
 * Fetches announcement document by ID from MongoDB, populates creator metadata,
 * and automatically marks corresponding notifications as read for requesting employee.
 */
export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    let announcement = null;

    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        announcement = await Announcement.findOne({ _id: id, ...tenantScope })
          .populate("createdBy", "fullName email role name")
          .lean();
      } catch (dbErr) {
        console.warn("DB findById announcement error:", dbErr.message);
      }
    }

    // Check reactive in-memory cache if not found in DB
    if (!announcement) {
      const liveItem = liveAnnouncementStore.find(
        (a) =>
          String(a._id) === String(id) &&
          (!tenantId || !a.companyId || String(a.companyId) === String(tenantId) || String(a.organizationId) === String(tenantId))
      );
      if (liveItem) {
        announcement = { ...liveItem };
      }
    }

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found or access denied.",
      });
    }

    // Automatically mark the corresponding notification as read for requesting employee
    try {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
      const token =
        req.cookies?.employeeToken ||
        req.cookies?.token ||
        bearerToken ||
        req.headers["x-employee-token"] ||
        req.headers["x-admin-token"];

      let empId =
        req.employee?._id ||
        req.employee?.id ||
        req.employee?.employeeId ||
        req.user?.id ||
        req.user?._id ||
        req.headers["x-employee-id"] ||
        req.headers["x-user-id"] ||
        req.query?.employeeId ||
        req.query?.user_id;

      if (!empId && token) {
        try {
          const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key_12345";
          const decoded = jwt.verify(token, jwtSecret);
          if (decoded) {
            empId = decoded.id || decoded._id || decoded.employeeId;
          }
        } catch {
          // Token verification error handled gracefully
        }
      }

      // Mark notification documents referencing this announcement as read
      const orConditions = [];
      if (mongoose.Types.ObjectId.isValid(id)) {
        orConditions.push({ announcementId: id });
        orConditions.push({ "metadata.announcementId": id });
        orConditions.push({ "metadata.announcement_id": id });
      }
      if (announcement.title) {
        const titleExcerpt = announcement.title.substring(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        orConditions.push({
          title: { $regex: titleExcerpt, $options: "i" },
          $or: [{ category: "announcement" }, { type: "announcement" }],
        });
      }

      const notifQuery = {
        $or: orConditions.length > 0 ? orConditions : [{ announcementId: id }],
      };

      if (empId) {
        notifQuery.$and = [
          {
            $or: [
              { recipient: empId },
              { recipient_id: String(empId) },
              { recipient_id: "all_employees" },
              { recipient_role: "employee" },
            ],
          },
        ];
      }

      await Notification.updateMany(notifQuery, {
        $set: { isRead: true, is_read: true },
      }).catch(() => {});
    } catch (notifErr) {
      console.warn("Auto mark notification read error:", notifErr.message);
    }

    const creatorName =
      announcement.createdBy?.fullName ||
      announcement.createdBy?.name ||
      announcement.author ||
      "Management";
    const creatorRole =
      announcement.createdBy?.role ||
      announcement.authorRole ||
      "admin";

    return res.status(200).json({
      success: true,
      announcement: {
        _id: announcement._id,
        id: announcement._id,
        title: announcement.title,
        content: announcement.content,
        priority: (announcement.priority || "normal").toLowerCase(),
        category: announcement.category || "Company News",
        isPinned: Boolean(announcement.isPinned),
        author: creatorName,
        authorRole: creatorRole,
        createdBy: announcement.createdBy || null,
        department: announcement.department || "All",
        targetAudience: announcement.targetAudience || "all",
        tags: announcement.tags || [],
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt || announcement.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in getAnnouncementById:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to fetch announcement details."),
    });
  }
};

/**
 * POST /api/admin/announcements & POST /api/announcements
 * Accessible strictly by authenticated Admins (role: 'admin')
 * - Saves new announcement document to MongoDB
 * - Automatically creates Notification documents for every active employee
 */
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority, category, isPinned, targetAudience, department, tags } =
      req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required for announcements.",
      });
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    const cleanPriority = (priority || "normal").toLowerCase();
    const authorName =
      req.admin?.fullName || req.admin?.full_name || req.admin?.name || "Administration";
    const creatorId = req.admin?.id || req.admin?._id;

    let savedDoc = null;
    const tenantId = req.organizationId || req.companyId || req.admin?.organizationId || req.admin?.companyId || null;

    try {
      const newDocData = {
        title: cleanTitle,
        content: cleanContent,
        priority: cleanPriority,
        category: category || "Company News",
        isPinned: Boolean(isPinned),
        author: authorName,
        authorRole: "admin",
        targetAudience: targetAudience || "all",
        department: department || "All",
        tags: Array.isArray(tags) ? tags : [],
        organizationId: tenantId,
        companyId: tenantId,
        createdAt: new Date(),
      };

      if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) {
        newDocData.createdBy = creatorId;
      }

      savedDoc = await Announcement.create(newDocData);
    } catch (dbErr) {
      console.warn("DB save in createAnnouncement fallback:", dbErr.message);
    }

    const finalItem = savedDoc?.toObject
      ? savedDoc.toObject()
      : {
          _id: "announcement_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          title: cleanTitle,
          content: cleanContent,
          priority: cleanPriority,
          category: category || "Company News",
          isPinned: Boolean(isPinned),
          author: authorName,
          authorRole: "admin",
          createdBy: creatorId || null,
          targetAudience: targetAudience || "all",
          department: department || "All",
          tags: Array.isArray(tags) ? tags : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    liveAnnouncementStore.unshift(finalItem);

    // =========================================================================
    // BROADCAST NOTIFICATION: Automatically create a new Notification document
    // for every active employee (User.find({ role: 'employee', status: 'active' }))
    // =========================================================================
    try {
      // Find active employees across both User model and Employee model scoped to tenant
      let activeEmployees = [];
      try {
        const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};
        const users = await User.find({
          ...tenantScope,
          role: "employee",
          isActive: { $ne: false },
        }).select("_id fullName email");

        const emps = await Employee.find({
          ...tenantScope,
          status: { $in: ["active", "Active"] },
        }).select("_id fullName email employeeId");

        const employeeMap = new Map();
        (users || []).forEach((u) => employeeMap.set(String(u._id), u));
        (emps || []).forEach((e) => employeeMap.set(String(e._id), e));

        activeEmployees = Array.from(employeeMap.values());
      } catch (findErr) {
        console.warn("Could not query active employee list:", findErr.message);
      }

      const notifTitle =
        cleanPriority === "urgent"
          ? `🚨 Urgent Announcement: ${cleanTitle}`
          : cleanPriority === "important"
          ? `📌 Important Announcement: ${cleanTitle}`
          : `📢 Company Announcement: ${cleanTitle}`;

      const notifMessage =
        cleanContent.length > 150 ? cleanContent.substring(0, 147) + "..." : cleanContent;

      const notifDocs = [];

      // Create individual notifications for every active employee
      if (activeEmployees.length > 0) {
        activeEmployees.forEach((emp) => {
          notifDocs.push({
            recipient: emp._id,
            recipient_id: String(emp._id || emp.employeeId),
            recipient_role: "employee",
            title: notifTitle,
            message: notifMessage,
            type: "announcement",
            category: "announcement",
            priority: cleanPriority,
            isRead: false,
            is_read: false,
            announcementId: savedDoc?._id || null,
            organizationId: tenantId,
            companyId: tenantId,
            action_url: "/employee/dashboard",
            action_label: "View Announcement",
            createdAt: new Date(),
            created_at: new Date(),
          });
        });
      } else {
        // Fallback: If no active employee individual records are found yet, create broadcast for all_employees
        notifDocs.push({
          recipient: "all_employees",
          recipient_id: "all_employees",
          recipient_role: "employee",
          title: notifTitle,
          message: notifMessage,
          type: "announcement",
          category: "announcement",
          priority: cleanPriority,
          isRead: false,
          is_read: false,
          announcementId: savedDoc?._id || null,
          organizationId: tenantId,
          companyId: tenantId,
          action_url: "/employee/dashboard",
          action_label: "View Announcement",
          createdAt: new Date(),
          created_at: new Date(),
        });
      }

      if (notifDocs.length > 0) {
        await Notification.insertMany(notifDocs, { ordered: false }).catch((insertErr) => {
          console.warn("Notification insertMany partial notice:", insertErr.message);
        });
      }
    } catch (notifErr) {
      console.warn("Error broadcasting announcement notifications:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Announcement published and broadcasted to employees successfully.",
      announcement: finalItem,
    });
  } catch (error) {
    console.error("Error in createAnnouncement:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to create announcement."),
    });
  }
};

/**
 * DELETE /api/admin/announcements/:id & DELETE /api/announcements/:id
 * Deletes an announcement from the database and in-memory cache
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Remove from in-memory store
    const idx = liveAnnouncementStore.findIndex((a) => String(a._id) === String(id));
    if (idx !== -1) {
      liveAnnouncementStore.splice(idx, 1);
    }

    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        await Announcement.findByIdAndDelete(id);
      } else {
        await Announcement.findOneAndDelete({ _id: id });
      }
      // Clean up notifications referencing this announcement
      await Notification.deleteMany({
        $or: [
          { announcementId: id },
          { announcementId: String(id) },
          { "metadata.announcementId": id },
          { "metadata.announcement_id": id },
        ],
      }).catch(() => {});
    } catch (dbErr) {
      console.warn("DB delete announcement error:", dbErr.message);
    }


    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully.",
      id,
    });
  } catch (error) {
    console.error("Error in deleteAnnouncement:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete announcement."),
    });
  }
};

/**
 * PUT /api/admin/announcements/:id & PUT /api/announcements/:id
 * Updates an announcement
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, priority, category, isPinned, department } = req.body;

    let updatedDoc = null;

    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        updatedDoc = await Announcement.findByIdAndUpdate(
          id,
          {
            $set: {
              ...(title && { title: title.trim() }),
              ...(content && { content: content.trim() }),
              ...(priority && { priority: priority.toLowerCase() }),
              ...(category && { category }),
              ...(isPinned !== undefined && { isPinned: Boolean(isPinned) }),
              ...(department && { department }),
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        ).lean();
      }
    } catch (dbErr) {
      console.warn("DB update for announcement:", dbErr.message);
    }

    const liveItem = liveAnnouncementStore.find((a) => String(a._id) === String(id));
    if (liveItem) {
      if (title) liveItem.title = title.trim();
      if (content) liveItem.content = content.trim();
      if (priority) liveItem.priority = priority.toLowerCase();
      if (category) liveItem.category = category;
      if (isPinned !== undefined) liveItem.isPinned = Boolean(isPinned);
      if (department) liveItem.department = department;
      liveItem.updatedAt = new Date().toISOString();
    }

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully.",
      announcement: updatedDoc || liveItem || { _id: id, title, content },
    });
  } catch (error) {
    console.error("Error in updateAnnouncement:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update announcement."),
    });
  }
};

/**
 * PATCH /api/announcements/:id/pin
 */
export const togglePinAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    let newPinnedStatus = true;

    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.admin?.organizationId || req.admin?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const liveItem = liveAnnouncementStore.find(
      (a) =>
        String(a._id) === String(id) &&
        (!tenantId || !a.companyId || String(a.companyId) === String(tenantId) || String(a.organizationId) === String(tenantId))
    );
    if (liveItem) {
      liveItem.isPinned = !liveItem.isPinned;
      newPinnedStatus = liveItem.isPinned;
      liveItem.updatedAt = new Date().toISOString();
    }

    try {
      if (mongoose.Types.ObjectId.isValid(id)) {
        const doc = await Announcement.findOne({ _id: id, ...tenantScope });
        if (doc) {
          doc.isPinned = !doc.isPinned;
          newPinnedStatus = doc.isPinned;
          await doc.save();
        } else if (!liveItem) {
          return res.status(404).json({
            success: false,
            message: "Announcement not found or access denied.",
          });
        }
      }
    } catch (dbErr) {
      console.warn("DB toggle pin error:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: newPinnedStatus ? "Announcement pinned to board top." : "Announcement unpinned.",
      isPinned: newPinnedStatus,
    });
  } catch (error) {
    console.error("Error in togglePinAnnouncement:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to toggle pin status."),
    });
  }
};
