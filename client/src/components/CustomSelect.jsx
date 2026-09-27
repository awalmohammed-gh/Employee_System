import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { dropdownPopoverVariants } from "../utils/motion";

/**
 * Universal responsive CustomSelect component.
 * Adheres strictly to boundary-containment and mobile responsiveness:
 * - absolute left-0 right-0 w-full max-w-full overflow-hidden popover
 * - truncate text-sm on all label and item rows with title tooltips
 * - elevated dark surface: dark:bg-[#162033] border-slate-200 dark:border-slate-700
 * - includes hidden native select for form serialization and test runners
 */
export const CustomSelect = ({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = "-- Select an option --",
  disabled = false,
  required = false,
  icon: Icon,
  className = "",
  buttonClassName = "",
  dropdownClassName = "",
  searchable = false,
  searchPlaceholder = "Search options...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  // Normalize options to array of { value, label, sublabel }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string" || typeof opt === "number") {
        return { value: String(opt), label: String(opt) };
      }
      return {
        value: String(opt.value !== undefined ? opt.value : opt.id || ""),
        label: String(opt.label || opt.name || opt.title || opt.value || ""),
        sublabel: opt.sublabel || opt.description || null,
        badge: opt.badge || null,
      };
    });
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    if (disabled) return;
    if (onChange) {
      // Provide synthetic event-like object for compatibility with (e) => handleChange(e)
      onChange({
        target: {
          name: name || id,
          value: val,
        },
      });
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  const isSearchEnabled = searchable || normalizedOptions.length > 7;

  return (
    <div ref={dropdownRef} className={`relative w-full max-w-full ${className}`}>
      {/* Hidden Native Select for standard form serialization and test runner DOM queries */}
      <select
        id={id}
        name={name}
        value={value ?? ""}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        required={required}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Visible Interactive Trigger Button */}
      <motion.button
        id={id ? `${id}-trigger` : undefined}
        type="button"
        whileTap={!disabled ? { scale: 0.99 } : undefined}
        transition={{ duration: 0.1 }}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full max-w-full flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-[#111927] py-2.5 px-3.5 text-left text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors hover:border-[#002185] dark:hover:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-[#002185]/20 dark:focus:ring-blue-500/20 cursor-pointer overflow-hidden ${
          disabled ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#162033]" : ""
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
          {Icon && (
            <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
          <div
            className={`truncate text-sm flex-1 ${
              selectedOption
                ? "text-slate-900 dark:text-white font-medium"
                : "text-slate-400 dark:text-slate-500"
            }`}
            title={selectedOption ? selectedOption.label : placeholder}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#002185] dark:text-blue-400" : ""
          }`}
        />
      </motion.button>

      {/* Clamped Dropdown Popover with Framer Motion Blooming Animation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={id ? `${id}-menu` : undefined}
            variants={dropdownPopoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: "top" }}
            className={`absolute left-0 right-0 top-full mt-1.5 z-50 w-full max-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] shadow-xl ${dropdownClassName}`}
          >
            {/* Optional Search Filter */}
            {isSearchEnabled && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/90 dark:bg-[#111927]/80">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] text-slate-900 dark:text-white outline-hidden focus:border-[#002185] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#002185]/30"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              role="listbox"
              className="max-h-56 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 dark:divide-slate-800/60"
            >
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full max-w-full text-left px-3.5 py-2.5 transition flex items-center justify-between gap-2 overflow-hidden cursor-pointer ${
                        isSelected
                          ? "bg-blue-50/90 dark:bg-blue-950/60 text-[#002185] dark:text-blue-400 font-semibold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <div className="truncate text-sm flex-1 min-w-0" title={opt.label}>
                        <span>{opt.label}</span>
                        {opt.sublabel && (
                          <span className="block text-xs text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#002185] dark:text-blue-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
