/**
 * Current company logo for non-React code (PDF generators, print templates).
 *
 * The single source of truth is the logo saved in company settings on the server. BrandingProvider
 * loads it from /company/public-branding (and again after the Admin saves a new logo) and publishes
 * it here, so every export uses the same logo the rest of the internal system shows.
 */
import defaultLogo from "../assets/eyenit_logo.png";

let currentLogo = "";

export const setCurrentCompanyLogo = (url) => {
  currentLogo = typeof url === "string" ? url.trim() : "";
};

const readCachedLogo = () => {
  try {
    const cached = JSON.parse(localStorage.getItem("company_branding") || sessionStorage.getItem("company_branding") || "null");
    return typeof cached?.logoUrl === "string" ? cached.logoUrl : "";
  } catch {
    return "";
  }
};

/** Company logo URL, or "" when the company has not configured one. */
export const getCurrentCompanyLogo = () => currentLogo || readCachedLogo();

/** Company logo, falling back to the built-in default image. */
export const getCompanyLogoOrDefault = () => getCurrentCompanyLogo() || defaultLogo;

export { defaultLogo };
