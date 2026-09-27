import { WorkspaceLoader } from "../components/ui/WorkspaceLoader";

/**
 * Loading Component
 * Re-exports WorkspaceLoader to maintain seamless backwards-compatibility
 * across all existing layout, page, and modal loading boundaries.
 */
const Loading = (props) => {
  return <WorkspaceLoader {...props} />;
};

export { WorkspaceLoader };
export default Loading;
