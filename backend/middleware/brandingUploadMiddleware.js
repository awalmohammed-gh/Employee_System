import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  brandingUploadDir,
  storeBrandingAsset,
  storeBase64Image,
  deleteStoredAsset,
} from "../services/storageService.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { brandingUploadDir };

// In-memory buffer storage so Sharp / Cloudinary can optimize images before persistence
const memoryStorage = multer.memoryStorage();

// File filter strictly allowing standard image formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
    "image/jpg",
  ];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error("Invalid image format. Supported formats are PNG, JPEG, WEBP, SVG, and GIF.");
    error.statusCode = 400;
    error.code = "INVALID_IMAGE_TYPE";
    cb(error, false);
  }
};

// Multer upload middleware instance (15MB limit per file, 25MB limit per field to prevent busboy LIMIT_FIELD_VALUE)
export const uploadBranding = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB file limit
    fieldSize: 25 * 1024 * 1024, // 25MB field value limit to prevent premature LIMIT_FIELD_VALUE aborts
    files: 5,
  },
  fileFilter,
}).fields([
  { name: "logo", maxCount: 1 },
  { name: "companyLogo", maxCount: 1 },
  { name: "logoFile", maxCount: 1 },
  { name: "welcomeBackground", maxCount: 1 },
  { name: "background", maxCount: 1 },
  { name: "backgroundImage", maxCount: 1 },
  { name: "welcomeBg", maxCount: 1 },
  { name: "bgFile", maxCount: 1 },
]);

/**
 * Middleware: Process, optimize, and store uploaded images using Cloudinary or Sharp
 * - Logos: Resized to max 800x800, converted to optimized WebP (or preserves SVG)
 * - Welcome background: Resized to max 1920x1080, converted to high-efficiency WebP
 * - Base64 fallback: If logo is sent as a Data URL in req.body, safely decodes and stores it
 */
export const processAndOptimizeBranding = async (req, res, next) => {
  const createdAssets = [];
  req.createdBrandingAssets = createdAssets;

  const cleanupProcessedAssets = async () => {
    for (const asset of createdAssets) {
      try {
        await deleteStoredAsset(asset);
      } catch (e) {
        // continue
      }
    }
  };

  try {
    // Normalize field aliases so controller and processing logic consistently receive req.files.logo and req.files.welcomeBackground
    if (req.files) {
      if (!req.files.logo) {
        const aliasLogo = req.files.companyLogo || req.files.logoFile;
        if (aliasLogo) req.files.logo = aliasLogo;
      }
      if (!req.files.welcomeBackground) {
        const aliasBg =
          req.files.background ||
          req.files.backgroundImage ||
          req.files.welcomeBg ||
          req.files.bgFile;
        if (aliasBg) req.files.welcomeBackground = aliasBg;
      }
    }

    // 1. Process uploaded company logo file
    if (req.files?.logo && req.files.logo[0]) {
      const logoFile = req.files.logo[0];
      const result = await storeBrandingAsset({
        buffer: logoFile.buffer,
        originalFilename: logoFile.originalname,
        mimetype: logoFile.mimetype,
        folder: "workpulse/companies",
        prefix: "logo",
        maxWidth: 800,
        maxHeight: 800,
        quality: 90,
      });

      logoFile.filename = path.basename(result.url);
      logoFile.path = result.filePath || "";
      logoFile.publicUrl = result.url;
      logoFile.publicId = result.publicId;
      logoFile.storage = result.storage;

      createdAssets.push({
        publicId: result.publicId,
        url: result.url,
        storage: result.storage,
        filePath: result.filePath,
      });
    }

    // 2. Process uploaded welcome background image file
    if (req.files?.welcomeBackground && req.files.welcomeBackground[0]) {
      const bgFile = req.files.welcomeBackground[0];
      const result = await storeBrandingAsset({
        buffer: bgFile.buffer,
        originalFilename: bgFile.originalname,
        mimetype: bgFile.mimetype,
        folder: "workpulse/companies/backgrounds",
        prefix: "bg",
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 85,
      });

      bgFile.filename = path.basename(result.url);
      bgFile.path = result.filePath || "";
      bgFile.publicUrl = result.url;
      bgFile.publicId = result.publicId;
      bgFile.storage = result.storage;

      createdAssets.push({
        publicId: result.publicId,
        url: result.url,
        storage: result.storage,
        filePath: result.filePath,
      });
    }

    // 3. Fallback: If no logo file was uploaded, but a Base64 Data URL was supplied in req.body
    const rawLogoBody = req.body?.logo || req.body?.companyLogo || req.body?.logoPreview;
    if (!req.files?.logo?.[0] && typeof rawLogoBody === "string" && rawLogoBody.startsWith("data:")) {
      try {
        const result = await storeBase64Image(rawLogoBody, {
          folder: "workpulse/companies",
          prefix: "logo",
          maxWidth: 800,
          maxHeight: 800,
          quality: 90,
        });

        // Set clean URL in req.body and remove raw base64 string
        req.body.logo = result.url;
        req.body.companyLogo = result.url;
        req.body.companyLogoPublicId = result.publicId;
        req.body.logoStorage = result.storage;
        delete req.body.logoPreview;

        createdAssets.push({
          publicId: result.publicId,
          url: result.url,
          storage: result.storage,
          filePath: result.filePath,
        });
      } catch (b64Err) {
        await cleanupProcessedAssets();
        return res.status(b64Err.statusCode || 400).json({
          success: false,
          message: safeErrorMessage(b64Err, "Failed to process Base64 company logo."),
        });
      }
    } else if (req.body?.logoPreview) {
      // Discard logoPreview if a file is already present to prevent base64 leaks
      delete req.body.logoPreview;
    }

    // 4. Fallback: If no background file was uploaded, but a Base64 Data URL was supplied in req.body
    const rawBgBody = req.body?.welcomeBackground || req.body?.backgroundPreview;
    if (!req.files?.welcomeBackground?.[0] && typeof rawBgBody === "string" && rawBgBody.startsWith("data:")) {
      try {
        const result = await storeBase64Image(rawBgBody, {
          folder: "workpulse/companies/backgrounds",
          prefix: "bg",
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
        });

        req.body.welcomeBackground = result.url;
        req.body.welcomeBackgroundUrl = result.url;
        req.body.backgroundPublicId = result.publicId;
        delete req.body.backgroundPreview;

        createdAssets.push({
          publicId: result.publicId,
          url: result.url,
          storage: result.storage,
          filePath: result.filePath,
        });
      } catch (b64Err) {
        await cleanupProcessedAssets();
        return res.status(b64Err.statusCode || 400).json({
          success: false,
          message: safeErrorMessage(b64Err, "Failed to process Base64 welcome background."),
        });
      }
    } else if (req.body?.backgroundPreview) {
      delete req.body.backgroundPreview;
    }

    next();
  } catch (err) {
    await cleanupProcessedAssets();
    console.error("[BrandingUpload] Sharp/Cloudinary image optimization error:", err);
    return res.status(500).json({
      success: false,
      message: "Image optimization failed. Please verify the uploaded image file.",
      error: safeErrorMessage(err, undefined),
    });
  }
};

// Error handling middleware for branding upload issues
export const handleBrandingUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Company logo must be smaller than 15MB.",
      });
    }
    if (err.code === "LIMIT_FIELD_VALUE") {
      return res.status(400).json({
        success: false,
        message: `Field value too long for '${err.field || "form field"}'. Please upload images as image files rather than large text strings.`,
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: safeErrorMessage(err, "File upload failed."),
    });
  }
  next();
};

export default uploadBranding;
