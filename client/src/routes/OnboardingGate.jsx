import { useBranding } from "../context/BrandingContext";
import WorkspaceLoader from "../components/ui/WorkspaceLoader";

export const OnboardingGate = ({ children }) => {
  const { isLoading } = useBranding();

  if (isLoading) {
    return <WorkspaceLoader fullScreen />;
  }

  return children;
};

export default OnboardingGate;
