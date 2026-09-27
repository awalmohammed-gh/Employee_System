import { Component } from "react";
import {
  AlertTriangle,
  RotateCcw,
  Home,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldAlert,
} from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught client-side runtime error:", error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopyError = () => {
    const errorText = `Error: ${this.state.error?.message || "Unknown error"}\n\nStack:\n${
      this.state.error?.stack || "No stack trace available"
    }\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || "No component stack"}`;

    navigator.clipboard?.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback({
              error: this.state.error,
              errorInfo: this.state.errorInfo,
              resetErrorBoundary: this.handleReset,
            })
          : this.props.fallback;
      }

      const isFullPage = this.props.fullPage ?? false;
      const title = this.props.title || "Something went wrong";
      const message =
        this.props.message ||
        this.state.error?.message ||
        "An unexpected client-side error occurred while rendering this component.";

      return (
        <div
          id="error-boundary-container"
          className={`${
            isFullPage
              ? "min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950"
              : "w-full min-h-[320px] flex items-center justify-center p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-sm"
          }`}
        >
          <div className="max-w-lg w-full text-center space-y-5">
            {/* Warning Icon Badge */}
            <div className="relative inline-flex">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm mx-auto">
                <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0B1E48] text-white flex items-center justify-center shadow-xs">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Error Heading & Description */}
            <div className="space-y-2">
              <h2
                id="error-boundary-title"
                className="text-xl sm:text-2xl font-extrabold text-[#0B1E48] dark:text-blue-100 tracking-tight"
              >
                {title}
              </h2>
              <p
                id="error-boundary-message"
                className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed"
              >
                {message}
              </p>
            </div>

            {/* Action Buttons: Try Again & Navigate */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                id="error-boundary-try-again-btn"
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1E48] hover:bg-[#002185] active:scale-[0.98] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <a
                id="error-boundary-dashboard-btn"
                href="#/welcome"
                onClick={() => {
                  this.handleReset();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Home Page</span>
              </a>
            </div>

            {/* Collapsible Error Diagnostics Details */}
            <div className="pt-2">
              <button
                id="error-boundary-toggle-details-btn"
                type="button"
                onClick={this.toggleDetails}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <span>{this.state.showDetails ? "Hide Technical Details" : "Show Technical Details"}</span>
                {this.state.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {this.state.showDetails && (
                <div
                  id="error-boundary-details-panel"
                  className="mt-3 text-left p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs font-mono max-h-48 overflow-y-auto space-y-2.5 relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] font-semibold text-slate-400">Stack Trace</span>
                    <button
                      id="error-boundary-copy-btn"
                      type="button"
                      onClick={this.handleCopyError}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      {this.state.copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-rose-400 font-semibold break-all">
                      {this.state.error?.toString()}
                    </p>
                    {this.state.error?.stack && (
                      <pre className="text-[10px] text-slate-400 whitespace-pre-wrap break-all">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

