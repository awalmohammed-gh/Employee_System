import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState } from "react";
import { X, FileSpreadsheet, FileText, Download, Printer, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  exportAttendanceLogsToCSV,
  exportAttendanceLogsToPDF,
  normalizeAttendanceAuditRecords,
} from "../../utils/attendanceExportUtils";

export const AttendanceExportModal = ({
  isOpen = false,
  onClose,
  filteredRecords = [],
  allRecords = [],
  periodLabel = "Current Period",
  departmentFilter = "All",
  companyName = "",
  logoUrl,
  primaryColor = "#0B1E48",
  onOpenPrintReport,
}) => {
  const [exportFormat, setExportFormat] = useState("csv"); // 'csv' | 'pdf'
  const [scope, setScope] = useState("filtered"); // 'filtered' | 'all'
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(null);

  if (!isOpen) return null;

  const targetRecords = scope === "filtered" ? filteredRecords : allRecords;
  const { summary } = normalizeAttendanceAuditRecords(targetRecords);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(null);

      const timestamp = new Date().toISOString().split("T")[0];
      const deptSlug = departmentFilter !== "All" ? `_${departmentFilter.replace(/\s+/g, "_")}` : "";

      if (exportFormat === "csv") {
        const filename = `payroll_attendance_${scope}${deptSlug}_${timestamp}.csv`;
        exportAttendanceLogsToCSV({
          attendanceList: targetRecords,
          periodLabel,
          companyName,
          filename,
        });
        setExportSuccess(`CSV exported successfully (${targetRecords.length} records)`);
      } else {
        const filename = `attendance_audit_report_${scope}${deptSlug}_${timestamp}.pdf`;
        await exportAttendanceLogsToPDF({
          attendanceList: targetRecords,
          periodLabel,
          companyName,
          logoUrl,
          departmentFilter,
          filename,
        });
        setExportSuccess(`Audit PDF generated successfully (${targetRecords.length} records)`);
      }
    } catch (err) {
      console.error("[AttendanceExportModal] Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPrintPreview = () => {
    if (onOpenPrintReport) {
      onOpenPrintReport();
      onClose();
    } else {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#111927] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111927]/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0B1E48]/10 dark:bg-blue-500/10 text-[#0B1E48] dark:text-blue-400 flex items-center justify-center font-bold">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B1E48] dark:text-white tracking-tight">
                Export Attendance Logs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate payroll-ready spreadsheets and official audit documents
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* 1. Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5">
              1. Choose Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: CSV */}
              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportFormat === "csv"
                    ? "border-[#0B1E48] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-[#0B1E48]/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#162033]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    exportFormat === "csv"
                      ? "bg-[#0B1E48] text-white"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      CSV Spreadsheet
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      Payroll Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Formatted for Excel, Google Sheets, QuickBooks, and payroll engines with UTF-8 BOM encoding.
                  </p>
                </div>
              </button>

              {/* Option B: PDF */}
              <button
                type="button"
                onClick={() => setExportFormat("pdf")}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportFormat === "pdf"
                    ? "border-[#0B1E48] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-[#0B1E48]/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#162033]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    exportFormat === "pdf"
                      ? "bg-[#0B1E48] text-white"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-950/50"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Corporate PDF
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                      Print-Friendly
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Landscape audit document with executive KPIs, auto-paginated log tables, and auditor sign-off blocks.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Record Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              2. Select Record Scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === "filtered"
                    ? "border-[#0B1E48] dark:border-blue-500 bg-slate-50 dark:bg-[#162033]/60 font-semibold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className="w-4 h-4 text-[#0B1E48] focus:ring-[#0B1E48]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Current Filtered View
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {filteredRecords.length} records matching search/dates
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  scope === "all"
                    ? "border-[#0B1E48] dark:border-blue-500 bg-slate-50 dark:bg-[#162033]/60 font-semibold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="w-4 h-4 text-[#0B1E48] focus:ring-[#0B1E48]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    All Loaded Logs
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {allRecords.length} total system records
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Live Audit Summary Box */}
          <div className="bg-slate-50 dark:bg-[#162033] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0B1E48] dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Audit Scope Summary
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Period: <strong className="text-slate-800 dark:text-slate-200">{periodLabel}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white dark:bg-[#111927] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Logs</span>
                <span className="text-base font-bold text-[#0B1E48] dark:text-white block mt-0.5">
                  {summary.totalLogs}
                </span>
                <span className="text-[10px] text-slate-500">{summary.totalEmployees} Employees</span>
              </div>

              <div className="bg-white dark:bg-[#111927] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Work Hours</span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                  {summary.totalHours.toFixed(1)}h
                </span>
                <span className="text-[10px] text-amber-600 font-semibold">+{summary.totalOvertimeHours.toFixed(1)}h OT</span>
              </div>

              <div className="bg-white dark:bg-[#111927] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Deductions</span>
                <span className="text-base font-bold text-rose-600 dark:text-rose-400 block mt-0.5">
                  GH₵ {summary.totalPenaltyDeductions.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500">{summary.totalLateMinutes} late mins</span>
              </div>

              <div className="bg-white dark:bg-[#111927] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Punctuality</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {summary.complianceRate}%
                </span>
                <span className="text-[10px] text-slate-500">{summary.presentCount} On-Time</span>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {exportSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927]/30">
          <button
            type="button"
            onClick={handleOpenPrintPreview}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#162033] hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Print Sheet Preview</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              id="btn-confirm-export"
              onClick={handleExport}
              disabled={isExporting || targetRecords.length === 0}
              style={{ backgroundColor: primaryColor || "#0B1E48" }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Preparing Document...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {exportFormat === "csv" ? "Download CSV File" : "Download PDF File"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceExportModal;
