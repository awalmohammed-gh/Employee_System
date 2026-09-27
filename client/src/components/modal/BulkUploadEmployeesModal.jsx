import WorkspaceLoader from "../ui/WorkspaceLoader";
import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, AlertCircle, FileText, Trash2, Check } from "lucide-react";
import { bulkUploadEmployees } from "../../apis/fontApis";
import {
  downloadEmployeeCsvTemplate,
  parseClientCSV,
} from "../../utils/exportCsv";

export const BulkUploadEmployeesModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [csvRawText, setCsvRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [defaultPassword, setDefaultPassword] = useState("Password@123");
  const [autoGenerateId, setAutoGenerateId] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [filterPreview, setFilterPreview] = useState("all"); // "all" | "valid" | "invalid"

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    if (
      !selectedFile.name.endsWith(".csv") &&
      !selectedFile.name.endsWith(".txt")
    ) {
      setUploadError("Please select a valid CSV (.csv) file.");
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvRawText(text);
      try {
        const rows = parseClientCSV(text);
        setParsedRows(rows);
        if (rows.length === 0) {
          setUploadError(
            "The selected CSV file appears to be empty or missing data rows. Please ensure it contains headers and records."
          );
        }
      } catch (err) {
        console.error("CSV parse error:", err);
        setUploadError("Failed to parse CSV file. Please verify file formatting.");
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read the selected file. Please try again.");
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setCsvRawText("");
    setParsedRows([]);
    setUploadError(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRows = parsedRows.filter((r) => r._isValid);
  const invalidRows = parsedRows.filter((r) => !r._isValid);

  const visiblePreviewRows = parsedRows.filter((r) => {
    if (filterPreview === "valid") return r._isValid;
    if (filterPreview === "invalid") return !r._isValid;
    return true;
  });

  const handleImportSubmit = async () => {
    if (!file && !csvRawText) {
      setUploadError("Please upload a CSV file first.");
      return;
    }

    if (validRows.length === 0) {
      setUploadError(
        "There are no valid employee records in this file to import. Please review validation errors."
      );
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      // Use FormData to send both the file and options
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("csvData", csvRawText);
      }
      formData.append("defaultPassword", defaultPassword || "Password@123");
      formData.append("autoGenerateId", String(autoGenerateId));
      formData.append("skipDuplicates", String(skipDuplicates));

      const res = await bulkUploadEmployees(formData);
      const data = res?.data;

      if (data && (data.success || data.importedCount > 0)) {
        setUploadResult({
          importedCount: data.importedCount || validRows.length,
          failedCount: data.failedCount || 0,
          failedRows: data.failedRows || [],
          message: data.message || "Employees imported successfully.",
        });

        if (typeof onSuccess === "function") {
          onSuccess(data);
        }
      } else {
        setUploadError(data?.message || "Failed to bulk-import employee records.");
      }
    } catch (err) {
      console.error("Bulk upload API error:", err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred during bulk employee upload.";
      setUploadError(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033]/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Import Employee Records</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a CSV spreadsheet to batch-create staff accounts in one step.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SUCCESS SCREEN */}
          {uploadResult ? (
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Bulk Import Completed
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {uploadResult.message}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Successfully Added
                  </p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {uploadResult.importedCount}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#162033]/60 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Skipped / Errors
                  </p>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {uploadResult.failedCount}
                  </p>
                </div>
              </div>

              {/* Breakdown of any failed rows */}
              {uploadResult.failedRows && uploadResult.failedRows.length > 0 && (
                <div className="max-w-xl mx-auto text-left border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Skipped Rows Notice ({uploadResult.failedRows.length})</span>
                  </div>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 max-h-36 overflow-y-auto pl-2 list-disc">
                    {uploadResult.failedRows.map((f, idx) => (
                      <li key={idx}>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Row {f.row} ({f.name || f.email || "Employee"}):
                        </span>{" "}
                        {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Import Another File
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Done &amp; View Directory
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Template Callout Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#002185] dark:bg-blue-600 text-white shadow-xs shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Download Standard CSV Template
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Includes headers for Employee ID, Full Name, Email, Department, Salary, and Phone.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadEmployeeCsvTemplate()}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#162033] hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template.csv</span>
                </button>
              </div>

              {/* Error Banner */}
              {uploadError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Upload Error</p>
                    <p className="mt-0.5 leading-relaxed">{uploadError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Drag & Drop Zone */}
              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]"
                      : "border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Click to browse or drag &amp; drop your CSV file here
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Supports comma-delimited .csv files up to 10MB.
                  </p>
                </div>
              ) : (
                /* Selected File Card */
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#162033]/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB &bull; {parsedRows.length} rows parsed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Change File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Configuration Options */}
              {parsedRows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/60 dark:bg-[#162033]/30 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Default Password for Imported Users
                    </label>
                    <input
                      type="text"
                      value={defaultPassword}
                      onChange={(e) => setDefaultPassword(e.target.value)}
                      placeholder="Password@123"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162033] text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-[#002185]/25 focus:outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Used whenever a row leaves the Password column blank.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={autoGenerateId}
                        onChange={(e) => setAutoGenerateId(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-[#002185]/25"
                      />
                      <span>Auto-generate Employee ID if column is empty</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-[#002185]/25"
                      />
                      <span>Skip duplicate rows and continue importing</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Table with Tabs */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        CSV Preview &amp; Validation
                      </h4>
                      <span className="text-xs text-slate-400">
                        ({parsedRows.length} total rows)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#162033] p-1 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setFilterPreview("all")}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          filterPreview === "all"
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        All ({parsedRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterPreview("valid")}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          filterPreview === "valid"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        }`}
                      >
                        Valid ({validRows.length})
                      </button>
                      {invalidRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilterPreview("invalid")}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            filterPreview === "invalid"
                              ? "bg-rose-600 text-white shadow-2xs"
                              : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          }`}
                        >
                          Errors ({invalidRows.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table Box */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-[#162033]/80 sticky top-0 z-10 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Full Name</th>
                          <th className="py-2.5 px-3">Email Address</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Position</th>
                          <th className="py-2.5 px-3">Salary (GHS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#111927]">
                        {visiblePreviewRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              !row._isValid ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                            }`}
                          >
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                              #{row._rowNumber}
                            </td>
                            <td className="py-2 px-3">
                              {row._isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
                                  <Check className="w-3 h-3" />
                                  <span>Ready</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800"
                                  title={row._errors.join(", ")}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>{row._errors[0]}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                              {row.fullName || "—"}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                              {row.email || "—"}
                            </td>
                            <td className="py-2 px-3">{row.department || "General"}</td>
                            <td className="py-2 px-3">{row.position || "Staff"}</td>
                            <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {row.baseSalary || "0.00"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!uploadResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#162033]/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={isSubmitting || validRows.length === 0}
              className="px-5 py-2 rounded-xl bg-[#002185] dark:bg-blue-600 hover:bg-[#001760] dark:hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <WorkspaceLoader inline />
                  <span>Importing Records...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    Import {validRows.length} Employee{validRows.length === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadEmployeesModal;
