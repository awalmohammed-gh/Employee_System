import { useTheme } from "../context/ThemeContext";
import { useManagement } from "../context/ManagementContextProvider";
import { Sun, Moon, Laptop, Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Dedicated ThemePreferenceCard Component
 * Segmented 3-option appearance selector (Light, Dark, System sync)
 * Featuring subtle cross-fade animations on transitions, hairline borders,
 * and seamless synchronization with useTheme() context.
 */
export const ThemePreferenceCard = ({ className = "" }) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { showToast, setShowToast } = useManagement();

  const handleSelect = (modeId, modeLabel) => {
    if (theme === modeId) return;
    setTheme(modeId);

    const message = `Theme preference updated to ${modeLabel}`;
    if (typeof showToast === "function") {
      showToast(message, "info");
    } else if (typeof setShowToast === "function") {
      setShowToast({ show: true, message, type: "info" });
    }
  };

  const options = [
    {
      id: "light",
      label: "Light Mode",
      icon: Sun,
      subtitle: "Daytime palette",
      description: "Clean, high-contrast light surfaces for illuminated environments",
      iconColor: "text-amber-500",
      activeBg: "bg-[#0B1E48]",
    },
    {
      id: "dark",
      label: "Dark Mode",
      icon: Moon,
      subtitle: "Nighttime palette",
      description: "Comfortable, glare-reduced slate palette to ease eye strain",
      iconColor: "text-blue-400",
      activeBg: "bg-[#0B1E48]",
    },
    {
      id: "system",
      label: "Sync with Device",
      icon: Laptop,
      subtitle: `OS default (${resolvedTheme})`,
      description: "Automatically synchronizes with your device operating system theme",
      iconColor: "text-slate-400",
      activeBg: "bg-[#0B1E48]",
    },
  ];

  return (
    <div
      id="theme-preference-card"
      className={`bg-white dark:bg-[#111927] border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6 transition-colors duration-200 ${className}`}
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-[#0B1E48] dark:text-blue-400 shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <h3 className="text-[14px] sm:text-base font-bold text-[#0B1E48] dark:text-white">
              Appearance & Theme
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Choose your preferred color scheme or synchronize automatically with your device settings.
          </p>
        </div>

        {/* Current Resolved Theme Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#162033] text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/80 self-start sm:self-auto shrink-0 shadow-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="capitalize text-[11px] font-medium">
            Active: <strong className="text-[#0B1E48] dark:text-white capitalize">{theme}</strong> ({resolvedTheme} active)
          </span>
        </div>
      </div>

      {/* Three-Option Segmented Control Tiles */}
      <div
        role="radiogroup"
        aria-label="Theme appearance options"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              id={`theme-tile-option-${opt.id}`}
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.id, opt.label)}
              aria-pressed={isSelected}
              className={`relative overflow-hidden p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[136px] group focus:outline-none focus:ring-2 focus:ring-[#0B1E48]/30 dark:focus:ring-blue-500/40 ${
                isSelected
                  ? "bg-[#0B1E48] text-white border-[#0B1E48] shadow-sm"
                  : "bg-slate-50 dark:bg-[#162033] border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-none"
              }`}
            >
              {/* Subtle cross-fade gradient overlay on active selection */}
              {isSelected && (
                <motion.div
                  layoutId="activeThemeHighlight"
                  className="absolute inset-0 bg-gradient-to-tr from-blue-900/30 to-transparent pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              )}

              {/* Top Row: Icon container + Active check status */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${
                    isSelected
                      ? "bg-white/15 text-white border border-white/20"
                      : "bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-none"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${opt.id}-${isSelected}`}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          isSelected ? "text-white" : opt.iconColor
                        }`}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Status Indicator */}
                <AnimatePresence mode="wait">
                  {isSelected ? (
                    <motion.span
                      key="active-indicator"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider border border-white/20 shadow-none"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Active</span>
                    </motion.span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400 capitalize">
                      {opt.subtitle}
                    </span>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Content: Title and Description */}
              <div className="relative z-10 mt-3.5">
                <h4
                  className={`text-xs sm:text-sm font-bold tracking-tight ${
                    isSelected ? "text-white" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {opt.label}
                </h4>
                <p
                  className={`text-[11px] leading-relaxed mt-1 line-clamp-2 ${
                    isSelected
                      ? "text-blue-100/90"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemePreferenceCard;
