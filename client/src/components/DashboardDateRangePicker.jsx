import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useId } from "react";
import { Calendar, RotateCcw, Check, FileDown, ChevronDown } from "lucide-react";

/**
 * Quick date range helper
 */
const computePresetDates = (presetKey) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (presetKey === "last_7") {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: todayStr,
      label: "Last 7 Days",
    };
  }

  if (presetKey === "last_30") {
    const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: todayStr,
      label: "Last 30 Days",
    };
  }

  if (presetKey === "last_90") {
    const start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: todayStr,
      label: "Last 90 Days",
    };
  }

  if (presetKey === "this_month") {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const start = `${year}-${month}-01`;
    return {
      startDate: start,
      endDate: todayStr,
      label: "This Month",
    };
  }

  if (presetKey === "ytd") {
    const year = now.getFullYear();
    const start = `${year}-01-01`;
    return {
      startDate: start,
      endDate: todayStr,
      label: `Year to Date (${year})`,
    };
  }

  return {
    startDate: todayStr,
    endDate: todayStr,
    label: "Custom Period",
  };
};

export const DashboardDateRangePicker = ({
  startDate = "",
  endDate = "",
  selectedPreset = "last_30",
  onRangeChange = () => {},
  onDownloadReport = () => {},
  isDownloading = false,
  className = "",
}) => {
  const startInputId = useId();
  const endInputId = useId();

  const [preset, setPreset] = useState(selectedPreset);
  const [customStart, setCustomStart] = useState(
    startDate || computePresetDates("last_30").startDate
  );
  const [customEnd, setCustomEnd] = useState(
    endDate || computePresetDates("last_30").endDate
  );
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  const presetsList = [
    { key: "last_7", label: "Last 7 Days" },
    { key: "last_30", label: "Last 30 Days" },
    { key: "last_90", label: "Last 90 Days" },
    { key: "this_month", label: "This Month" },
    { key: "ytd", label: "Year to Date" },
    { key: "custom", label: "Custom Range" },
  ];

  const handleSelectPreset = (key) => {
    setPreset(key);
    if (key === "custom") {
      setShowCustomInputs(true);
      return;
    }
    setShowCustomInputs(false);
    const calculated = computePresetDates(key);
    setCustomStart(calculated.startDate);
    setCustomEnd(calculated.endDate);
    onRangeChange({
      preset: key,
      startDate: calculated.startDate,
      endDate: calculated.endDate,
      label: calculated.label,
    });
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) {
      // Auto swap if inverted
      const temp = customStart;
      setCustomStart(customEnd);
      setCustomEnd(temp);
      onRangeChange({
        preset: "custom",
        startDate: customEnd,
        endDate: temp,
        label: `${customEnd} to ${temp}`,
      });
      return;
    }
    onRangeChange({
      preset: "custom",
      startDate: customStart,
      endDate: customEnd,
      label: `${customStart} to ${customEnd}`,
    });
  };

  const handleReset = () => {
    const def = computePresetDates("last_30");
    setPreset("last_30");
    setShowCustomInputs(false);
    setCustomStart(def.startDate);
    setCustomEnd(def.endDate);
    onRangeChange({
      preset: "last_30",
      startDate: def.startDate,
      endDate: def.endDate,
      label: def.label,
    });
  };

  return (
    <div
      id="dashboard-date-range-picker-container"
      className={`bg-white dark:bg-[#111927] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 transition-all ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Heading & Period Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Dashboard Time Period
              </h4>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                {presetsList.find((p) => p.key === preset)?.label || "Active Range"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter metrics, attendance telemetry, shift durations, and payroll cycles
            </p>
          </div>
        </div>

        {/* Right: Quick Action Buttons including Download Report */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Report Button */}
          <button
            type="button"
            id="btn-download-dashboard-report"
            onClick={onDownloadReport}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B1E48] hover:bg-[#071638] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title="Download Attendance and Payroll Analytics as PDF Report"
          >
            {isDownloading ? (
              <>
                <WorkspaceLoader inline />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-blue-300" />
                <span>Download Report</span>
              </>
            )}
          </button>

          {/* Reset button */}
          <button
            type="button"
            id="btn-reset-date-filter"
            onClick={handleReset}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Reset to default 30 days"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preset Pill Bar */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">
          Presets:
        </span>
        {presetsList.map((item) => {
          const isActive = preset === item.key;
          return (
            <button
              key={item.key}
              type="button"
              id={`date-preset-${item.key}`}
              onClick={() => handleSelectPreset(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#002185] dark:bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80"
              }`}
            >
              {isActive && <Check className="w-3 h-3 text-white" />}
              <span>{item.label}</span>
            </button>
          );
        })}

        {!showCustomInputs && (
          <button
            type="button"
            onClick={() => setShowCustomInputs(true)}
            className="px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Custom Dates</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Custom Date Range Input Fields */}
      {showCustomInputs && (
        <form
          onSubmit={handleApplyCustom}
          id="custom-date-range-form"
          className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <label htmlFor={startInputId} className="font-semibold text-slate-600 dark:text-slate-300">
              From:
            </label>
            <input
              id={startInputId}
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111927] text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={endInputId} className="font-semibold text-slate-600 dark:text-slate-300">
              To:
            </label>
            <input
              id={endInputId}
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111927] text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={() => setShowCustomInputs(false)}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default DashboardDateRangePicker;
