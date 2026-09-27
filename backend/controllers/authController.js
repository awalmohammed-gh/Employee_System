import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { Attendance } from "../models/attendanceModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { liveAttendanceStore, autoCloseUnfinishedShifts } from "./employeeAttendance.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { normalizeRole } from "../utils/roles.js";

const getJwtSecret = () => process.env.JWT_SECRET || "default_jwt_secret_key_12345";

/**
 * Helper to check and verify if a user has an active, incomplete shift in the database immediately upon login
 */
export const verifyActiveIncompleteShift = async (employee) => {
  if (!employee) {
    return {
      hasActiveShift: false,
      activeShift: null,
      todayRecord: null,
      attendanceState: null,
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const todayStr = startOfToday.toISOString().split("T")[0];

  const empId = employee._id ? employee._id.toString() : employee.id ? employee.id.toString() : null;
  const empCode = employee.employeeId || "";
  const email = employee.email || "";

  // 1. Auto-close any lingering shift started before today that was never clocked out
  try {
    await autoCloseUnfinishedShifts(empId || empCode, employee);
  } catch (acErr) {
    console.warn("Could not auto-close stale shifts in verifyActiveIncompleteShift:", acErr.message);
  }

  let activeShift = null;
  let todayRecord = null;

  try {
    const activeShiftConditions = [
      ...(empId && mongoose.Types.ObjectId.isValid(empId) ? [{ employee: empId }] : []),
      ...(empCode ? [{ employeeId: empCode }] : []),
      ...(email ? [{ "employee.email": email }] : []),
    ];

    if (activeShiftConditions.length > 0) {
      activeShift = await Attendance.findOne({
        $or: activeShiftConditions,
        $and: [
          {
            $or: [{ date: todayStr }, { clockIn: { $gte: startOfToday, $lte: endOfToday } }],
          },
          {
            $or: [
              { clockIn: { $ne: null, $exists: true } },
              { clockInTime: { $ne: null, $exists: true } },
            ],
          },
          {
            $or: [{ clockOut: null }, { clockOut: { $exists: false } }],
          },
          {
            $or: [{ clockOutTime: null }, { clockOutTime: { $exists: false } }],
          },
          {
            shiftStatus: { $ne: "Auto-Closed" },
          },
        ],
      })
        .populate("employee", "fullName employeeId department position email avatar")
        .sort({ createdAt: -1 })
        .lean();

      todayRecord = await Attendance.findOne({
        $or: activeShiftConditions,
        $or: [{ date: todayStr }, { clockIn: { $gte: startOfToday, $lte: endOfToday } }],
      })
        .populate("employee", "fullName employeeId department position email avatar")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();
    }
  } catch (err) {
    console.warn("Error querying active shift in authController:", err.message);
  }

  // Check and sync with liveAttendanceStore in memory
  if (liveAttendanceStore) {
    const keysToCheck = [
      empId ? `${empId}_${todayStr}` : null,
      empCode ? `${empCode}_${todayStr}` : null,
    ].filter(Boolean);

    for (const key of keysToCheck) {
      const memRec = liveAttendanceStore.get(key);
      if (memRec && (!memRec.date || memRec.date === todayStr)) {
        if (!todayRecord) todayRecord = memRec;
        if (
          !activeShift &&
          (memRec.clockIn || memRec.clockInTime) &&
          !memRec.clockOut &&
          !memRec.clockOutTime &&
          memRec.shiftStatus !== "Auto-Closed"
        ) {
          activeShift = memRec;
        }
        break;
      }
    }

    if (activeShift && (activeShift.date === todayStr || !activeShift.date)) {
      if (empId) liveAttendanceStore.set(`${empId}_${todayStr}`, activeShift);
      if (empCode) liveAttendanceStore.set(`${empCode}_${todayStr}`, activeShift);
    }
  }

  if (activeShift && !todayRecord) {
    todayRecord = activeShift;
  }

  const hasActiveShift = Boolean(activeShift && (!activeShift.date || activeShift.date === todayStr));
  const primaryRecord =
    todayRecord && (!todayRecord.date || todayRecord.date === todayStr)
      ? todayRecord
      : hasActiveShift
      ? activeShift
      : null;

  const hasClockedIn = Boolean(
    hasActiveShift ||
      (primaryRecord &&
        (primaryRecord.clockIn || primaryRecord.clockInTime) &&
        (!primaryRecord.date || primaryRecord.date === todayStr))
  );
  const hasClockedOut = Boolean(
    !hasActiveShift &&
      primaryRecord &&
      (primaryRecord.clockOut || primaryRecord.clockOutTime) &&
      (!primaryRecord.date || primaryRecord.date === todayStr)
  );
  const isClockedIn = Boolean(hasActiveShift || (hasClockedIn && !hasClockedOut));
  const isClockedOut = hasClockedOut;

  const attendanceState = {
    hasActiveShift,
    hasClockedIn,
    hasClockedOut,
    isClockedIn,
    isClockedOut,
    isActiveShift: isClockedIn,
    clockIn: isClockedIn || hasClockedOut ? primaryRecord?.clockIn || primaryRecord?.clockInTime || null : null,
    clockOut: hasClockedOut ? primaryRecord?.clockOut || primaryRecord?.clockOutTime || null : null,
    status: primaryRecord?.status || (hasClockedIn ? "On Time" : "Not Clocked In"),
    workHours: Number(primaryRecord?.workHours || 0),
    delayMinutes: Number(primaryRecord?.delayMinutes ?? primaryRecord?.lateMinutes ?? 0),
    lateMinutes: Number(primaryRecord?.lateMinutes ?? primaryRecord?.delayMinutes ?? 0),
    latePenalty: Number(primaryRecord?.latePenalty ?? 0),
    penaltyTier: primaryRecord?.penaltyTier || "",
    lateReason: primaryRecord?.lateReason || primaryRecord?.notes || "",
    date: primaryRecord?.date || todayStr,
    shiftId: primaryRecord?._id || null,
  };

  return {
    hasActiveShift,
    activeShift: hasActiveShift ? activeShift : null,
    todayRecord: primaryRecord || null,
    attendance: primaryRecord || null,
    attendanceState,
  };
};

const generateAuthToken = (userPayload, expiresIn = "7d") => {
  return jwt.sign(userPayload, getJwtSecret(), { expiresIn });
};

/**
 * GET /api/auth/admin/exists
 */
export const checkAdminExists = async (_req, res) => {
  try {
    const adminCount = await Admin.countDocuments();
    return res.status(200).json({
      success: true,
      exists: adminCount > 0,
      count: adminCount,
    });
  } catch (error) {
    console.error("Error checking admin existence:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking admin status.",
    });
  }
};

/**
 * POST /api/auth/admin/register
 * Admin account registration.
 * Enforces security: prevents employee accounts from escalating to admin,
 * rejects duplicate email addresses, and validates password constraints.
 */
export const adminRegister = async (req, res) => {
  try {
    const { fullName, full_name, email, phone, password, confirmPassword } = req.body;
    const name = (fullName || full_name || "").trim();
    const cleanEmail = (email || "").toLowerCase().trim();
    const phoneNumber = (phone || "").trim();

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Email Address, and Password are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    // Security check: Prevent privilege escalation from regular employees
    const existingEmployee = await Employee.findOne({
      $or: [{ email: cleanEmail }, { "employee.email": cleanEmail }],
    });
    if (existingEmployee) {
      return res.status(403).json({
        success: false,
        message: "Access restricted. This email belongs to an employee account. Employees cannot register as an administrator.",
      });
    }

    const existingAdmin = await Admin.findOne({ email: cleanEmail });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "An Admin account with this email address already exists. Please log in.",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      full_name: name,
      email: cleanEmail,
      phone: phoneNumber,
      password_hash,
      role: "admin",
      profile_image_url: "",
    });

    const savedAdmin = await newAdmin.save();

    const token = generateAuthToken({
      id: savedAdmin._id.toString(),
      userId: savedAdmin._id.toString(),
      email: savedAdmin.email,
      role: savedAdmin.role || "admin",
      fullName: savedAdmin.full_name,
    });

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    };

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("token", token, cookieOptions);

    const safeAdmin = {
      _id: savedAdmin._id.toString(),
      id: savedAdmin._id.toString(),
      name: savedAdmin.full_name,
      fullName: savedAdmin.full_name,
      full_name: savedAdmin.full_name,
      email: savedAdmin.email,
      phone: savedAdmin.phone || phoneNumber,
      role: savedAdmin.role || "admin",
      department: "Executive Management",
      position: "Administrator",
      avatar: savedAdmin.profile_image_url || "",
      profile_image_url: savedAdmin.profile_image_url || "",
      dashboardUrl: "/admin/dashboard",
      permittedDashboardUrl: "/admin/dashboard",
      createdAt: savedAdmin.createdAt,
    };

    try {
      await logAuditAction({
        req,
        action: "ADMIN_REGISTER",
        category: "Authentication",
        target: "Admin Portal",
        targetModel: "Admin",
        summary: `New Administrator account created for '${savedAdmin.email}'.`,
        performedBy: {
          id: savedAdmin._id.toString(),
          name: safeAdmin.name,
          email: savedAdmin.email,
          role: "admin",
        },
      });
    } catch (auditErr) {
      console.warn("[AdminRegister] Audit log notice:", auditErr.message);
    }

    return res.status(201).json({
      success: true,
      token,
      dashboardUrl: "/admin/dashboard",
      permittedDashboardUrl: "/admin/dashboard",
      message: "Admin account registered successfully.",
      user: safeAdmin,
      admin: safeAdmin,
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to register admin account."),
    });
  }
};

/**
 * POST /api/auth/admin/login
 */
export const adminLogin = async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginEmail = (identifier || email || "").toLowerCase().trim();

    if (!loginEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address and password.",
      });
    }

    let targetAccount = await Admin.findOne({ email: loginEmail });
    if (!targetAccount) {
      targetAccount = await User.findOne({ email: loginEmail });
    }

    if (!targetAccount) {
      const emp = await Employee.findOne({
        $or: [{ email: loginEmail }, { employeeId: (identifier || email || "").trim() }],
      });
      if (emp && emp.password) {
        const isEmpMatch = await bcrypt.compare(password, emp.password);
        if (isEmpMatch) {
          return res.status(403).json({
            success: false,
            message: "Access restricted. Only Managers and Administrators may log in through this portal.",
          });
        }
      }

      return res.status(401).json({
        success: false,
        message: "Invalid credentials. No administrator account found matching this email.",
      });
    }

    const accountPassword = targetAccount.password_hash || targetAccount.password;
    const isMatch = await bcrypt.compare(password, accountPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please verify your password.",
      });
    }

    const role = normalizeRole(targetAccount.role, "admin");
    const token = generateAuthToken({
      id: targetAccount._id.toString(),
      userId: targetAccount._id.toString(),
      role,
      email: targetAccount.email,
      fullName: targetAccount.fullName || targetAccount.full_name || "Administrator",
    });

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    const remember = Boolean(req.body.rememberMe || req.body.rememberDevice);
    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
      path: "/",
    };

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("token", token, cookieOptions);

    const safeProfile = {
      _id: targetAccount._id.toString(),
      id: targetAccount._id.toString(),
      name: targetAccount.fullName || targetAccount.full_name || "Administrator",
      fullName: targetAccount.fullName || targetAccount.full_name || "Administrator",
      email: targetAccount.email,
      role,
      department: targetAccount.department || "Executive Management",
      position: targetAccount.position || (role === "manager" ? "Manager" : "Administrator"),
      avatar: targetAccount.avatar || targetAccount.profile_image_url || "",
      dashboardUrl: "/admin/dashboard",
      permittedDashboardUrl: "/admin/dashboard",
    };

    try {
      await logAuditAction({
        req,
        action: "MANAGER_LOGIN",
        category: "Authentication",
        target: "Admin Portal",
        targetModel: "Admin",
        summary: `Administrator '${targetAccount.email}' logged in successfully.`,
        performedBy: {
          id: targetAccount._id.toString(),
          name: safeProfile.name,
          email: targetAccount.email,
          role,
        },
      });
    } catch (auditErr) {
      console.warn("[AdminLogin] Audit log notice:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      token,
      dashboardUrl: "/admin/dashboard",
      permittedDashboardUrl: "/admin/dashboard",
      message: "Management login successful.",
      user: safeProfile,
      admin: safeProfile,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication.",
      error: safeErrorMessage(error, undefined),
    });
  }
};

/**
 * POST /api/auth/employee/login
 */
export const employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email / Employee ID and password are required.",
      });
    }

    const cleanInput = email.trim();
    const cleanEmail = cleanInput.toLowerCase();
    const cleanPassword = password.trim();

    let employee = await Employee.findOne({
      $or: [{ email: cleanEmail }, { employeeId: cleanInput }],
    }).select("+password");

    if (!employee) {
      const user = await User.findOne({ email: cleanEmail }).select("+password");
      if (user) employee = user;
    }

    if (!employee || !employee.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (employee.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your employee account has been suspended. Please contact Administrator.",
      });
    }

    if (employee.status === "inactive" || employee.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your employee account is inactive. Please contact Administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(cleanPassword, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const role = employee.role || "employee";
    const token = generateAuthToken({
      id: employee._id.toString(),
      userId: employee._id.toString(),
      employeeId: employee.employeeId,
      email: employee.email,
      role,
      fullName: employee.fullName,
    });

    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    };

    res.cookie("auth_token", token, cookieOptions);
    res.cookie("employeeToken", token, cookieOptions);
    res.cookie("token", token, cookieOptions);

    const safeEmployee = employee.toObject ? employee.toObject() : { ...employee };
    delete safeEmployee.password;
    safeEmployee.id = safeEmployee._id ? safeEmployee._id.toString() : safeEmployee.id;
    safeEmployee.name = safeEmployee.fullName || safeEmployee.name || "";
    safeEmployee.avatar = safeEmployee.avatar || safeEmployee.profilePicture || safeEmployee.profile_image_url || "";
    safeEmployee.dashboardUrl = "/employee/dashboard";
    safeEmployee.permittedDashboardUrl = "/employee/dashboard";

    const shiftVerification = await verifyActiveIncompleteShift(safeEmployee);

    try {
      await logAuditAction({
        req,
        action: "EMPLOYEE_LOGIN",
        category: "Authentication",
        target: `Employee: ${safeEmployee.name || safeEmployee.email}`,
        targetModel: "Employee",
        summary: `Employee '${safeEmployee.email}' logged in.`,
        performedBy: {
          id: safeEmployee.id,
          name: safeEmployee.name,
          email: safeEmployee.email,
          role,
        },
      });
    } catch (auditErr) {
      console.warn("[EmployeeLogin] Audit log notice:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      token,
      dashboardUrl: "/employee/dashboard",
      permittedDashboardUrl: "/employee/dashboard",
      message: shiftVerification.hasActiveShift
        ? "Employee login successful. You have an active ongoing shift."
        : "Employee login successful.",
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
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Internal server error during employee login."),
    });
  }
};

/**
 * POST /api/auth/login
 * Unified Login Endpoint
 */
export const unifiedLogin = async (req, res) => {
  try {
    const { identifier, email, role } = req.body;
    const cleanEmail = (identifier || email || "").toLowerCase().trim();

    if (role === "employee") {
      return employeeLogin(req, res);
    }

    const adminMatch = await Admin.findOne({ email: cleanEmail });
    if (adminMatch) {
      return adminLogin(req, res);
    }

    const empMatch = await Employee.findOne({
      $or: [{ email: cleanEmail }, { employeeId: (identifier || email || "").trim() }],
    });
    if (empMatch) {
      return employeeLogin(req, res);
    }

    return adminLogin(req, res);
  } catch (error) {
    console.error("Unified login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication.",
      error: safeErrorMessage(error, undefined),
    });
  }
};

/**
 * POST /api/auth/logout
 */
export const authLogout = async (_req, res) => {
  try {
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };

    res.clearCookie("auth_token", clearOptions);
    res.clearCookie("token", clearOptions);
    res.clearCookie("employeeToken", clearOptions);
    res.clearCookie("adminToken", clearOptions);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout error.",
    });
  }
};

/**
 * GET /api/auth/me
 */
export const getAuthMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token =
      req.cookies?.auth_token ||
      req.cookies?.token ||
      req.cookies?.employeeToken ||
      req.cookies?.adminToken ||
      bearerToken ||
      req.headers["x-admin-token"] ||
      req.headers["x-employee-token"] ||
      req.headers["x-auth-token"];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No active session token found.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session token.",
      });
    }

    if (!decoded || (!decoded.id && !decoded._id)) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const userId = decoded.id || decoded._id;

    let companyObj = null;
    let companyLogoUrl = "";
    try {
      const compSettings = await CompanySettings.findOne({}).lean();
      if (compSettings) {
        companyLogoUrl = compSettings.logoUrl || compSettings.logo || "";
        companyObj = {
          _id: compSettings._id,
          name: compSettings.companyName || "WorkPulse",
          companyName: compSettings.companyName || "WorkPulse",
          logoUrl: companyLogoUrl,
          companyLogoUrl,
          primaryColor: compSettings.primaryColor || "#0B1E48",
        };
      }
    } catch {
      // ignore
    }

    if (["admin", "manager", "company_admin"].includes(normalizeRole(decoded.role))) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        const dbAdmin = await Admin.findById(userId).select("-password_hash").lean();
        if (dbAdmin) {
          const adminAvatar = dbAdmin.avatarUrl || dbAdmin.profile_image_url || dbAdmin.avatar || "";
          const adminObj = {
            _id: dbAdmin._id.toString(),
            id: dbAdmin._id.toString(),
            name: dbAdmin.full_name,
            fullName: dbAdmin.full_name,
            email: dbAdmin.email,
            role: normalizeRole(dbAdmin.role, "admin"),
            department: "Executive Management",
            position: dbAdmin.role === "manager" ? "Manager" : "Administrator",
            avatar: adminAvatar,
            avatarUrl: adminAvatar,
            company: companyObj,
            companyLogoUrl,
          };
          return res.status(200).json({
            success: true,
            role: normalizeRole(dbAdmin.role, "admin"),
            user: adminObj,
            admin: adminObj,
            company: companyObj,
            companyLogoUrl,
          });
        }
      }

      const fallbackAdmin = {
        _id: userId,
        id: userId,
        name: decoded.fullName || "Administrator",
        fullName: decoded.fullName || "Administrator",
        email: decoded.email || "",
        role: normalizeRole(decoded.role, "admin"),
        department: "Executive Management",
        position: "Administrator",
        avatar: "",
        company: companyObj,
        companyLogoUrl,
      };

      return res.status(200).json({
        success: true,
        role: normalizeRole(decoded.role, "admin"),
        user: fallbackAdmin,
        admin: fallbackAdmin,
        company: companyObj,
        companyLogoUrl,
      });
    } else {
      let dbEmp = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        dbEmp = await Employee.findById(userId).select("-password").lean();
      }
      if (!dbEmp && decoded.employeeId) {
        dbEmp = await Employee.findOne({ employeeId: decoded.employeeId }).select("-password").lean();
      }
      if (!dbEmp && decoded.email) {
        dbEmp = await Employee.findOne({ email: decoded.email.toLowerCase() }).select("-password").lean();
      }

      if (dbEmp) {
        const empAvatar = dbEmp.profilePicture || dbEmp.avatar || dbEmp.profile_image_url || dbEmp.profile_picture || dbEmp.avatarUrl || "";
        const safeEmp = {
          ...dbEmp,
          _id: dbEmp._id.toString(),
          id: dbEmp._id.toString(),
          name: dbEmp.fullName || dbEmp.name || "",
          fullName: dbEmp.fullName || "",
          avatar: empAvatar,
          avatarUrl: empAvatar,
          role: dbEmp.role || "employee",
          company: companyObj,
          companyLogoUrl,
        };

        const shiftVerification = await verifyActiveIncompleteShift(safeEmp);

        return res.status(200).json({
          success: true,
          role: safeEmp.role || "employee",
          user: safeEmp,
          employee: safeEmp,
          company: companyObj,
          companyLogoUrl,
          hasActiveShift: shiftVerification.hasActiveShift,
          activeShift: shiftVerification.activeShift,
          todayRecord: shiftVerification.todayRecord,
          attendance: shiftVerification.attendance,
          attendanceState: shiftVerification.attendanceState,
        });
      }

      return res.status(404).json({
        success: false,
        message: "Employee record not found in database.",
      });
    }
  } catch (error) {
    console.error("getAuthMe error:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Server error resolving auth session."),
    });
  }
};

export default {
  adminRegister,
  adminLogin,
  employeeLogin,
  unifiedLogin,
  authLogout,
  getAuthMe,
  checkAdminExists,
  verifyActiveIncompleteShift,
};
