import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { getCompanyLogoOrDefault, defaultLogo } from "./companyLogo";
import { getCompanyProfile } from "./companyProfile";

/**
 * Formats a numeric value into standard Ghana Cedis (GH₵) currency representation
 */
export const formatCurrency = (amount) => {
  const val = Number(amount) || 0;
  return `GH₵${val.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Formats a date string into readable human format (e.g. "24 August 2026")
 */
export const formatPayslipDate = (dateString) => {
  if (!dateString) {
    return new Date().toLocaleDateString("en-GH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-GH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

/**
 * Normalizes payslip record fields across various API payloads.
 * Missing values stay empty ("—" when displayed) rather than being invented.
 */
export const normalizePayslipData = (payslip = {}) => {
  const employeeName =
    payslip.employee?.fullName ||
    payslip.employeeName ||
    payslip.name ||
    "Employee";
  const employeeId =
    payslip.employee?.employeeId ||
    payslip.employeeId ||
    "";
  const department =
    payslip.employee?.department ||
    payslip.department ||
    "";
  const position =
    payslip.employee?.position ||
    payslip.position ||
    "";

  const payslipId =
    payslip.payslipNumber ||
    payslip.id ||
    (payslip._id ? `PAY-${String(payslip._id).slice(-6).toUpperCase()}` : "");

  const payPeriod =
    payslip.payMonth ||
    payslip.month ||
    "Current Pay Period";

  const paymentDate = payslip.paymentDate ? formatPayslipDate(payslip.paymentDate) : "";
  const dateGenerated = formatPayslipDate(new Date());

  const basicSalary = Number(
    payslip.breakdown?.baseSalary !== undefined
      ? payslip.breakdown.baseSalary
      : payslip.basicSalary !== undefined
      ? payslip.basicSalary
      : payslip.baseSalary !== undefined
      ? payslip.baseSalary
      : 0
  );

  // Dynamic mapped allowances
  let dynamicAllowances = [];
  if (Array.isArray(payslip.breakdown?.allowances)) {
    dynamicAllowances = payslip.breakdown.allowances.map((item) => ({
      description: item.title || item.description || item.name || "Allowance",
      amount: Number(item.amount || 0),
    }));
  } else if (Array.isArray(payslip.earnings) && payslip.earnings.length > 0) {
    dynamicAllowances = payslip.earnings.map((item) => ({
      description: item.description || item.name || item.label || "Allowance",
      amount: Number(item.amount || 0),
    }));
  } else if (Number(payslip.allowances || payslip.totalEarnings || 0) > 0) {
    dynamicAllowances = [
      {
        description: "Allowances",
        amount: Number(payslip.allowances || payslip.totalEarnings),
      },
    ];
  }

  // Dynamic mapped deductions
  let dynamicDeductions = [];
  if (Array.isArray(payslip.breakdown?.customDeductions)) {
    dynamicDeductions = payslip.breakdown.customDeductions.map((item) => ({
      description: item.title || item.description || item.name || "Adjustment",
      amount: Number(item.amount || 0),
    }));
  } else if (Array.isArray(payslip.deductions) && payslip.deductions.length > 0) {
    dynamicDeductions = payslip.deductions.map((item) => ({
      description: item.description || item.name || item.label || "Adjustment",
      amount: Number(item.amount || 0),
    }));
  } else if (
    typeof payslip.deductions === "number" &&
    Number(payslip.deductions) > 0
  ) {
    dynamicDeductions = [
      {
        description: "Other Deductions",
        amount: Number(payslip.deductions),
      },
    ];
  }

  // Absenteeism penalty (only the recorded amount/rate; no assumed rate)
  const absenceBreakdown = payslip.breakdown?.absenceDeduction || payslip.absenceDeduction || {};
  const absentDays = Number(absenceBreakdown.daysCount || payslip.absentDays || 0);
  const absentRate = Number(absenceBreakdown.ratePerDay ?? payslip.absenceRate ?? 0);
  const absentDaysDeduction = Number(
    absenceBreakdown.totalAmount !== undefined
      ? absenceBreakdown.totalAmount
      : (payslip.absentDaysDeduction || (absentDays > 0 && absentRate > 0 ? absentDays * absentRate : 0))
  );

  // Lateness penalty
  const latenessBreakdown = payslip.breakdown?.latenessDeduction || payslip.latenessDeduction || {};
  const totalLateMinutes = Number(latenessBreakdown.totalLateMinutes || 0);
  const lateDaysCount = Number(latenessBreakdown.lateDaysCount || 0);
  const tierBreakdown = Array.isArray(latenessBreakdown.tierBreakdown) ? latenessBreakdown.tierBreakdown : [];
  const latenessDeduction = Number(
    latenessBreakdown.totalAmount !== undefined
      ? latenessBreakdown.totalAmount
      : (typeof payslip.latenessDeduction === "number" ? payslip.latenessDeduction : 0)
  );

  const totalAllowances = dynamicAllowances.reduce(
    (acc, curr) => acc + curr.amount,
    0
  );
  const totalCustomDeductions = dynamicDeductions.reduce(
    (acc, curr) => acc + curr.amount,
    0
  );
  const totalDeductions =
    totalCustomDeductions + absentDaysDeduction + latenessDeduction;

  const netSalary = Number(
    payslip.breakdown?.netSalary !== undefined
      ? payslip.breakdown.netSalary
      : payslip.netSalary !== undefined
      ? payslip.netSalary
      : payslip.netPay !== undefined
      ? payslip.netPay
      : Math.max(0, basicSalary + totalAllowances - totalDeductions)
  );

  const status = payslip.status || "";

  return {
    payslipId,
    dateGenerated,
    employeeName,
    employeeId,
    department,
    position,
    payPeriod,
    paymentDate,
    status,
    basicSalary,
    dynamicAllowances,
    dynamicDeductions,
    absentDays,
    absentRate,
    absentDaysDeduction,
    totalLateMinutes,
    lateDaysCount,
    tierBreakdown,
    latenessDeduction,
    totalAllowances,
    totalDeductions,
    grossEarnings: basicSalary + totalAllowances,
    netSalary,
  };
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const wordsBelowThousand = (n) => {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n) parts.push("and");
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
};

const integerToWords = (n) => {
  if (n === 0) return "Zero";
  const scales = [["Billion", 1e9], ["Million", 1e6], ["Thousand", 1e3]];
  const parts = [];
  for (const [label, size] of scales) {
    if (n >= size) {
      parts.push(`${wordsBelowThousand(Math.floor(n / size))} ${label}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(wordsBelowThousand(n));
  return parts.join(" ");
};

/** e.g. 2350.5 → "Two Thousand Three Hundred and Fifty Ghana Cedis and Fifty Pesewas Only" */
export const amountInWords = (amount) => {
  const value = Math.max(0, Math.round((Number(amount) || 0) * 100));
  const cedis = Math.floor(value / 100);
  const pesewas = value % 100;
  let words = `${integerToWords(cedis)} Ghana Cedi${cedis === 1 ? "" : "s"}`;
  if (pesewas > 0) words += ` and ${integerToWords(pesewas)} Pesewa${pesewas === 1 ? "" : "s"}`;
  return `${words} Only`;
};

const statusStyle = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;";
  if (s === "pending" || s === "processing" || s === "draft") return "background:#fffbeb;color:#b45309;border:1px solid #fde68a;";
  if (s === "cancelled" || s === "failed" || s === "void") return "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;";
  return "background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;";
};

/**
 * Printable payslip HTML (used for PDF download, bulk export, printing and the on-screen preview).
 * @param {object} rawPayslip payroll record
 * @param {object} [options] { company: { companyName, address, email, phone, website }, logoUrl }
 */
export const generatePayslipHTML = (rawPayslip, options = {}) => {
  const data = normalizePayslipData(rawPayslip);
  const company = { ...getCompanyProfile(), ...(options.company || {}) };
  const companyName = company.companyName || "WorkPulse";
  const logo = options.logoUrl || getCompanyLogoOrDefault();
  const e = escapeHtml;
  const dash = (v) => (v ? e(v) : "—");

  const NAVY = "#002185";
  const ACCENT = "#ff5500";
  const BORDER = "#e2e8f0";
  const MUTED = "#64748b";
  const INK = "#0f172a";

  const contactLine = [company.phone, company.email, company.website].filter(Boolean).map(e).join("&nbsp;&nbsp;•&nbsp;&nbsp;");

  const row = (label, amount, { sub = "", bold = false } = {}) => `
    <tr>
      <td style="padding:9px 14px;border-bottom:1px solid ${BORDER};font-size:12.5px;color:${INK};${bold ? "font-weight:700;" : ""}">
        ${e(label)}${sub ? `<div style="font-size:10.5px;color:${MUTED};margin-top:2px;">${sub}</div>` : ""}
      </td>
      <td style="padding:9px 14px;border-bottom:1px solid ${BORDER};font-size:12.5px;text-align:right;white-space:nowrap;color:${INK};font-variant-numeric:tabular-nums;${bold ? "font-weight:700;" : "font-weight:600;"}">
        ${e(formatCurrency(amount))}
      </td>
    </tr>`;

  const emptyRow = (text) => `
    <tr><td colspan="2" style="padding:10px 14px;border-bottom:1px solid ${BORDER};font-size:11.5px;color:${MUTED};font-style:italic;">${e(text)}</td></tr>`;

  const earningsRows = [
    row("Basic Salary", data.basicSalary, { bold: true }),
    ...data.dynamicAllowances.map((a) => row(a.description, a.amount)),
  ].join("");

  const deductionParts = [];
  if (data.absentDaysDeduction > 0) {
    const sub = data.absentDays > 0
      ? `${data.absentDays} absent day${data.absentDays === 1 ? "" : "s"}${data.absentRate > 0 ? ` @ ${e(formatCurrency(data.absentRate))}/day` : ""}`
      : "";
    deductionParts.push(row("Absence Deduction", data.absentDaysDeduction, { sub }));
  }
  if (data.latenessDeduction > 0) {
    const detail = [
      data.lateDaysCount > 0 ? `${data.lateDaysCount} late day${data.lateDaysCount === 1 ? "" : "s"}` : "",
      data.totalLateMinutes > 0 ? `${data.totalLateMinutes} mins total` : "",
    ].filter(Boolean).join(", ");
    const tiers = data.tierBreakdown
      .map((t) => `${e(t.date || "")}: ${Number(t.minutesLate || 0)} mins – ${e(formatCurrency(t.penalty || t.total || 0))}`)
      .join("<br/>");
    deductionParts.push(row("Lateness Deduction", data.latenessDeduction, { sub: [e(detail), tiers].filter(Boolean).join("<br/>") }));
  }
  data.dynamicDeductions.forEach((d) => deductionParts.push(row(d.description, d.amount)));
  const deductionRows = deductionParts.length ? deductionParts.join("") : emptyRow("No deductions this period");

  const sectionTable = (title, rows, totalLabel, total, color) => `
    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:${color};border-bottom:2px solid ${color};">${e(title)}</th>
          <th style="padding:10px 14px;text-align:right;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};border-bottom:2px solid ${color};">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f8fafc;">
          <td style="padding:11px 14px;font-size:12px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;">${e(totalLabel)}</td>
          <td style="padding:11px 14px;font-size:13px;font-weight:800;color:${color};text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${e(formatCurrency(total))}</td>
        </tr>
      </tfoot>
    </table>`;

  const detail = (label, value) => `
    <td style="padding:8px 0;vertical-align:top;width:25%;">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${MUTED};">${e(label)}</div>
      <div style="font-size:12.5px;font-weight:700;color:${INK};margin-top:3px;">${value}</div>
    </td>`;

  const statusBadge = data.status
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;${statusStyle(data.status)}">${e(data.status)}</span>`
    : "—";

  return `
    <div id="corporate-payslip-document" style="width:794px;max-width:100%;margin:0 auto;background:#ffffff;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:${INK};box-sizing:border-box;border:1px solid ${BORDER};">
      <div style="height:6px;background:${NAVY};"></div>
      <div style="height:2px;background:${ACCENT};"></div>

      <div style="padding:30px 40px 34px;">
        <!-- Letterhead -->
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <table style="border-collapse:collapse;"><tr>
                <td style="vertical-align:middle;padding-right:14px;">
                  <div style="width:64px;height:64px;border:1px solid ${BORDER};border-radius:12px;padding:6px;box-sizing:border-box;background:#fff;">
                    <img src="${e(logo)}" alt="" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain;display:block;" />
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:${NAVY};line-height:1.2;">${e(companyName)}</div>
                  ${company.address ? `<div style="font-size:11px;color:${MUTED};margin-top:4px;max-width:330px;">${e(company.address)}</div>` : ""}
                  ${contactLine ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${contactLine}</div>` : ""}
                </td>
              </tr></table>
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:24px;font-weight:800;letter-spacing:4px;color:${NAVY};">PAYSLIP</div>
              <div style="font-size:12px;font-weight:700;color:${INK};margin-top:6px;">${e(data.payPeriod)}</div>
              ${data.payslipId ? `<div style="font-size:11px;color:${MUTED};margin-top:3px;font-family:Consolas,Menlo,monospace;">No. ${e(data.payslipId)}</div>` : ""}
            </td>
          </tr>
        </table>

        <div style="height:1px;background:${BORDER};margin:22px 0 16px;"></div>

        <!-- Employee & payment details -->
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            ${detail("Employee Name", e(data.employeeName))}
            ${detail("Employee ID", dash(data.employeeId))}
            ${detail("Department", dash(data.department))}
            ${detail("Position", dash(data.position))}
          </tr>
          <tr>
            ${detail("Pay Period", e(data.payPeriod))}
            ${detail("Payment Date", dash(data.paymentDate))}
            ${detail("Payslip No.", dash(data.payslipId))}
            ${detail("Status", statusBadge)}
          </tr>
        </table>

        <div style="height:1px;background:${BORDER};margin:16px 0 22px;"></div>

        <!-- Earnings & deductions -->
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:50%;vertical-align:top;padding-right:10px;">
              ${sectionTable("Earnings", earningsRows, "Gross Earnings", data.grossEarnings, "#047857")}
            </td>
            <td style="width:50%;vertical-align:top;padding-left:10px;">
              ${sectionTable("Deductions", deductionRows, "Total Deductions", data.totalDeductions, "#b91c1c")}
            </td>
          </tr>
        </table>

        <!-- Net pay -->
        <table style="width:100%;border-collapse:collapse;margin-top:22px;background:#f3f6fd;border:1px solid #d6def5;border-left:5px solid ${NAVY};">
          <tr>
            <td style="padding:16px 20px;vertical-align:middle;">
              <div style="font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${NAVY};">Net Pay</div>
              <div style="font-size:11px;color:${MUTED};margin-top:5px;font-style:italic;">${e(amountInWords(data.netSalary))}</div>
            </td>
            <td style="padding:16px 20px;text-align:right;vertical-align:middle;white-space:nowrap;">
              <div style="font-size:26px;font-weight:800;color:${NAVY};font-variant-numeric:tabular-nums;">${e(formatCurrency(data.netSalary))}</div>
              <div style="font-size:10.5px;color:${MUTED};margin-top:2px;">Gross ${e(formatCurrency(data.grossEarnings))} − Deductions ${e(formatCurrency(data.totalDeductions))}</div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table style="width:100%;border-collapse:collapse;margin-top:34px;border-top:1px solid ${BORDER};">
          <tr>
            <td style="padding-top:12px;font-size:10.5px;color:${MUTED};">
              This is a computer-generated payslip and does not require a signature.<br/>
              Please keep it confidential. Report any discrepancy to HR / Payroll.
            </td>
            <td style="padding-top:12px;font-size:10.5px;color:${MUTED};text-align:right;white-space:nowrap;vertical-align:top;">
              Generated ${e(data.dateGenerated)}<br/>${e(companyName)}
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
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
 * Generates an official, high-resolution vector PDF payslip using jsPDF
 */
export const generatePayslipPDF = async (rawPayslip) => {
  const data = normalizePayslipData(rawPayslip);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 18;

  // Try to load and embed company logo
  try {
    // Company logo from settings; fall back to the default image if it cannot be embedded
    const base64Logo =
      (await getBase64ImageFromUrl(getCompanyLogoOrDefault()).catch(() => null)) ||
      (await getBase64ImageFromUrl(defaultLogo).catch(() => null));
    if (base64Logo) {
      doc.addImage(base64Logo, "PNG", margin, currentY, 16, 16);
    }
  } catch (err) {
    console.warn("Could not embed logo in PDF:", err);
  }

  // Letterhead: company name + contacts on the left, PAYSLIP / period on the right
  const company = getCompanyProfile();
  const companyName = company.companyName || "WorkPulse";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 33, 133); // company navy #002185
  doc.text(companyName, margin + 20, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const contactLine = [company.phone, company.email, company.website].filter(Boolean).join("  •  ");
  if (company.address) doc.text(company.address, margin + 20, currentY + 11, { maxWidth: 110 });
  if (contactLine) doc.text(contactLine, margin + 20, currentY + (company.address ? 15 : 11));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 33, 133);
  doc.text("PAYSLIP", pageWidth - margin, currentY + 6, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(data.payPeriod, pageWidth - margin, currentY + 11.5, { align: "right" });
  if (data.payslipId) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`No. ${data.payslipId}`, pageWidth - margin, currentY + 16, { align: "right" });
  }

  currentY += 21;

  // Company navy rule with a thin accent line
  doc.setFillColor(0, 33, 133);
  doc.rect(margin, currentY, contentWidth, 1, "F");
  doc.setFillColor(255, 85, 0);
  doc.rect(margin, currentY + 1, contentWidth, 0.4, "F");

  currentY += 6;

  // Two-Column Metadata Box Grid
  const boxWidth = (contentWidth - 6) / 2;
  const boxHeight = 36;

  // Employee Information Box
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text("EMPLOYEE INFORMATION", margin + 4, currentY + 6);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, currentY + 8, margin + boxWidth - 4, currentY + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Name:", margin + 4, currentY + 14);
  doc.text("Employee ID:", margin + boxWidth / 2 + 2, currentY + 14);
  doc.text("Department:", margin + 4, currentY + 24);
  doc.text("Position:", margin + boxWidth / 2 + 2, currentY + 24);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName, margin + 4, currentY + 19);
  doc.text(data.employeeId || "—", margin + boxWidth / 2 + 2, currentY + 19);
  doc.text(data.department || "—", margin + 4, currentY + 29);
  doc.text(data.position || "—", margin + boxWidth / 2 + 2, currentY + 29);

  // Payment Information Box
  const rightBoxX = margin + boxWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightBoxX, currentY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text("PAYMENT INFORMATION", rightBoxX + 4, currentY + 6);
  doc.line(rightBoxX + 4, currentY + 8, rightBoxX + boxWidth - 4, currentY + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Pay Period:", rightBoxX + 4, currentY + 14);
  doc.text("Payment Date:", rightBoxX + boxWidth / 2 + 2, currentY + 14);
  doc.text("Status:", rightBoxX + 4, currentY + 24);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.payPeriod, rightBoxX + 4, currentY + 19);
  doc.text(data.paymentDate || "—", rightBoxX + boxWidth / 2 + 2, currentY + 19);

  // Status "Paid" in bold green #16a34a
  doc.setTextColor(22, 163, 74); // #16a34a
  doc.text(data.status || "—", rightBoxX + 4, currentY + 29);

  currentY += boxHeight + 8;

  // Table Headers (Clean bordered table with blue accent border #bfdbfe)
  const col1X = margin + 4;
  const col2X = pageWidth - margin - 4;
  const rowHeight = 8.5;

  // Header Row
  doc.setFillColor(240, 247, 255); // #f0f7ff
  doc.setDrawColor(191, 219, 254); // #bfdbfe
  doc.rect(margin, currentY, contentWidth, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text("ITEM DESCRIPTION", col1X, currentY + 5.5);
  doc.text("AMOUNT (GHS)", col2X, currentY + 5.5, { align: "right" });

  currentY += rowHeight;

  // Basic Salary Row
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Basic Salary", col1X, currentY + 5.5);
  doc.setTextColor(30, 58, 138);
  doc.text(formatCurrency(data.basicSalary), col2X, currentY + 5.5, { align: "right" });

  currentY += rowHeight;

  // Subheader: ADDITIONAL EARNINGS & ALLOWANCES (Green #059669)
  doc.setFillColor(236, 253, 245); // #ecfdf5
  doc.rect(margin, currentY, contentWidth, 7, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105); // #059669
  doc.text("ADDITIONAL EARNINGS & ALLOWANCES", col1X, currentY + 4.8);

  currentY += 7;

  // Allowances Items
  if (data.dynamicAllowances.length > 0) {
    data.dynamicAllowances.forEach((item) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(item.description, col1X, currentY + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(5, 150, 105);
      doc.text(`+${formatCurrency(item.amount)}`, col2X, currentY + 5.5, { align: "right" });
      currentY += rowHeight;
    });
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("No additional earnings recorded", col1X, currentY + 5.5);
    currentY += rowHeight;
  }

  // Subheader: DEDUCTIONS & ADJUSTMENTS (Red #dc2626)
  doc.setFillColor(254, 242, 242); // #fef2f2
  doc.rect(margin, currentY, contentWidth, 7, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38); // #dc2626
  doc.text("DEDUCTIONS & ADJUSTMENTS", col1X, currentY + 4.8);

  currentY += 7;

  // Deductions Items & Absenteeism penalty
  let hasDeductions = false;
  if (data.absentDaysDeduction > 0) {
    hasDeductions = true;
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Absence Deduction${data.absentDays > 0 ? ` (${data.absentDays} days${data.absentRate > 0 ? ` @ ${formatCurrency(data.absentRate)}/day` : ""})` : ""}`, col1X, currentY + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(data.absentDaysDeduction)}`, col2X, currentY + 5.5, { align: "right" });
    currentY += rowHeight;
  }

  if (data.latenessDeduction > 0) {
    hasDeductions = true;
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Lateness Penalties (${data.lateDaysCount} days, ${data.totalLateMinutes} total late mins)`, col1X, currentY + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(data.latenessDeduction)}`, col2X, currentY + 5.5, { align: "right" });
    currentY += rowHeight;

    if (data.tierBreakdown.length > 0) {
      data.tierBreakdown.slice(0, 5).forEach((t) => {
        doc.setFillColor(255, 252, 252);
        doc.rect(margin, currentY, contentWidth, 7, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`  • ${t.date || "Log"}: ${t.minutesLate || 0} mins late (${t.tier || "Tier fine"})`, col1X + 4, currentY + 4.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text(`-${formatCurrency(t.penalty || t.total || 0)}`, col2X, currentY + 4.8, { align: "right" });
        currentY += 7;
      });
    }
  }

  if (data.dynamicDeductions.length > 0) {
    hasDeductions = true;
    data.dynamicDeductions.forEach((item) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(item.description, col1X, currentY + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(`-${formatCurrency(item.amount)}`, col2X, currentY + 5.5, { align: "right" });
      currentY += rowHeight;
    });
  }

  if (!hasDeductions) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, rowHeight, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("No deductions or absenteeism penalties recorded", col1X, currentY + 5.5);
    currentY += rowHeight;
  }

  // NET SALARY Summary Footer Row (Highlighted slate background #f1f5f9, large bold navy net total)
  doc.setFillColor(241, 245, 249); // #f1f5f9
  doc.setDrawColor(30, 58, 138); // #1e3a8a top border
  doc.rect(margin, currentY, contentWidth, 12, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text("NET PAY", col1X, currentY + 7.5);

  doc.setFontSize(13);
  doc.text(formatCurrency(data.netSalary), col2X, currentY + 7.5, { align: "right" });

  currentY += 16;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(amountInWords(data.netSalary), margin, currentY, { maxWidth: contentWidth });

  currentY += 10;

  // Footer Note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("This is a computer-generated payslip and does not require a signature.", margin, currentY);
  doc.text(`Generated ${data.dateGenerated} • ${companyName}`, pageWidth - margin, currentY, { align: "right" });

  return doc;
};

/**
 * Renders a payslip record into an HTML canvas using html2canvas.
 * If targetElement is provided (e.g. an active card in the DOM), it captures that directly.
 * Otherwise, it creates a temporary off-screen container from generatePayslipHTML, captures it, and cleans up.
 */
export const renderPayslipToCanvas = async (rawPayslip, targetElement = null) => {
  let el = typeof targetElement === "string" ? document.getElementById(targetElement) : targetElement;
  let tempContainer = null;

  if (!el) {
    tempContainer = document.createElement("div");
    tempContainer.style.position = "fixed";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "0";
    tempContainer.style.width = "794px";
    tempContainer.style.background = "#ffffff";
    tempContainer.style.zIndex = "-9999";
    tempContainer.style.boxSizing = "border-box";
    tempContainer.innerHTML = generatePayslipHTML(rawPayslip);
    document.body.appendChild(tempContainer);
    el = tempContainer.querySelector("#corporate-payslip-document") || tempContainer;
  }

  // Make sure the company logo has loaded (or failed) so it is captured in the image
  await Promise.all(
    Array.from(el.querySelectorAll("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = () => {
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = defaultLogo;
              } else {
                resolve();
              }
            };
            setTimeout(resolve, 4000);
          })
    )
  );

  try {
    const canvas = await html2canvas(el, {
      scale: 2, // 2x high resolution for sharp PDF printing
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 1024,
      imageTimeout: 8000,
    });
    return canvas;
  } finally {
    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
  }
};

/**
 * Adds an HTML canvas of a payslip to a jsPDF instance, fitting neatly inside A4 dimensions.
 */
export const addPayslipCanvasToDoc = (canvas, doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10; // 10mm margin
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const imgWidth = availableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let finalWidth = imgWidth;
  let finalHeight = imgHeight;
  let finalX = margin;
  let finalY = margin;

  if (imgHeight > availableHeight) {
    const scaleFactor = availableHeight / imgHeight;
    finalHeight = availableHeight;
    finalWidth = imgWidth * scaleFactor;
    finalX = margin + (availableWidth - finalWidth) / 2;
  }

  const imgData = canvas.toDataURL("image/png", 1.0);
  doc.addImage(imgData, "PNG", finalX, finalY, finalWidth, finalHeight, undefined, "FAST");
  return doc;
};

/**
 * Download handler that saves an individual employee's official pay stub using html2canvas & jsPDF.
 */
export const downloadPayslipPDF = async (rawPayslip, targetElement = null) => {
  const data = normalizePayslipData(rawPayslip);
  try {
    const canvas = await renderPayslipToCanvas(rawPayslip, targetElement);
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    addPayslipCanvasToDoc(canvas, doc);

    const safeName = data.employeeName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safePeriod = data.payPeriod.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Payslip_${safeName}_${safePeriod}.pdf`;
    doc.save(fileName);
    return { success: true, fileName };
  } catch (canvasErr) {
    console.warn("html2canvas PDF generation failed, falling back to direct vector PDF:", canvasErr);
    // Programmatic vector fallback ensures download always succeeds
    const doc = await generatePayslipPDF(rawPayslip);
    const safeName = data.employeeName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safePeriod = data.payPeriod.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Payslip_${safeName}_${safePeriod}.pdf`;
    doc.save(fileName);
    return { success: true, fallback: true, fileName };
  }
};

/**
 * Downloads multiple employee payroll statements in a consolidated, multi-page PDF document
 * using html2canvas and jsPDF.
 *
 * @param {Array} payslipList - Array of payroll/payslip records
 * @param {Object} options - { onProgress: (progressObj) => void, fileName: string }
 */
export const downloadBulkPayslipsPDF = async (payslipList = [], options = {}) => {
  if (!Array.isArray(payslipList) || payslipList.length === 0) {
    throw new Error("No payroll records provided for bulk PDF download.");
  }

  const total = payslipList.length;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < total; i++) {
    const payslip = payslipList[i];
    const data = normalizePayslipData(payslip);

    if (typeof options.onProgress === "function") {
      options.onProgress({
        current: i + 1,
        total,
        percentage: Math.round(((i + 1) / total) * 100),
        employeeName: data.employeeName,
        payPeriod: data.payPeriod,
      });
    }

    // Add page for all records after the first
    if (i > 0) {
      doc.addPage();
    }

    try {
      const canvas = await renderPayslipToCanvas(payslip);
      addPayslipCanvasToDoc(canvas, doc);
    } catch (err) {
      console.warn(`Canvas render failed for ${data.employeeName}, generating direct vector fallback:`, err);
      // Fallback note on canvas render issue
      // If error occurs, create empty or minimal note
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(`Official Payslip - ${data.employeeName}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Period: ${data.payPeriod} • Net Salary: ${formatCurrency(data.netSalary)}`, 14, 28);
    }
  }

  const samplePeriod =
    normalizePayslipData(payslipList[0])?.payPeriod?.replace(/[^a-zA-Z0-9_-]/g, "_") || "Statements";
  const defaultFileName = `Bulk_Payslips_${samplePeriod}_${total}_Employees.pdf`;
  const fileName = options.fileName || defaultFileName;
  doc.save(fileName);

  return { success: true, count: total, fileName };
};


/**
 * Printable Window Handler for instant preview or physical print
 */
export const printPayslipDocument = (rawPayslip) => {
  const data = normalizePayslipData(rawPayslip);
  const content = generatePayslipHTML(rawPayslip);
  const printWindow = window.open("", "_blank", "width=850,height=1000");
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${escapeHtml(data.employeeName)} (${escapeHtml(data.payPeriod)})</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
              background: #f8fafc;
              margin: 0;
              padding: 24px;
              display: flex;
              justify-content: center;
            }
            .controls {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 10px;
              z-index: 100;
            }
            .btn {
              padding: 10px 18px;
              font-size: 13px;
              font-weight: bold;
              border-radius: 8px;
              cursor: pointer;
              border: none;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }
            .btn-primary { background: #002185; color: #ffffff; }
            .btn-secondary { background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; }
            @media print {
              body { background: #ffffff; padding: 0; }
              .controls { display: none !important; }
              #corporate-payslip-document { border: none !important; box-shadow: none !important; }
              @page { size: A4; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="controls">
            <button class="btn btn-secondary" onclick="window.close()">Close</button>
            <button class="btn btn-primary" onclick="window.print()">Print Payslip</button>
          </div>
          ${content}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
};
