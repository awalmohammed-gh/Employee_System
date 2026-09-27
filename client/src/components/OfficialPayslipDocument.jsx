import WorkspaceLoader from "./ui/WorkspaceLoader";
import { useState } from "react";
import { Download, Printer, ArrowLeft, FileCheck } from "lucide-react";
import defaultLogo from "../assets/eyenit_logo.png";
import { useBranding } from "../context/BrandingContext";
import {
  normalizePayslipData,
  generatePayslipHTML,
  downloadPayslipPDF,
  printPayslipDocument,
} from "../utils/payslipPdfGenerator";

/**
 * OfficialPayslipDocument Component
 *
 * On-screen payslip with download/print controls. The document itself is the shared payslip
 * template (company letterhead, employee details, earnings/deductions, net pay), so what is shown
 * here is exactly what the PDF download and print produce.
 */
export const OfficialPayslipDocument = ({
  payslip,
  onBack,
  showControls = true,
  title = "Official Employee Payslip",
}) => {
  // Company logo from company settings; built-in default when none is configured
  const { logoUrl: companyLogoUrl, branding } = useBranding();
  const logo = companyLogoUrl || defaultLogo;
  const [isExporting, setIsExporting] = useState(false);
  const data = normalizePayslipData(payslip);
  const documentHtml = generatePayslipHTML(payslip, {
    logoUrl: logo,
    company: {
      companyName: branding?.companyName || "",
      address: branding?.address || "",
      email: branding?.contactEmail || branding?.email || "",
      phone: branding?.contactPhone || branding?.phone || "",
      website: branding?.website || "",
    },
  });

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      await downloadPayslipPDF(payslip, "corporate-payslip-canvas");
    } catch (err) {
      console.error("PDF download error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      printPayslipDocument(payslip);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 print-container">
      {/* Controls Bar */}
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
                <FileCheck className="w-4 h-4 text-[#002185] dark:text-blue-400" />
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.employeeName} • {data.payPeriod}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-print-payslip-sheet"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              id="btn-download-payslip-pdf"
              onClick={handleDownload}
              disabled={isExporting}
              className="px-4 py-2 bg-[#002185] hover:bg-[#001760] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-75"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? <><WorkspaceLoader inline /> Generating PDF...</> : "Download Official PDF"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Official payslip document — same template used for PDF download, bulk export and printing */}
      <div className="overflow-x-auto rounded-2xl shadow-xl print:shadow-none print:overflow-visible">
        <div
          id="corporate-payslip-canvas"
          className="bg-white w-fit min-w-full mx-auto print-card"
          dangerouslySetInnerHTML={{ __html: documentHtml }}
        />
      </div>
    </div>
  );
};

export default OfficialPayslipDocument;
