import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Admin } from "../models/Admin.js";
import { CompanySettings } from "../models/CompanySettings.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { buildTenantScope } from "../utils/tenantScope.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { parseCSV } from "../utils/csvParser.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

// Helper for valid MongoDB ObjectId checking
const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

// Function to get all employees details directly from the database (Single-Tenant Global Access)
export const employeeDetails = async (req, res) => {
  try {
    let employees = [];

    try {
      employees = await Employee.find({
        role: { $nin: ["admin", "manager"] },
      })
        .select("-password")
        .sort({ createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.warn("DB find in employeeDetails:", dbErr.message);
    }

    // Format employee records cleanly for client consuming
    const enrichedEmployees = (employees || []).map((emp) => ({
      _id: emp._id,
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone || "+233 24 000 0000",
      department: emp.department || "General",
      position: emp.position || "Staff Member",
      baseSalary: Number(emp.baseSalary || 0),
      employmentType: emp.employmentType || "Full-time",
      employmentDate: emp.employmentDate || new Date(),
      role: emp.role || "employee",
      companyId: emp.companyId || emp.organizationId || null,
      organizationId: emp.organizationId || emp.companyId || null,
      profilePicture: emp.profilePicture || emp.profile_picture || emp.avatar || emp.profile_image_url || "",
      profile_picture: emp.profile_picture || emp.profilePicture || emp.avatar || emp.profile_image_url || "",
      avatar: emp.avatar || emp.profilePicture || emp.profile_image_url || "",
      profile_image_url: emp.profile_image_url || emp.avatar || emp.profilePicture || "",
      isActive: typeof emp.isActive === "boolean" ? emp.isActive : true,
      status: emp.status || (emp.isActive !== false ? "Active" : "Inactive"),
      location: emp.location || "Accra Head Office",
      emergencyContact: emp.emergencyContact || "+233 20 000 0000",
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
    }));

    res.status(200).json({
      success: true,
      count: enrichedEmployees.length,
      employees: enrichedEmployees,
    });
  } catch (error) {
    console.error("Error in employeeDetails:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve employee directory from database."),
    });
  }
};

// Function to get compact employee name list for dropdowns and filters
export const employeeNameList = async (req, res) => {
  try {
    const orgId = req.user?.organizationId || req.user?.companyId || req.companyId || req.organizationId;
    let employees = [];
    const query = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};
    try {
      employees = await Employee.find(query)
        .select("_id employeeId fullName department position email phone baseSalary organizationId companyId")
        .sort({ fullName: 1 })
        .lean();
    } catch (dbErr) {
      console.warn("DB find in employeeNameList:", dbErr.message);
    }

    res.status(200).json({
      success: true,
      employees: employees || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Get single employee profile by MongoDB _id, employeeId, or email
export const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId || req.user?.companyId || req.companyId || req.organizationId;
    let employee = null;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    if (isValidObjectId(id)) {
      employee = await Employee.findOne({ _id: id, ...orgQuery }).select("-password").lean();
    } else {
      employee = await Employee.findOne({
        $or: [{ employeeId: id }, { email: id }],
        ...orgQuery,
      }).select("-password").lean();
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found in this company workspace.",
      });
    }

    // Validate organization access to prevent cross-tenant data access
    validateOrganizationAccess(employee, req);

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Get logged-in employee profile for /me endpoint
export const getCurrentLoggedInEmployee = async (req, res) => {
  try {
    const rawId = req.employee?.id || req.employee?._id || req.user?._id || req.user?.id;
    const orgId = req.companyId || req.organizationId || req.employee?.companyId || req.employee?.organizationId;
    let employee = null;

    const orgFilter = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    if (isValidObjectId(rawId)) {
      employee = await Employee.findOne({ _id: rawId, ...orgFilter }).select("-password").lean();
    } else if (rawId) {
      employee = await Employee.findOne({
        $or: [{ employeeId: req.employee?.employeeId || rawId }, { email: rawId }],
        ...orgFilter,
      }).select("-password").lean();
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found in authenticated company workspace.",
      });
    }

    validateOrganizationAccess(employee, req);

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update logged-in employee profile
export const updateCurrentEmployee = async (req, res) => {
  try {
    const rawId = req.employee?.id || req.employee?._id;
    const orgId = req.user?.organizationId || req.user?.companyId || req.companyId || req.organizationId;
    const orgFilter = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};
    const { fullName, phone, avatar, profilePicture, profile_picture, profile_image_url } = req.body;
    let filter = {};

    if (isValidObjectId(rawId)) {
      filter = { _id: rawId, ...orgFilter };
    } else if (rawId) {
      filter = {
        $or: [{ employeeId: req.employee?.employeeId || rawId }, { email: rawId }],
        ...orgFilter,
      };
    } else if (orgId) {
      const active = await Employee.findOne({ isActive: true, ...orgFilter });
      if (active) filter = { _id: active._id };
      else {
        return res.status(404).json({
          success: false,
          message: "Employee profile not found.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access restricted: No company workspace identified for this request.",
      });
    }

    const updates = {};
    if (fullName) updates.fullName = fullName.trim();
    if (phone) updates.phone = phone.trim();
    const newAvatar = avatar || profilePicture || profile_picture || profile_image_url;
    if (newAvatar !== undefined) {
      updates.avatar = newAvatar;
      updates.profilePicture = newAvatar;
      updates.profile_picture = newAvatar;
      updates.profile_image_url = newAvatar;
    }

    const updated = await Employee.findOneAndUpdate(filter, { $set: updates }, { returnDocument: "after" })
      .select("-password")
      .lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Failed to find and update employee profile.",
      });
    }

    validateOrganizationAccess(updated, req);

    try {
      await logAuditAction({
        req,
        action: "UPDATE_PROFILE",
        category: "Employees",
        target: `${updated.fullName || updated.email} (${updated.employeeId || "Staff"})`,
        targetModel: "Employee",
        summary: `Updated profile information for employee ${updated.fullName || updated.email}.`,
        details: `Employee ID: ${updated.employeeId || "N/A"}, Phone: ${updated.phone || "N/A"}.`,
      });
    } catch (auditErr) {
      console.warn("[EmployeeProfile] Audit log warning:", auditErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      employee: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Export complete employee database to CSV for HR reporting purposes
export const exportEmployeesCSV = async (req, res) => {
  try {
    const { status, department } = req.query;
    const filter = {};

    if (status && status !== "all") {
      if (status === "active") {
        filter.$or = [{ status: "active" }, { status: { $exists: false }, isActive: { $ne: false } }];
      } else {
        filter.status = status;
      }
    }

    if (department && department !== "all") {
      filter.department = department;
    }

    const employees = await Employee.find(filter)
      .select("-password")
      .sort({ department: 1, fullName: 1 })
      .lean();

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
      "Basic Salary (GHS)",
      "Work Location",
      "System Role",
      "Emergency Contact Name",
      "Emergency Contact Phone",
      "Record Created Date",
    ];

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '""';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = (employees || []).map((emp) => {
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
        escapeCSV(Number(salaryVal).toFixed(2)),
        escapeCSV(emp.location || "Accra Head Office"),
        escapeCSV(emp.role || "employee"),
        escapeCSV(emp.emergencyContact || emp.emergencyName || "N/A"),
        escapeCSV(emp.emergencyPhone || emp.emergencyContactPhone || "N/A"),
        escapeCSV(createdStr),
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `workpulse_hr_employee_report_${dateStr}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("exportEmployeesCSV error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to export employee database to CSV."),
    });
  }
};

/**
 * Bulk upload employee records via CSV or pre-parsed dataset.
 * Supports file uploads (multipart/form-data), raw CSV text, or JSON payload.
 * Validates entries, prevents duplicate emails/IDs, hashes passwords,
 * synchronizes to User collection, and logs comprehensive audit history.
 */
export const bulkUploadEmployees = async (req, res) => {
  try {
    let rawRecords = [];

    // 1. File Upload (multipart/form-data with multer memory storage)
    if (req.file && req.file.buffer) {
      const csvString = req.file.buffer.toString("utf-8");
      rawRecords = parseCSV(csvString);
    }
    // 2. Direct CSV string in req.body
    else if (req.body.csvData || req.body.csvText) {
      rawRecords = parseCSV(req.body.csvData || req.body.csvText);
    }
    // 3. Pre-parsed JSON array
    else if (Array.isArray(req.body.employees)) {
      rawRecords = req.body.employees;
    } else if (Array.isArray(req.body.data)) {
      rawRecords = req.body.data;
    } else if (Array.isArray(req.body)) {
      rawRecords = req.body;
    }

    if (!rawRecords || rawRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No employee records could be parsed. Please ensure the CSV contains a valid header row and data rows.",
      });
    }

    // Resolve Target Company Workspace
    let targetOrgId =
      req.companyId ||
      req.organizationId ||
      req.user?.companyId ||
      req.user?.organizationId ||
      req.admin?.companyId ||
      req.admin?.organizationId ||
      null;

    if (!targetOrgId && mongoose.connection.readyState === 1) {
      try {
        const comp = await CompanySettings.findOne().lean();
        if (comp && comp._id) {
          targetOrgId = comp._id;
        } else {
          const newComp = await CompanySettings.create({
            companyName: "WorkPulse",
            name: "WorkPulse",
            slug: "workpulse",
          });
          targetOrgId = newComp._id;
        }
      } catch (err) {
        console.warn("[bulkUploadEmployees] fallback workspace lookup:", err.message);
      }
    }

    const defaultPassword = (req.body.defaultPassword || "Password@123").trim();

    // Fetch existing emails and employeeIds for fast O(1) conflict validation
    const existingEmployees = await Employee.find({}, { email: 1, employeeId: 1 }).lean();
    const existingEmails = new Set(
      existingEmployees.map((e) => (e.email || "").toLowerCase().trim()).filter(Boolean)
    );
    const existingEmployeeIds = new Set(
      existingEmployees.map((e) => (e.employeeId || "").trim()).filter(Boolean)
    );

    // Track intra-batch duplicates
    const batchEmails = new Set();
    const batchEmployeeIds = new Set();

    const createdEmployees = [];
    const failedRows = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const generateId = () => {
      let candidate = `EMP${Math.floor(1000 + Math.random() * 9000)}`;
      while (existingEmployeeIds.has(candidate) || batchEmployeeIds.has(candidate)) {
        candidate = `EMP${Math.floor(10000 + Math.random() * 90000)}`;
      }
      return candidate;
    };

    for (let i = 0; i < rawRecords.length; i++) {
      const row = rawRecords[i];
      const rowNum = row._rowNumber || i + 2;

      const fullName = (row.fullName || row.name || "").trim();
      const email = (row.email || "").toLowerCase().trim();
      let employeeId = (row.employeeId || "").trim();
      const phone = (row.phone || row.mobile || "").trim();
      const department = (row.department || "Operations & Support").trim();
      const position = (row.position || "Staff Member").trim();
      const employmentType = (row.employmentType || "Full-time").trim();
      const role = (row.role || "employee").toLowerCase().trim();
      const status = (row.status || "active").toLowerCase().trim();
      const location = (row.location || "Head Office").trim();
      const rawSalary = row.baseSalary || row.salary || 0;
      const parsedSalary = !isNaN(parseFloat(String(rawSalary).replace(/[^0-9.]/g, "")))
        ? Math.max(0, parseFloat(String(rawSalary).replace(/[^0-9.]/g, "")))
        : 0;

      const parsedEmploymentDate =
        row.employmentDate && !isNaN(new Date(row.employmentDate).getTime())
          ? new Date(row.employmentDate)
          : new Date();

      const password = (row.password || defaultPassword || "Password@123").trim();

      // Required validation: Full Name
      if (!fullName || fullName.length < 2) {
        failedRows.push({
          row: rowNum,
          name: fullName || "N/A",
          email: email || "N/A",
          employeeId: employeeId || "N/A",
          reason: "Full Name is required (minimum 2 characters).",
        });
        continue;
      }

      // Required validation: Email
      if (!email) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email: "N/A",
          employeeId: employeeId || "N/A",
          reason: "Email address is required.",
        });
        continue;
      }

      if (!emailRegex.test(email)) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email,
          employeeId: employeeId || "N/A",
          reason: `Invalid email address format "${email}".`,
        });
        continue;
      }

      // Intra-batch duplicate check
      if (batchEmails.has(email)) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email,
          employeeId: employeeId || "N/A",
          reason: `Duplicate email "${email}" found multiple times in this CSV file.`,
        });
        continue;
      }

      // Existing DB duplicate check
      if (existingEmails.has(email)) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email,
          employeeId: employeeId || "N/A",
          reason: `An employee with email "${email}" already exists in the system.`,
        });
        continue;
      }

      // Employee ID assignment & conflict check
      if (!employeeId) {
        employeeId = generateId();
      } else if (existingEmployeeIds.has(employeeId) || batchEmployeeIds.has(employeeId)) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email,
          employeeId,
          reason: `Employee ID "${employeeId}" is already assigned to another staff member.`,
        });
        continue;
      }

      const validRoles = ["employee", "manager", "hr", "admin"];
      const resolvedRole = validRoles.includes(role) ? role : "employee";

      try {
        const newEmp = await Employee.create({
          employeeId,
          fullName,
          email,
          password,
          phone: phone || "+233 24 000 0000",
          department,
          position,
          employmentType,
          employmentDate: parsedEmploymentDate,
          baseSalary: parsedSalary,
          role: resolvedRole,
          status: status === "inactive" ? "inactive" : "active",
          isActive: status !== "inactive",
          location,
          organizationId: targetOrgId,
          companyId: targetOrgId,
        });

        // Sync to User collection
        try {
          await User.findOneAndUpdate(
            { email },
            {
              fullName,
              name: fullName,
              email,
              password,
              role: resolvedRole,
              status: status === "inactive" ? "inactive" : "active",
              isActive: status !== "inactive",
              companyId: targetOrgId,
              organizationId: targetOrgId,
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
          );
        } catch (userErr) {
          console.warn("[bulkUploadEmployees] User sync warning:", userErr.message);
        }

        // If admin role assigned, also ensure Admin account entry exists
        if (resolvedRole === "admin") {
          try {
            const existingAdmin = await Admin.findOne({ email });
            if (!existingAdmin) {
              const adminHash = await bcrypt.hash(password, 10);
              await Admin.create({
                full_name: fullName,
                email,
                password_hash: adminHash,
                role: "admin",
                organizationId: targetOrgId,
              });
            }
          } catch (adminErr) {
            console.warn("[bulkUploadEmployees] Admin sync warning:", adminErr.message);
          }
        }

        batchEmails.add(email);
        existingEmails.add(email);
        batchEmployeeIds.add(employeeId);
        existingEmployeeIds.add(employeeId);

        createdEmployees.push({
          _id: newEmp._id,
          employeeId: newEmp.employeeId,
          fullName: newEmp.fullName,
          email: newEmp.email,
          phone: newEmp.phone,
          department: newEmp.department,
          position: newEmp.position,
          baseSalary: newEmp.baseSalary,
          role: newEmp.role,
          status: newEmp.status,
        });
      } catch (insertErr) {
        failedRows.push({
          row: rowNum,
          name: fullName,
          email,
          employeeId,
          reason: safeErrorMessage(insertErr, "Failed to save record to database."),
        });
      }
    }

    // Audit log
    if (createdEmployees.length > 0) {
      try {
        await logAuditAction({
          req,
          action: "BULK_IMPORT_EMPLOYEES",
          category: "Employees",
          target: `${createdEmployees.length} Employee Records`,
          targetModel: "Employee",
          summary: `Bulk imported ${createdEmployees.length} employee records from CSV.`,
          details: `Total processed: ${rawRecords.length}, Succeeded: ${createdEmployees.length}, Failed: ${failedRows.length}.`,
          metadata: {
            successCount: createdEmployees.length,
            failedCount: failedRows.length,
            sampleEmployees: createdEmployees.slice(0, 5).map((e) => `${e.fullName} (${e.employeeId})`),
          },
        });
      } catch (auditErr) {
        console.warn("[bulkUploadEmployees] Audit log warning:", auditErr.message);
      }
    }

    const message =
      createdEmployees.length > 0
        ? `Successfully imported ${createdEmployees.length} of ${rawRecords.length} employee records.` +
          (failedRows.length > 0 ? ` ${failedRows.length} rows were skipped due to errors.` : "")
        : `No employee records were imported. All ${failedRows.length} rows had validation errors.`;

    return res.status(createdEmployees.length > 0 ? 200 : 400).json({
      success: createdEmployees.length > 0,
      message,
      totalProcessed: rawRecords.length,
      importedCount: createdEmployees.length,
      failedCount: failedRows.length,
      importedEmployees: createdEmployees,
      failedRows,
    });
  } catch (error) {
    console.error("bulkUploadEmployees controller error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "An unexpected error occurred during bulk employee CSV upload."),
    });
  }
};

