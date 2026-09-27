import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import {
  exportPayrollToCSV,
  exportPayrollToPDF,
} from "../utils/payrollReportExport";
import { exportPayrollReport, getAllPayslips } from "../apis/fontApis";

/**
 * Clean, multi-format export dropdown button for monthly processed payroll reports
 * Supports direct export to CSV and PDF format for accounting purposes.
 */
export const ExportPayrollReportButton = ({
  records = [],
  month = "Current Month",
  year = new Date().getFullYear(),
  onSuccess,
  onError,
  className = "",
  buttonText = "Export Report",
  size = "md", // 'sm' | 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState(null); // 'csv' | 'pdf'
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format) => {
    try {
      setIsExporting(true);
      setExportType(format);
      setIsOpen(false);

      let targetRecords = records;

      // If records were not provided or empty, attempt live API fetch
      if (!targetRecords || targetRecords.length === 0) {
        try {
          const res = await exportPayrollReport({
            month: month !== "Current Month" && month !== "All Months" ? month : undefined,
          });
          if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
            targetRecords = res.data.data;
          } else {
            const allRes = await getAllPayslips();
            if (allRes.data?.data && Array.isArray(allRes.data.data)) {
              targetRecords = allRes.data.data;
            } else if (Array.isArray(allRes.data?.payslips)) {
              targetRecords = allRes.data.payslips;
            }
          }
        } catch (fetchErr) {
          console.warn("Live export fetch fallback:", fetchErr);
        }
      }

      if (!targetRecords || targetRecords.length === 0) {
        throw new Error("No processed payroll records found for this period to export.");
      }

      if (format === "csv") {
        const result = exportPayrollToCSV({
          records: targetRecords,
          month,
          year,
        });
        if (onSuccess) {
          onSuccess({
            format: "CSV",
            filename: result.filename,
            count: result.totalRecords,
            message: `Exported ${result.totalRecords} payroll records to CSV for accounting.`,
          });
        }
      } else if (format === "pdf") {
        const result = await exportPayrollToPDF({
          records: targetRecords,
          month,
          year,
          title: `MONTHLY PROCESSED PAYROLL REPORT - ${month.toUpperCase()} ${year}`,
        });
        if (onSuccess) {
          onSuccess({
            format: "PDF",
            filename: result.filename,
            count: result.totalRecords,
            message: `Generated official accounting PDF report (${result.totalRecords} records).`,
          });
        }
      }
    } catch (err) {
      console.error(`Error exporting payroll to ${format}:`, err);
      if (onError) {
        onError(err.message || `Failed to export payroll report as ${format.toUpperCase()}.`);
      }
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const isSmall = size === "sm";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div className="inline-flex rounded-xl shadow-2xs">
        {/* Main Trigger Button */}
        <button
          id="export-payroll-report-main-btn"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={isExporting}
          className={`bg-white dark:bg-[#162033] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
            isSmall ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-xs"
          }`}
          title="Export monthly processed payroll report to CSV or PDF"
        >
          {isExporting ? (
            <WorkspaceLoader inline />
          ) : (
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          )}
          <span>
            {isExporting
              ? `Exporting ${exportType ? exportType.toUpperCase() : ""}...`
              : buttonText}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          id="export-payroll-dropdown-menu"
          className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Accounting Export Options
            </p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5 truncate">
              {month} • {records.length} Processed Staff
            </p>
          </div>

          <div className="p-1 space-y-0.5">
            {/* CSV Option */}
            <button
              id="export-payroll-csv-btn"
              type="button"
              onClick={() => handleExport("csv")}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Export to CSV (.csv)
                </p>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Excel-ready raw accounting data with complete payroll breakdown
                </p>
              </div>
            </button>

            {/* PDF Option */}
            <button
              id="export-payroll-pdf-btn"
              type="button"
              onClick={() => handleExport("pdf")}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Export to PDF (.pdf)
                </p>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Official landscape audit report with executive metrics & signatures
                </p>
              </div>
            </button>
          </div>

          <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#162033]/50 border-t border-slate-100 dark:border-slate-800 mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>Direct Accounting Download</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPayrollReportButton;
