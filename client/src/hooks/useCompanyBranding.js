import { useState, useEffect, useCallback } from "react";
import { api } from "../apis/axios";
import eyenitLogo from "../assets/eyenit_logo.png";

const DEFAULT_BRANDING = {
  companyName: "",
  logoUrl: "/eyenit_logo.png",
  welcomeBackgroundUrl: "",
  primaryColor: "#0B1E48",
  accentColor: "#ff5500",
  contactEmail: "",
  isConfigured: false,
};

const getCachedBranding = () => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("org_branding") || sessionStorage.getItem("org_branding");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          return { ...DEFAULT_BRANDING, ...parsed };
        }
      }
    } catch {
      return DEFAULT_BRANDING;
    }
  }
  return DEFAULT_BRANDING;
};

/**
 * Custom React hook that fetches active public organization branding data
 * from `/api/company/public-branding` and dynamically applies theme variables
 * and assets (logo, colors, background) across authentication views.
 */
export const useCompanyBranding = () => {
  const [branding, setBranding] = useState(getCachedBranding);
  const [isLoading, setIsLoading] = useState(!branding.companyName);
  const [error, setError] = useState(null);

  const fetchBranding = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const slug = typeof window !== "undefined" ? localStorage.getItem("workpulse_last_org_slug") : null;
      const url = slug ? `/company/public-branding/${encodeURIComponent(slug)}` : "/company/public-branding";
      const response = await api.get(url);
      const data = response?.data;

      if (data) {
        const comp = data.company || data;
        const normalized = {
          companyName:
            comp.companyName ||
            comp.name ||
            data.companyName ||
            data.name ||
            DEFAULT_BRANDING.companyName,
          logoUrl:
            comp.logoUrl ||
            comp.logo ||
            data.logoUrl ||
            data.logo ||
            DEFAULT_BRANDING.logoUrl,
          welcomeBackgroundUrl:
            comp.welcomeBackgroundUrl ||
            comp.backgroundUrl ||
            data.welcomeBackgroundUrl ||
            data.backgroundUrl ||
            "",
          primaryColor:
            comp.primaryColor ||
            comp.themeColor ||
            comp.themeColors?.primary ||
            data.primaryColor ||
            data.themeColor ||
            data.themeColors?.primary ||
            DEFAULT_BRANDING.primaryColor,
          accentColor:
            comp.themeColors?.accent ||
            data.themeColors?.accent ||
            DEFAULT_BRANDING.accentColor,
          contactEmail:
            comp.contactEmail ||
            data.contactEmail ||
            DEFAULT_BRANDING.contactEmail,
          isConfigured: Boolean(
            data.isConfigured !== undefined
              ? data.isConfigured
              : comp.isConfigured
          ),
        };

        setBranding(normalized);

        // Dynamically inject CSS variables into document root for seamless Tailwind/CSS access
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty(
            "--brand-primary",
            normalized.primaryColor
          );
          document.documentElement.style.setProperty(
            "--brand-accent",
            normalized.accentColor
          );
        }
      }
    } catch (err) {
      console.warn(
        "[useCompanyBranding] Using default branding due to fetch error:",
        err.message
      );
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const activeLogo = branding.logoUrl || eyenitLogo;

  return {
    branding,
    logoUrl: activeLogo,
    themeColor: branding.primaryColor,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    companyName: branding.companyName,
    welcomeBackgroundUrl: branding.welcomeBackgroundUrl,
    isConfigured: branding.isConfigured,
    isLoading,
    error,
    refreshBranding: fetchBranding,
  };
};

export default useCompanyBranding;
