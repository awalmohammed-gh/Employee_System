import { jsPDF } from "jspdf";
import { getCompanyLogoOrDefault, defaultLogo } from "./companyLogo";

/**
 * Formats a date string into readable human format (e.g. "24 August 2026")
 */
export const formatReportDate = (dateString) => {
  if (!dateString) {
    return new Date().toLocaleDateString("en-GH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString("en-GH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(dateString);
  }
};

/**
 * Formats ISO / 24h time into 12-hour AM/PM format (e.g. "08:30 AM")
 */
export const formatReportTime = (timeStr) => {
  if (!timeStr) return "--:--";
  if (typeof timeStr === "string" && (timeStr.includes("AM") || timeStr.includes("PM"))) {
    return timeStr;
  }
  try {
    if (typeof timeStr === "string" && timeStr.includes(":")) {
      const parts = timeStr.split(":");
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1] ? parts[1].substring(0, 2) : "00";
      if (isNaN(hours)) return timeStr;
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
    }
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {
    // Return original
  }
  return String(timeStr);
};

/**
 * Normalizes attendance report payload for a specific employee and attendance logs list
 */
export const normalizeAttendanceReportData = ({
  employee = {},
  attendanceList = [],
  period = "",
  dateRange = "",
  generatedBy = "System Administrator",
}) => {
  const employeeName =
    employee.fullName ||
    employee.name ||
    employee.employeeName ||
    "Staff Member";
  const employeeId =
    employee.employeeId ||
    employee.id ||
    (employee._id ? `EMP-${String(employee._id).slice(-4).toUpperCase()}` : "EMP-001");
  const department =
    employee.department ||
    "General";
  const position =
    employee.position ||
    employee.role ||
    "Staff Member";
  const email = employee.email || "N/A";
  const phone = employee.phone || "N/A";

  const reportId = `ATT-${String(employeeId).replace(/[^A-Za-z0-9]/g, "")}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const dateGenerated = formatReportDate(new Date());
  const reportPeriod = period || new Date().toLocaleDateString("en-GH", { month: "long", year: "numeric" });

  // Calculate telemetry and statistics from attendanceList
  let totalDays = 0;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let excusedDays = 0;
  let totalLateMinutes = 0;
  let totalWorkHours = 0;

  const normalizedRecords = (Array.isArray(attendanceList) ? attendanceList : []).map((rec, index) => {
    totalDays++;
    const statusRaw = String(rec.status || "Present").toLowerCase();
    const isExcused = Boolean(rec.isExcused || rec.excused);
    const isLate = statusRaw === "late" || Number(rec.minutesLate || rec.lateMinutes || 0) > 0;
    const isAbsent = statusRaw === "absent";
    if (statusRaw === "present" || (!isAbsent && !isLate)) {
      presentDays++;
    }

    const hours = Number(rec.workHours || rec.hours || 0);
    totalWorkHours += hours;

    if (isExcused) {
      excusedDays++;
    }

    if (isLate) {
      lateDays++;
      totalLateMinutes += Number(rec.minutesLate || rec.lateMinutes || 0);
    } else if (isAbsent) {
      absentDays++;
    } else {
      presentDays++;
    }

    const dateFormatted = rec.date ? formatReportDate(rec.date) : `Day ${index + 1}`;
    let dayOfWeek = "";
    try {
      if (rec.date) {
        dayOfWeek = new Date(rec.date).toLocaleDateString("en-US", { weekday: "short" });
      }
    } catch {
      dayOfWeek = "";
    }

    return {
      id: rec._id || rec.id || `att-row-${index}`,
      date: dateFormatted,
      rawDate: rec.date,
      dayOfWeek: dayOfWeek || "Weekday",
      scheduledShift: rec.shift || "08:00 AM - 05:00 PM",
      clockIn: formatReportTime(rec.clockIn),
      clockOut: formatReportTime(rec.clockOut),
      workHours: hours > 0 ? `${hours.toFixed(1)} hrs` : isAbsent ? "0.0 hrs" : "--",
      rawHours: hours,
      status: isExcused ? "Excused" : isLate ? "Late" : isAbsent ? "Absent" : "Present",
      lateMinutes: Number(rec.minutesLate || rec.lateMinutes || 0),
      isExcused,
      excuseReason: rec.excuseReason || "",
      notes: rec.notes || rec.remarks || (isLate ? `${rec.minutesLate || 0}m late` : isExcused ? "Penalty waived" : ""),
    };
  });

  // Calculate compliance rate
  const recordedDays = totalDays || 1;
  const complianceRate = Math.min(
    100,
    Math.max(0, Math.round(((presentDays + (excusedDays * 0.5)) / recordedDays) * 100))
  );

  const averageHoursPerDay = totalDays > 0 ? (totalWorkHours / totalDays).toFixed(1) : "0.0";

  return {
    employeeName,
    employeeId,
    department,
    position,
    email,
    phone,
    reportId,
    dateGenerated,
    reportPeriod,
    dateRange: dateRange || reportPeriod,
    generatedBy,
    totalDays: totalDays || normalizedRecords.length,
    presentDays,
    lateDays,
    absentDays,
    excusedDays,
    totalLateMinutes,
    totalWorkHours: totalWorkHours.toFixed(1),
    averageHoursPerDay,
    complianceRate,
    records: normalizedRecords,
  };
};

/**
 * Loads an image from URL/asset and converts it to a Base64 string for jsPDF
 */
const getBase64ImageFromUrl = async (imgUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
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
 * Generates an official vector PDF attendance report using jsPDF
 */
export const generateAttendanceReportPDF = async (reportPayload) => {
  const data = normalizeAttendanceReportData(reportPayload);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 16;

  // Try to load and embed company logo
  try {
    // Company logo from settings; fall back to the default image if it cannot be embedded
    const base64Logo =
      (await getBase64ImageFromUrl(getCompanyLogoOrDefault()).catch(() => null)) ||
      (await getBase64ImageFromUrl(defaultLogo).catch(() => null));
    if (base64Logo) {
      doc.addImage(base64Logo, "PNG", margin, currentY, 14, 14);
    }
  } catch {
    // Continue without logo image
  }

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138); // Deep Navy (#1e3a8a)
  doc.text("ATTENDANCE REPORT", margin + 18, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Official Individual Attendance Audit • ${data.reportId}`, margin + 18, currentY + 11);

  // Date Generated on Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DATE GENERATED", pageWidth - margin, currentY + 4, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(data.dateGenerated, pageWidth - margin, currentY + 10, { align: "right" });

  currentY += 18;

  // Solid Deep-Navy Rule (#1e3a8a, height: 3px)
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, contentWidth, 1.2, "F");

  currentY += 6;

  // Metadata Grid: Two Boxes
  const boxWidth = (contentWidth - 6) / 2;
  const boxHeight = 28;

  // 1. Employee Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text("EMPLOYEE INFORMATION", margin + 4, currentY + 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, currentY + 8, margin + boxWidth - 4, currentY + 8);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Name:", margin + 4, currentY + 13);
  doc.text("ID:", margin + boxWidth / 2 + 2, currentY + 13);
  doc.text("Dept:", margin + 4, currentY + 20);
  doc.text("Role:", margin + boxWidth / 2 + 2, currentY + 20);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName.substring(0, 20), margin + 18, currentY + 13);
  doc.text(data.employeeId, margin + boxWidth / 2 + 12, currentY + 13);
  doc.text(data.department.substring(0, 18), margin + 18, currentY + 20);
  doc.text(data.position.substring(0, 18), margin + boxWidth / 2 + 12, currentY + 20);

  // 2. Report Period Box
  const box2X = margin + boxWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(box2X, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text("AUDIT & REPORT PERIOD", box2X + 4, currentY + 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(box2X + 4, currentY + 8, box2X + boxWidth - 4, currentY + 8);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Period:", box2X + 4, currentY + 13);
  doc.text("Total Logs:", box2X + boxWidth / 2 + 2, currentY + 13);
  doc.text("Compliance:", box2X + 4, currentY + 20);
  doc.text("Scope:", box2X + boxWidth / 2 + 2, currentY + 20);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.reportPeriod, box2X + 18, currentY + 13);
  doc.text(`${data.totalDays} Days`, box2X + boxWidth / 2 + 22, currentY + 13);

  doc.setTextColor(22, 163, 74); // Green
  doc.text(`${data.complianceRate}% Rate`, box2X + 26, currentY + 20);
  doc.setTextColor(15, 23, 42);
  doc.text("Verified Audit", box2X + boxWidth / 2 + 16, currentY + 20);

  currentY += boxHeight + 5;

  // KPI Highlights Strip (4 Metric Tiles)
  const kpiTileWidth = (contentWidth - 9) / 4;
  const kpiTileHeight = 16;

  const kpis = [
    { label: "PRESENT DAYS", val: `${data.presentDays} Days`, color: [5, 150, 105], bg: [236, 253, 245] },
    { label: "LATE LOGS", val: `${data.lateDays} (${data.totalLateMinutes}m)`, color: [220, 38, 38], bg: [254, 242, 242] },
    { label: "ABSENT DAYS", val: `${data.absentDays} Days`, color: [217, 119, 6], bg: [254, 243, 199] },
    { label: "TOTAL LOGGED", val: `${data.totalWorkHours}h (${data.averageHoursPerDay}h/d)`, color: [30, 58, 138], bg: [240, 247, 255] },
  ];

  kpis.forEach((kpi, idx) => {
    const tileX = margin + idx * (kpiTileWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(tileX, currentY, kpiTileWidth, kpiTileHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.label, tileX + 3, currentY + 5);

    doc.setFontSize(9.5);
    doc.text(kpi.val, tileX + 3, currentY + 12);
  });

  currentY += kpiTileHeight + 6;

  // Audit Table Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text("DAILY ATTENDANCE LOG & AUDIT TRAILS", margin, currentY);
  currentY += 4;

  // Table Columns Setup
  const colWidths = [24, 18, 28, 24, 24, 20, 24, contentWidth - 162];
  const colHeaders = ["DATE", "DAY", "SCHEDULED", "CLOCK IN", "CLOCK OUT", "HOURS", "STATUS", "REMARKS"];

  // Draw Table Header Row
  doc.setFillColor(240, 247, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(margin, currentY, contentWidth, 7, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(30, 58, 138);

  let currentX = margin + 2;
  colHeaders.forEach((hdr, idx) => {
    doc.text(hdr, currentX, currentY + 4.8);
    currentX += colWidths[idx];
  });

  currentY += 7;

  // Draw Records
  const displayRecords = data.records.slice(0, 26); // Fit on one page comfortably
  displayRecords.forEach((rec, rIdx) => {
    const isEven = rIdx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 6, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);

    let cellX = margin + 2;

    // Date
    doc.text(String(rec.date).substring(0, 11), cellX, currentY + 4.2);
    cellX += colWidths[0];

    // Day
    doc.text(rec.dayOfWeek, cellX, currentY + 4.2);
    cellX += colWidths[1];

    // Shift
    doc.setTextColor(100, 116, 139);
    doc.text(rec.scheduledShift, cellX, currentY + 4.2);
    cellX += colWidths[2];

    // Clock In
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(rec.clockIn, cellX, currentY + 4.2);
    cellX += colWidths[3];

    // Clock Out
    doc.text(rec.clockOut, cellX, currentY + 4.2);
    cellX += colWidths[4];

    // Hours
    doc.setTextColor(30, 58, 138);
    doc.text(rec.workHours, cellX, currentY + 4.2);
    cellX += colWidths[5];

    // Status Badge
    doc.setFont("helvetica", "bold");
    if (rec.status === "Present") {
      doc.setTextColor(5, 150, 105);
    } else if (rec.status === "Late") {
      doc.setTextColor(220, 38, 38);
    } else if (rec.status === "Absent") {
      doc.setTextColor(217, 119, 6);
    } else {
      doc.setTextColor(30, 58, 138);
    }
    doc.text(rec.status, cellX, currentY + 4.2);
    cellX += colWidths[6];

    // Remarks
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(String(rec.notes || "").substring(0, 24), cellX, currentY + 4.2);

    currentY += 6;
  });

  if (displayRecords.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, 8, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("No attendance activity logged for this period.", margin + contentWidth / 2, currentY + 5.5, { align: "center" });
    currentY += 8;
  }

  // Footer: System Info & Sign-off Box
  currentY = Math.max(currentY + 6, pageHeight - 26);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Generated by Eyenit HR & Payroll Management System", margin, currentY);
  doc.text("Supervisor Signature / HR Verification: _______________________", pageWidth - margin, currentY, { align: "right" });

  currentY += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text("Official Corporate Document • Validated against biometric / digital log timestamps", margin, currentY);

  return doc;
};

/**
 * Direct file download trigger for Attendance Report PDF
 */
export const downloadAttendanceReportPDF = async (reportPayload) => {
  const data = normalizeAttendanceReportData(reportPayload);
  const doc = await generateAttendanceReportPDF(reportPayload);
  const sanitizedName = (data.employeeName || "Employee").replace(/\s+/g, "_");
  const fileName = `Attendance_Report_${sanitizedName}_${data.reportId}.pdf`;
  doc.save(fileName);
};
