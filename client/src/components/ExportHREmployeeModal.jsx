import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState, useMemo } from "react";
import { FileSpreadsheet, Download, X, CheckCircle2, Users, Building2, AlertCircle } from "lucide-react";
import { exportEmployeesCSV } from "../apis/fontApis";
import { exportHREmployeeReportToCSV, triggerDownload } from "../utils/exportCsv";

export const ExportHREmployeeModal = ({
  isOpen,
  onClose,
  employeeList = [],
  departments = [],
  onSuccessNotice,
}) => {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [reportType, setReportType] = useState("full_audit");
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Derive unique departments list if not passed
  const availableDepartments = useMemo(() => {
    if (departments && departments.length > 0) {
      return departments.map((d) => (typeof d === "string" ? d : d._id || d.name)).filter(Boolean);
    }
    const depts = new Set();
    (employeeList || []).forEach((emp) => {
      if (emp.department) depts.add(emp.department);
    });
    return Array.from(depts).sort();
  }, [departments, employeeList]);

  // Compute matching count in real time
  const matchingCount = useMemo(() => {
    if (!employeeList || employeeList.length === 0) return 0;
    return employeeList.filter((emp) => {
      const rawStatus = (emp.status || (emp.isActive !== false ? "active" : "inactive")).toLowerCase().trim();
      if (selectedStatus !== "all" && rawStatus !== selectedStatus.toLowerCase()) {
        return false;
      }
      if (selectedDept !== "all" && (emp.department || "General").toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }
      return true;
    }).length;
  }, [employeeList, selectedStatus, selectedDept]);

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `workpulse_hr_employee_report_${selectedStatus}_${dateStr}.csv`;

      // 1. First attempt direct streaming from backend server endpoint
      try {
        const response = await exportEmployeesCSV({
          status: selectedStatus,
          department: selectedDept,
        });

        if (response?.data) {
          const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
          triggerDownload(blob, filename);

          setExportComplete(true);
          const noticeMsg = `Successfully exported HR employee database to ${filename}.`;
          if (onSuccessNotice) onSuccessNotice(noticeMsg);
          setTimeout(() => {
            setExportComplete(false);
            onClose();
          }, 1400);
          return;
        }
      } catch (serverErr) {
        console.warn("Backend CSV stream fallback to client-side engine:", serverErr?.message);
      }

      // 2. Fallback to client-side high-fidelity export using local database list
      const result = exportHREmployeeReportToCSV(employeeList, {
        filterStatus: selectedStatus,
        filterDepartment: selectedDept,
        reportType,
        filename,
      });

      if (result.success) {
        setExportComplete(true);
        if (onSuccessNotice) onSuccessNotice(result.message);
        setTimeout(() => {
          setExportComplete(false);
          onClose();
        }, 1400);
      } else {
        setErrorMessage(result.message || "Failed to generate CSV file.");
      }
    } catch (err) {
      console.error("Error executing HR export:", err);
      setErrorMessage(err.message || "An unexpected error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-hr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="export-hr-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Export Employee Database
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate CSV file formatted for HR reporting and executive audits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Filter: Employment Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Workforce Status Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "All Records", sub: "Complete Database" },
                { id: "active", label: "Active Only", sub: "Currently Employed" },
                { id: "inactive", label: "Inactive / Suspended", sub: "Archived Staff" },
              ].map((statusOpt) => (
                <button
                  key={statusOpt.id}
                  type="button"
                  onClick={() => setSelectedStatus(statusOpt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedStatus === statusOpt.id
                      ? "border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-[#111927]"
                  }`}
                >
                  <p className="text-xs font-bold truncate">{statusOpt.label}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {statusOpt.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label
              htmlFor="hr-export-department-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Department Filter
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="hr-export-department-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-[#162033]/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#002185]/25 cursor-pointer"
              >
                <option value="all">All Departments ({availableDepartments.length || "All"})</option>
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Report Columns Information Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#162033]/50 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Included HR Fields
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                15 standard columns
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Employee ID, Full Name, Email, Phone, Department, Position, Status, Employment Type, Date Joined, Basic Salary (GHS), Work Location, System Role, Emergency Contacts, and Creation Timestamps.
            </p>
          </div>

          {/* Matching Count Preview */}
          <div className="flex items-center justify-between px-1 py-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Users className="w-3.5 h-3.5" />
              <span>Target records to export:</span>
            </div>
            <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {matchingCount} {matchingCount === 1 ? "Employee" : "Employees"}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-[#162033]/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-hr-csv-export-button"
            onClick={handleExecuteExport}
            disabled={isExporting || matchingCount === 0}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              exportComplete
                ? "bg-emerald-600 text-white"
                : matchingCount === 0
                ? "bg-slate-200 dark:bg-[#162033] text-slate-400 cursor-not-allowed"
                : "bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white shadow-xs hover:shadow-md"
            }`}
          >
            {isExporting ? (
              <>
                <WorkspaceLoader inline />
                <span>Generating CSV...</span>
              </>
            ) : exportComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Downloaded Successfully</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download HR CSV File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportHREmployeeModal;
