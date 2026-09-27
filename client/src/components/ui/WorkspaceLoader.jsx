import { useContext, useState } from "react";
import { LoaderScopeContext } from "./loaderScope";
import { useBranding } from "../../context/BrandingContext";
import "./WorkspaceLoader.css";

/** Shared branded indicator for pages, sections, and inline actions. */
export const WorkspaceLoader = ({
  title = "Loading…",
  message,
  subtext,
  fullScreen = true,
  compact = false,
  inline = false,
  className = "",
}) => {
  const { logoUrl, companyName } = useBranding();
  const [failedLogo, setFailedLogo] = useState(null);
  const initials = (companyName || "").trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const scope = useContext(LoaderScopeContext);
  // Inside the app shell a "full page" loader fills the content area only (sidebar/top bar stay visible)
  const mode = inline ? "inline" : compact ? "compact" : fullScreen ? (scope === "content" ? "content" : "page") : "section";

  return (
    <span className={`company-loader company-loader--${mode} ${className}`} role="status" aria-live="polite" aria-label={title || "Loading"}>
      <span className="company-loader__mark" aria-hidden="true">
        <span className="company-loader__orbit" />
        <span className="company-loader__logo">
          {logoUrl && failedLogo !== logoUrl ? (
            <img key={logoUrl} src={logoUrl} alt="" onError={() => setFailedLogo(logoUrl)} />
          ) : (
            <span className="company-loader__initials">{initials || "…"}</span>
          )}
        </span>
      </span>
      {!inline && (title || subtext || message) && (
        <span className="company-loader__copy">
          <span className="company-loader__title">{title}</span>
          {(subtext || message) && <span className="company-loader__message">{subtext || message}</span>}
        </span>
      )}
    </span>
  );
};

export default WorkspaceLoader;
