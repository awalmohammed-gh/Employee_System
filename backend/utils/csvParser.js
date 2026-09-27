/**
 * Robust CSV parser for employee records.
 * Supports quotes, commas inside fields, CRLF/LF line endings,
 * UTF-8 BOM, and flexible header mapping.
 */

export const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== "string") return [];

  // Remove BOM if present
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
        i++; // skip next quote
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
        if (nextChar === "\n") {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else if (char === "\n") {
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }

  // Push remainder
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, "")
  );

  // Map header string to standard field
  const headerMap = {
    employeeId: [
      "employee id",
      "employeeid",
      "employee_id",
      "id",
      "staff id",
      "staffid",
      "emp id",
      "emp_id",
    ],
    fullName: [
      "full name",
      "fullname",
      "full_name",
      "name",
      "employee name",
      "staff name",
    ],
    email: ["email", "email address", "email_address", "work email"],
    phone: [
      "phone",
      "phone number",
      "phone_number",
      "mobile",
      "contact",
      "contact number",
    ],
    department: ["department", "dept"],
    position: [
      "position",
      "position / job title",
      "job title",
      "title",
      "role/title",
    ],
    baseSalary: [
      "basic salary",
      "base salary",
      "basic monthly salary (ghs)",
      "basic monthly salary",
      "base_salary",
      "basic_salary",
      "salary",
      "monthly salary",
    ],
    employmentDate: [
      "date joined",
      "employment date",
      "employment_date",
      "joining date",
      "hire date",
      "start date",
    ],
    employmentType: ["employment type", "employment_type", "type"],
    role: ["system role", "role"],
    status: ["employment status", "status"],
    password: ["password", "initial password", "default password"],
    location: ["work location", "location", "office"],
    emergencyContact: [
      "emergency contact name",
      "emergency contact",
      "emergency_contact",
    ],
    emergencyPhone: [
      "emergency contact phone",
      "emergency phone",
      "emergency_phone",
    ],
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

  const parsedObjects = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    let hasAnyData = false;

    row.forEach((val, idx) => {
      const field = indexToField[idx];
      if (field) {
        obj[field] = val;
        if (val) hasAnyData = true;
      }
    });

    if (hasAnyData) {
      obj._rowNumber = r + 1; // 1-indexed for clear user error reporting
      parsedObjects.push(obj);
    }
  }

  return parsedObjects;
};

export default parseCSV;
