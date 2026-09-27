import { Settings } from "../models/adminSettingsModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { AuditLog } from "../models/AuditLog.js";
import { getStandardizedLatenessTiers } from "../utils/latenessPenaltyCalculator.js";
import { inMemoryAuditLogs, logAuditAction } from "../utils/auditLogger.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { resolveWorkSchedule, refreshWorkingDays } from "../utils/workSchedule.js";

// In-memory fallback for penalty settings
let inMemoryPenaltySettings = {
  workStartTime: "08:00",
  workEndTime: "19:00",
  absenceDeductionRate: 15,
  lateTier1_amount: 10,
  lateTier2_amount: 30,
  lateTier3_amount: 50,
  lateTier4_amount: 75,
  lateTier5_amount: 100,
  lateTier6_amount: 150,
  latenessTiers: [
    { tier: 1, name: "Tier 1: 1–30 mins late", minMinutes: 1, maxMinutes: 30, fine: 10 },
    { tier: 2, name: "Tier 2: 31–60 mins late", minMinutes: 31, maxMinutes: 60, fine: 30 },
    { tier: 3, name: "Tier 3: 61–120 mins (1–2 hrs)", minMinutes: 61, maxMinutes: 120, fine: 50 },
    { tier: 4, name: "Tier 4: 121–180 mins (2–3 hrs)", minMinutes: 121, maxMinutes: 180, fine: 75 },
    { tier: 5, name: "Tier 5: 181–240 mins (3–4 hrs)", minMinutes: 181, maxMinutes: 240, fine: 100 },
    { tier: 6, name: "Tier 6: 241+ mins (4+ hrs)", minMinutes: 241, maxMinutes: 9999, fine: 150 },
  ],
  updatedAt: new Date(),
};

// Retrieve company penalty settings (absence rates & lateness tiers)
export const getPenaltySettings = async (req, res) => {
  try {
    let settingsDoc = null;
    const tenantId = req.organizationId || req.companyId;

    try {
      if (tenantId) {
        settingsDoc = await CompanySettings.findById(tenantId).lean();
        if (!settingsDoc) {
          settingsDoc = await CompanySettings.findOne({
            $or: [{ organizationId: tenantId }, { companyId: tenantId }],
          }).lean();
        }
      }
      if (!settingsDoc) {
        settingsDoc = await CompanySettings.findOne().lean();
      }

      if (!settingsDoc) {
        const created = await CompanySettings.create({
          ...inMemoryPenaltySettings,
        });
        settingsDoc = created.toObject ? created.toObject() : created;
      }
    } catch (dbErr) {
      console.warn("DB fallback for getPenaltySettings:", dbErr.message);
    }

    const rawSettings = settingsDoc || inMemoryPenaltySettings;
    const finalSettings = {
      ...rawSettings,
      latenessTiers: getStandardizedLatenessTiers(rawSettings),
    };

    return res.status(200).json({
      success: true,
      settings: finalSettings,
      penalties: finalSettings,
    });
  } catch (error) {
    console.error("Error in getPenaltySettings:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve penalty settings."),
    });
  }
};

// Update company penalty settings (Protected Admin route) with Audit Log recording
export const updatePenaltySettings = async (req, res) => {
  try {
    const tenantId = req.organizationId || req.companyId;

    const {
      workStartTime,
      absenceDeductionRate,
      lateTier1_amount,
      lateTier2_amount,
      lateTier3_amount,
      lateTier4_amount,
      lateTier5_amount,
      lateTier6_amount,
    } = req.body;

    // Fetch existing settings before applying update
    let currentSettings = inMemoryPenaltySettings;
    try {
      let dbDoc = null;
      if (tenantId) {
        dbDoc = await CompanySettings.findById(tenantId).lean();
        if (!dbDoc) {
          dbDoc = await CompanySettings.findOne({
            $or: [{ organizationId: tenantId }, { companyId: tenantId }],
          }).lean();
        }
      }
      if (!dbDoc) {
        dbDoc = await CompanySettings.findOne().lean();
      }
      if (dbDoc) {
        currentSettings = dbDoc;
      }
    } catch (dbErr) {
      console.warn("DB fetch previous settings fallback:", dbErr.message);
    }

    const parseAmount = (val, currentVal, fallback = 0) => {
      if (val !== undefined && val !== null && val !== "") {
        const n = Number(val);
        return isNaN(n) ? fallback : Math.max(0, n);
      }
      if (currentVal !== undefined && currentVal !== null && currentVal !== "") {
        const n = Number(currentVal);
        return isNaN(n) ? fallback : Math.max(0, n);
      }
      return fallback;
    };

    const t1 = parseAmount(lateTier1_amount, currentSettings.lateTier1_amount, 10);
    const t2 = parseAmount(lateTier2_amount, currentSettings.lateTier2_amount, 30);
    const t3 = parseAmount(lateTier3_amount, currentSettings.lateTier3_amount, 50);
    const t4 = parseAmount(lateTier4_amount, currentSettings.lateTier4_amount, 75);
    const t5 = parseAmount(lateTier5_amount, currentSettings.lateTier5_amount, 100);
    const t6 = parseAmount(lateTier6_amount, currentSettings.lateTier6_amount, 150);

    const latenessTiers = [
      { tier: 1, name: "Tier 1: 1–30 mins late", minMinutes: 1, maxMinutes: 30, fine: t1 },
      { tier: 2, name: "Tier 2: 31–60 mins late", minMinutes: 31, maxMinutes: 60, fine: t2 },
      { tier: 3, name: "Tier 3: 61–120 mins (1–2 hrs)", minMinutes: 61, maxMinutes: 120, fine: t3 },
      { tier: 4, name: "Tier 4: 121–180 mins (2–3 hrs)", minMinutes: 121, maxMinutes: 180, fine: t4 },
      { tier: 5, name: "Tier 5: 181–240 mins (3–4 hrs)", minMinutes: 181, maxMinutes: 240, fine: t5 },
      { tier: 6, name: "Tier 6: 241+ mins (4+ hrs)", minMinutes: 241, maxMinutes: 9999, fine: t6 },
    ];

    const payload = {
      workStartTime: workStartTime !== undefined ? String(workStartTime).trim() : currentSettings.workStartTime,
      absenceDeductionRate: parseAmount(absenceDeductionRate, currentSettings.absenceDeductionRate, 10),
      lateTier1_amount: t1,
      lateTier2_amount: t2,
      lateTier3_amount: t3,
      lateTier4_amount: t4,
      lateTier5_amount: t5,
      lateTier6_amount: t6,
      latenessTiers,
      updatedAt: new Date(),
    };

    // Calculate detailed diffs for Audit Trail
    const fieldLabels = {
      workStartTime: "Work Shift Start Time",
      absenceDeductionRate: "Unexcused Absence Rate (GH₵/day)",
      lateTier1_amount: "Tier 1 Penalty: 1-30 mins late (GH₵)",
      lateTier2_amount: "Tier 2 Penalty: 31-60 mins late (GH₵)",
      lateTier3_amount: "Tier 3 Penalty: 1-2 hrs late (GH₵)",
      lateTier4_amount: "Tier 4 Penalty: 2-3 hrs late (GH₵)",
      lateTier5_amount: "Tier 5 Penalty: 3-4 hrs late (GH₵)",
      lateTier6_amount: "Tier 6 Penalty: 4-5+ hrs late (GH₵)",
    };

    const changes = [];
    Object.keys(fieldLabels).forEach((key) => {
      const oldVal = currentSettings[key];
      const newVal = payload[key];
      if (oldVal !== undefined && newVal !== undefined && String(oldVal) !== String(newVal)) {
        changes.push({
          field: key,
          label: fieldLabels[key],
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    });

    let updatedDoc = null;
    try {
      const filter = tenantId ? { $or: [{ _id: tenantId }, { organizationId: tenantId }, { companyId: tenantId }] } : {};
      updatedDoc = await CompanySettings.findOneAndUpdate(
        filter,
        { $set: payload },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
      ).lean();
    } catch (dbErr) {
      console.warn("DB fallback for updatePenaltySettings:", dbErr.message);
    }

    inMemoryPenaltySettings = {
      ...inMemoryPenaltySettings,
      ...payload,
    };

    const finalResult = updatedDoc || inMemoryPenaltySettings;

    // Create Audit Log Record
    const adminUser = req.admin || {};
    const performedBy = {
      id: String(adminUser.id || adminUser._id || "admin_01"),
      name: adminUser.fullName || adminUser.full_name || "Administrator",
      email: adminUser.email || "admin@eyenit.com",
      role: adminUser.role || "admin",
    };

    const summaryText = changes.length > 0
      ? `Updated ${changes.length} attendance penalty rule(s): ${changes.map((c) => `${c.label} from '${c.oldValue}' to '${c.newValue}'`).join(", ")}`
      : "Saved attendance penalty rules without alterations.";

    try {
      const logEntry = await AuditLog.create({
        action: "UPDATE_ATTENDANCE_PENALTIES",
        category: "Penalties & Deductions",
        organizationId: tenantId || null,
        companyId: tenantId || null,
        performedBy,
        target: "Global Attendance Penalties",
        summary: summaryText,
        changes,
        metadata: {
          workStartTime: payload.workStartTime,
          absenceDeductionRate: payload.absenceDeductionRate,
          organizationId: tenantId || null,
        },
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Browser",
      });
      inMemoryAuditLogs.unshift(logEntry.toObject ? logEntry.toObject() : logEntry);
    } catch (auditErr) {
      console.warn("DB AuditLog creation fallback:", auditErr.message);
      inMemoryAuditLogs.unshift({
        _id: "audit_" + Date.now(),
        action: "UPDATE_ATTENDANCE_PENALTIES",
        category: "Penalties & Deductions",
        performedBy,
        target: "Global Attendance Penalties",
        summary: summaryText,
        changes,
        createdAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance deduction rules updated and synchronized across all active employees successfully.",
      settings: finalResult,
      penalties: finalResult,
      auditChangesCount: changes.length,
    });
  } catch (error) {
    console.error("Error in updatePenaltySettings:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to update penalty settings."),
    });
  }
};

// Retrieve Audit Logs with search & category filtering
export const getAuditLogs = async (req, res) => {
  try {
    const { category, search, limit = 50, page = 1 } = req.query;
    const query = {};
    const tenantId = req.organizationId || req.companyId;

    if (category && category !== "All") {
      query.category = category;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { summary: regex },
        { "performedBy.name": regex },
        { "performedBy.email": regex },
        { action: regex },
        { target: regex },
      ];
    }

    let logs = [];
    let total = 0;

    try {
      total = await AuditLog.countDocuments(query);
      logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean();
    } catch (dbErr) {
      console.warn("DB query for audit logs fallback:", dbErr.message);
      logs = inMemoryAuditLogs;
      total = logs.length;
    }

    return res.status(200).json({
      success: true,
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error in getAuditLogs:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve audit logs."),
    });
  }
};

// Get all settings
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    // Create default settings document if none exists
    if (!settings) {
      settings = await Settings.create({});
    }

    // Ensure companySettings singleton values are harmonized
    let compSettings = null;
    try {
      compSettings = await CompanySettings.getSettings();
    } catch {
      compSettings = null;
    }

    const settingsObj = settings.toObject ? settings.toObject() : { ...settings };
    if (!settingsObj.attendance) settingsObj.attendance = {};
    if (!settingsObj.company) settingsObj.company = {};

    // Same resolution the automatic absence processor uses, so every screen shows the real configured hours
    // (a configured 17:00 closing time is honoured; it was previously overridden to 19:00).
    const schedule = await resolveWorkSchedule();
    const resolvedStartTime = schedule.workStartTime;
    const resolvedEndTime = schedule.workEndTime;
    settingsObj.attendance.workingDays = schedule.workingDays;

    settingsObj.attendance.workStartTime = resolvedStartTime;
    settingsObj.attendance.workEndTime = resolvedEndTime;
    settingsObj.company.workStartTime = resolvedStartTime;
    settingsObj.company.workEndTime = resolvedEndTime;
    settingsObj.company.companyName = compSettings?.companyName || settingsObj.company.companyName || "WorkPulse";
    settingsObj.company.logo = compSettings?.logoUrl || compSettings?.logo || settingsObj.company.logo || "";
    settingsObj.company.email = compSettings?.contactEmail || compSettings?.email || settingsObj.company.email || "";
    settingsObj.company.phone = compSettings?.contactPhone || compSettings?.phone || settingsObj.company.phone || "";
    settingsObj.company.address = compSettings?.address || settingsObj.company.address || "";
    settingsObj.workStartTime = resolvedStartTime;
    settingsObj.workEndTime = resolvedEndTime;

    res.status(200).json({
      success: true,
      settings: settingsObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update company settings with Audit Log
export const updateCompanySettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { company: req.body } },
      { returnDocument: "after", upsert: true },
    );

    // Synchronize to CompanySettings singleton
    const compUpdate = {};
    if (req.body?.companyName || req.body?.name) {
      compUpdate.companyName = req.body.companyName || req.body.name;
      compUpdate.name = compUpdate.companyName;
    }
    if (req.body?.address !== undefined) compUpdate.address = req.body.address;
    if (req.body?.phone || req.body?.contactPhone) compUpdate.contactPhone = req.body.phone || req.body.contactPhone;
    if (req.body?.email || req.body?.contactEmail) compUpdate.contactEmail = req.body.email || req.body.contactEmail;
    if (req.body?.logo || req.body?.logoUrl) {
      compUpdate.logoUrl = req.body.logoUrl || req.body.logo;
      compUpdate.logo = compUpdate.logoUrl;
    }
    if (req.body?.workStartTime) compUpdate.workStartTime = req.body.workStartTime;
    if (req.body?.workEndTime) compUpdate.workEndTime = req.body.workEndTime;

    if (Object.keys(compUpdate).length > 0) {
      await CompanySettings.findOneAndUpdate({}, { $set: compUpdate }, { upsert: true });
    }

    // Harmonize work hours across attendance settings
    if (req.body?.workStartTime || req.body?.workEndTime) {
      const attUpdate = {};
      if (req.body.workStartTime) attUpdate["attendance.workStartTime"] = req.body.workStartTime;
      if (req.body.workEndTime) attUpdate["attendance.workEndTime"] = req.body.workEndTime;
      await Settings.updateOne({}, { $set: attUpdate });
    }

    const tenantId =
      req.organizationId ||
      req.companyId ||
      req.admin?.organizationId ||
      req.admin?.companyId ||
      req.user?.organizationId ||
      req.user?.companyId ||
      null;

    const adminUser = req.admin || req.user || {};
    const performedBy = {
      id: String(adminUser.id || adminUser._id || "admin_01"),
      name: adminUser.fullName || adminUser.full_name || "Administrator",
      email: adminUser.email || "admin@eyenit.com",
      role: adminUser.role || "admin",
    };

    const summaryText = `Updated Organization Settings: ${req.body?.name || req.body?.companyName || "Company profile"}`;
    const changes = Object.keys(req.body || {}).map((k) => ({
      field: k,
      label: k,
      oldValue: "Previous",
      newValue: req.body[k],
    }));

    try {
      const logEntry = await AuditLog.create({
        action: "UPDATE_COMPANY_SETTINGS",
        category: "Admin Settings",
        organizationId: tenantId || null,
        companyId: tenantId || null,
        performedBy,
        target: "Company Profile",
        summary: summaryText,
        changes,
        createdAt: new Date(),
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "Browser",
      });
      inMemoryAuditLogs.unshift(logEntry.toObject ? logEntry.toObject() : logEntry);
    } catch (e) {
      console.warn("Audit log creation error:", e.message);
      inMemoryAuditLogs.unshift({
        _id: "audit_" + Date.now(),
        action: "UPDATE_COMPANY_SETTINGS",
        category: "Admin Settings",
        organizationId: tenantId || null,
        companyId: tenantId || null,
        performedBy,
        target: "Company Profile",
        summary: summaryText,
        changes,
        createdAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Company settings updated successfully.",
      company: settings.company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update employee settings with Audit Log
export const updateEmployeeSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { employee: req.body } },
      { returnDocument: "after", upsert: true },
    );

    res.status(200).json({
      success: true,
      message: "Employee settings updated successfully.",
      employee: settings.employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update payroll settings
export const updatePayrollSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { payroll: req.body } },
      { returnDocument: "after", upsert: true },
    );

    res.status(200).json({
      success: true,
      message: "Payroll settings updated successfully.",
      payroll: settings.payroll,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update leave settings
export const updateLeaveSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { leave: req.body } },
      { returnDocument: "after", upsert: true },
    );

    res.status(200).json({
      success: true,
      message: "Leave settings updated successfully.",
      leave: settings.leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update attendance settings
export const updateAttendanceSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { attendance: req.body } },
      { returnDocument: "after", upsert: true },
    );

    // Also sync shift hours to company settings and CompanySettings singleton
    if (req.body?.workStartTime || req.body?.workEndTime) {
      const compUpdate = {};
      const companySubdocUpdate = {};
      if (req.body.workStartTime) {
        compUpdate.workStartTime = req.body.workStartTime;
        companySubdocUpdate["company.workStartTime"] = req.body.workStartTime;
      }
      if (req.body.workEndTime) {
        compUpdate.workEndTime = req.body.workEndTime;
        companySubdocUpdate["company.workEndTime"] = req.body.workEndTime;
      }
      await CompanySettings.updateOne({}, { $set: compUpdate });
      await Settings.updateOne({}, { $set: companySubdocUpdate });
    }

    // Working days drive rest days in payroll, dashboards and absence tracking
    await refreshWorkingDays({ force: true });

    res.status(200).json({
      success: true,
      message: "Attendance settings updated successfully.",
      attendance: settings.attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Update security settings
export const updateSecuritySettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { security: req.body } },
      { returnDocument: "after", upsert: true },
    );

    res.status(200).json({
      success: true,
      message: "Security settings updated successfully.",
      security: settings.security,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};
