/**
 * Current company details for non-React code (payslip PDFs, print templates).
 *
 * BrandingProvider publishes the company settings loaded from /company/public-branding here, so
 * documents carry the same company name and contact details the Admin configured.
 */
let currentProfile = null;

const clean = (v) => (typeof v === "string" ? v.trim() : "");

const fromBranding = (b = {}) => ({
  companyName: clean(b.companyName || b.name),
  address: clean(b.address),
  email: clean(b.contactEmail || b.email),
  phone: clean(b.contactPhone || b.phone),
  website: clean(b.website),
});

export const setCurrentCompanyProfile = (branding) => {
  currentProfile = branding ? fromBranding(branding) : null;
};

const readCachedProfile = () => {
  try {
    const cached = JSON.parse(localStorage.getItem("company_branding") || sessionStorage.getItem("company_branding") || "null");
    return cached ? fromBranding(cached) : null;
  } catch {
    return null;
  }
};

/** { companyName, address, email, phone, website } — empty strings for anything not configured. */
export const getCompanyProfile = () =>
  currentProfile || readCachedProfile() || { companyName: "", address: "", email: "", phone: "", website: "" };
