import multer from "multer";
import { safeErrorMessage } from "../utils/errorResponse.js";

const storage = multer.memoryStorage();

const csvFilter = (_req, file, cb) => {
  const allowedExtensions = [".csv", ".txt"];
  const ext = file.originalname.slice(((file.originalname.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
  const mimetype = (file.mimetype || "").toLowerCase();

  if (
    allowedExtensions.includes("." + ext) ||
    mimetype.includes("csv") ||
    mimetype.includes("text") ||
    mimetype.includes("excel") ||
    mimetype.includes("comma-separated-values") ||
    mimetype === "application/octet-stream"
  ) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error("Only CSV files (.csv) are accepted for bulk employee import."), { statusCode: 400 }), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB CSV limit
  fileFilter: csvFilter,
});

export const handleCsvUpload = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    upload.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: safeErrorMessage(err, "Failed to process uploaded CSV file."),
        });
      }
      next();
    });
  } else {
    next();
  }
};

export default handleCsvUpload;
