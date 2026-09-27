import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local directory for branding assets
export const brandingUploadDir = path.resolve(__dirname, "../uploads/branding");
if (!fs.existsSync(brandingUploadDir)) {
  fs.mkdirSync(brandingUploadDir, { recursive: true });
}

// Check if Cloudinary is configured via environment variables
export const isCloudinaryConfigured = () => {
  if (process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim()) {
    return true;
  }
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Initialize Cloudinary if credentials exist
const initCloudinary = () => {
  if (isCloudinaryConfigured()) {
    if (process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL,
      });
    } else {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
    return true;
  }
  return false;
};

initCloudinary();

/**
 * Upload an image buffer to Cloudinary or optimize and store locally
 * @param {Object} options
 * @param {Buffer} options.buffer - Raw image buffer
 * @param {string} options.originalFilename - Original filename
 * @param {string} options.mimetype - Image MIME type
 * @param {string} [options.folder='workpulse/companies'] - Cloudinary folder
 * @param {string} [options.prefix='logo'] - Local filename prefix
 * @param {number} [options.maxWidth=800] - Max width for resizing
 * @param {number} [options.maxHeight=800] - Max height for resizing
 * @param {number} [options.quality=90] - Output quality
 * @returns {Promise<{ url: string, publicId: string, storage: 'cloudinary' | 'local', filePath?: string }>}
 */
export const storeBrandingAsset = async ({
  buffer,
  originalFilename = "image.png",
  mimetype = "image/png",
  folder = "workpulse/companies",
  prefix = "logo",
  maxWidth = 800,
  maxHeight = 800,
  quality = 90,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw Object.assign(new Error("Invalid image buffer provided for storage."), { statusCode: 400 });
  }

  const isSvg =
    mimetype === "image/svg+xml" ||
    (originalFilename && path.extname(originalFilename).toLowerCase() === ".svg");

  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  // 1. Try Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      // If raster, optimize via sharp first to minimize network transfer
      let uploadBuffer = buffer;
      let format = undefined;
      if (!isSvg) {
        uploadBuffer = await sharp(buffer)
          .resize({
            width: maxWidth,
            height: maxHeight,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality, effort: 4 })
          .toBuffer();
        format = "webp";
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
            format,
            public_id: `${prefix}-${uniqueSuffix}`,
            overwrite: true,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(uploadBuffer);
      });

      return {
        url: uploadResult.secure_url || uploadResult.url,
        publicId: uploadResult.public_id,
        storage: "cloudinary",
      };
    } catch (cldErr) {
      console.warn("[StorageService] Cloudinary upload failed, falling back to local storage:", cldErr.message);
    }
  }

  // 2. Local Sharp disk storage
  let filename = "";
  let filePath = "";

  if (isSvg) {
    filename = `${prefix}-${uniqueSuffix}.svg`;
    filePath = path.join(brandingUploadDir, filename);
    await fs.promises.writeFile(filePath, buffer);
  } else {
    filename = `${prefix}-${uniqueSuffix}.webp`;
    filePath = path.join(brandingUploadDir, filename);
    await sharp(buffer)
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toFile(filePath);
  }

  return {
    url: `/uploads/branding/${filename}`,
    publicId: filename,
    storage: "local",
    filePath,
  };
};

/**
 * Parse and store a Base64 data URL into storage
 * Guarantees that raw Base64 strings are NEVER stored in MongoDB
 * @param {string} dataUrl - e.g. "data:image/png;base64,iVBORw..."
 * @param {Object} options
 * @returns {Promise<{ url: string, publicId: string, storage: string }>}
 */
export const storeBase64Image = async (dataUrl, options = {}) => {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw Object.assign(new Error("Invalid Base64 Data URL format."), { statusCode: 400 });
  }

  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw Object.assign(new Error("Malformed Base64 image string."), { statusCode: 400 });
  }

  const mimetype = matches[1].toLowerCase();
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  // Validate file size (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    const error = new Error("Uploaded image exceeds the 10MB maximum limit.");
    error.statusCode = 400;
    throw error;
  }

  // Validate MIME type
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/gif",
    "image/jpg",
  ];
  if (!allowedMimeTypes.includes(mimetype)) {
    const error = new Error("Invalid image format. Supported formats are PNG, JPEG, WEBP, SVG, and GIF.");
    error.statusCode = 400;
    throw error;
  }

  const ext = mimetype === "image/svg+xml" ? ".svg" : mimetype.replace("image/", ".");
  return await storeBrandingAsset({
    buffer,
    originalFilename: `upload${ext}`,
    mimetype,
    ...options,
  });
};

/**
 * Clean up an asset if registration fails (deletes from Cloudinary or local disk)
 * @param {Object} asset
 * @param {string} [asset.publicId]
 * @param {string} [asset.url]
 * @param {string} [asset.storage]
 * @param {string} [asset.filePath]
 */
export const deleteStoredAsset = async (asset = {}) => {
  if (!asset || typeof asset !== "object") return;
  const { publicId, url, storage, filePath } = asset;

  try {
    // 1. Cloudinary asset removal
    if (publicId && (storage === "cloudinary" || isCloudinaryConfigured())) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (cErr) {
        // Continue to check local file as fallback
      }
    }

    // 2. Local filesystem removal
    const targetPath =
      filePath ||
      (url && url.startsWith("/uploads/branding/")
        ? path.join(brandingUploadDir, path.basename(url))
        : (url && !url.startsWith("http") && !url.startsWith("data:")
            ? path.join(brandingUploadDir, path.basename(url))
            : null));

    if (targetPath && fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (err) {
    console.warn("[StorageService] Notice: Asset cleanup warning:", err.message);
  }
};
