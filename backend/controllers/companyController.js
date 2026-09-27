import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { CompanySettings } from "../models/CompanySettings.js";
import { Settings } from "../models/adminSettingsModel.js";
import { Admin } from "../models/Admin.js";
import { User } from "../models/userModel.js";
import { Department } from "../models/Department.js";
import { ShiftPolicy } from "../models/ShiftPolicy.js";
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
 * GET /api/company/public-branding
 * Unauthenticated endpoint for login and public-facing views.
 * Dynamically queries the company's CompanySettings.
 */
export const getPublicBranding = async (_req, res) => {
  try {
    const settings = await CompanySettings.getSettings();
    const companyName = settings.companyName || "WorkPulse";
    const logoUrl = settings.logoUrl || settings.logo || "";
    const welcomeBackgroundUrl = settings.welcomeBackgroundUrl || "";
    const primaryColor = settings.primaryColor || "#0B1E48";
    const contactEmail = settings.contactEmail || settings.email || "";

    const brandingData = {
      companyName,
      name: companyName,
      logo: logoUrl,
      logoUrl,
      companyLogo: logoUrl,
      welcomeBackgroundUrl,
      backgroundUrl: welcomeBackgroundUrl,
      primaryColor,
      contactEmail,
      email: contactEmail,
      contactPhone: settings.contactPhone || settings.phone || "",
      address: settings.address || "",
      website: settings.website || "",
      isConfigured: Boolean(settings.isConfigured),
    };

    return res.status(200).json({
      success: true,
      ...brandingData,
      branding: {
        companyName,
        logoUrl,
        welcomeBackgroundUrl,
        primaryColor,
      },
      company: {
        ...brandingData,
      },
      workspace: {
        ...brandingData,
      },
    });
  } catch (error) {
    console.error("[CompanyController] getPublicBranding error:", error);
    return res.status(200).json({
      success: true,
      companyName: "WorkPulse",
      logoUrl: "",
      primaryColor: "#0B1E48",
      isConfigured: true,
    });
  }
};

/**
 * GET /api/company/status
 */
export const getCompanyStatus = async (_req, res) => {
  try {
    const settings = await CompanySettings.findOne();
    const adminCount = await User.countDocuments({ role: { $in: ["admin", "manager"] } });
    const legacyAdminCount = await Admin.countDocuments({ role: { $in: ["admin", "manager"] } });
    const totalAdmins = adminCount + legacyAdminCount;
    const isConfigured = Boolean(settings && settings.isConfigured && totalAdmins > 0);

    return res.status(200).json({
      success: true,
      isConfigured,
      requiresSetup: !isConfigured,
      hasAdmin: totalAdmins > 0,
      companyName: settings?.companyName || "",
      logoUrl: settings?.logoUrl || settings?.logo || "",
    });
  } catch (error) {
    console.error("[CompanyController] getCompanyStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve company status.",
    });
  }
};

/**
 * GET /api/company/init-status
 */
export const getInitStatus = async (_req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: { $in: ["admin", "manager"] } });
    const legacyAdminCount = await Admin.countDocuments({ role: { $in: ["admin", "manager"] } });
    const totalAdmins = adminCount + legacyAdminCount;
    const settings = await CompanySettings.findOne();

    const hasCompany = Boolean(settings && (settings.isConfigured || settings.companyName));
    const isConfigured = Boolean(settings && settings.isConfigured && totalAdmins > 0);
    const requiresSetup = !isConfigured || totalAdmins === 0;

    return res.status(200).json({
      success: true,
      hasExistingCompany: hasCompany && totalAdmins > 0,
      isConfigured,
      configured: isConfigured,
      hasAdmin: totalAdmins > 0,
      adminExists: totalAdmins > 0,
      requiresSetup,
      companyName: settings?.companyName || "",
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      hasExistingCompany: false,
      isConfigured: false,
      configured: false,
      hasAdmin: false,
      adminExists: false,
      requiresSetup: true,
    });
  }
};

/**
 * GET /api/company/branding
 * Protected admin endpoint to retrieve complete branding settings
 */
export const getAdminBranding = async (_req, res) => {
  try {
    const settings = await CompanySettings.getSettings();

    return res.status(200).json({
      success: true,
      company: {
        companyName: settings.companyName || "WorkPulse",
        name: settings.companyName || "WorkPulse",
        logoUrl: settings.logoUrl || settings.logo || "",
        logo: settings.logoUrl || settings.logo || "",
        welcomeBackgroundUrl: settings.welcomeBackgroundUrl || "",
        primaryColor: settings.primaryColor || "#0B1E48",
        contactEmail: settings.contactEmail || settings.email || "",
        contactPhone: settings.contactPhone || settings.phone || "",
        address: settings.address || "",
        isConfigured: Boolean(settings.isConfigured),
      },
      branding: {
        companyName: settings.companyName || "WorkPulse",
        logoUrl: settings.logoUrl || settings.logo || "",
        welcomeBackgroundUrl: settings.welcomeBackgroundUrl || "",
        primaryColor: settings.primaryColor || "#0B1E48",
      },
    });
  } catch (error) {
    console.error("[CompanyController] getAdminBranding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve company branding.",
    });
  }
};

/**
 * PUT /api/company/branding
 * Protected admin endpoint to dynamically update company name, logo, background,
 * primary brand color, and contact email.
 */
export const updateBranding = async (req, res) => {
  try {
    const {
      companyName,
      name,
      primaryColor,
      contactEmail,
      email,
      contactPhone,
      phone,
      address,
      removeLogo,
      removeWelcomeBackground,
      logoUrl: manualLogoUrl,
      welcomeBackgroundUrl: manualBgUrl,
    } = req.body;

    const settings = await CompanySettings.getSettings();

    if (companyName || name) {
      settings.companyName = (companyName || name).trim();
      settings.name = settings.companyName;
    }

    if (primaryColor) {
      settings.primaryColor = primaryColor.trim();
    }

    if (contactEmail || email) {
      settings.contactEmail = (contactEmail || email).trim().toLowerCase();
      settings.email = settings.contactEmail;
    }

    if (contactPhone || phone) {
      settings.contactPhone = (contactPhone || phone).trim();
      settings.phone = settings.contactPhone;
    }

    if (address !== undefined) {
      settings.address = address.trim();
    }

    // Handle uploaded files
    const uploadedLogo = req.files?.logo?.[0];
    const uploadedBg = req.files?.welcomeBackground?.[0];

    if (uploadedLogo) {
      const builtLogo = buildAssetUrl(uploadedLogo);
      settings.logoUrl = builtLogo;
      settings.logo = builtLogo;
      settings.companyLogo = builtLogo;
    } else if (manualLogoUrl !== undefined && manualLogoUrl !== null && manualLogoUrl !== "") {
      settings.logoUrl = manualLogoUrl.trim();
      settings.logo = settings.logoUrl;
      settings.companyLogo = settings.logoUrl;
    } else if (removeLogo === "true" || removeLogo === true) {
      settings.logoUrl = "";
      settings.logo = "";
      settings.companyLogo = "";
    }

    if (uploadedBg) {
      settings.welcomeBackgroundUrl = buildAssetUrl(uploadedBg);
    } else if (manualBgUrl !== undefined && manualBgUrl !== null && manualBgUrl !== "") {
      settings.welcomeBackgroundUrl = manualBgUrl.trim();
    } else if (removeWelcomeBackground === "true" || removeWelcomeBackground === true) {
      settings.welcomeBackgroundUrl = "";
    }

    settings.isConfigured = true;
    await settings.save();

    // Synchronize with general admin Settings model
    try {
      await Settings.findOneAndUpdate(
        {},
        {
          $set: {
            "company.companyName": settings.companyName,
            "company.logo": settings.logoUrl,
            "company.email": settings.contactEmail,
            "company.phone": settings.contactPhone,
            "company.address": settings.address,
          },
        },
        { upsert: true }
      );
    } catch (syncErr) {
      console.warn("[CompanyController] Settings model sync notice:", syncErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Company settings updated successfully.",
      company: {
        companyName: settings.companyName,
        name: settings.companyName,
        logoUrl: settings.logoUrl,
        logo: settings.logoUrl,
        welcomeBackgroundUrl: settings.welcomeBackgroundUrl,
        primaryColor: settings.primaryColor,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        address: settings.address,
        isConfigured: settings.isConfigured,
      },
    });
  } catch (error) {
    console.error("[CompanyController] updateBranding error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update branding settings."),
    });
  }
};

/**
 * POST /api/company/upload-assets
 */
export const uploadBrandAssets = async (req, res) => {
  try {
    const logoFile = req.files?.logo?.[0];
    const bgFile = req.files?.welcomeBackground?.[0];

    if (!logoFile && !bgFile) {
      return res.status(400).json({
        success: false,
        message: "No brand assets were provided for upload.",
      });
    }

    const assets = {};
    if (logoFile) {
      assets.logoUrl = buildAssetUrl(logoFile);
      assets.logo = assets.logoUrl;
    }
    if (bgFile) {
      assets.welcomeBackgroundUrl = buildAssetUrl(bgFile);
    }

    return res.status(200).json({
      success: true,
      message: "Brand assets successfully uploaded.",
      assets,
    });
  } catch (error) {
    console.error("[CompanyController] uploadBrandAssets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process brand asset upload.",
      error: safeErrorMessage(error, undefined),
    });
  }
};

/**
 * POST /api/company/setup
 * Initial setup wizard if company or admin needs configuration
 */
export const setupInitialCompany = async (req, res) => {
  try {
    const {
      companyName,
      primaryColor,
      contactEmail,
      adminFullName,
      adminEmail,
      adminPassword,
    } = req.body;

    const trimmedCompanyName = (companyName || "").trim() || "WorkPulse";
    const settings = await CompanySettings.getSettings();
    settings.companyName = trimmedCompanyName;
    settings.name = trimmedCompanyName;
    if (primaryColor) settings.primaryColor = primaryColor.trim();
    if (contactEmail) {
      settings.contactEmail = contactEmail.trim().toLowerCase();
      settings.email = settings.contactEmail;
    }

    const uploadedLogo = req.files?.logo?.[0];
    const uploadedBg = req.files?.welcomeBackground?.[0];
    if (uploadedLogo) {
      settings.logoUrl = buildAssetUrl(uploadedLogo);
      settings.logo = settings.logoUrl;
    }
    if (uploadedBg) {
      settings.welcomeBackgroundUrl = buildAssetUrl(uploadedBg);
    }
    settings.isConfigured = true;
    await settings.save();

    // Create admin user if needed
    if (adminEmail && adminPassword) {
      const cleanEmail = adminEmail.toLowerCase().trim();
      let admin = await Admin.findOne({ email: cleanEmail });
      if (!admin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        admin = await Admin.create({
          full_name: (adminFullName || "Administrator").trim(),
          email: cleanEmail,
          password_hash: hashedPassword,
          role: "admin",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Company setup completed successfully.",
      company: {
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        primaryColor: settings.primaryColor,
        isConfigured: true,
      },
    });
  } catch (error) {
    console.error("[CompanyController] setupInitialCompany error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to initialize company profile."),
    });
  }
};

// Backward-compatible endpoints that return company configuration
export const getCurrentWorkspace = getPublicBranding;
export const getWorkspaceBySlug = getPublicBranding;
export const verifyWorkspace = async (_req, res) => {
  const settings = await CompanySettings.getSettings();
  return res.status(200).json({
    success: true,
    exists: true,
    company: settings,
  });
};
export const getPublicOrganizations = async (_req, res) => {
  const settings = await CompanySettings.getSettings();
  return res.status(200).json({
    success: true,
    organizations: [settings],
  });
};
export const registerOrganization = async (_req, res) => {
  return res.status(400).json({
    success: false,
    message: "Workspace registration is disabled.",
  });
};

export default {
  getPublicBranding,
  getCompanyStatus,
  getInitStatus,
  getAdminBranding,
  updateBranding,
  uploadBrandAssets,
  setupInitialCompany,
  getCurrentWorkspace,
  getWorkspaceBySlug,
  verifyWorkspace,
  getPublicOrganizations,
  registerOrganization,
};
