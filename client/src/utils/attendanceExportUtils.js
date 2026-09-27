import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/eyenit_logo.png";

/**
 * Safely formats dates into ISO "YYYY-MM-DD" or readable string
 */
export const formatExportDate = (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toISOString().split("T")[0];
  } catch {
    return String(dateVal);
  }
};

/**
 * Returns day of week (e.g. "Mon", "Tue")
 */
export const getDayOfWeek = (dateVal) => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "";
  }
};

/**
 * Formats time string or Date into 12-hour AM/PM format
 */
export const formatExportTime = (timeVal) => {
  if (!timeVal) return "--:--";
  if (typeof timeVal === "string" && (timeVal.includes("AM") || timeVal.includes("PM"))) {
    return timeVal.trim();
  }
  try {
    if (typeof timeVal === "string" && timeVal.includes(":") && !timeVal.includes("T")) {
      const parts = timeVal.split(":");
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1] ? parts[1].substring(0, 2) : "00";
      if (isNaN(hours)) return timeVal;
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
    }
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {
    // Fallback
  }
  return String(timeVal);
};

/**
 * Loads an image from URL/asset and converts it to Base64 for jsPDF
 */
const getBase64Image = (imgUrl) => {
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
 * Normalizes raw attendance records into an enriched, standardized payroll-audit format
 */
export const normalizeAttendanceAuditRecords = (records = []) => {
  let totalHours = 0;
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalLateMinutes = 0;
  let totalPenaltyDeductions = 0;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let flaggedCount = 0;

  const uniqueEmployeeMap = new Set();

  const normalized = records.map((item, idx) => {
    const rawDate = item.date || item.createdAt || new Date();
    const formattedDate = formatExportDate(rawDate);
    const dayName = getDayOfWeek(rawDate);

    // Employee extraction
    const emp = item.employee || {};
    const empId =
      emp.employeeId ||
      item.employeeId ||
      (emp._id ? `EMP-${String(emp._id).slice(-4).toUpperCase()}` : `EMP-${String(idx + 1).padStart(3, "0")}`);
    const empName = emp.fullName || emp.name || item.employeeName || "Staff Member";
    const dept = emp.department || item.department || "General Operations";
    const position = emp.position || emp.role || item.position || "Staff";

    uniqueEmployeeMap.add(empId);

    // Times & Hours
    const clockInStr = formatExportTime(item.clockIn);
    const clockOutStr = formatExportTime(item.clockOut);
    const scheduledShift = item.scheduledShift || item.shiftType || "08:00 AM - 05:00 PM";

    const workHrs = Number(item.workHours) || 0;
    const standardDailyHrs = Number(item.expectedHours || 8);
    const regularHrs = Math.min(workHrs, standardDailyHrs);
    const overtimeHrs = Math.max(0, Number(item.overtimeHours) || (workHrs > standardDailyHrs ? workHrs - standardDailyHrs : 0));

    // Lateness & Deductions
    const isLate = Boolean(item.isLate || item.status === "Late");
    const lateMins = Number(item.lateMinutes) || (isLate ? 15 : 0);
    const deduction = Number(item.lateDeduction || item.penaltyAmount || (lateMins > 0 ? Math.min(100, Math.ceil(lateMins / 30) * 10) : 0));

    // Statuses
    const isExcused = Boolean(item.isExcused || item.isWaived || item.status === "Excused");
    const isFlagged = Boolean(item.isFlagged || item.flagged);
    const status = item.status || (isLate ? "Late" : workHrs > 0 ? "Present" : "Absent");

    // Telemetry updates
    totalHours += workHrs;
    totalRegularHours += regularHrs;
    totalOvertimeHours += overtimeHrs;
    totalLateMinutes += isLate && !isExcused ? lateMins : 0;
    totalPenaltyDeductions += isExcused ? 0 : deduction;

    if (status === "Present") presentCount++;
    else if (status === "Late") lateCount++;
    else if (status === "Absent") absentCount++;
    if (isExcused) excusedCount++;
    if (isFlagged) flaggedCount++;

    return {
      id: item._id || item.id || `att-${idx}`,
      date: formattedDate,
      day: dayName,
      employeeId: empId,
      employeeName: empName,
      department: dept,
      position: position,
      scheduledShift,
      clockIn: clockInStr,
      clockOut: clockOutStr,
      workHours: Number(workHrs.toFixed(2)),
      regularHours: Number(regularHrs.toFixed(2)),
      overtimeHours: Number(overtimeHrs.toFixed(2)),
      lateMinutes: lateMins,
      deductionAmount: isExcused ? 0 : deduction,
      isExcused,
      excusedReason: item.excusedReason || item.notes || (isExcused ? "Administrative Waiver" : ""),
      isFlagged,
      flagReason: item.flagReason || "",
      status,
      notes: item.notes || (isExcused ? "Excused by Management" : isFlagged ? "Audit Review Flag" : "System Logged"),
      verifiedBy: item.verifiedBy || item.approvedBy || "Biometric / System",
    };
  });

  const totalLogs = normalized.length;
  const complianceRate = totalLogs > 0 ? Math.round(((presentCount + excusedCount) / totalLogs) * 100) : 100;

  const summary = {
    totalLogs,
    totalEmployees: uniqueEmployeeMap.size,
    totalHours: Number(totalHours.toFixed(2)),
    totalRegularHours: Number(totalRegularHours.toFixed(2)),
    totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
    totalLateMinutes,
    totalPenaltyDeductions: Number(totalPenaltyDeductions.toFixed(2)),
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    flaggedCount,
    complianceRate,
  };

  return { records: normalized, summary };
};

/**
 * Exports normalized attendance logs to a comprehensive CSV file for payroll processing and auditing.
 * Prepend UTF-8 BOM (\uFEFF) for seamless opening in Excel and Google Sheets without encoding glitches.
 */
export const exportAttendanceLogsToCSV = ({
  attendanceList = [],
  periodLabel = "Current Period",
  companyName = "",
  filename,
}) => {
  const { records, summary } = normalizeAttendanceAuditRecords(attendanceList);
  if (!records || records.length === 0) {
    throw new Error("No attendance records found to export.");
  }

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    "Date",
    "Day",
    "Employee ID",
    "Employee Name",
    "Department",
    "Job Position",
    "Scheduled Shift",
    "Clock In",
    "Clock Out",
    "Total Hours",
    "Regular Hours",
    "Overtime Hours",
    "Late (Minutes)",
    "Late Penalty / Deduction (GH₵)",
    "Attendance Status",
    "Excused / Waived",
    "Flagged For Audit",
    "Audit Notes & Details",
    "Verification Authority",
  ];

  const rows = records.map((r) => [
    escapeCSV(r.date),
    escapeCSV(r.day),
    escapeCSV(r.employeeId),
    escapeCSV(r.employeeName),
    escapeCSV(r.department),
    escapeCSV(r.position),
    escapeCSV(r.scheduledShift),
    escapeCSV(r.clockIn),
    escapeCSV(r.clockOut),
    r.workHours,
    r.regularHours,
    r.overtimeHours,
    r.lateMinutes,
    r.deductionAmount.toFixed(2),
    escapeCSV(r.status),
    escapeCSV(r.isExcused ? `Yes - ${r.excusedReason}` : "No"),
    escapeCSV(r.isFlagged ? `Flagged: ${r.flagReason || "Requires Review"}` : "Normal"),
    escapeCSV(r.notes),
    escapeCSV(r.verifiedBy),
  ]);

  // Reconciliation summary footer row for payroll officer
  const summaryRow = [
    escapeCSV("TOTALS / SUMMARY"),
    escapeCSV(`${summary.totalLogs} Logs`),
    escapeCSV(`${summary.totalEmployees} Staff`),
    escapeCSV(""),
    escapeCSV(""),
    escapeCSV(""),
    escapeCSV(""),
    escapeCSV(""),
    escapeCSV(""),
    summary.totalHours.toFixed(2),
    summary.totalRegularHours.toFixed(2),
    summary.totalOvertimeHours.toFixed(2),
    summary.totalLateMinutes,
    summary.totalPenaltyDeductions.toFixed(2),
    escapeCSV(`${summary.complianceRate}% Compliance`),
    escapeCSV(`${summary.excusedCount} Excused`),
    escapeCSV(`${summary.flaggedCount} Flagged`),
    escapeCSV("Audit Reconciliation Row"),
    escapeCSV("Automated Payroll Summary"),
  ];

  // Metadata preamble rows
  const metadataRows = [
    [escapeCSV(`ORGANIZATION: ${companyName}`)],
    [escapeCSV(`REPORT TITLE: Official Attendance Logs & Payroll Audit Sheet`)],
    [escapeCSV(`AUDIT PERIOD: ${periodLabel}`)],
    [escapeCSV(`DATE GENERATED: ${new Date().toLocaleString()}`)],
    [escapeCSV(`TOTAL LOGS: ${summary.totalLogs} | TOTAL STAFF: ${summary.totalEmployees} | TOTAL WORK HOURS: ${summary.totalHours} | OVERTIME HOURS: ${summary.totalOvertimeHours} | TOTAL DEDUCTIONS: GH₵ ${summary.totalPenaltyDeductions.toFixed(2)}`)],
    [], // Blank line before headers
  ];

  const csvContent =
    "\uFEFF" +
    metadataRows.map((r) => r.join(",")).join("\r\n") +
    [headers.join(","), ...rows.map((row) => row.join(",")), summaryRow.join(",")].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const defaultFilename = `payroll_attendance_audit_${new Date().toISOString().split("T")[0]}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename || defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: records.length, filename: filename || defaultFilename };
};

/**
 * Generates an executive print-friendly corporate PDF for Payroll Processing & Auditing
 * Designed in landscape orientation to accommodate all payroll verification columns cleanly.
 */
export const exportAttendanceLogsToPDF = async ({
  attendanceList = [],
  periodLabel = "Current Audit Period",
  companyName = "",
  logoUrl,
  departmentFilter = "All Departments",
  filename,
  preparedBy = "System Administrator",
}) => {
  const { records, summary } = normalizeAttendanceAuditRecords(attendanceList);
  if (!records || records.length === 0) {
    throw new Error("No attendance records found to export.");
  }

  // Initialize jsPDF in landscape for comprehensive tabular clarity
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 12;

  // Try to load and embed company logo
  const resolvedLogo = logoUrl || logo;
  try {
    const base64Logo = await getBase64Image(resolvedLogo);
    if (base64Logo) {
      doc.addImage(base64Logo, "PNG", margin, currentY, 14, 14);
    }
  } catch {
    // Continue cleanly if logo fails to render
  }

  // Header Title & Branding
  const titleX = margin + 17;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(11, 30, 72); // Deep Navy #0B1E48
  doc.text(companyName.toUpperCase(), titleX, currentY + 4);

  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // Secondary Navy
  doc.text("PAYROLL & ATTENDANCE AUDIT REPORT", titleX, currentY + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Certified Timekeeping & Shift Records for Payroll Reconciliation", titleX, currentY + 14);

  // Document Metadata on Right
  const reportRef = `AUD-ATT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("AUDIT REFERENCE", pageWidth - margin, currentY + 3, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(reportRef, pageWidth - margin, currentY + 7.5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DATE GENERATED", pageWidth - margin, currentY + 12, { align: "right" });
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), pageWidth - margin, currentY + 16, { align: "right" });

  currentY += 19;

  // Solid corporate navy separator line (#0B1E48, 1.2mm)
  doc.setFillColor(11, 30, 72);
  doc.rect(margin, currentY, contentWidth, 1.2, "F");

  currentY += 4;

  // Executive Scope & Summary Ribbon (5 Key Metrics Tiles)
  const tileWidth = (contentWidth - 12) / 5;
  const tileHeight = 15;

  const kpis = [
    {
      label: "TOTAL LOGS / STAFF",
      val: `${summary.totalLogs} Logs (${summary.totalEmployees} Staff)`,
      sub: departmentFilter !== "All" ? `Dept: ${departmentFilter}` : "All Departments",
      color: [11, 30, 72],
      bg: [241, 245, 249],
    },
    {
      label: "TOTAL WORK HOURS",
      val: `${summary.totalHours.toFixed(1)} hrs`,
      sub: `Reg: ${summary.totalRegularHours.toFixed(1)}h`,
      color: [30, 58, 138],
      bg: [239, 246, 255],
    },
    {
      label: "OVERTIME HOURS",
      val: `${summary.totalOvertimeHours.toFixed(1)} hrs`,
      sub: "Eligible for OT Rates",
      color: [180, 83, 9],
      bg: [254, 243, 199],
    },
    {
      label: "LATE / DEDUCTIONS",
      val: `GH₵ ${summary.totalPenaltyDeductions.toFixed(2)}`,
      sub: `${summary.totalLateMinutes} mins (${summary.lateCount} late)`,
      color: [220, 38, 38],
      bg: [254, 242, 242],
    },
    {
      label: "COMPLIANCE & AUDIT",
      val: `${summary.complianceRate}% On-Time`,
      sub: `${summary.excusedCount} Excused • ${summary.flaggedCount} Flagged`,
      color: [22, 101, 52],
      bg: [240, 253, 244],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const tileX = margin + idx * (tileWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(tileX, currentY, tileWidth, tileHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.label, tileX + 2.5, currentY + 4);

    doc.setFontSize(8.5);
    doc.text(kpi.val, tileX + 2.5, currentY + 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, tileX + 2.5, currentY + 13);
  });

  currentY += tileHeight + 4;

  // Table Configuration for autoTable
  const tableColumns = [
    { header: "DATE", dataKey: "date" },
    { header: "DAY", dataKey: "day" },
    { header: "STAFF ID", dataKey: "employeeId" },
    { header: "EMPLOYEE NAME", dataKey: "employeeName" },
    { header: "DEPARTMENT", dataKey: "department" },
    { header: "IN", dataKey: "clockIn" },
    { header: "OUT", dataKey: "clockOut" },
    { header: "HRS", dataKey: "workHours" },
    { header: "OT", dataKey: "overtimeHours" },
    { header: "LATE", dataKey: "lateMinutes" },
    { header: "DEDUCT (GH₵)", dataKey: "deductionAmount" },
    { header: "STATUS", dataKey: "status" },
    { header: "AUDIT TRAILS & NOTES", dataKey: "notes" },
  ];

  const tableRows = records.map((r) => ({
    date: r.date,
    day: r.day,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    department: r.department,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    workHours: `${r.workHours.toFixed(1)}h`,
    overtimeHours: r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}h` : "-",
    lateMinutes: r.lateMinutes > 0 ? `${r.lateMinutes}m` : "-",
    deductionAmount: r.deductionAmount > 0 ? r.deductionAmount.toFixed(2) : "-",
    status: r.status,
    notes: r.isExcused ? `Excused: ${r.excusedReason}` : r.isFlagged ? `Flagged: ${r.flagReason || r.notes}` : r.notes || "Verified",
  }));

  // AutoTable invocation
  autoTable(doc, {
    columns: tableColumns,
    body: tableRows,
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 22 },
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 6.8,
      cellPadding: 1.8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [11, 30, 72], // #0B1E48
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.8,
      halign: "left",
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      date: { cellWidth: 18 },
      day: { cellWidth: 10, halign: "center" },
      employeeId: { cellWidth: 18, fontStyle: "bold" },
      employeeName: { cellWidth: 32, fontStyle: "bold" },
      department: { cellWidth: 26 },
      clockIn: { cellWidth: 16, halign: "center" },
      clockOut: { cellWidth: 16, halign: "center" },
      workHours: { cellWidth: 12, halign: "right", fontStyle: "bold", textColor: [30, 58, 138] },
      overtimeHours: { cellWidth: 12, halign: "right", textColor: [180, 83, 9] },
      lateMinutes: { cellWidth: 12, halign: "right" },
      deductionAmount: { cellWidth: 18, halign: "right", fontStyle: "bold", textColor: [220, 38, 38] },
      status: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      notes: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      // Colorize status column cells
      if (data.section === "body" && data.column.dataKey === "status") {
        const val = String(data.cell.raw);
        if (val === "Present") {
          data.cell.styles.textColor = [22, 101, 52]; // green
        } else if (val === "Late") {
          data.cell.styles.textColor = [220, 38, 38]; // red
        } else if (val === "Excused") {
          data.cell.styles.textColor = [37, 99, 235]; // blue
        } else if (val === "Absent") {
          data.cell.styles.textColor = [217, 119, 6]; // amber
        }
      }
    },
    didDrawPage: (data) => {
      // Running Footer on every page
      const pageNumber = doc.internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);

      // Left footer
      doc.text(
        `Confidential • ${companyName} Attendance & Payroll Audit • Period: ${periodLabel}`,
        margin,
        pageHeight - 8
      );

      // Right footer: Page X of Y
      doc.text(`Page ${data.pageNumber} of ${pageNumber}`, pageWidth - margin, pageHeight - 8, {
        align: "right",
      });
    },
  });

  // Calculate final position after table
  let finalY = doc.lastAutoTable.finalY + 6;

  // If near bottom of page, add a new page for Sign-off block
  if (finalY > pageHeight - 32) {
    doc.addPage();
    finalY = 20;
  }

  // 3-Column Auditor & Payroll Certification Sign-Off Block
  const sigBoxWidth = (contentWidth - 8) / 3;
  const sigBoxHeight = 22;

  const signatures = [
    { role: "PREPARED BY (TIMEKEEPER / HR)", name: preparedBy, date: "Date: ________________" },
    { role: "VERIFIED BY (HR OPERATIONS)", name: "HR Manager / Operations", date: "Date: ________________" },
    { role: "APPROVED FOR PAYROLL RELEASE", name: "Finance Director / Audit Lead", date: "Date: ________________" },
  ];

  signatures.forEach((sig, sIdx) => {
    const sigX = margin + sIdx * (sigBoxWidth + 4);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(sigX, finalY, sigBoxWidth, sigBoxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(11, 30, 72);
    doc.text(sig.role, sigX + 3, finalY + 4.5);

    doc.setDrawColor(203, 213, 225);
    doc.line(sigX + 3, finalY + 6, sigX + sigBoxWidth - 3, finalY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Signature: ____________________________", sigX + 3, finalY + 13);
    doc.text(sig.date, sigX + 3, finalY + 18);
  });

  const defaultFilename = `payroll_attendance_report_${new Date().toISOString().split("T")[0]}.pdf`;
  const resolvedFilename = filename || defaultFilename;
  doc.save(resolvedFilename);

  return { success: true, filename: resolvedFilename };
};
