/**
 * Comprehensive HR Reporting & Employee Database CSV Export Engine.
 * Handles character escaping, dates, salaries, filters, and UTF-8 BOM encoding
 * for seamless compatibility with Microsoft Excel, Google Sheets, Apple Numbers, and HRIS systems.
 */

const escapeCSV = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Trigger browser file download for a given Blob or CSV string.
 */
export const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Standard employee export (maintained for backward compatibility).
 */
export const exportEmployeesToCSV = (
  employeeList = [],
  filename = `employee_directory_${new Date().toISOString().split("T")[0]}.csv`
) => {
  return exportHREmployeeReportToCSV(employeeList, { filename });
};

/**
 * Full-featured HR Employee Database CSV Export with custom filtering and comprehensive auditing fields.
 */
export const exportHREmployeeReportToCSV = (
  employeeList = [],
  options = {}
) => {
  if (!employeeList || employeeList.length === 0) {
    return { success: false, message: "No employee records found to export.", count: 0 };
  }

  const {
    filterStatus = "all",
    filterDepartment = "all",
    reportType: _reportType = "full_audit", // "full_audit" | "directory"
    filename = `workpulse_hr_employee_report_${new Date().toISOString().split("T")[0]}.csv`,
  } = options;

  // 1. Apply filtering
  const filteredList = employeeList.filter((emp) => {
    const rawStatus = (emp.status || (emp.isActive !== false ? "active" : "inactive")).toLowerCase().trim();
    if (filterStatus !== "all" && rawStatus !== filterStatus.toLowerCase()) {
      return false;
    }
    if (filterDepartment !== "all" && (emp.department || "General").toLowerCase() !== filterDepartment.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (filteredList.length === 0) {
    return {
      success: false,
      message: "No employees match the selected filter criteria.",
      count: 0,
    };
  }

  // 2. Define Headers
  const headers = [
    "Employee ID",
    "Full Name",
    "Email Address",
    "Phone Number",
    "Department",
    "Position / Job Title",
    "Employment Type",
    "Employment Status",
    "Date Joined",
    "Basic Monthly Salary (GHS)",
    "Work Location",
    "System Role",
    "Emergency Contact Name",
    "Emergency Contact Phone",
    "Record Created Date",
  ];

  // 3. Map Rows
  const rows = filteredList.map((emp) => {
    const statusStr =
      emp.status || (emp.isActive !== false ? "Active" : "Inactive");

    const joinedStr = emp.employmentDate
      ? new Date(emp.employmentDate).toISOString().split("T")[0]
      : emp.joiningDate
      ? new Date(emp.joiningDate).toISOString().split("T")[0]
      : emp.createdAt
      ? new Date(emp.createdAt).toISOString().split("T")[0]
      : "N/A";

    const createdStr = emp.createdAt
      ? new Date(emp.createdAt).toISOString().split("T")[0]
      : "N/A";

    const salaryVal =
      emp.baseSalary !== undefined
        ? emp.baseSalary
        : emp.salary !== undefined
        ? emp.salary
        : emp.basicSalary !== undefined
        ? emp.basicSalary
        : 0;

    const numSalary = Number(salaryVal);
    const salaryFormatted = isNaN(numSalary) ? "0.00" : numSalary.toFixed(2);

    return [
      escapeCSV(emp.employeeId || "N/A"),
      escapeCSV(emp.fullName || ""),
      escapeCSV(emp.email || ""),
      escapeCSV(emp.phone || "N/A"),
      escapeCSV(emp.department || "General"),
      escapeCSV(emp.position || "Staff Member"),
      escapeCSV(emp.employmentType || "Full-time"),
      escapeCSV(statusStr),
      escapeCSV(joinedStr),
      escapeCSV(salaryFormatted),
      escapeCSV(emp.location || emp.officeLocation || "Accra Head Office"),
      escapeCSV(emp.role || "employee"),
      escapeCSV(emp.emergencyContact || emp.emergencyName || "N/A"),
      escapeCSV(emp.emergencyPhone || emp.emergencyContactPhone || "N/A"),
      escapeCSV(createdStr),
    ];
  });

  // 4. Prepend UTF-8 Byte Order Mark (\uFEFF)
  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);

  return {
    success: true,
    count: filteredList.length,
    filename,
    message: `Successfully exported ${filteredList.length} employee record${filteredList.length === 1 ? "" : "s"} to CSV.`,
  };
};

/**
 * Generates and triggers download of a standardized CSV template for bulk-adding employees.
 */
export const downloadEmployeeCsvTemplate = (filename = "workpulse_employee_bulk_import_template.csv") => {
  const headers = [
    "Employee ID",
    "Full Name",
    "Email Address",
    "Phone Number",
    "Department",
    "Position / Job Title",
    "Basic Monthly Salary (GHS)",
    "Employment Date",
    "Employment Type",
    "System Role",
    "Initial Password",
  ];

  const sampleRows = [
    [
      "EMP1001",
      "Kwesi Arthur",
      "kwesi.arthur@example.com",
      "+233 24 123 4567",
      "Software Engineering",
      "Senior Frontend Engineer",
      "4500.00",
      "2026-01-15",
      "Full-time",
      "employee",
      "Password@123",
    ],
    [
      "EMP1002",
      "Ama Osei",
      "ama.osei@example.com",
      "+233 20 987 6543",
      "Human Resources",
      "HR Specialist",
      "3800.00",
      "2026-02-01",
      "Full-time",
      "hr",
      "Password@123",
    ],
    [
      "EMP1003",
      "Kofi Mensah",
      "kofi.mensah@example.com",
      "+233 55 555 1234",
      "Finance & Accounting",
      "Financial Analyst",
      "4200.00",
      "2026-03-01",
      "Full-time",
      "employee",
      "Password@123",
    ],
  ];

  const escapeField = (v) => `"${String(v || "").replace(/"/g, '""')}"`;

  const csvContent =
    "\uFEFF" +
    [
      headers.map(escapeField).join(","),
      ...sampleRows.map((r) => r.map(escapeField).join(",")),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);

  return { success: true, filename };
};

/**
 * Client-side CSV text parser for employee records preview and validation.
 */
export const parseClientCSV = (csvText) => {
  if (!csvText || typeof csvText !== "string") return [];

  const cleanText = csvText.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== "")) rows.push(currentRow);
        currentRow = [];
        currentVal = "";
      } else if (char === "\n") {
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== "")) rows.push(currentRow);
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== "")) rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, "")
  );

  const headerMap = {
    employeeId: ["employee id", "employeeid", "employee_id", "id", "staff id", "staffid"],
    fullName: ["full name", "fullname", "full_name", "name", "employee name", "staff name"],
    email: ["email", "email address", "email_address", "work email"],
    phone: ["phone", "phone number", "phone_number", "mobile", "contact"],
    department: ["department", "dept"],
    position: ["position", "position / job title", "job title", "title"],
    baseSalary: ["basic salary", "base salary", "basic monthly salary (ghs)", "base_salary", "basic_salary", "salary"],
    employmentDate: ["date joined", "employment date", "employment_date", "joining date", "hire date"],
    employmentType: ["employment type", "employment_type", "type"],
    role: ["system role", "role"],
    status: ["employment status", "status"],
    password: ["password", "initial password", "default password"],
  };

  const indexToField = {};
  rawHeaders.forEach((header, idx) => {
    for (const [field, aliases] of Object.entries(headerMap)) {
      if (aliases.some((alias) => header === alias || header.includes(alias))) {
        if (!Object.values(indexToField).includes(field)) {
          indexToField[idx] = field;
          break;
        }
      }
    }
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmails = new Set();
  const parsedRecords = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record = {};
    let hasData = false;

    row.forEach((val, idx) => {
      const field = indexToField[idx];
      if (field) {
        record[field] = val;
        if (val) hasData = true;
      }
    });

    if (!hasData) continue;

    const rowNum = r + 1;
    const errors = [];

    const fullName = (record.fullName || "").trim();
    const email = (record.email || "").toLowerCase().trim();

    if (!fullName) errors.push("Full Name is required");
    else if (fullName.length < 2) errors.push("Full Name must be at least 2 chars");

    if (!email) errors.push("Email is required");
    else if (!emailRegex.test(email)) errors.push("Invalid email format");
    else if (seenEmails.has(email)) errors.push("Duplicate email in file");
    else seenEmails.add(email);

    parsedRecords.push({
      _rowNumber: rowNum,
      employeeId: (record.employeeId || "").trim(),
      fullName,
      email,
      phone: (record.phone || "").trim(),
      department: (record.department || "Operations & Support").trim(),
      position: (record.position || "Staff Member").trim(),
      baseSalary: record.baseSalary || "0.00",
      employmentDate: record.employmentDate || new Date().toISOString().split("T")[0],
      role: (record.role || "employee").toLowerCase().trim(),
      password: (record.password || "Password@123").trim(),
      _isValid: errors.length === 0,
      _errors: errors,
    });
  }

  return parsedRecords;
};

export default {
  exportEmployeesToCSV,
  exportHREmployeeReportToCSV,
  downloadEmployeeCsvTemplate,
  parseClientCSV,
  triggerDownload,
};
