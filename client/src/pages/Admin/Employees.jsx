import WorkspaceLoader from "../../components/ui/WorkspaceLoader";
import { useState, useEffect } from "react";
import { UserPlus, Download, Check, RefreshCw, FileSpreadsheet, Upload, X } from "lucide-react";
import { allEmployees } from "../../apis/fontApis";
import { EmployeeDirectory } from "../../components/EmployeeDirectory";
import AddEmployee from "../../components/modal/AddEmployee";
import ExportHREmployeeModal from "../../components/ExportHREmployeeModal";
import BulkUploadEmployeesModal from "../../components/modal/BulkUploadEmployeesModal";
import { useManagement } from "../../context/ManagementContextProvider";
import { exportHREmployeeReportToCSV } from "../../utils/exportCsv";
import ErrorMessage from "../../ui/ErrorMessage";
import { ui } from "./ui/tokens";
import { Badge } from "./ui/primitives";

const Employees = () => {
  const { showEmployeeModal, setShowEmployeeModal } = useManagement();
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await allEmployees();
      const data = res?.data;

      if (data && (data.success || Array.isArray(data.employees) || Array.isArray(data))) {
        const list = Array.isArray(data.employees)
          ? data.employees
          : Array.isArray(data)
          ? data
          : data.list || [];
        setEmployees(list);
      } else {
        setEmployees([]);
        if (data?.message) {
          setError(data.message);
        }
      }
    } catch (err) {
      setEmployees([]);
      setError(
        err.response?.data?.message ||
          err.message ||
          "An error occurred while fetching employees."
      );
      console.error("fetchEmployees error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeDeleted = (deletedEmployeeId) => {
    setEmployees((prev) =>
      prev.filter(
        (emp) =>
          emp._id !== deletedEmployeeId &&
          emp.employeeId !== deletedEmployeeId &&
          String(emp._id) !== String(deletedEmployeeId)
      )
    );
  };

  const handleDownloadAllCSV = () => {
    if (!employees || employees.length === 0) return;
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().split("T")[0];
      const result = exportHREmployeeReportToCSV(employees, {
        filterStatus: "all",
        filename: `workpulse_hr_employee_records_${dateStr}.csv`,
      });
      if (result.success) {
        setExportSuccess(true);
        setExportNotice(`✓ Successfully exported ${result.count} employee records to CSV`);
        setTimeout(() => {
          setExportSuccess(false);
          setExportNotice(null);
        }, 4000);
      }
    } catch (err) {
      console.error("Download CSV error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className={`${ui.page} overflow-x-hidden`}>
      {/* Toolbar */}
      <div className={ui.toolbar}>
        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 min-w-0">
          <Badge tone="brand">{employees.length} staff member{employees.length === 1 ? "" : "s"}</Badge>
          <span className="hidden sm:inline truncate">Manage employee details, roles, and availability.</span>
        </p>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchEmployees}
            disabled={isLoading}
            title="Refresh staff records"
            className={ui.btnSecondary}
          >
            {(isLoading) ? <WorkspaceLoader inline /> : <RefreshCw className="w-4 h-4" />}
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAllCSV}
            disabled={isExporting || employees.length === 0}
            title="Download complete employee directory CSV"
            className={
              exportSuccess
                ? `${ui.btnSecondary} bg-emerald-600! border-emerald-600! text-white! hover:bg-emerald-600!`
                : ui.btnSecondary
            }
          >
            {exportSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>CSV exported</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Download CSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={employees.length === 0}
            title="Open full HR employee database export wizard"
            className={ui.btnSecondary}
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>HR reporting export</span>
          </button>

          <button
            id="btn-upload-csv-employees"
            type="button"
            onClick={() => setShowBulkUploadModal(true)}
            title="Bulk-add employee records by uploading a CSV file"
            className={ui.btnSecondary}
          >
            <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Upload CSV</span>
          </button>

          <button
            id="btn-new-employee"
            type="button"
            onClick={() => setShowEmployeeModal(true)}
            className={ui.btnPrimary}
            title="Add a new employee to directory"
          >
            <UserPlus className="w-4 h-4" />
            <span>New employee</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div role="status" className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300">
          <span>{exportNotice}</span>
          <button type="button" onClick={() => setExportNotice(null)} className={`${ui.iconBtn} w-7! h-7!`} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchEmployees}
          onClose={() => setError(null)}
        />
      )}

      {/* Searchable Employee Directory Component with Skeleton Loading & Empty State */}
      <EmployeeDirectory
        employees={employees}
        setEmployees={setEmployees}
        onEmployeeDeleted={handleEmployeeDeleted}
        onDeleteSuccess={handleEmployeeDeleted}
        isLoading={isLoading}
        onRefresh={fetchEmployees}
      />

      {/* Add Employee Modal */}
      {showEmployeeModal && (
        <AddEmployee
          onEmployeeAdded={fetchEmployees}
          onOpenBulkUpload={() => setShowBulkUploadModal(true)}
        />
      )}

      {/* Bulk CSV Upload Modal */}
      <BulkUploadEmployeesModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        onSuccess={(data) => {
          fetchEmployees();
          setExportNotice(
            `✓ Successfully imported ${data.importedCount} employee records from CSV.`
          );
          setTimeout(() => setExportNotice(null), 5000);
        }}
      />

      {/* Full HR Employee Database CSV Export Wizard */}
      <ExportHREmployeeModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        employeeList={employees}
        onSuccessNotice={(msg) => {
          setExportNotice(msg);
          setTimeout(() => setExportNotice(null), 5000);
        }}
      />
    </div>
  );
};

export default Employees;
