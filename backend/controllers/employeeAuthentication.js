import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Admin } from "../models/Admin.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { verifyActiveIncompleteShift } from "./authController.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { createNotificationRecord } from "./notificationController.js";
import { safeErrorMessage } from "../utils/errorResponse.js";

const isValidObjectId = (id) =>
  id && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

// Create Employee / Staff User Account with Role Assignment (Admin-Restricted)
export const createEmployeeAccount = async (req, res) => {
  try {
    const {
      employeeId,
      fullName,
      email,
      password,
      phone,
      department,
      position,
      employmentDate,
      role,
      baseSalary,
    } = req.body;

    const assignedRole = (role || "employee").toLowerCase().trim();
    const cleanEmail = (email || "").toLowerCase().trim();
    const name = (fullName || "").trim();
    const plainPassword = (password || "").trim();
    const id = (employeeId || `EMP00${Math.floor(Math.random() * 900) + 100}`).trim();
    const parsedBaseSalary =
      baseSalary !== undefined && baseSalary !== "" && !isNaN(Number(baseSalary))
        ? Math.max(0, Number(baseSalary))
        : 0;

    // Validate input
    if (
      !id ||
      !name ||
      !cleanEmail ||
      !plainPassword ||
      !phone ||
      !department ||
      !position
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required (Employee ID, Full Name, Email, Password, Phone, Department, Position).",
      });
    }

    if (plainPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Resolve Tenant Workspace: from authenticated session or singleton CompanySettings
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
      } catch (compErr) {
        console.warn("[createEmployeeAccount] fallback workspace lookup:", compErr.message);
      }
    }

    const callerRole = (req.user?.role || req.admin?.role || "").toLowerCase();
    const isAllowedAdmin = [
      "admin",
      "company_admin",
      "manager",
    ].includes(callerRole);

    if (!isAllowedAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have administrative privileges to create employee accounts.",
      });
    }

    const orgQuery = targetOrgId
      ? { $or: [{ organizationId: targetOrgId }, { companyId: targetOrgId }] }
      : {};

    // Check if email or employee ID already exists in Employee DB (scoped to this specific company workspace)
    const existingEmail = await Employee.findOne({ email: cleanEmail, ...orgQuery });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "An employee with this email address already exists in this company workspace.",
      });
    }

    const existingEmployeeId = await Employee.findOne({ employeeId: id, ...orgQuery });
    if (existingEmployeeId) {
      return res.status(409).json({
        success: false,
        message: `Employee ID "${id}" is already assigned to another staff member in this company workspace.`,
      });
    }

    // Pass plainPassword to model; schema pre-save hook handles hashing safely without double-hashing
    const employee = await Employee.create({
      employeeId: id,
      fullName: name,
      email: cleanEmail,
      password: plainPassword,
      phone: phone.trim(),
      department: department.trim(),
      position: position.trim(),
      employmentDate: employmentDate ? new Date(employmentDate) : new Date(),
      baseSalary: parsedBaseSalary,
      role: assignedRole,
      status: "active",
      isActive: true,
      companyId: targetOrgId,
      organizationId: targetOrgId,
    });

    // Also sync to User collection
    try {
      await User.findOneAndUpdate(
        { email: cleanEmail, companyId: targetOrgId },
        {
          fullName: name,
          name: name,
          email: cleanEmail,
          password: plainPassword,
          role: assignedRole,
          status: "active",
          isActive: true,
          companyId: targetOrgId,
          organizationId: targetOrgId,
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    } catch (userSyncErr) {
      console.warn("User collection sync in createEmployeeAccount:", userSyncErr.message);
    }

    // If an administrator role is assigned, also ensure Admin account entry exists
    if (assignedRole === "admin") {
      const existingAdmin = await Admin.findOne({ email: cleanEmail });
      if (!existingAdmin) {
        const adminHash = await bcrypt.hash(plainPassword, 10);
        await Admin.create({
          full_name: name,
          email: cleanEmail,
          password_hash: adminHash,
          role: "admin",
          organizationId: targetOrgId,
        });
      }
    }

    const safeEmployee = employee.toObject ? employee.toObject() : employee;
    delete safeEmployee.password;

    // Log critical user action: Employee Creation
    try {
      await logAuditAction({
        req,
        action: "CREATE_EMPLOYEE",
        category: "Employees",
        target: `${name} (${id})`,
        targetModel: "Employee",
        summary: `Created employee profile for ${name} (${id}) in ${department.trim()} as ${position.trim()}.`,
        details: `Assigned role: ${assignedRole.toUpperCase()}, Base Salary: GHS ${parsedBaseSalary.toFixed(2)}, Contact: ${cleanEmail}.`,
        metadata: {
          employeeId: id,
          fullName: name,
          department: department.trim(),
          position: position.trim(),
          role: assignedRole,
          baseSalary: parsedBaseSalary,
          organizationId: targetOrgId,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log notice in createEmployeeAccount:", auditErr.message);
    }

    // Centralized Notification: Alert administrators about new employee registration
    try {
      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(req.admin?.id || req.admin?._id || "system"),
        sender_role: req.admin ? "admin" : "system",
        sender_name: req.admin?.fullName || "System Administration",
        title: `👤 New Employee Registered: ${name}`,
        message: `${name} (${id}) has joined the ${department.trim()} department as ${position.trim()}. Workspace access is active.`,
        type: "new_employee_registration",
        category: "system",
        priority: "high",
        action_url: "/admin/employees",
        action_label: "View Employees",
        organizationId: targetOrgId,
        companyId: targetOrgId,
        metadata: {
          employeeId: id,
          fullName: name,
          email: cleanEmail,
          department: department.trim(),
          position: position.trim(),
          role: assignedRole,
        },
      });
    } catch (notifErr) {
      console.warn("Notification error in createEmployeeAccount:", notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Account for ${name} (${assignedRole.toUpperCase()}) created successfully.`,
      employee: safeEmployee,
      credentials: {
        email: cleanEmail,
        employeeId: id,
        temporaryPassword: plainPassword,
        role: assignedRole,
        fullName: name,
      },
    });
  } catch (error) {
    console.error("Error creating employee account:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error creating employee."),
    });
  }
};

// Employee Login directly against MongoDB
export const employeeLogin = async (req, res) => {
  try {
    const { email, password, companySlug, workspaceSlug, companyId } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanInput = email.trim();
    const cleanEmail = cleanInput.toLowerCase();
    const cleanPassword = password.trim();
    const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key_12345";

    // Query real employee document from MongoDB
    let employee = await Employee.findOne({
      $or: [{ email: cleanEmail }, { employeeId: cleanInput }],
    }).select("+password");

    // Fallback search in User collection
    if (!employee) {
      const user = await User.findOne({ email: cleanEmail }).select("+password");
      if (user) {
        employee = user;
      }
    }

    if (!employee || !employee.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (employee.role === "admin" || employee.role === "manager") {
      return res.status(403).json({
        success: false,
        message: "Access restricted. Only Employees may log in through the Employee portal. Administrators and Managers must use the Admin portal.",
        code: "EMPLOYEE_PORTAL_ONLY",
      });
    }

    const employeeOrgId = employee.companyId
      ? String(employee.companyId)
      : (employee.organizationId ? String(employee.organizationId) : null);

    if (employee.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact HR or Administrator.",
      });
    }

    if (employee.status === "inactive" || employee.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact HR or Administrator.",
      });
    }

    const isPasswordMatch = await bcrypt.compare(cleanPassword, employee.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT strictly bound to the verified employee's company
    const orgId = employeeOrgId;
    const token = jwt.sign(
      {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        email: employee.email,
        role: employee.role || "employee",
        fullName: employee.fullName,
        companyId: orgId,
        organizationId: orgId,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    );

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    };

    // Save cookies (auth_token primary)
    res.cookie("auth_token", token, cookieOptions);
    res.cookie("employeeToken", token, cookieOptions);
    res.cookie("token", token, cookieOptions);

    const safeEmployee = employee.toObject ? employee.toObject() : employee;
    delete safeEmployee.password;
    safeEmployee.id = safeEmployee._id ? safeEmployee._id.toString() : safeEmployee.id;
    safeEmployee.name = safeEmployee.fullName || safeEmployee.name || "";
    safeEmployee.avatar = safeEmployee.avatar || safeEmployee.profilePicture || safeEmployee.profile_image_url || "";
    safeEmployee.companyId = orgId;
    safeEmployee.organizationId = orgId;

    // Verify if user has an active, incomplete shift in the database immediately upon login
    const shiftVerification = await verifyActiveIncompleteShift(safeEmployee);

    res.status(200).json({
      success: true,
      token,
      message: shiftVerification.hasActiveShift
        ? "Login successful. You have an active ongoing shift."
        : "Login successful.",
      user: safeEmployee,
      employee: safeEmployee,
      hasActiveShift: shiftVerification.hasActiveShift,
      activeShift: shiftVerification.activeShift,
      todayRecord: shiftVerification.todayRecord,
      attendance: shiftVerification.attendance,
      attendanceState: shiftVerification.attendanceState,
    });
  } catch (error) {
    console.error("Employee login error:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error during login."),
    });
  }
};

// Employee Logout
export const employeeLogout = async (req, res) => {
  try {
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };

    res.clearCookie("auth_token", clearOptions);
    res.clearCookie("employeeToken", clearOptions);
    res.clearCookie("token", clearOptions);

    res.status(200).json({
      success: true,
      message: "Employee logged out successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
};

// Employee Change Password
export const changeEmployeePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const rawId = req.employee?.id || req.employee?._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long.",
      });
    }

    let filter = {};
    if (isValidObjectId(rawId)) {
      filter = { _id: rawId };
    } else if (rawId) {
      filter = {
        $or: [{ employeeId: req.employee?.employeeId || rawId }, { email: rawId }],
      };
    } else {
      const active = await Employee.findOne({ isActive: true });
      if (active) filter = { _id: active._id };
      else {
        return res.status(404).json({
          success: false,
          message: "Employee account not found.",
        });
      }
    }

    const employee = await Employee.findOne(filter);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found.",
      });
    }

    if (employee.password) {
      const isMatch = await bcrypt.compare(currentPassword, employee.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
    }

    employee.password = newPassword;
    await employee.save();

    // Also update User collection if exists
    try {
      if (employee.email) {
        const userRec = await User.findOne({ email: employee.email });
        if (userRec) {
          userRec.password = newPassword;
          await userRec.save();
        }
      }
    } catch (uErr) {
      console.warn("User password sync warning:", uErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Error in changeEmployeePassword:", error);
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update password."),
    });
  }
};




