import { api } from "../apis/axios";

export const brandingService = {
  /**
   * Fetch active public branding configuration (unauthenticated)
   */
  getPublicBranding: async () => {
    try {
      const res = await api.get("/company/public-branding");
      return res.data;
    } catch (err) {
      console.warn("[BrandingService] Public branding error:", err.message);
      return {
        success: false,
        company: {
          companyName: "",
          logoUrl: "",
          welcomeBackgroundUrl: "",
          primaryColor: "#0B1E48",
          contactEmail: "",
          isConfigured: false,
        },
        isConfigured: false,
      };
    }
  },

  /**
   * Check company setup and configuration status
   */
  getCompanyStatus: async () => {
    try {
      const res = await api.get("/company/status");
      return res.data;
    } catch (err) {
      console.warn("[BrandingService] Status check warning:", err.message);
      return {
        success: true,
        isConfigured: false,
        requiresSetup: true,
        hasAdmin: false,
      };
    }
  },

  /**
   * Check initial company setup status for system onboarding gate
   */
  getInitStatus: async () => {
    try {
      const res = await api.get("/company/init-status");
      return res.data;
    } catch (err) {
      console.warn("[BrandingService] Init-status check warning:", err.message);
      return {
        success: true,
        hasExistingCompany: false,
        companyName: "",
        isConfigured: false,
        requiresSetup: true,
      };
    }
  },

  /**
   * Upload and optimize brand assets via standalone endpoint
   */
  uploadBrandAssets: async (formData) => {
    const res = await api.post("/company/upload-assets", formData);
    return res.data;
  },

  /**
   * Submit initial setup wizard registration
   */
  setupInitialCompany: async (formData) => {
    const res = await api.post("/company/setup", formData);
    return res.data;
  },

  /**
   * Fetch administrator branding configuration (authenticated)
   */
  getAdminBranding: async () => {
    const res = await api.get("/company/branding");
    return res.data;
  },

  /**
   * Update company branding assets and organization info (authenticated)
   */
  updateAdminBranding: async (formData) => {
    const res = await api.put("/company/branding", formData);
    return res.data;
  },
};

export default brandingService;
