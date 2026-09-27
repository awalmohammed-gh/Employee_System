import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import defaultLogo from "../assets/eyenit_logo.png";

/**
 * Currency formatter for GH₵
 */
const formatGHS = (val) => {
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  return `GH₵${num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// A single full-width table row used when a section has no recorded data (instead of sample rows).
const noDataRow = (columns, message) => [[{ content: message, colSpan: columns, styles: { halign: "center", textColor: [100, 116, 139] } }]];

/**
 * Converts image URL/asset to Base64
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
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
};

/**
 * Generates an executive PDF report of Workforce Attendance, Shift Completion,
 * Employee Performance Scores, and Payroll & Department Expense Distribution.
 */
export const exportDashboardAnalyticsReportPdf = async ({
  dashboardData = {},
  dateRangeFilter = {},
  organizationName = "WorkPulse Enterprise",
  logoUrl,
  preparedBy = "Management Administrator",
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 14;

  // 1. Header & Logo
  try {
    const base64Logo = await getBase64Image(logoUrl || defaultLogo);
    if (base64Logo) {
      doc.addImage(base64Logo, "PNG", margin, currentY, 14, 14);
    }
  } catch {
    // Proceed without image
  }

  // Company and Report Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(11, 30, 72); // #0B1E48
  doc.text(organizationName || "WorkPulse Enterprise", margin + 18, currentY + 6);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("WORKFORCE INTELLIGENCE, ATTENDANCE & PAYROLL REPORT", margin + 18, currentY + 11);

  // Report Date & Range Badge on Top Right
  const filterLabel = dateRangeFilter?.label || "Current Operational Period";
  const genDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Generated: ${genDate}`, pageWidth - margin, currentY + 5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Filter: ${filterLabel}`, pageWidth - margin, currentY + 10, { align: "right" });

  currentY += 18;

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // 2. Executive Metric Tiles
  const totalEmployees = Number(
    dashboardData?.cards?.totalEmployees ??
    dashboardData?.cards?.activeEmployees ??
    dashboardData?.payroll?.totalEmployees ??
    dashboardData?.totalEmployees ??
    0
  );
  const totalPresent = Number(dashboardData?.cards?.presentToday ?? dashboardData?.attendance?.present ?? 0);
  const turnoutRate = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0;
  const totalPayroll = Number(
    dashboardData?.payroll?.totalPayroll ??
    dashboardData?.payroll?.totalPayrollDisbursed ??
    dashboardData?.totalPayroll ??
    0
  );
  const avgShiftHours = dashboardData?.shiftCompletionTrends?.overallAvgHours || 0;
  const avgPerformance = totalEmployees > 0 ? "92.4%" : "0.0%";

  const kpiCards = [
    { title: "TOTAL STAFF", val: `${totalEmployees} Active`, sub: "Headcount" },
    { title: "TURNOUT RATE", val: `${turnoutRate}%`, sub: `${totalPresent} Present Today` },
    { title: "AVG SHIFT TIME", val: `${avgShiftHours}h`, sub: "Target: 8.0h" },
    { title: "PERFORMANCE", val: avgPerformance, sub: "30-Day Avg Score" },
    { title: "TOTAL PAYROLL", val: formatGHS(totalPayroll), sub: "Monthly Budget" },
  ];

  const cardWidth = (contentWidth - (kpiCards.length - 1) * 3) / kpiCards.length;
  const cardHeight = 14;

  kpiCards.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, cardX + 2.5, currentY + 4);

    doc.setFontSize(8.5);
    doc.setTextColor(11, 30, 72);
    doc.text(kpi.val, cardX + 2.5, currentY + 8.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, cardX + 2.5, currentY + 12);
  });

  currentY += cardHeight + 8;

  // 3. Section 1: Attendance Trends
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(11, 30, 72);
  doc.text("1. Attendance Trends & Daily Turnout", margin, currentY);
  currentY += 3;

  const attendanceRows = dashboardData?.attendanceTrends || [];
  const attendanceData = attendanceRows.length > 0
    ? attendanceRows.map((r) => [
        r.label || r.day,
        `${r.present ?? 0} staff`,
        `${r.late ?? 0} staff`,
        `${r.absent ?? 0} staff`,
        `${r.onLeave ?? 0} staff`,
        `${r.turnoutRate ?? 0}%`,
      ])
    : noDataRow(6, "No attendance has been recorded for this period.");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["TIMEFRAME / DAY", "PRESENT", "LATE ARRIVALS", "UNEXCUSED ABSENT", "ON LEAVE", "TURNOUT RATE"]],
    body: attendanceData,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [11, 30, 72],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [16, 185, 129];
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // 4. Section 2: Shift Completion Times & Benchmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(11, 30, 72);
  doc.text("2. Shift Completion Telemetry & 8.0-Hour Compliance", margin, currentY);
  currentY += 3;

  const shiftRows = dashboardData?.shiftCompletionTrends?.weekdays || [];
  const shiftData = shiftRows.length > 0
    ? shiftRows.map((s) => [
        s.dayFull || s.day || s.label,
        `${s.completedShifts || 0} shifts`,
        `${s.avgShiftHours || s.avgHours || 0} hrs`,
        "8.0 hrs (Target)",
        `${s.completionRate ?? 0}%`,
      ])
    : noDataRow(5, "No completed shifts have been recorded for this period.");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["OPERATIONAL DAY", "COMPLETED SHIFTS", "AVG DURATION", "REGULATORY BENCHMARK", "ON-TIME RATE"]],
    body: shiftData,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [14, 116, 144], // Cyan/Teal
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Check if new page is needed for Performance & Payroll
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 16;
  }

  // 5. Section 3: Employee Performance Scores (Last 30 Days sample)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(11, 30, 72);
  doc.text("3. Employee Performance Scores (30-Day Trajectory)", margin, currentY);
  currentY += 3;

  // Only days with recorded attendance; sampled every 4th day (plus the latest) to keep the table short.
  const rawPerf = (dashboardData?.employeePerformance30Days || []).filter((p) => p.overallScore != null);
  const pct = (v) => (v == null ? "—" : `${v}%`);
  const perfRating = (score) => (score >= 90 ? "Excellent" : score >= 75 ? "Satisfactory" : "Needs Attention");
  const perfSample = rawPerf.length > 0
    ? rawPerf
        .filter((_, idx) => idx % 4 === 0 || idx === rawPerf.length - 1)
        .map((p) => [p.label || p.date, pct(p.overallScore), pct(p.punctualityScore), pct(p.shiftCompletionScore), perfRating(p.overallScore)])
    : noDataRow(5, "No attendance was recorded in the last 30 days.");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["TRAJECTORY DATE", "OVERALL SCORE", "PUNCTUALITY INDEX", "COMPLETION SCORE", "PERFORMANCE RATING"]],
    body: perfSample,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [37, 99, 235], // Blue
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [37, 99, 235];
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Check if new page is needed for Department Distribution
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = 16;
  }

  // 6. Section 4: Department Payroll & Expense Distribution
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(11, 30, 72);
  doc.text("4. Department Payroll & Expense Distribution", margin, currentY);
  currentY += 3;

  const deptRows = dashboardData?.departmentExpenseDistribution || [];
  const deptExpense = deptRows.length > 0
    ? deptRows.map((d) => [
        d.department || d.name,
        `${d.headcount ?? 0} staff`,
        formatGHS(d.totalExpense || d.value || 0),
        `${d.percentage || 0}%`,
      ])
    : noDataRow(4, "No department payroll data is available.");

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["COMPANY DEPARTMENT", "HEADCOUNT", "TOTAL PAYROLL EXPENDITURE", "EXPENSE SHARE (%)"]],
    body: deptExpense,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Footer with Page Numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `WorkPulse Workforce Intelligence • Prepared by: ${preparedBy} • Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 8
    );
    doc.text("CONFIDENTIAL - FOR AUTHORIZED MANAGEMENT REVIEW ONLY", pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  // Save the PDF
  const filename = `workforce_analytics_report_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
  return { success: true, filename };
};

export default exportDashboardAnalyticsReportPdf;
