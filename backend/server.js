import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { connectMongodb, closeMongodb, ensureMongodbConnection } from "./config/mongodb.js";
import { initSocket } from "./utils/socket.js";
import adminRouter from "./routes/adminRoutes.js";
import employeeRouter from "./routes/employeeRoutes.js";
import payrollRouter from "./routes/payrollRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import leaveRouter from "./routes/leaveRoute.js";
import settingsRouter from "./routes/adminSettingsRoute.js";
import notificationRouter from "./routes/notificationRoutes.js";
import authRouter from "./routes/authRoutes.js";
import announcementRouter from "./routes/announcementRoutes.js";
import userRouter from "./routes/userRoutes.js";
import companyRouter from "./routes/companyRoutes.js";
import { CompanySettings } from "./models/CompanySettings.js";
import { logErrorToFile } from "./utils/logger.js";
import { autoCloseAllStaleShifts } from "./controllers/employeeAttendance.js";
import { syncActivityLogsCollection } from "./utils/auditLogger.js";
import { refreshWorkingDays } from "./utils/workSchedule.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the environment file next to this backend entry point. This keeps
// `node backend/server.js` consistent with the root development launcher.
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Validate and normalize critical environment variables
const validateEnvironmentVariables = () => {
  const warnings = [];

  // Normalize MONGO_URI and MONGODB_URI for Atlas and local environments
  if (process.env.MONGO_URI && !process.env.MONGODB_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  } else if (process.env.MONGODB_URI && !process.env.MONGO_URI) {
    process.env.MONGO_URI = process.env.MONGODB_URI;
  }

  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    warnings.push("[Server Config] Warning: Neither MONGO_URI nor MONGODB_URI is set. Database operations will run with offline fallback.");
  }

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    if (process.env.NODE_ENV === "production") {
      warnings.push("[CRITICAL PRODUCTION WARNING] JWT_SECRET is not configured in production environment!");
    } else {
      process.env.JWT_SECRET = "default_secure_jwt_secret_dev_key_eyenit_2026";
      console.info("[Server Config] Initialized fallback JWT_SECRET for secure runtime session handling.");
    }
  }

  warnings.forEach((w) => console.warn(w));
  console.log(`[Server Config] Environment validation initialized (NODE_ENV: ${process.env.NODE_ENV || "development"}, PORT: ${process.env.PORT || 3000})`);
};

validateEnvironmentVariables();

// app config
const app = express();
const server = http.createServer(app);
const io = initSocket(server);
app.set("io", io);

const port = process.env.PORT || 3000;

// Standard CORS configuration for standalone Node.js server
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);

      // Allow localhost, local IP addresses, and configured client URLs
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin === process.env.CLIENT_URL ||
        origin === process.env.FRONTEND_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-token",
      "x-employee-token",
      "x-admin-id",
      "x-employee-id",
      "x-role",
      "X-Requested-With",
      "Accept",
    ],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "25mb", strict: false }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Ensure upload directories exist for persistent local storage
const rootUploadsDir = path.resolve(process.cwd(), "uploads");
const uploadsStaticDir = path.resolve(__dirname, "uploads");
const avatarsStaticDir = path.resolve(__dirname, "uploads/avatars");
try {
  if (!fs.existsSync(rootUploadsDir)) fs.mkdirSync(rootUploadsDir, { recursive: true });
  if (!fs.existsSync(uploadsStaticDir)) fs.mkdirSync(uploadsStaticDir, { recursive: true });
  if (!fs.existsSync(avatarsStaticDir)) fs.mkdirSync(avatarsStaticDir, { recursive: true });
} catch (fsErr) {
  console.warn("[Backend] Note: Error ensuring local upload directory exists:", fsErr.message);
}

// Serve uploaded profile images, branding assets, and registration files
app.use("/uploads", express.static(rootUploadsDir, { maxAge: "1d", fallthrough: true }));
app.use("/uploads", express.static(uploadsStaticDir, { maxAge: "1d", fallthrough: true }));
app.use("/uploads", (req, res) => {
  res.status(404).send("File not found");
});

// Health check endpoint (always accessible regardless of DB state)
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? "healthy" : "degraded",
    database: isDbConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Serverless entry (api/index.js) never runs startBackendServer, so connect lazily on the first API request
app.use("/api", async (req, res, next) => {
  if (!isMainModule && req.path !== "/health" && mongoose.connection.readyState !== 1) {
    await ensureMongodbConnection();
  }
  next();
});

// Database readiness guard for API routes (fails fast with 503 instead of buffering/hanging queries)
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Database connection is not available. Please verify MongoDB status.",
      code: "DATABASE_DISCONNECTED",
    });
  }
  next();
});

// Single-tenant modular API routers
// Keep the admin's working days (rest days) current for day-of-week calculations
app.use("/api", async (req, res, next) => {
  if (mongoose.connection.readyState === 1) await refreshWorkingDays();
  next();
});

app.use("/api/company", companyRouter);
app.use("/api/companies", companyRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/user", userRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/admin", adminRouter);
app.use("/api/pay", payrollRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/payslips", payrollRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/announcements", announcementRouter);

// Direct mounts without /api prefix to gracefully handle requests if client baseURL omits /api
app.use("/company", companyRouter);
app.use("/companies", companyRouter);

// database offline fallback error handler for API routes
app.use("/api", (err, req, res, next) => {
  if (
    err.name === "MongooseError" ||
    err.name === "MongoNetworkError" ||
    (err.message &&
      (err.message.includes("buffering timed out") ||
        err.message.includes("not connected") ||
        err.message.includes("ECONNREFUSED")))
  ) {
    console.warn("[Backend] Database offline during API request:", req.method, req.originalUrl);
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable (database offline).",
      code: "DATABASE_DISCONNECTED",
    });
  }
  console.error("API error:", err);
  logErrorToFile({
    route: req.originalUrl || req.url || "/api",
    statusCode: 500,
    error: err,
    req,
    details: "Server-side Express API exception",
  });
  const exposeDetails = process.env.NODE_ENV !== "production";
  return res.status(500).json({
    success: false,
    message: exposeDetails && err.message ? err.message : "Internal server error",
  });
});

// Dedicated API 404 handler: Immediately catch any unhandled /api requests before static files
app.use("/api", (req, res) => {
  console.error(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found on server.`,
  });
});

// serve frontend static assets
const clientDistPath = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDistPath));

// SPA fallback for all client routes
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
    const indexPath = path.join(clientDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"><title>Loading...</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Loading Application...</h2><p>Please wait a moment while the frontend builds.</p></body></html>`);
  }
  next();
});

// Catch-all 404 handler to help diagnose dead URLs immediately
app.use((req, res) => {
  console.error(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found on server.`,
  });
});

const isMainModule = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

// Standalone server execution: connect to database BEFORE listening for requests
const startBackendServer = async () => {
  if (isMainModule) {
    try {
      console.log("[Backend] Initializing MongoDB connection...");
      await connectMongodb();
      if (mongoose.connection.readyState === 1) {
        console.log("[Backend] Database ready for incoming requests.");

        // These initialization tasks query MongoDB and must not run in offline mode.
        try {
          await CompanySettings.getSettings();
          await autoCloseAllStaleShifts();
          await syncActivityLogsCollection();
        } catch (initializationErr) {
          console.warn("[Backend] Database initialization notice:", initializationErr.message);
        }
      } else if (process.env.NODE_ENV === "production" && !process.env.ALLOW_OFFLINE_FALLBACK) {
        // connectMongodb() reports failure by returning null rather than throwing
        throw new Error("MongoDB connection could not be established.");
      } else {
        console.warn("[Backend] Running in offline mode; database initialization tasks were skipped.");
      }

      // Schedule periodic background sweep to catch 7:30 PM auto-close and midnight rollovers
      setInterval(async () => {
        try {
          if (mongoose.connection.readyState === 1) {
            await autoCloseAllStaleShifts();
          }
        } catch {
          // ignore background interval sweep errors
        }
      }, 60 * 1000).unref();
    } catch (error) {
      console.error("[Backend] Critical: Failed to establish initial database connection:", error.message);
      if (process.env.NODE_ENV === "production" && !process.env.ALLOW_OFFLINE_FALLBACK) {
        console.error("[Backend] Halting startup: Database connection required in production.");
        process.exit(1);
      }
      console.warn("[Backend] Starting server in degraded mode. API requests will be guarded.");
    }

    server.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${port}`);
    });
  }
};

startBackendServer();

// Graceful Shutdown & Process Signal Handling to prevent hanging socket connections
let isShuttingDown = false;
const gracefulShutdown = (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Backend] Received ${signal}. Initiating graceful shutdown...`);

  // Close socket.io connections
  if (io) {
    try {
      io.close(() => {
        console.log("[Backend] Socket.IO connections closed.");
      });
    } catch (e) {
      console.warn("[Backend] Error closing Socket.IO:", e.message);
    }
  }

  // Stop receiving new connections
  server.close(async () => {
    console.log("[Backend] HTTP server closed.");
    try {
      await closeMongodb();
    } catch (err) {
      console.warn("[Backend] Error closing MongoDB connection:", err.message);
    }
    process.exit(exitCode);
  });

  // Force shutdown if connections do not close within 5 seconds
  setTimeout(() => {
    console.error("[Backend] Forced termination after timeout.");
    process.exit(1);
  }, 5000).unref();
};

if (isMainModule) {
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`[Backend] Port ${port} is already in use. Stop the other server or set PORT to an available port. Standalone Vite should run on port 5173.`);
    } else {
      console.error("[Backend] HTTP server error:", error.message);
    }
    gracefulShutdown("HTTP server error", 1);
  });
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export default app;
export { app, server, io };
