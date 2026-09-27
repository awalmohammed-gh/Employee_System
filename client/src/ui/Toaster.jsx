import { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

const Toaster = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: {
      border: "border-emerald-500/30 dark:border-emerald-500/40",
      bg: "bg-white dark:bg-slate-900",
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-5 h-5" />,
      accent: "text-emerald-700 dark:text-emerald-300",
    },
    error: {
      border: "border-rose-500/30 dark:border-rose-500/40",
      bg: "bg-white dark:bg-slate-900",
      iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
      icon: <AlertCircle className="w-5 h-5" />,
      accent: "text-rose-700 dark:text-rose-300",
    },
    warning: {
      border: "border-amber-500/30 dark:border-amber-500/40",
      bg: "bg-white dark:bg-slate-900",
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
      icon: <AlertTriangle className="w-5 h-5" />,
      accent: "text-amber-700 dark:text-amber-300",
    },
    info: {
      border: "border-blue-500/30 dark:border-blue-500/40",
      bg: "bg-white dark:bg-slate-900",
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
      icon: <Info className="w-5 h-5" />,
      accent: "text-blue-700 dark:text-blue-300",
    },
  };

  const style = config[type] || config.info;

  return (
    <div
      id="system-toaster-container"
      className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 sm:w-96 z-50 pointer-events-none flex flex-col gap-2"
    >
      <div
        id="system-toaster-alert"
        role="alert"
        className={`w-full pointer-events-auto flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border-2 ${style.border} ${style.bg} shadow-xl backdrop-blur-sm transition-all duration-300 animate-fade-in`}
      >
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
          {/* Status Icon */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
          >
            {style.icon}
          </div>

          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">
            {message}
          </p>
        </div>

        {/* Close Button with adequate tap target */}
        <button
          id="btn-close-system-toast"
          type="button"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toaster;

