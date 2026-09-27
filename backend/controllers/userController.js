import { buildTenantScope } from "../utils/tenantScope.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { validateOrganizationAccess, extractResourceOrgId } from "../utils/validateOrganizationAccess.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

// Legacy profiles without an organization may only be updated by their authenticated owner.
const validateProfileAccess = (profile, req) => {
  const authenticatedId = req.user?.id || req.user?._id;
  if (!extractResourceOrgId(profile) && authenticatedId && String(profile._id) === String(authenticatedId)) return;
  validateOrganizationAccess(profile, req);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to remove old avatar files from disk
const removeOldAvatarFile = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") return;
  try {
    if (fileUrl.startsWith("/uploads/avatars/")) {
      const fileName = fileUrl.replace("/uploads/avatars/", "");
      const fullPath = path.resolve(__dirname, "../uploads/avatars", fileName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[Avatar Update] Deleted obsolete avatar file: ${fileName}`);
      }
    }
  } catch (err) {
    console.warn("[Avatar Update] Failed to remove old avatar file:", err.message);
  }
};

/**
 * Helper to save base64 Data URL to avatars directory
 */
const saveBase64Avatar = (dataUrl, userId = "user") => {
  try {
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const ext = matches[1] === "jpeg" ? ".jpg" : `.${matches[1]}`;
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const uploadDir = path.resolve(__dirname, "../uploads/avatars");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `avatar-${userId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/avatars/${fileName}`;
  } catch (err) {
    console.error("[Avatar Update] Failed to parse base64 data URL:", err.message);
    return null;
  }
};

/**
 * PATCH /api/users/profile-picture
 * or POST /api/users/profile-picture
 * or PUT /api/users/profile-picture
 * Handles multipart file upload or JSON avatar payload, updates MongoDB document, cleans up previous file.
 */
export const uploadProfilePicture = async (req, res) => {
  const startTime = Date.now();
  console.log("=================================================");
  console.log(`[Avatar Update] 🚀 Incoming ${req.method} ${req.originalUrl}`);
  console.log(`[Avatar Update] Auth User:`, JSON.stringify(req.user || req.admin || req.employee || "Anonymous"));
  console.log(`[Avatar Update] File present:`, !!req.file, req.file ? `(${req.file.originalname}, ${req.file.size} bytes, ${req.file.mimetype})` : "");
  console.log(`[Avatar Update] Body keys:`, Object.keys(req.body || {}));

  try {
    let newAvatarUrl = "";

    // 1. Check if multipart file uploaded via Multer (single or array)
    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (uploadedFile) {
      newAvatarUrl = `/uploads/avatars/${uploadedFile.filename}`;
      console.log(`[Avatar Update] 📁 Received uploaded multipart file:`, {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalname,
        sizeBytes: uploadedFile.size,
        mimeType: uploadedFile.mimetype,
        storedPath: uploadedFile.path || newAvatarUrl,
      });
    } else if (req.body?.avatar || req.body?.profilePicture || req.body?.image || req.body?.profile_image_url || req.body?.avatarUrl) {
      const rawAvatar = req.body.avatar || req.body.profilePicture || req.body.image || req.body.profile_image_url || req.body.avatarUrl;
      console.log(`[Avatar Update] 📦 Received payload string avatar data (length: ${typeof rawAvatar === "string" ? rawAvatar.length : 0})`);
      if (typeof rawAvatar === "string" && rawAvatar.startsWith("data:image/")) {
        const savedUrl = saveBase64Avatar(rawAvatar, req.user?.id || "user");
        if (savedUrl) {
          newAvatarUrl = savedUrl;
          console.log(`[Avatar Update] 💾 Decoded and saved base64 image data to disk -> ${newAvatarUrl}`);
        } else {
          newAvatarUrl = rawAvatar;
        }
      } else if (typeof rawAvatar === "string") {
        newAvatarUrl = rawAvatar.trim();
        console.log(`[Avatar Update] 🔗 Received direct image URL string -> ${newAvatarUrl}`);
      }
    }

    if (!newAvatarUrl) {
      console.warn(`[Avatar Update] ❌ Rejected: No image file or avatar URL provided.`);
      return res.status(400).json({
        success: false,
        message: "No image file or avatar URL provided. Please upload a JPEG, PNG, or WEBP image.",
      });
    }

    const userId = req.user?.id || req.user?._id || req.admin?.id || req.employee?.id;
    const userRole = req.user?.role || (req.admin ? "admin" : "employee");
    const userEmail = req.user?.email || req.body?.email;

    const tenantScope = buildTenantScope(req);

    let updatedUser = null;
    let oldAvatarUrl = null;
    let targetModel = "";

    // 2. Try updating Admin document if role is admin or user matches admin
    if (["admin", "manager", "company_admin"].includes(userRole)) {
      let dbAdmin = null;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        dbAdmin = await Admin.findOne({ _id: userId, ...tenantScope });
      }
      if (!dbAdmin && userEmail) {
        dbAdmin = await Admin.findOne({ email: userEmail.toLowerCase().trim(), ...tenantScope });
      }

      if (dbAdmin) {
        targetModel = "Admin";
        oldAvatarUrl = dbAdmin.profile_image_url || dbAdmin.avatar || dbAdmin.avatarUrl;
        dbAdmin.profile_image_url = newAvatarUrl;
        dbAdmin.avatar = newAvatarUrl;
        dbAdmin.avatarUrl = newAvatarUrl;
        dbAdmin.profilePicture = newAvatarUrl;
        dbAdmin.profile_picture = newAvatarUrl;
        await dbAdmin.save();

        console.log(`[Avatar Update] ✅ MongoDB Admin document updated: ID=${dbAdmin._id}, Name=${dbAdmin.full_name}`);

        updatedUser = {
          id: String(dbAdmin._id),
          _id: String(dbAdmin._id),
          fullName: dbAdmin.full_name,
          full_name: dbAdmin.full_name,
          email: dbAdmin.email,
          role: dbAdmin.role || "admin",
          profilePicture: newAvatarUrl,
          profile_picture: newAvatarUrl,
          profile_image_url: newAvatarUrl,
          avatar: newAvatarUrl,
          avatarUrl: newAvatarUrl,
          avatar_url: newAvatarUrl,
        };
      }
    }

    // 3. Try updating Employee document if not updated yet
    if (!updatedUser) {
      let dbEmp = null;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        dbEmp = await Employee.findOne({ _id: userId, ...tenantScope });
      }
      if (!dbEmp && req.user?.employeeId) {
        dbEmp = await Employee.findOne({ employeeId: req.user.employeeId, ...tenantScope });
      }
      if (!dbEmp && userId) {
        dbEmp = await Employee.findOne({ employeeId: String(userId), ...tenantScope });
      }
      if (!dbEmp && userEmail) {
        dbEmp = await Employee.findOne({ email: userEmail.toLowerCase().trim(), ...tenantScope });
      }

      if (dbEmp) {
        validateProfileAccess(dbEmp, req);
        targetModel = "Employee";
        oldAvatarUrl = dbEmp.profilePicture || dbEmp.profile_picture || dbEmp.avatar || dbEmp.avatarUrl;
        dbEmp.profilePicture = newAvatarUrl;
        dbEmp.profile_picture = newAvatarUrl;
        dbEmp.avatar = newAvatarUrl;
        dbEmp.avatarUrl = newAvatarUrl;
        dbEmp.profile_image_url = newAvatarUrl;
        dbEmp.avatar_url = newAvatarUrl;
        await dbEmp.save();

        console.log(`[Avatar Update] ✅ MongoDB Employee document updated: ID=${dbEmp._id}, EmpID=${dbEmp.employeeId}, Name=${dbEmp.fullName}`);

        updatedUser = {
          id: String(dbEmp._id),
          _id: String(dbEmp._id),
          employeeId: dbEmp.employeeId,
          fullName: dbEmp.fullName,
          full_name: dbEmp.fullName,
          email: dbEmp.email,
          role: "employee",
          department: dbEmp.department,
          position: dbEmp.position,
          profilePicture: newAvatarUrl,
          profile_picture: newAvatarUrl,
          avatar: newAvatarUrl,
          avatarUrl: newAvatarUrl,
          profile_image_url: newAvatarUrl,
          avatar_url: newAvatarUrl,
        };
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Profile not found. Your picture was not saved." });
    }

    // 4. Also synchronize standard User model if exists
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const dbUser = await User.findOne({ _id: userId, ...tenantScope });
        if (dbUser) {
          validateProfileAccess(dbUser, req);
          dbUser.profile_image_url = newAvatarUrl;
          dbUser.avatar = newAvatarUrl;
          dbUser.avatarUrl = newAvatarUrl;
          dbUser.profilePicture = newAvatarUrl;
          dbUser.profile_picture = newAvatarUrl;
          await dbUser.save();
          console.log(`[Avatar Update] ✅ Synchronized User collection for ID: ${userId}`);
        }
      } catch (userErr) {
        console.warn("[Avatar Update] User model sync notice:", userErr.message);
      }
    }

    // 5. Clean up old avatar file from disk if distinct
    if (oldAvatarUrl && oldAvatarUrl !== newAvatarUrl) {
      removeOldAvatarFile(oldAvatarUrl);
    }

    const duration = Date.now() - startTime;
    console.log(`[Avatar Update] 🎉 Success (200 OK in ${duration}ms) for model: ${targetModel || "Fallback"}`);
    console.log(`[Avatar Update] Response avatarUrl: ${newAvatarUrl}`);
    console.log("=================================================");

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded and saved to MongoDB successfully.",
      avatarUrl: newAvatarUrl,
      profilePicture: newAvatarUrl,
      profile_picture: newAvatarUrl,
      profile_image_url: newAvatarUrl,
      avatar: newAvatarUrl,
      user: updatedUser || {
        id: userId,
        profilePicture: newAvatarUrl,
        avatar: newAvatarUrl,
        profile_image_url: newAvatarUrl,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Avatar Update] ❌ Error in ${duration}ms:`, error);
    console.log("=================================================");
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update profile picture in database."),
    });
  }
};

/**
 * DELETE /api/users/profile-picture
 * Removes current profile picture, sets field to empty string in MongoDB, and deletes file from disk.
 */
export const removeProfilePicture = async (req, res) => {
  const startTime = Date.now();
  console.log("=================================================");
  console.log(`[Avatar Remove] 🚀 Incoming DELETE ${req.originalUrl}`);
  console.log(`[Avatar Remove] Auth User:`, JSON.stringify(req.user || req.admin || req.employee || "Anonymous"));

  try {
    const userId = req.user?.id || req.user?._id || req.admin?.id || req.employee?.id;
    const userRole = req.user?.role || (req.admin ? "admin" : "employee");
    const userEmail = req.user?.email || req.body?.email;

    const tenantScope = buildTenantScope(req);

    let oldAvatarUrl = null;
    let updatedUser = null;
    let targetModel = "";

    // 1. Try removing from Admin
    if (["admin", "manager", "company_admin"].includes(userRole)) {
      let dbAdmin = null;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        dbAdmin = await Admin.findOne({ _id: userId, ...tenantScope });
      }
      if (!dbAdmin && userEmail) {
        dbAdmin = await Admin.findOne({ email: userEmail.toLowerCase().trim(), ...tenantScope });
      }

      if (dbAdmin) {
        targetModel = "Admin";
        oldAvatarUrl = dbAdmin.profile_image_url || dbAdmin.avatar;
        dbAdmin.profile_image_url = "";
        dbAdmin.avatar = "";
        await dbAdmin.save();

        console.log(`[Avatar Remove] ✅ Admin avatar cleared in MongoDB: ID=${dbAdmin._id}`);

        updatedUser = {
          id: String(dbAdmin._id),
          _id: String(dbAdmin._id),
          fullName: dbAdmin.full_name,
          full_name: dbAdmin.full_name,
          email: dbAdmin.email,
          role: dbAdmin.role || "admin",
          profilePicture: "",
          profile_image_url: "",
          avatar: "",
          avatar_url: "",
        };
      }
    }

    // 2. Try removing from Employee
    if (!updatedUser) {
      let dbEmp = null;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        dbEmp = await Employee.findOne({ _id: userId, ...tenantScope });
      }
      if (!dbEmp && req.user?.employeeId) {
        dbEmp = await Employee.findOne({ employeeId: req.user.employeeId, ...tenantScope });
      }
      if (!dbEmp && userId) {
        dbEmp = await Employee.findOne({ employeeId: String(userId), ...tenantScope });
      }
      if (!dbEmp && userEmail) {
        dbEmp = await Employee.findOne({ email: userEmail.toLowerCase().trim(), ...tenantScope });
      }

      if (dbEmp) {
        validateProfileAccess(dbEmp, req);
        targetModel = "Employee";
        oldAvatarUrl = dbEmp.profilePicture || dbEmp.profile_picture || dbEmp.avatar;
        dbEmp.profilePicture = "";
        dbEmp.profile_picture = "";
        dbEmp.avatar = "";
        dbEmp.profile_image_url = "";
        dbEmp.avatar_url = "";
        await dbEmp.save();

        console.log(`[Avatar Remove] ✅ Employee avatar cleared in MongoDB: ID=${dbEmp._id}, EmpID=${dbEmp.employeeId}`);

        updatedUser = {
          id: String(dbEmp._id),
          _id: String(dbEmp._id),
          employeeId: dbEmp.employeeId,
          fullName: dbEmp.fullName,
          full_name: dbEmp.fullName,
          email: dbEmp.email,
          role: "employee",
          department: dbEmp.department,
          position: dbEmp.position,
          profilePicture: "",
          profile_picture: "",
          avatar: "",
          avatar_url: "",
        };
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Profile not found. Your picture was not removed." });
    }

    // 3. Remove physical avatar file from disk
    if (oldAvatarUrl) {
      removeOldAvatarFile(oldAvatarUrl);
    }

    const duration = Date.now() - startTime;
    console.log(`[Avatar Remove] 🎉 Avatar removed successfully in ${duration}ms for model: ${targetModel || "Fallback"}`);
    console.log("=================================================");

    return res.status(200).json({
      success: true,
      message: "Profile picture removed successfully.",
      avatarUrl: "",
      profilePicture: "",
      profile_image_url: "",
      avatar: "",
      user: updatedUser || {
        id: userId,
        profilePicture: "",
        avatar: "",
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Avatar Remove] ❌ Error in ${duration}ms:`, error);
    console.log("=================================================");
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : 500;
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to remove profile picture."),
    });
  }
};

