import { useEffect } from "react";
import { X } from "lucide-react";
import OfficialAttendanceReportDocument from "../OfficialAttendanceReportDocument";

/**
 * AttendanceReportModal Component
 *
 * Provides a pop-up and print-ready modal wrapper around OfficialAttendanceReportDocument
 * for both Admin and Staff users.
 */
export const AttendanceReportModal = ({
  isOpen = false,
  onClose,
  employee = {},
  attendanceList = [],
  period = "",
  dateRange = "",
  title = "Staff Attendance Report",
}) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in print:p-0 print:bg-white print:static"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-slate-100 dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[95vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:bg-white print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Controls (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden no-print">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Document Preview Mode</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          <OfficialAttendanceReportDocument
            employee={employee}
            attendanceList={attendanceList}
            period={period}
            dateRange={dateRange}
            onBack={onClose}
            showControls={true}
            title={title}
          />
        </div>
      </div>
    </div>
  );
};

export default AttendanceReportModal;
