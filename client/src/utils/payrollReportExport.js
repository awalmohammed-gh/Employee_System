import { jsPDF } from "jspdf";
import { getCompanyLogoOrDefault, defaultLogo } from "./companyLogo";

/**
 * Formats currency to Ghana Cedis (GH₵)
 */
export const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `GH₵${num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Loads an image from URL/asset and converts it to a Base64 string for jsPDF
 */
const getBase64ImageFromUrl = (imgUrl) => {
  return new Promise((resolve) => {
    if (!imgUrl) return resolve(null);
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
};

/**
 * Normalizes processed payroll records for consistent export
 */
export const normalizeExportRecords = (records = []) => {
  return records.map((r, idx) => {
    const pNum = r.payslipNumber || r.id || r._id || `PAY-${idx + 1}`;
    const empId = r.employee?.employeeId || r.employeeId || `EMP00${idx + 1}`;
    const empName = r.employee?.fullName || r.employeeName || r.fullName || "Staff Member";
    const dept = r.employee?.department || r.department || "Operations";
    const pos = r.employee?.position || r.position || "Staff";
    const month = r.payMonth || r.month || "Current Month";
    const payDate = r.paymentDate || r.date || new Date().toISOString().split("T")[0];
    const basic = Number(r.basicSalary || r.baseSalary || 0);
    const allow = Number(r.allowances || 0);
    const gross = basic + allow;
    const deduct = Number(r.deductions || r.totalAttendanceDeductions || (gross - Number(r.netSalary || r.netTakeHomePay || 0)) || 0);
    const net = Number(r.netSalary || r.netTakeHomePay || (gross - deduct));
    const method = r.paymentMethod || "Bank Transfer";
    const status = r.status || "Paid";
    const bank = r.employee?.bankName || r.bankName || "Ghana Commercial Bank";
    const account = r.employee?.accountNumber || r.accountNumber || "N/A";

    return {
      payslipNumber: pNum,
      employeeId: empId,
      employeeName: empName,
      department: dept,
      position: pos,
      payMonth: month,
      paymentDate: payDate,
      basicSalary: basic,
      allowances: allow,
      grossSalary: gross,
      deductions: Math.max(0, deduct),
      netSalary: Math.max(0, net),
      paymentMethod: method,
      status,
      bankName: bank,
      accountNumber: account,
    };
  });
};

/**
 * Exports processed monthly payroll records to CSV formatted for accounting
 */
export const exportPayrollToCSV = ({
  records = [],
  month = "All Months",
  year = new Date().getFullYear(),
  filename,
}) => {
  const data = normalizeExportRecords(records);
  if (!data || data.length === 0) {
    throw new Error("No payroll records available to export.");
  }

  const safeMonth = String(month).replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename =
    filename || `Payroll_Report_${safeMonth}_${year}.csv`;

  // Accounting summary figures
  const totalBasic = data.reduce((acc, r) => acc + r.basicSalary, 0);
  const totalAllow = data.reduce((acc, r) => acc + r.allowances, 0);
  const totalGross = data.reduce((acc, r) => acc + r.grossSalary, 0);
  const totalDeduct = data.reduce((acc, r) => acc + r.deductions, 0);
  const totalNet = data.reduce((acc, r) => acc + r.netSalary, 0);

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    "Payslip Ref",
    "Employee ID",
    "Employee Name",
    "Department",
    "Designation",
    "Pay Period",
    "Disbursement Date",
    "Basic Salary (GH₵)",
    "Allowances (GH₵)",
    "Gross Earnings (GH₵)",
    "Deductions & Fines (GH₵)",
    "Net Payable (GH₵)",
    "Payment Method",
    "Status",
    "Bank Name",
    "Account Number",
  ];

  const rows = data.map((r) => [
    escapeCell(r.payslipNumber),
    escapeCell(r.employeeId),
    escapeCell(r.employeeName),
    escapeCell(r.department),
    escapeCell(r.position),
    escapeCell(r.payMonth),
    escapeCell(r.paymentDate),
    r.basicSalary.toFixed(2),
    r.allowances.toFixed(2),
    r.grossSalary.toFixed(2),
    r.deductions.toFixed(2),
    r.netSalary.toFixed(2),
    escapeCell(r.paymentMethod),
    escapeCell(r.status),
    escapeCell(r.bankName),
    escapeCell(r.accountNumber),
  ]);

  // Grand Totals Summary Row
  const totalsRow = [
    '"TOTALS"',
    `"HEADCOUNT: ${data.length}"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    totalBasic.toFixed(2),
    totalAllow.toFixed(2),
    totalGross.toFixed(2),
    totalDeduct.toFixed(2),
    totalNet.toFixed(2),
    '""',
    '""',
    '""',
    '""',
  ];

  // Top metadata block for official accounting audit
  const metaBlock = [
    `"MONTHLY PROCESSED PAYROLL REPORT - ACCOUNTING & AUDIT DISBURSEMENT"`,
    `"Accounting Period: ${month} ${year}"`,
    `"Generated On: ${new Date().toLocaleString("en-GH")}"`,
    `"Total Headcount Processed: ${data.length}"`,
    `"Total Net Disbursement: GH₵ ${totalNet.toFixed(2)}"`,
    '""', // Blank separator line
  ].join("\n");

  const csvBody = [headers.join(","), ...rows.map((r) => r.join(",")), totalsRow.join(",")].join("\n");
  const fullContent = "\uFEFF" + metaBlock + "\n" + csvBody;

  const blob = new Blob([fullContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    totalRecords: data.length,
    totalNet,
    filename: actualFilename,
  };
};

/**
 * Exports processed monthly payroll reports directly to high-resolution vector PDF using jsPDF
 */
export const exportPayrollToPDF = async ({
  records = [],
  month = "All Months",
  year = new Date().getFullYear(),
  filename,
  title = "MONTHLY PROCESSED PAYROLL REPORT",
}) => {
  const data = normalizeExportRecords(records);
  if (!data || data.length === 0) {
    throw new Error("No payroll records available to export.");
  }

  const safeMonth = String(month).replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename =
    filename || `Payroll_Report_${safeMonth}_${year}.pdf`;

  // Aggregate financial metrics for the accounting header
  const totalCount = data.length;
  const totalBasic = data.reduce((acc, r) => acc + r.basicSalary, 0);
  const totalAllow = data.reduce((acc, r) => acc + r.allowances, 0);
  const totalDeduct = data.reduce((acc, r) => acc + r.deductions, 0);
  const totalNet = data.reduce((acc, r) => acc + r.netSalary, 0);
  const paidCount = data.filter((r) => String(r.status).toLowerCase() === "paid").length;
  const pendingCount = totalCount - paidCount;

  // Initialize Landscape A4 (297mm x 210mm) for maximum column fidelity
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 273mm

  let currentY = 12;

  // Try to load and embed company logo
  try {
    // Company logo from settings; fall back to the default image if it cannot be embedded
    const base64Logo =
      (await getBase64ImageFromUrl(getCompanyLogoOrDefault()).catch(() => null)) ||
      (await getBase64ImageFromUrl(defaultLogo).catch(() => null));
    if (base64Logo) {
      doc.addImage(base64Logo, "PNG", margin, currentY, 12, 12);
    }
  } catch {
    // Continue cleanly if logo fails to load
  }

  // Header Title & Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(11, 30, 72); // Deep Navy (#0B1E48)
  doc.text(title, margin + 16, currentY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(
    `Official Accounting Disbursement & Audit Record • Accounting Period: ${month} ${year}`,
    margin + 16,
    currentY + 10
  );

  // Metadata block on top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DATE GENERATED", pageWidth - margin, currentY + 4, { align: "right" });
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }), pageWidth - margin, currentY + 9, { align: "right" });

  currentY += 15;

  // Top Accent Bar (Solid brand deep navy rule)
  doc.setFillColor(0, 33, 133); // #002185
  doc.rect(margin, currentY, contentWidth, 1.0, "F");
  currentY += 4;

  // EXECUTIVE ACCOUNTING SUMMARY BOX: 5 Compact Metric Cards
  const summaryBoxGap = 3;
  const numCards = 5;
  const cardWidth = (contentWidth - summaryBoxGap * (numCards - 1)) / numCards;
  const cardHeight = 15;

  const summaryMetrics = [
    { label: "HEADCOUNT", value: `${totalCount} Staff`, sub: `${paidCount} Paid • ${pendingCount} Pending` },
    { label: "TOTAL BASIC", value: formatCurrency(totalBasic), sub: "Base earnings" },
    { label: "ALLOWANCES", value: formatCurrency(totalAllow), sub: "Benefits & perks" },
    { label: "DEDUCTIONS", value: formatCurrency(totalDeduct), sub: "Absences & penalties" },
    { label: "NET DISBURSEMENT", value: formatCurrency(totalNet), sub: "Total payable" },
  ];

  summaryMetrics.forEach((metric, i) => {
    const cardX = margin + i * (cardWidth + summaryBoxGap);
    
    // Background card
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

    // Card text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(metric.label, cardX + 3, currentY + 4.5);

    doc.setFontSize(8.5);
    doc.setTextColor(i === 4 ? 0 : 15, i === 4 ? 33 : 23, i === 4 ? 133 : 42);
    doc.text(metric.value, cardX + 3, currentY + 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(metric.sub, cardX + 3, currentY + 13);
  });

  currentY += cardHeight + 4;

  // TABLE CONFIGURATION (Landscape 273mm width)
  const columns = [
    { id: "idx", label: "#", width: 10, align: "center" },
    { id: "empId", label: "EMP ID", width: 22, align: "left" },
    { id: "empName", label: "EMPLOYEE NAME", width: 50, align: "left" },
    { id: "dept", label: "DEPARTMENT", width: 34, align: "left" },
    { id: "basic", label: "BASIC (GH₵)", width: 27, align: "right" },
    { id: "allow", label: "ALLOWANCES", width: 27, align: "right" },
    { id: "deduct", label: "DEDUCTIONS", width: 27, align: "right" },
    { id: "net", label: "NET SALARY (GH₵)", width: 34, align: "right" },
    { id: "method", label: "METHOD", width: 24, align: "center" },
    { id: "status", label: "STATUS", width: 18, align: "center" },
  ];

  const headerHeight = 7.5;
  const rowHeight = 6.2;
  const bottomMargin = 22; // Leave space for signatures/footers

  // Helper to draw table header
  const drawTableHeader = (y) => {
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(margin, y, contentWidth, headerHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let currentX = margin;
    columns.forEach((col) => {
      let textX = currentX + 2;
      if (col.align === "right") {
        textX = currentX + col.width - 2;
      } else if (col.align === "center") {
        textX = currentX + col.width / 2;
      }
      doc.text(col.label, textX, y + 5, { align: col.align });
      currentX += col.width;
    });

    return y + headerHeight;
  };

  currentY = drawTableHeader(currentY);

  let pageNum = 1;

  // Render Table Rows
  data.forEach((row, index) => {
    // Check page overflow
    if (currentY + rowHeight > pageHeight - bottomMargin) {
      // Print page footer on current page before moving
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Confidential Financial Audit Record • Page ${pageNum}`,
        margin,
        pageHeight - 8
      );

      doc.addPage("a4", "landscape");
      pageNum += 1;
      currentY = margin;

      // Repeat Table Header
      currentY = drawTableHeader(currentY);
    }

    // Alternating row background
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252); // Slate-50
    }
    doc.rect(margin, currentY, contentWidth, rowHeight, "F");

    // Subtle bottom row border
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

    doc.setFontSize(7.2);

    let currentX = margin;
    columns.forEach((col) => {
      let text = "";
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85); // Slate-700

      if (col.id === "idx") text = String(index + 1);
      else if (col.id === "empId") text = row.employeeId;
      else if (col.id === "empName") {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        text = row.employeeName.length > 25 ? row.employeeName.substring(0, 24) + "…" : row.employeeName;
      } else if (col.id === "dept") {
        text = row.department.length > 18 ? row.department.substring(0, 17) + "…" : row.department;
      } else if (col.id === "basic") {
        text = row.basicSalary.toFixed(2);
      } else if (col.id === "allow") {
        text = row.allowances.toFixed(2);
      } else if (col.id === "deduct") {
        text = row.deductions.toFixed(2);
        if (row.deductions > 0) doc.setTextColor(220, 38, 38); // Red for deductions
      } else if (col.id === "net") {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 33, 133); // #002185
        text = row.netSalary.toFixed(2);
      } else if (col.id === "method") {
        text = row.paymentMethod;
      } else if (col.id === "status") {
        text = row.status;
        if (String(row.status).toLowerCase() === "paid") {
          doc.setTextColor(22, 163, 74); // Green
        } else {
          doc.setTextColor(217, 119, 6); // Amber
        }
      }

      let textX = currentX + 2;
      if (col.align === "right") {
        textX = currentX + col.width - 2;
      } else if (col.align === "center") {
        textX = currentX + col.width / 2;
      }

      doc.text(text, textX, currentY + 4.2, { align: col.align });
      currentX += col.width;
    });

    currentY += rowHeight;
  });

  // GRAND TOTALS ROW
  if (currentY + 12 > pageHeight - bottomMargin) {
    doc.addPage("a4", "landscape");
    pageNum += 1;
    currentY = margin;
  }

  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(margin, currentY, contentWidth, 7, "F");
  doc.setDrawColor(0, 33, 133);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, margin + contentWidth, currentY);
  doc.line(margin, currentY + 7, margin + contentWidth, currentY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("GRAND TOTALS", margin + 14, currentY + 4.5);

  let currentX = margin;
  columns.forEach((col) => {
    let text = "";
    if (col.id === "basic") text = totalBasic.toFixed(2);
    else if (col.id === "allow") text = totalAllow.toFixed(2);
    else if (col.id === "deduct") text = totalDeduct.toFixed(2);
    else if (col.id === "net") text = totalNet.toFixed(2);

    if (text) {
      const textX = currentX + col.width - 2;
      doc.text(text, textX, currentY + 4.5, { align: "right" });
    }
    currentX += col.width;
  });

  currentY += 10;

  // OFFICIAL ACCOUNTING SIGN-OFF AUDIT BLOCK (If room on page, or append cleanly)
  if (currentY + 14 <= pageHeight - 12) {
    const signBoxWidth = contentWidth / 3;
    const signY = currentY + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);

    // Signature 1: Payroll Officer
    doc.text("Prepared by (Payroll Officer):", margin, signY);
    doc.line(margin + 36, signY, margin + signBoxWidth - 8, signY);

    // Signature 2: Internal Auditor
    doc.text("Audited by (Accounting / Audit):", margin + signBoxWidth, signY);
    doc.line(margin + signBoxWidth + 40, signY, margin + signBoxWidth * 2 - 8, signY);

    // Signature 3: Finance Director
    doc.text("Authorized by (Finance Director):", margin + signBoxWidth * 2, signY);
    doc.line(margin + signBoxWidth * 2 + 42, signY, margin + contentWidth, signY);
  }

  // Final Page Numbers across all generated pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "EYENIT EMPOWER HRM • OFFICIAL MONTHLY PROCESSED PAYROLL REPORT • STRICTLY CONFIDENTIAL",
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: "right" }
    );
  }

  // Save/Download PDF
  doc.save(actualFilename);

  return {
    success: true,
    totalRecords: data.length,
    totalNet,
    filename: actualFilename,
  };
};
