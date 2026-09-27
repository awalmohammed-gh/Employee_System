import { AlertCircle, RotateCcw, X } from "lucide-react";

const ErrorMessage = ({ message, onRetry, onClose }) => {
  return (
    <div className="flex items-center justify-between bg-[#FFF7ED] border border-[#F97316] rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Error icon */}
        <div className="shrink-0">
          <AlertCircle className="w-5 h-5 text-[#F97316]" />
        </div>

        {/* Message */}
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Error</h3>
          <p className="text-sm text-[#64748B]">
            {message || "Something went wrong. Please try again."}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1E3A8A] rounded-md transition-colors duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-md transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
