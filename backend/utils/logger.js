import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logDir = path.resolve(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.warn("Could not create logs directory:", err.message);
  }
}

const errorLogPath = path.join(logDir, "error.log");

/**
 * Centralized Error Logger Utility
 * Captures 500 status code details, MongoDB aggregation pipeline failures,
 * stack traces, and request context, and writes them reliably to disk.
 */
export const logErrorToFile = ({
  route = "unknown_route",
  statusCode = 500,
  error = null,
  req = null,
  details = "",
  timestamp = new Date().toISOString(),
}) => {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = {
      timestamp,
      statusCode,
      route: req?.originalUrl || req?.url || route,
      method: req?.method || "GET",
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || "127.0.0.1",
      user: req?.user?.id || req?.admin?.id || req?.employee?.id || "anonymous",
      role: req?.user?.role || req?.admin?.role || req?.employee?.role || "unknown",
      query: req?.query || {},
      body: req?.body ? { ...req.body, password: req.body.password ? "[REDACTED]" : undefined } : {},
      errorMessage: error?.message || String(error || "Unknown Error"),
      errorStack: error?.stack || null,
      details,
    };

    const formattedLine = `[${timestamp}] [STATUS ${statusCode}] [${logEntry.method} ${logEntry.route}] -> ${logEntry.errorMessage}\nDETAILS: ${details}\nQUERY: ${JSON.stringify(logEntry.query)}\nSTACK: ${logEntry.errorStack || "N/A"}\n--------------------------------------------------------------------------------\n`;

    fs.appendFileSync(errorLogPath, formattedLine, "utf8");
    console.error(`[ErrorLogger] 500 Error recorded in ${errorLogPath} for route: ${logEntry.route}`);
  } catch (err) {
    console.error("[ErrorLogger] Failed to write error log to disk:", err.message);
  }
};

/**
 * Express Middleware to capture and log any 500 response automatically
 */
export const errorLoggerMiddleware = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  if (statusCode >= 500) {
    logErrorToFile({
      route: req.originalUrl || req.path,
      statusCode,
      error: err,
      req,
      details: "Unhandled Express API server exception",
    });
  }
  next(err);
};

export default {
  logErrorToFile,
  errorLoggerMiddleware,
};
