import express from "express";
import {
  getPublicBranding,
  getCompanyStatus,
  getInitStatus,
  setupInitialCompany,
  getAdminBranding,
  updateBranding,
  uploadBrandAssets,
  getCurrentWorkspace,
  getWorkspaceBySlug,
  verifyWorkspace,
} from "../controllers/companyController.js";
import { verifyAdmin } from "../middleware/authAdmin.js";
import {
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
} from "../middleware/brandingUploadMiddleware.js";

const companyRouter = express.Router();

// CORS preflight
companyRouter.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Public endpoints
companyRouter.get("/profile", getPublicBranding);
companyRouter.get("/company-profile", getPublicBranding);
companyRouter.get("/public-branding", getPublicBranding);
companyRouter.get("/public-branding/:slug", getPublicBranding);
companyRouter.get("/status", getCompanyStatus);
companyRouter.get("/init-status", getInitStatus);

// Compatibility fallbacks for existing links/clients
companyRouter.get("/current-workspace", getCurrentWorkspace);
companyRouter.get("/workspace/:slug", getWorkspaceBySlug);
companyRouter.get("/workspaces/:slug", getWorkspaceBySlug);
companyRouter.get("/verify-workspace", verifyWorkspace);
companyRouter.post("/verify-workspace", verifyWorkspace);

// Upload assets
companyRouter.post(
  "/upload-assets",
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
  uploadBrandAssets
);

// Initial setup wizard
companyRouter.post(
  ["/setup", "/setup-initial"],
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
  setupInitialCompany
);

// Protected Admin branding management
companyRouter.get("/branding", verifyAdmin, getAdminBranding);
companyRouter.put(
  "/branding",
  verifyAdmin,
  uploadBranding,
  processAndOptimizeBranding,
  handleBrandingUploadError,
  updateBranding
);

export default companyRouter;
