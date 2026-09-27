import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { brandingService } from "../services/brandingService";
import { setCurrentCompanyLogo } from "../utils/companyLogo";
import { setCurrentCompanyProfile } from "../utils/companyProfile";

const defaultBranding = {
  companyName: "WorkPulse",
  logoUrl: "",
  welcomeBackgroundUrl: "",
  primaryColor: "#0B1E48",
  contactEmail: "",
  isConfigured: true,
};

const getInitialBranding = () => {
  if (typeof window !== "undefined") {
    try {
      const stored =
        sessionStorage.getItem("company_branding") || localStorage.getItem("company_branding");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          return { ...defaultBranding, ...parsed };
        }
      }
    } catch (e) {
      console.warn("Error parsing stored branding:", e);
    }
  }
  return defaultBranding;
};

const BrandingContext = createContext({
  companyName: "WorkPulse",
  logoUrl: "",
  welcomeBackgroundUrl: "",
  primaryColor: "#0B1E48",
  branding: defaultBranding,
  isConfigured: true,
  hasExistingCompany: true,
  requiresSetup: false,
  isLoading: false,
  refreshBranding: async () => {},
  setBranding: () => {},
});

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(getInitialBranding);
  const [isConfigured, setIsConfigured] = useState(true);
  const [hasExistingCompany, setHasExistingCompany] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBranding = useCallback(async () => {
    try {
      // Fetch public company configuration from endpoint
      const [brandRes, initRes] = await Promise.allSettled([
        brandingService.getPublicBranding(),
        brandingService.getInitStatus(),
      ]);

      let comp = null;
      if (brandRes.status === "fulfilled" && brandRes.value?.success) {
        comp = brandRes.value.company || brandRes.value;
      }

      if (comp && (comp.companyName || comp.name)) {
        setBranding((prev) => {
          const resolvedLogo =
            comp.logoUrl !== undefined
              ? comp.logoUrl
              : comp.logo !== undefined
              ? comp.logo
              : prev.logoUrl;

          const resolvedName = comp.companyName || comp.name || prev.companyName || "WorkPulse";

          const merged = {
            ...prev,
            ...comp,
            companyName: resolvedName,
            logoUrl: resolvedLogo || "",
            welcomeBackgroundUrl:
              comp.welcomeBackgroundUrl || comp.backgroundUrl || prev.welcomeBackgroundUrl || "",
            primaryColor:
              comp.primaryColor || comp.themeColor || comp.themeColors?.primary || prev.primaryColor || "#0B1E48",
          };

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("company_branding", JSON.stringify(merged));
              localStorage.setItem("company_branding", JSON.stringify(merged));
            } catch (err) {
              console.debug("Failed caching branding:", err);
            }
          }
          return merged;
        });
      }

      if (initRes.status === "fulfilled" && initRes.value?.success) {
        const hasExisting = Boolean(initRes.value.hasExistingCompany);
        const configured = Boolean(initRes.value.isConfigured);
        setHasExistingCompany(hasExisting);
        setIsConfigured(configured);
        setRequiresSetup(!hasExisting || !configured);
      }
    } catch (err) {
      console.warn("[BrandingProvider] Refresh branding warning:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  // Apply primary color to CSS custom property and sync document title
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (branding.primaryColor) {
        document.documentElement.style.setProperty("--brand-primary", branding.primaryColor);
      }
      if (branding.companyName) {
        document.title = `${branding.companyName} | WorkPulse`;
      }
    }
  }, [branding.primaryColor, branding.companyName]);

  const clearBranding = useCallback(() => {
    setBranding(defaultBranding);
    if (typeof window !== "undefined") {
      localStorage.removeItem("company_branding");
      sessionStorage.removeItem("company_branding");
    }
  }, []);

  const activeCompanyName = branding.companyName || "WorkPulse";
  const activeLogoUrl = branding.logoUrl || "";
  const activeWelcomeBackgroundUrl = branding.welcomeBackgroundUrl || "";
  const activePrimaryColor = branding.primaryColor || "#0B1E48";

  // Publish the current logo for non-React code (PDF exports, print templates)
  useEffect(() => {
    setCurrentCompanyLogo(activeLogoUrl);
  }, [activeLogoUrl]);

  // Publish company name + contact details for documents (payslips, print templates)
  useEffect(() => {
    setCurrentCompanyProfile(branding);
  }, [branding]);

  return (
    <BrandingContext.Provider
      value={{
        companyName: activeCompanyName,
        logoUrl: activeLogoUrl,
        welcomeBackgroundUrl: activeWelcomeBackgroundUrl,
        primaryColor: activePrimaryColor,
        branding,
        isConfigured,
        hasExistingCompany,
        requiresSetup,
        isLoading,
        loading: isLoading,
        refreshBranding,
        clearBranding,
        setBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
};

export { useCompanyBranding } from "../hooks/useCompanyBranding";

export default BrandingContext;
