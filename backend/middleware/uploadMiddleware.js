import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { safeErrorMessage } from "../utils/errorResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.resolve(__dirname, "../uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?._id || req.admin?.id || req.employee?.id || "user";
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  },
});

// File filter strictly allowing JPEG, PNG, WEBP
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error("Invalid file type. Only JPEG, PNG, and WEBP images are allowed.");
    error.statusCode = 400;
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

// Multer upload middleware instance (5MB maximum file size, 10MB text field size)
export const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB field value limit
    files: 1,
  },
  fileFilter,
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FIELD_VALUE") {
      return res.status(400).json({
        success: false,
        message: "Text field value is too long.",
      });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds the 5MB maximum limit.",
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
