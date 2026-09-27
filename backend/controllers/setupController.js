import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/userModel.js";
import { Admin } from "../models/Admin.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { storeBase64Image } from "../services/storageService.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

const getJwtSecret = () => process.env.JWT_SECRET || "default_jwt_secret_key_12345";

const buildAssetUrl = (file) => {
  if (!file) return "";
  if (file.publicUrl) return file.publicUrl;
  if (file.filename) {
    if (file.path && file.path.includes("branding")) {
      return `/uploads/branding/${file.filename}`;
    }
    return `/uploads/${file.filename}`;
  }
  return "";
};

/**
 * GET /api/setup/status
 * Check if single-tenant system has already been initialized with an Admin and Company
 */
export const getSetupStatus = async (_req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: { $in: ["admin", "manager"] } });
    const legacyAdminCount = await Admin.countDocuments({ role: { $in: ["admin", "manager"] } });
    const company = await CompanySettings.findOne();

    const hasAdmin = adminCount > 0 || legacyAdminCount > 0;
    const hasCompany = Boolean(company && (company.isConfigured || company.companyName));
    const isInitialized = hasAdmin && hasCompany;

    return res.status(200).json({
      success: true,
      isInitialized,
      hasAdmin,
      hasCompany,
      requiresSetup: !isInitialized,
      company: isInitialized
        ? {
            companyName: company.companyName || company.name,
            logoUrl: company.logoUrl || company.logo,
            primaryColor: company.primaryColor,
          }
        : null,
    });
  } catch (error) {
    console.error("[SetupController] getSetupStatus error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve system setup status."),
    });
  }
};

/**
 * POST /api/setup/initialize
 * Master Single-Tenant Initialization Endpoint
 *
 * Sequence Execution:
 * 1. Verify no existing Admin or Company already exists in the database.
 * 2. Hash the admin password and create the master User record with role 'admin'.
 * 3. Create the global Company document using details and branding files provided in Step 2.
 * 4. Automatically authenticate the new admin by issuing a secure JWT cookie.
 * 5. Return a success response to trigger a frontend redirect straight to the Admin Dashboard.
 */
export const initializeSystem = async (req, res) => {
  try {
    const {
      // Step 1: Admin Credentials
      fullName,
      adminFullName,
      email,
      adminEmail,
      phone,
      adminPhone,
      password,
      adminPassword,
      confirmPassword,

      // Step 2: Global Company Configuration
      companyName,
      companyEmail,
      companyPhone,
      address,
      primaryColor,
      website,
      logoUrl: inputLogoUrl,
      logoBase64,
      force,
    } = req.body;

    // Resolve unified input names
    const resolvedFullName = (adminFullName || fullName || "").trim();
    const resolvedAdminEmail = (adminEmail || email || "").toLowerCase().trim();
    const resolvedAdminPhone = (adminPhone || phone || "").trim();
    const resolvedPassword = adminPassword || password || "";

    const resolvedCompanyName = (companyName || "").trim() || "WorkPulse";
    const resolvedCompanyEmail = (companyEmail || resolvedAdminEmail || "").toLowerCase().trim();
    const resolvedCompanyPhone = (companyPhone || resolvedAdminPhone || "").trim();
    const resolvedAddress = (address || "").trim();
    const resolvedPrimaryColor = (primaryColor || "#0B1E48").trim();

    // 1. Verify no existing Admin or Company already exists (single-tenant protection)
    const existingAdminInUsers = await User.findOne({
      role: { $in: ["admin", "manager"] },
      status: "active",
    });
    const existingAdminInAdmins = await Admin.findOne({
      role: { $in: ["admin", "manager"] },
    });
    const existingConfiguredCompany = await CompanySettings.findOne({
      isConfigured: true,
    });

    const isAlreadyInitialized =
      (existingAdminInUsers || existingAdminInAdmins) && existingConfiguredCompany;

    if (isAlreadyInitialized && !force) {
      return res.status(400).json({
        success: false,
        message:
          "The system is already initialized. Re-running the initial setup wizard is disabled. Please log in using your administrator credentials.",
        isInitialized: true,
        redirectUrl: "/admin/auth?mode=login",
      });
    }

    // Input Validation
    if (!resolvedFullName) {
      return res.status(400).json({
        success: false,
        message: "Administrator full name is required.",
      });
    }

    if (!resolvedAdminEmail || !resolvedAdminEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "A valid administrator email address is required.",
      });
    }

    if (!resolvedPassword || resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Administrator password must be at least 6 characters long.",
      });
    }

    if (confirmPassword && confirmPassword !== resolvedPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match. Please verify both password fields.",
      });
    }

    if (!resolvedCompanyName) {
      return res.status(400).json({
        success: false,
        message: "Company name is required for Step 2 setup.",
      });
    }

    // 2. Hash the admin password and create the master User record with role 'admin'
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(resolvedPassword, salt);

    // Create or update master User
    let masterUser = await User.findOne({ email: resolvedAdminEmail });
    if (!masterUser) {
      masterUser = new User({
        fullName: resolvedFullName,
        name: resolvedFullName,
        email: resolvedAdminEmail,
        password: hashedPassword,
        role: "admin",
        phone: resolvedAdminPhone,
        phoneNumber: resolvedAdminPhone,
        status: "active",
        isActive: true,
      });
    } else {
      masterUser.fullName = resolvedFullName;
      masterUser.name = resolvedFullName;
      masterUser.password = hashedPassword;
      masterUser.role = "admin";
      masterUser.phone = resolvedAdminPhone;
      masterUser.status = "active";
      masterUser.isActive = true;
    }

    // Also sync with Admin collection for complete legacy route compatibility
    let adminRecord = await Admin.findOne({ email: resolvedAdminEmail });
    if (!adminRecord) {
      adminRecord = new Admin({
        full_name: resolvedFullName,
        fullName: resolvedFullName,
        email: resolvedAdminEmail,
        password_hash: hashedPassword,
        role: "admin",
        phone: resolvedAdminPhone,
      });
    } else {
      adminRecord.full_name = resolvedFullName;
      adminRecord.fullName = resolvedFullName;
      adminRecord.password_hash = hashedPassword;
      adminRecord.role = "admin";
      adminRecord.phone = resolvedAdminPhone;
    }

    // 3. Create or update the global Company document using details and branding files
    let companySettings = await CompanySettings.findOne();
    if (!companySettings) {
      companySettings = new CompanySettings();
    }

    companySettings.companyName = resolvedCompanyName;
    companySettings.name = resolvedCompanyName;
    companySettings.email = resolvedCompanyEmail;
    companySettings.contactEmail = resolvedCompanyEmail;
    companySettings.phone = resolvedCompanyPhone;
    companySettings.contactPhone = resolvedCompanyPhone;
    companySettings.address = resolvedAddress;
    companySettings.primaryColor = resolvedPrimaryColor;
    if (website) companySettings.website = website.trim();

    // Handle branding logo upload or base64 data
    const uploadedLogoFile =
      req.files?.logo?.[0] ||
      req.files?.companyLogo?.[0] ||
      req.files?.logoFile?.[0];

    if (uploadedLogoFile) {
      const builtLogoUrl = buildAssetUrl(uploadedLogoFile);
      companySettings.logoUrl = builtLogoUrl;
      companySettings.logo = builtLogoUrl;
      companySettings.companyLogo = builtLogoUrl;
      masterUser.avatar = builtLogoUrl;
      masterUser.avatarUrl = builtLogoUrl;
      adminRecord.avatar = builtLogoUrl;
    } else if (logoBase64 && typeof logoBase64 === "string" && logoBase64.startsWith("data:image")) {
      try {
        const storedLogo = await storeBase64Image(logoBase64, "company-logo");
        if (storedLogo?.publicUrl) {
          companySettings.logoUrl = storedLogo.publicUrl;
          companySettings.logo = storedLogo.publicUrl;
          companySettings.companyLogo = storedLogo.publicUrl;
        }
      } catch (imgErr) {
        console.warn("[SetupController] Base64 logo storage notice:", imgErr.message);
      }
    } else if (inputLogoUrl) {
      companySettings.logoUrl = inputLogoUrl.trim();
      companySettings.logo = inputLogoUrl.trim();
      companySettings.companyLogo = inputLogoUrl.trim();
    }

    companySettings.isConfigured = true;
    await companySettings.save();

    // Link Company ID to Admin records
    masterUser.companyId = companySettings._id;
    masterUser.organizationId = companySettings._id;
    await masterUser.save();

    adminRecord.companyId = companySettings._id;
    adminRecord.organizationId = companySettings._id;
    await adminRecord.save();

    // 4. Automatically authenticate the new admin by issuing a secure JWT cookie
    const tokenPayload = {
      id: masterUser._id.toString(),
      userId: masterUser._id.toString(),
      role: "admin",
      email: masterUser.email,
      fullName: masterUser.fullName,
      companyId: companySettings._id.toString(),
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "7d" });

    const isHttps =
      req.secure ||
      req.headers["x-forwarded-proto"] === "https" ||
      process.env.NODE_ENV === "production";

    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    };

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("token", token, cookieOptions);

    // Audit log initialization event
    try {
      await logAuditAction({
        req,
        action: "SYSTEM_INITIALIZATION",
        category: "System",
        target: "Single-Tenant Core",
        targetModel: "CompanySettings",
        summary: `Single-tenant system initialized by master admin '${masterUser.email}' for company '${resolvedCompanyName}'.`,
        performedBy: {
          id: masterUser._id.toString(),
          name: masterUser.fullName,
          email: masterUser.email,
          role: "admin",
        },
      });
    } catch (auditErr) {
      console.warn("[SetupController] Audit log notice:", auditErr.message);
    }

    // 5. Return success response to trigger frontend redirect straight to Admin Dashboard
    return res.status(201).json({
      success: true,
      message: "System setup completed successfully! Welcome to your Admin Dashboard.",
      token,
      user: {
        id: masterUser._id.toString(),
        _id: masterUser._id.toString(),
        fullName: masterUser.fullName,
        email: masterUser.email,
        role: "admin",
        phone: masterUser.phone || "",
        avatar: masterUser.avatar || "",
        dashboardUrl: "/admin/dashboard",
      },
      admin: {
        id: adminRecord._id.toString(),
        _id: adminRecord._id.toString(),
        fullName: adminRecord.full_name,
        email: adminRecord.email,
        role: "admin",
      },
      company: {
        id: companySettings._id.toString(),
        _id: companySettings._id.toString(),
        companyName: companySettings.companyName,
        email: companySettings.email,
        phone: companySettings.phone,
        address: companySettings.address,
        logoUrl: companySettings.logoUrl,
        primaryColor: companySettings.primaryColor,
        isConfigured: true,
      },
      redirectUrl: "/admin/dashboard",
    });
  } catch (error) {
    console.error("[SetupController] initializeSystem error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to initialize the system."),
    });
  }
};

export default {
  getSetupStatus,
  initializeSystem,
};
