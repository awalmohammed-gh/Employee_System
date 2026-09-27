import express from "express";
import {
  getSetupStatus,
  initializeSystem,
} from "../controllers/setupController.js";
import {
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
} from "../middleware/brandingUploadMiddleware.js";

const setupRouter = express.Router();

// CORS preflight
setupRouter.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Check if system is initialized
setupRouter.get("/status", getSetupStatus);
setupRouter.get("/init-status", getSetupStatus);

// Master 2-step single-tenant initialization endpoint
setupRouter.post(
  "/initialize",
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
  initializeSystem
);

// Backward-compatible alias
setupRouter.post(
  ["/", "/setup", "/setup-initial"],
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
  initializeSystem
);

export default setupRouter;
