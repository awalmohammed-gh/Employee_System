import React from "react";
import { Building2 } from "lucide-react";

/**
 * DefaultPlatformLogo
 * Standard default branding for the SaaS platform (WorkPulse).
 * Used strictly on public-facing routes (like Landing Page) and as fallback
 * when a custom tenant company logo is not configured.
 */
export const DefaultPlatformLogo = ({
  className = "w-10 h-10",
  iconSize = "w-5 h-5",
  showLabel = false,
  labelClassName = "text-base font-black text-[#0B1E48] dark:text-white",
}) => {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`rounded-xl bg-[#0B1E48] dark:bg-blue-900/80 text-white p-2 shadow-2xs flex items-center justify-center border border-[#0B1E48]/20 shrink-0 ${className}`}
        title="WorkPulse SaaS Platform"
      >
        <Building2 className={`${iconSize} text-blue-400`} />
      </div>
      {showLabel && (
        <span className={labelClassName}>
          WorkPulse
        </span>
      )}
    </div>
  );
};

export default DefaultPlatformLogo;
