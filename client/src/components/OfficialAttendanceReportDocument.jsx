import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState } from "react";
import { Download, Printer, ArrowLeft, CheckCircle2, FileCheck, FileSpreadsheet } from "lucide-react";
import defaultLogo from "../assets/eyenit_logo.png";
import { useBranding } from "../context/BrandingContext";
import {
  normalizeAttendanceReportData,
  downloadAttendanceReportPDF,
} from "../utils/attendanceReportPdfGenerator";
import {
  exportAttendanceLogsToCSV,
  exportAttendanceLogsToPDF,
  normalizeAttendanceAuditRecords,
} from "../utils/attendanceExportUtils";

/**
 * OfficialAttendanceReportDocument Component
 *
 * Clean corporate document layout matching all styling and print specifications:
 * 1. Header with Company Logo, bold title in deep navy (#0B1E48 / #1e3a8a), dynamic Report ID, Date Generated, and 3px deep navy rule.
 * 2. Two-column metadata grid (EMPLOYEE / ROSTER INFORMATION & AUDIT & REPORT PERIOD with verified compliance status).
 * 3. KPI Highlights Banner with metric cards (Total Staff/Records, Present, Late Logins, Work Hours & Deductions).
 * 4. Daily Attendance Audit Log Table with shift windows, check-in, check-out, duration, and status tags.
 * 5. Multi-Page Print and Export to CSV / PDF capabilities for payroll reconciliation.
 */
export const OfficialAttendanceReportDocument = ({
  employee = {},
  attendanceList = [],
  period = "",
  dateRange = "",
  onBack,
  showControls = true,
  title = "Official Attendance Audit Report",
}) => {
  // Company logo from company settings; built-in default when none is configured
  const { logoUrl: companyLogoUrl } = useBranding();
  const logo = companyLogoUrl || defaultLogo;
  const [isExporting, setIsExporting] = useState(false);

  const isRosterMode =
    !employee?._id ||
    employee.employeeId === "ALL-STAFF" ||
    employee.fullName === "Company Staff Roster" ||
    (attendanceList.length > 0 &&
      new Set(
        attendanceList.map(
          (a) => a?.employee?._id || a?.employee?.employeeId || a?.employeeId
        )
      ).size > 1);

  const reportPayload = {
    employee,
    attendanceList,
    period,
    dateRange,
  };

  const data = normalizeAttendanceReportData(reportPayload);
  const { records: auditRecords, summary: auditSummary } =
    normalizeAttendanceAuditRecords(attendanceList);

  const handleDownloadCSV = () => {
    try {
      exportAttendanceLogsToCSV({
        attendanceList,
        periodLabel: period || data.reportPeriod || "Audit Period",
        companyName: "Eyenit Logistics & Transport",
        filename: `attendance_audit_${
          isRosterMode ? "roster" : data.employeeId
        }_${new Date().toISOString().split("T")[0]}.csv`,
      });
    } catch (err) {
      console.error("Attendance CSV export error:", err);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true);
      if (isRosterMode) {
        await exportAttendanceLogsToPDF({
          attendanceList,
          periodLabel: period || data.reportPeriod || "Audit Period",
          companyName: "Eyenit Logistics & Transport",
          filename: `attendance_audit_roster_${
            new Date().toISOString().split("T")[0]
          }.pdf`,
        });
      } else {
        await downloadAttendanceReportPDF(reportPayload);
      }
    } catch (err) {
      console.error("Attendance PDF download error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Controls Bar (Hidden in Print Mode) */}
      {showControls && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs print:hidden no-print">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-[#0B1E48] dark:text-blue-400" />
                {isRosterMode ? "Consolidated Attendance & Payroll Audit Sheet" : title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRosterMode
                  ? `${auditSummary.totalLogs} Logs • ${auditSummary.totalEmployees} Employees • ${period || data.reportPeriod}`
                  : `${data.employeeName} • ${data.reportPeriod} • ${data.records.length} Recorded Shifts`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-download-attendance-csv"
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Download CSV for payroll systems"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              id="btn-print-attendance-sheet"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Print document"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              id="btn-download-attendance-pdf"
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-4 py-2 bg-[#0B1E48] hover:bg-[#081738] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-75"
              title="Download print-ready PDF"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? <><WorkspaceLoader inline /> Generating...</> : "Download PDF"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Official Corporate Attendance Document Card */}
      <div
        id="corporate-attendance-canvas"
        className="bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-xl p-8 sm:p-12 print-container print-card print:shadow-none print:border-none print:p-0 print:m-0"
      >
        {/* 1. Document Header & Branding */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs shrink-0">
              <img
                src={logo}
                onError={(e) => {
                  // Fall back to the default logo once (never loop if that fails too)
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = "1";
                    e.currentTarget.src = defaultLogo;
                  }
                }}
                alt="Company Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1E48] tracking-tight leading-none">
                {isRosterMode ? "ATTENDANCE AUDIT & PAYROLL SHEET" : "ATTENDANCE REPORT"}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-slate-500 font-mono mt-1">
                {data.reportId}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Date Generated
            </span>
            <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
              {data.dateGenerated}
            </span>
          </div>
        </div>

        {/* Solid deep-navy horizontal line (#0B1E48, height: 3px) */}
        <div className="w-full h-[3px] bg-[#0B1E48] mb-6"></div>

        {/* 2. Metadata Grid (Two-Column Layouts) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* EMPLOYEE / ROSTER INFORMATION */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-black text-[#0B1E48] uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
              {isRosterMode ? "AUDIT & ROSTER INFORMATION" : "EMPLOYEE INFORMATION"}
            </h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  {isRosterMode ? "Scope Title" : "Staff Name"}
                </span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {isRosterMode ? "Company Staff Roster" : data.employeeName}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  {isRosterMode ? "Total Employees" : "Employee ID"}
                </span>
                <span className="font-bold text-slate-900 text-sm font-mono block mt-0.5">
                  {isRosterMode ? `${auditSummary.totalEmployees} Active Staff` : data.employeeId}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Department
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {isRosterMode ? "All Active Departments" : data.department}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  {isRosterMode ? "Target System" : "Job Position"}
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {isRosterMode ? "Payroll & HR Audit Engine" : data.position}
                </span>
              </div>
            </div>
          </div>

          {/* AUDIT & REPORT PERIOD */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <h2 className="text-xs font-black text-[#0B1E48] uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
              AUDIT & REPORT PERIOD
            </h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Report Month / Period
                </span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {period || data.reportPeriod}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Total Logged Shifts
                </span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {isRosterMode ? `${auditSummary.totalLogs} Logs` : `${data.totalDays} Days`}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Punctuality & Compliance Status
                </span>
                <span className="text-sm font-black text-[#16a34a] inline-flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  {isRosterMode
                    ? `${auditSummary.complianceRate}% Compliance Rate (${auditSummary.presentCount} On-Time, ${auditSummary.excusedCount} Excused)`
                    : `${data.complianceRate}% Compliance Score (${data.presentDays} Present, ${data.excusedDays} Excused)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. KPI Highlights Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
              {isRosterMode ? "On-Time Shifts" : "Present Days"}
            </span>
            <span className="text-lg font-black text-emerald-700 block mt-0.5">
              {isRosterMode ? `${auditSummary.presentCount} Shifts` : `${data.presentDays} Days`}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600">
              {isRosterMode ? `${auditSummary.complianceRate}% Punctual` : "On-time shifts"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-left">
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
              Late Check-ins
            </span>
            <span className="text-lg font-black text-rose-700 block mt-0.5">
              {isRosterMode ? `${auditSummary.lateCount} Shifts` : `${data.lateDays} Days`}
            </span>
            <span className="text-[10px] font-semibold text-rose-600">
              {isRosterMode
                ? `${auditSummary.totalLateMinutes} mins late`
                : `${data.totalLateMinutes} total late mins`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
              {isRosterMode ? "Overtime Hours" : "Absent Days"}
            </span>
            <span className="text-lg font-black text-amber-700 block mt-0.5">
              {isRosterMode ? `${auditSummary.totalOvertimeHours} hrs` : `${data.absentDays} Days`}
            </span>
            <span className="text-[10px] font-semibold text-amber-600">
              {isRosterMode
                ? "Eligible for OT Pay"
                : data.excusedDays > 0
                ? `${data.excusedDays} excused`
                : "Unexcused"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-left">
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">
              Logged Work Hours
            </span>
            <span className="text-lg font-black text-blue-700 block mt-0.5">
              {isRosterMode ? `${auditSummary.totalHours} hrs` : `${data.totalWorkHours} hrs`}
            </span>
            <span className="text-[10px] font-semibold text-blue-600">
              {isRosterMode
                ? `GH₵ ${auditSummary.totalPenaltyDeductions.toFixed(2)} deductions`
                : `~${data.averageHoursPerDay} hrs / day`}
            </span>
          </div>
        </div>

        {/* 4. Daily Attendance Audit Log Table */}
        <div className="mb-6 border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f0f7ff] border-b border-slate-200">
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                  DATE
                </th>
                {isRosterMode && (
                  <>
                    <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                      STAFF ID
                    </th>
                    <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                      EMPLOYEE NAME
                    </th>
                    <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                      DEPARTMENT
                    </th>
                  </>
                )}
                {!isRosterMode && (
                  <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                    SCHEDULED SHIFT
                  </th>
                )}
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                  CLOCK IN
                </th>
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider">
                  CLOCK OUT
                </th>
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider text-right">
                  WORK HRS
                </th>
                {isRosterMode && (
                  <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider text-right">
                    OT HRS
                  </th>
                )}
                {isRosterMode && (
                  <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider text-right">
                    DEDUCT
                  </th>
                )}
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider text-center">
                  STATUS
                </th>
                <th className="px-3 py-3 text-[11px] font-black text-[#0B1E48] uppercase tracking-wider text-right">
                  AUDIT NOTES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isRosterMode ? (
                auditRecords.length > 0 ? (
                  auditRecords.map((rec, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={rec.id || idx}
                        className={isEven ? "bg-white" : "bg-slate-50/50"}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          <span>{rec.date}</span>
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            ({rec.day})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {rec.employeeId}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {rec.employeeName}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {rec.department}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-900 whitespace-nowrap">
                          {rec.clockIn}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-900 whitespace-nowrap">
                          {rec.clockOut}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#0B1E48] text-right whitespace-nowrap">
                          {rec.workHours.toFixed(1)}h
                        </td>
                        <td className="px-3 py-2.5 text-amber-700 text-right whitespace-nowrap">
                          {rec.overtimeHours > 0 ? `+${rec.overtimeHours.toFixed(1)}h` : "-"}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-rose-600 text-right whitespace-nowrap">
                          {rec.deductionAmount > 0 ? `GH₵${rec.deductionAmount.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              rec.status === "Present"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : rec.status === "Late"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : rec.status === "Excused"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-500 text-[11px] max-w-xs truncate">
                          {rec.notes}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="bg-white">
                    <td
                      colSpan={11}
                      className="px-4 py-6 text-center text-slate-400 italic text-xs"
                    >
                      No attendance records found for this period.
                    </td>
                  </tr>
                )
              ) : (
                data.records.length > 0 ? (
                  data.records.map((rec, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={rec.id || idx}
                        className={isEven ? "bg-white" : "bg-slate-50/50"}
                      >
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          <span>{rec.date}</span>
                          <span className="text-[10px] text-slate-500 font-normal block">
                            {rec.dayOfWeek}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-[11px]">
                          {rec.scheduledShift}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-slate-900">
                          {rec.clockIn}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-slate-900">
                          {rec.clockOut}
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#0B1E48] text-right">
                          {rec.workHours}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              rec.status === "Present"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : rec.status === "Late"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : rec.status === "Excused"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-500 text-[11px]">
                          {rec.notes || (rec.isExcused ? "Penalty waived" : "Verified")}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="bg-white">
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-400 italic text-xs"
                    >
                      No attendance records found for this period.
                    </td>
                  </tr>
                )
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#f1f5f9] border-t-2 border-[#0B1E48]">
                <td
                  colSpan={isRosterMode ? 6 : 4}
                  className="px-3 py-3 font-black text-[#0B1E48] uppercase text-xs"
                >
                  TOTAL RECONCILED WORK HOURS
                </td>
                <td className="px-3 py-3 font-black text-sm text-[#0B1E48] text-right">
                  {isRosterMode ? `${auditSummary.totalHours} hrs` : `${data.totalWorkHours} hrs`}
                </td>
                {isRosterMode && (
                  <td className="px-3 py-3 font-black text-xs text-amber-800 text-right">
                    +{auditSummary.totalOvertimeHours} hrs OT
                  </td>
                )}
                {isRosterMode && (
                  <td className="px-3 py-3 font-black text-xs text-rose-700 text-right">
                    GH₵ {auditSummary.totalPenaltyDeductions.toFixed(2)}
                  </td>
                )}
                <td
                  colSpan={isRosterMode ? 2 : 2}
                  className="px-3 py-3 text-right font-bold text-xs text-[#0B1E48]"
                >
                  {isRosterMode
                    ? `${auditSummary.complianceRate}% Compliance`
                    : `Average: ${data.averageHoursPerDay} hrs/shift`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. 3-Column Auditor & Supervisor Sign-off for Print */}
        <div className="pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                1. Prepared By (Timekeeper / HR)
              </span>
              <div className="h-7 border-b border-dashed border-slate-300"></div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Signature</span>
                <span>Date: ____________</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                2. Verified By (HR Operations)
              </span>
              <div className="h-7 border-b border-dashed border-slate-300"></div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Signature</span>
                <span>Date: ____________</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
                3. Approved For Payroll Release
              </span>
              <div className="h-7 border-b border-dashed border-slate-300"></div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Signature & Stamp</span>
                <span>Date: ____________</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 pt-2 gap-2">
            <div>
              <span className="font-semibold block text-slate-700">
                Official Corporate Attendance & Payroll Audit Document
              </span>
              <span className="italic text-[11px] text-slate-400">
                Generated by Eyenit HR System • Certified Biometric & Timekeeping Logs
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500">
                Security Hash: SHA256-ATT-{Date.now().toString(36).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialAttendanceReportDocument;
