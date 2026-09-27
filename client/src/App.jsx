import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary fullPage title="Application Encountered an Error">
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
};

export default App;

