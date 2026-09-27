import WorkspaceLoader from "./WorkspaceLoader";

// Compatibility entry point: all action loaders use the shared branded indicator.
export const MotionSpinner = ({ className = "" }) => <WorkspaceLoader inline className={className} />;
export default MotionSpinner;
