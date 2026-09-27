import { useState } from "react";
import { useManagement } from "../../../context/ManagementContextProvider";
import { useBranding } from "../../../context/BrandingContext";
import DefaultPlatformLogo from "../../../components/DefaultPlatformLogo";

/** Company logo + name, with an initial fallback when the logo fails to load. */
export const useCompanyIdentity = () => {
  const { company, companyLogoUrl } = useManagement();
  const { companyName, logoUrl } = useBranding();
  return {
    // Company settings logo (BrandingContext) is the source of truth; it refreshes when the Admin saves a new logo
    logo: logoUrl || company?.logoUrl || companyLogoUrl,
    name: company?.name || company?.companyName || companyName || "WorkPulse",
  };
};

const BrandMark = ({ size = "w-9 h-9" }) => {
  const { logo, name } = useCompanyIdentity();
  // Track failure per URL so a newly saved logo is tried even if a previous one failed to load
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = Boolean(logo) && failedSrc === logo;

  if (!logo) return <DefaultPlatformLogo className={`${size} shrink-0`} />;

  return (
    <div className={`${size} shrink-0 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 grid place-items-center p-1 overflow-hidden`}>
      {failed ? (
        <span className="w-full h-full grid place-items-center rounded-lg bg-[#002185] text-white text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img src={logo} alt={name} className="w-full h-full object-contain" onError={() => setFailedSrc(logo)} />
      )}
    </div>
  );
};

export default BrandMark;
