import { isSundayHoliday, SUNDAY_HOLIDAY_MESSAGE } from "../utils/attendanceHoliday.js";
import mongoose from "mongoose";
import { Attendance } from "../models/attendanceModel.js";
import { Employee } from "../models/employeeModel.js";
import { User } from "../models/userModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { createNotificationRecord } from "./notificationController.js";
import { evaluateLatenessPenalty, calculateLatenessPenalty } from "../utils/latenessPenaltyCalculator.js";
import { calculateWorkHours, parseTimeToMinutes, safeDateTime } from "../utils/calculateWorkHours.js";
import { validateOrganizationAccess } from "../utils/validateOrganizationAccess.js";
import { buildTenantScope } from "../utils/tenantScope.js";
import { safeErrorMessage } from "../utils/errorResponse.js";
import { ensureAbsencesProcessed, SYSTEM_ABSENCE_SOURCE } from "../services/absenceProcessor.js";
import { attendanceDateKey } from "../utils/attendanceDate.js";
import { resolveWorkSchedule } from "../utils/workSchedule.js";
import { Leave } from "../models/leaveModel.js";

const isValidObjectId = (id) =>
  id &&
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

// In-memory attendance storage for real-time reactivity & fast lookups
export const liveAttendanceStore = new Map();

// Helper to get active record for an employee today
export const getEmployeeLiveToday = (employeeId, todayStr) => {
  const key = `${employeeId}_${todayStr}`;
  return liveAttendanceStore.get(key) || null;
};

// Helper to resolve employee ObjectId
export const resolveEmployeeObjectId = async (idOrKey) => {
  if (!idOrKey) return null;
  try {
    if (isValidObjectId(idOrKey)) {
      const empDirect = await Employee.findById(idOrKey).select("_id").lean();
      if (empDirect) return empDirect._id.toString();

      // Check User model if idOrKey belonged to users collection
      const userDirect = await User.findById(idOrKey).select("email employeeId").lean();
      if (userDirect) {
        const empFromUser = await Employee.findOne({
          $or: [
            ...(userDirect.email ? [{ email: userDirect.email.toLowerCase() }] : []),
            ...(userDirect.employeeId ? [{ employeeId: userDirect.employeeId }] : []),
          ],
        }).select("_id").lean();
        if (empFromUser) return empFromUser._id.toString();
      }
      return idOrKey;
    }

    const emp = await Employee.findOne({
      $or: [{ employeeId: idOrKey }, { email: String(idOrKey).toLowerCase() }],
    }).select("_id").lean();
    return emp ? emp._id.toString() : null;
  } catch {
    return isValidObjectId(idOrKey) ? idOrKey : null;
  }
};

/**
 * Thoroughly resolves an employee's context from request, auth tokens, and database models.
 * Returns documents, canonical Employee ObjectId, and comprehensive candidate identifiers.
 */
export const resolveEmployeeInfo = async (req, rawId = null) => {
  const targetId = rawId || req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
  const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.user?.organizationId || req.employee?.companyId;
  const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};
  let employeeDoc = null;
  let userDoc = null;

  // 1. Direct Employee findOne if targetId is an ObjectId
  if (targetId && isValidObjectId(targetId)) {
    try {
      employeeDoc = await Employee.findOne({ _id: targetId, ...tenantScope })
        .select("fullName employeeId department position email avatar profile_picture baseSalary salary companyId organizationId")
        .lean();
    } catch {
      // ignore
    }
    if (!employeeDoc) {
      try {
        userDoc = await User.findOne({ _id: targetId, ...tenantScope }).select("-password").lean();
      } catch {
        // ignore
      }
    }
  }

  // 2. Lookup Employee by email if not resolved yet
  const emailCandidate = (
    userDoc?.email ||
    req.user?.email ||
    req.employee?.email ||
    (targetId && !isValidObjectId(targetId) && String(targetId).includes("@") ? String(targetId) : "")
  )
    .toLowerCase()
    .trim();

  if (!employeeDoc && emailCandidate) {
    try {
      employeeDoc = await Employee.findOne({ email: emailCandidate, ...tenantScope })
        .select("fullName employeeId department position email avatar profile_picture baseSalary salary companyId organizationId")
        .lean();
    } catch {
      // ignore
    }
  }

  // 3. Lookup Employee by employeeId code if not resolved yet
  const codeCandidate = String(
    req.employee?.employeeId ||
    req.user?.employeeId ||
    userDoc?.employeeId ||
    (targetId && !isValidObjectId(targetId) ? targetId : "")
  ).trim();

  if (!employeeDoc && codeCandidate) {
    try {
      employeeDoc = await Employee.findOne({
        ...tenantScope,
        $or: [{ employeeId: codeCandidate }, { employeeId: codeCandidate.toUpperCase() }],
      })
        .select("fullName employeeId department position email avatar profile_picture baseSalary salary companyId organizationId")
        .lean();
    } catch {
      // ignore
    }
  }

  // 4. Assemble candidate ObjectIds
  const rawIdCandidates = [
    employeeDoc?._id,
    userDoc?._id,
    targetId,
    req.user?._id,
    req.user?.id,
    req.employee?._id,
    req.employee?.id,
  ].filter((id) => id && isValidObjectId(id));

  const uniqueIdStrs = Array.from(new Set(rawIdCandidates.map((id) => id.toString())));
  const objectIdList = uniqueIdStrs.map((id) => new mongoose.Types.ObjectId(id));

  // Assemble candidate employee codes
  const codeCandidates = Array.from(
    new Set(
      [
        employeeDoc?.employeeId,
        userDoc?.employeeId,
        req.user?.employeeId,
        req.employee?.employeeId,
        codeCandidate,
      ]
        .filter(Boolean)
        .map((c) => String(c).trim())
    )
  );

  const employeeObjectId = employeeDoc?._id
    ? employeeDoc._id.toString()
    : uniqueIdStrs[0] || null;

  const employeeCode = employeeDoc?.employeeId || codeCandidates[0] || "";

  return {
    employeeDoc,
    userDoc,
    employeeObjectId,
    employeeCode,
    idCandidates: objectIdList,
    idCandidateStrings: uniqueIdStrs,
    codeCandidates,
  };
};

/**
 * Automatically closes any open/unfinished attendance records belonging to an employee
 * from prior calendar days where clockOut is null.
 *
 * Runs before evaluating today's attendance status or processing new clock-ins.
 * Sets shiftStatus: 'Auto-Closed', notes: 'Shift auto-closed at midnight due to missing clock-out'.
 */
export const autoCloseUnfinishedShifts = async (employeeIdentifier, rawAuthUser = null) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayDateStr = startOfToday.toISOString().split("T")[0];

    const idCandidates = [];
    const codeCandidates = [];
    const emailCandidates = [];

    if (employeeIdentifier) {
      if (isValidObjectId(employeeIdentifier)) {
        idCandidates.push(new mongoose.Types.ObjectId(employeeIdentifier));
      } else if (typeof employeeIdentifier === "string" && employeeIdentifier.includes("@")) {
        emailCandidates.push(employeeIdentifier.toLowerCase().trim());
      } else {
        codeCandidates.push(String(employeeIdentifier).trim());
      }
    }

    if (rawAuthUser) {
      const authId = rawAuthUser._id || rawAuthUser.id;
      if (authId && isValidObjectId(authId)) {
        idCandidates.push(new mongoose.Types.ObjectId(authId));
      }
      if (rawAuthUser.employeeId) {
        codeCandidates.push(String(rawAuthUser.employeeId).trim());
      }
      if (rawAuthUser.email) {
        emailCandidates.push(String(rawAuthUser.email).toLowerCase().trim());
      }
    }

    // Probe User model if an auth user ID was passed to retrieve linked employeeId and email
    for (const rawId of [...idCandidates]) {
      try {
        const u = await User.findById(rawId).select("email employeeId").lean();
        if (u) {
          if (u.email) emailCandidates.push(u.email.toLowerCase().trim());
          if (u.employeeId) codeCandidates.push(String(u.employeeId).trim());
        }
      } catch {}
      try {
        const e = await Employee.findById(rawId).select("email employeeId").lean();
        if (e) {
          if (e.email) emailCandidates.push(e.email.toLowerCase().trim());
          if (e.employeeId) codeCandidates.push(String(e.employeeId).trim());
        }
      } catch {}
    }

    // Look up Employee records matching any of the candidate IDs, codes, or emails
    if (codeCandidates.length > 0 || idCandidates.length > 0 || emailCandidates.length > 0) {
      try {
        const empDocs = await Employee.find({
          $or: [
            ...(idCandidates.length > 0 ? [{ _id: { $in: idCandidates } }] : []),
            ...(codeCandidates.length > 0 ? [{ employeeId: { $in: codeCandidates } }] : []),
            ...(emailCandidates.length > 0 ? [{ email: { $in: emailCandidates } }] : []),
          ],
        }).select("_id employeeId email").lean();

        for (const emp of empDocs) {
          if (emp._id) idCandidates.push(emp._id);
          if (emp.employeeId) codeCandidates.push(emp.employeeId);
          if (emp.email) emailCandidates.push(emp.email.toLowerCase().trim());
        }
      } catch {
        // ignore lookup errors
      }
    }

    const uniqueIds = Array.from(new Set(idCandidates.map((id) => id.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const uniqueCodes = Array.from(new Set(codeCandidates.filter(Boolean)));

    const orClauses = [];
    if (uniqueIds.length > 0) {
      orClauses.push({ employee: { $in: uniqueIds } });
    }
    if (uniqueCodes.length > 0) {
      orClauses.push({ employeeId: { $in: uniqueCodes } });
    }

    if (orClauses.length === 0) return { modifiedCount: 0, forceClosed: false, records: [] };

    // Auto force-close any lingering shift started before today that was never clocked out
    const staleRecords = await Attendance.find({
      $and: [
        { $or: orClauses },
        {
          $or: [
            { clockOut: null },
            { clockOut: { $exists: false } },
            { clockOut: "" },
            { clockOutTime: null },
            { clockOutTime: { $exists: false } },
            { clockOutTime: "" },
            { shiftStatus: { $in: ["In-Progress", "In Progress", "Active", "active"] } },
          ],
        },
        {
          $or: [
            { clockIn: { $lt: startOfToday } },
            { date: { $lt: todayDateStr } },
          ],
        },
      ],
    });

    let modifiedCount = 0;
    const forceClosedRecords = [];
    for (const record of staleRecords) {
      const inTime = record.clockIn ? new Date(record.clockIn) : (record.date ? new Date(`${record.date}T08:00:00`) : startOfToday);
      let closeTime = new Date(inTime);
      closeTime.setHours(19, 30, 0, 0);
      if (closeTime.getTime() <= inTime.getTime()) {
        closeTime = new Date(inTime.getTime() + 8 * 60 * 60 * 1000);
      }
      if (closeTime > startOfToday) {
        closeTime = new Date(startOfToday.getTime() - 1000);
      }

      const diffMs = Math.max(0, closeTime.getTime() - inTime.getTime());
      const hoursWorked = Math.min(12, Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(2))));

      record.clockOut = closeTime;
      record.clockOutTime = closeTime;
      record.autoClockedOut = true;
      record.shiftStatus = "Auto-Closed";
      if (record.status !== "Late") {
        record.status = "Auto-Closed";
      }
      record.workHours = record.workHours > 0 ? record.workHours : hoursWorked;
      record.autoClosedAt = new Date();
      const forceNote = "Shift force-closed due to unclosed session from previous day upon next clock-in";
      record.notes = record.notes ? `${record.notes} | ${forceNote}` : forceNote;

      await record.save();
      modifiedCount++;
      forceClosedRecords.push(record);
    }

    // Clean up stale in-memory store records for this employee for dates before today
    if (liveAttendanceStore) {
      for (const [k, val] of liveAttendanceStore.entries()) {
        const valDate = val?.date || (val?.clockIn ? new Date(val.clockIn).toISOString().split("T")[0] : "");
        if (valDate && valDate !== todayDateStr) {
          liveAttendanceStore.delete(k);
        }
      }
    }

    if (modifiedCount > 0) {
      console.log(
        `[Attendance] Force clock-out: Auto-closed ${modifiedCount} incomplete session(s) from previous day(s) for employee (${uniqueCodes.join(", ") || uniqueIds.join(", ")}).`
      );
    }

    return { modifiedCount, forceClosed: modifiedCount > 0, records: forceClosedRecords };
  } catch (err) {
    console.warn("[Attendance] Error in autoCloseUnfinishedShifts:", err.message);
    return { modifiedCount: 0, forceClosed: false, records: [] };
  }
};

export const forceClockOutPreviousDaySessions = autoCloseUnfinishedShifts;

/**
 * Automated 7:30 PM (19:30) Shift Auto-Close Logic
 *
 * If an employee clocked in during the day but has not manually clocked out
 * by 7:30 PM (19:30), the system automatically clocks them out.
 *
 * Sets clockOut to the 19:30 threshold (or current timestamp),
 * marks autoClockedOut: true,
 * transitions shiftStatus to "Completed",
 * records notes: "Auto Clocked Out by System (Missed manual clock-out)",
 * and calculates accurate workHours based on clockIn.
 */
export const autoCloseEveningPastGracePeriod = async (targetEmployeeId = null) => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if current server time is >= 19:30 (7:30 PM)
    const isPastGracePeriod = currentHour > 19 || (currentHour === 19 && currentMinute >= 30);
    if (!isPastGracePeriod) {
      return { modifiedCount: 0, checked: false };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const todayDateStr = startOfToday.toISOString().split("T")[0];

    // Standard 19:30 auto-close timestamp for today
    const autoClockOutTime = new Date();
    autoClockOutTime.setHours(19, 30, 0, 0);

    const baseFilter = {
      clockOut: null,
      $or: [
        { clockIn: { $gte: startOfToday, $lte: endOfToday } },
        { date: todayDateStr },
      ],
    };

    if (targetEmployeeId) {
      const idCandidates = [targetEmployeeId];
      if (isValidObjectId(targetEmployeeId)) {
        idCandidates.push(new mongoose.Types.ObjectId(targetEmployeeId));
      }
      baseFilter.$and = [
        {
          $or: [
            { employee: { $in: idCandidates } },
            { employeeId: String(targetEmployeeId) },
          ],
        },
      ];
    }

    const unclosedRecords = await Attendance.find(baseFilter);
    if (!unclosedRecords || unclosedRecords.length === 0) {
      return { modifiedCount: 0, checked: true };
    }

    let modifiedCount = 0;
    for (const record of unclosedRecords) {
      const inTime = record.clockIn ? new Date(record.clockIn) : autoClockOutTime;
      const effectiveCloseTime = now < autoClockOutTime ? now : autoClockOutTime;
      const diffMs = Math.max(0, effectiveCloseTime.getTime() - inTime.getTime());
      const hoursWorked = Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));

      record.clockOut = effectiveCloseTime;
      record.clockOutTime = effectiveCloseTime;
      record.autoClockedOut = true;
      record.shiftStatus = "Completed";
      if (record.status !== "Late") {
        record.status = "Completed";
      }
      record.workHours = hoursWorked;
      record.autoClosedAt = now;
      record.notes = record.notes
        ? `${record.notes} | Auto Clocked Out by System (Missed manual clock-out)`
        : "Auto Clocked Out by System (Missed manual clock-out)";

      await record.save();
      modifiedCount++;

      // Invalidate memory store
      if (liveAttendanceStore) {
        if (record.employee) {
          liveAttendanceStore.delete(`${record.employee.toString()}_${todayDateStr}`);
        }
        if (record.employeeId) {
          liveAttendanceStore.delete(`${record.employeeId}_${todayDateStr}`);
        }
      }
    }

    if (modifiedCount > 0) {
      console.log(`[Attendance] 7:30 PM auto-close triggered: auto-closed ${modifiedCount} shift(s).`);
    }

    return { modifiedCount, checked: true };
  } catch (err) {
    console.warn("[Attendance] Error in autoCloseEveningPastGracePeriod:", err.message);
    return { modifiedCount: 0, error: err.message };
  }
};

/**
 * System-wide sweeper: auto-close any open shift across all employees
 * whose clockIn date is prior to today (midnight rollover),
 * and auto-close today's unclosed shifts if current time is >= 19:30 (7:30 PM).
 */
export const autoCloseAllStaleShifts = async () => {
  // This function is also invoked during server startup.  Avoid issuing a query
  // when MongoDB is deliberately unavailable in offline mode.
  if (mongoose.connection.readyState !== 1) {
    return { modifiedCount: 0, skipped: true };
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayDateStr = startOfToday.toISOString().split("T")[0];

    // 1. Midnight rollover: Auto-close any lingering shift from prior days
    const staleShifts = await Attendance.find({
      $and: [
        {
          $or: [
            { clockOut: null },
            { clockOut: { $exists: false } },
            { clockOutTime: null },
            { clockOutTime: { $exists: false } },
          ],
        },
        {
          $or: [
            { clockIn: { $lt: startOfToday } },
            { date: { $lt: todayDateStr } },
          ],
        },
      ],
    });

    let modifiedCount = 0;
    for (const record of staleShifts) {
      const inTime = record.clockIn ? new Date(record.clockIn) : (record.date ? new Date(record.date) : startOfToday);
      let closeTime = new Date(inTime);
      closeTime.setHours(19, 30, 0, 0);
      if (closeTime.getTime() <= inTime.getTime()) {
        closeTime = new Date(inTime.getTime() + 8 * 60 * 60 * 1000);
      }
      if (closeTime > startOfToday) {
        closeTime = new Date(startOfToday.getTime() - 1000);
      }

      const diffMs = Math.max(0, closeTime.getTime() - inTime.getTime());
      const hoursWorked = Math.min(12, Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(2))));

      record.clockOut = closeTime;
      record.clockOutTime = closeTime;
      record.autoClockedOut = true;
      record.shiftStatus = "Auto-Closed";
      if (record.status !== "Late") {
        record.status = "Auto-Closed";
      }
      record.workHours = record.workHours > 0 ? record.workHours : hoursWorked;
      record.autoClosedAt = new Date();
      if (!record.notes || !record.notes.includes("Shift auto-closed at midnight")) {
        record.notes = record.notes
          ? `${record.notes} | Shift auto-closed at midnight due to missing clock-out`
          : "Shift auto-closed at midnight due to missing clock-out";
      }

      await record.save();
      modifiedCount++;
    }

    if (liveAttendanceStore) {
      for (const [k, val] of liveAttendanceStore.entries()) {
        if (val?.date && val.date !== todayDateStr) {
          liveAttendanceStore.delete(k);
        }
      }
    }

    if (modifiedCount > 0) {
      console.log(`[Attendance] System midnight sweeper auto-closed ${modifiedCount} shift(s).`);
    }

    // 2. 7:30 PM (19:30) check for today's shifts
    await autoCloseEveningPastGracePeriod();

    // 3. Company closing time: record Absent for expected employees with no attendance that day
    await ensureAbsencesProcessed();

    return { modifiedCount };
  } catch (err) {
    console.warn("[Attendance] Error in autoCloseAllStaleShifts:", err.message);
    return { modifiedCount: 0 };
  }
};

// Clock in handler - Automatic real-time recording
export const clockIn = async (req, res) => {
  const submittedTime = req.body?.clockInTime || req.body?.timestamp || req.body?.clockIn;
  if (isSundayHoliday() || (submittedTime && isSundayHoliday(submittedTime))) {
    return res.status(403).json({ success: false, code: "SUNDAY_HOLIDAY", message: SUNDAY_HOLIDAY_MESSAGE });
  }
  try {
    // For standard employees, hardcode the employeeId strictly to the authenticated user ID
    const isEmployeeRole = req.user?.role === "employee" || (!req.admin && req.employee);
    let employeeId = isEmployeeRole
      ? (req.user?._id || req.user?.id || req.employee?.id || req.employee?._id)
      : (req.user?._id || req.user?.id || req.employee?.id || req.employee?._id || req.body?.employeeId);

    const resolvedId = await resolveEmployeeObjectId(employeeId);
    if (resolvedId) employeeId = resolvedId;

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Employee identification required for clock in.",
      });
    }

    // Force clock-out any unclosed shift from prior calendar days before evaluating today's clock-in
    const forceCloseResult = await autoCloseUnfinishedShifts(employeeId, req.user || req.employee);
    if (forceCloseResult?.modifiedCount > 0) {
      console.log(
        `[Attendance] Automatic force clock-out executed for ${forceCloseResult.modifiedCount} incomplete session(s) from previous day(s) for employee ${employeeId}.`
      );
    }

    // Lookup employee details for rich notification & response
    let employeeDoc = null;
    if (isValidObjectId(employeeId)) {
      try {
        employeeDoc = await Employee.findById(employeeId)
          .select("fullName employeeId department position email avatar profile_picture baseSalary salary")
          .lean();
      } catch (err) {
        console.warn("Could not fetch employee details for clockIn:", err.message);
      }
    }

    const employeeCode = employeeDoc?.employeeId || req.employee?.employeeId || "";
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const today = startOfToday.toISOString().split("T")[0];
    const key = `${employeeId}_${today}`;

    // Clean up stale in-memory store records from past dates
    if (liveAttendanceStore) {
      for (const [k, val] of liveAttendanceStore.entries()) {
        if (val?.date && val.date !== today) {
          liveAttendanceStore.delete(k);
        }
      }
    }

    // Parse check-in timestamp (from body or server clock)
    const checkInTimestamp = req.body?.clockInTime || req.body?.timestamp || req.body?.clockIn || new Date();
    const now = new Date(checkInTimestamp);
    const validNow = !isNaN(now.getTime()) ? now : new Date();

    // Fetch active CompanySettings for work start time and lateness penalty matrix
    let settingsDoc = null;
    const resolvedOrgId = req.organizationId || employeeDoc?.organizationId || req.user?.organizationId || req.employee?.organizationId || null;
    try {
      settingsDoc = await CompanySettings.getSingletonSettings(resolvedOrgId);
    } catch (err) {
      settingsDoc = {};
    }

    const workStartTime = settingsDoc?.workStartTime || "08:00";
    const penaltyEval = evaluateLatenessPenalty(validNow, workStartTime, settingsDoc || {});
    const delayMinutes = penaltyEval.delayMinutes ?? penaltyEval.minutesLate ?? 0;
    const latePenalty = Number(penaltyEval.latePenalty ?? penaltyEval.penalty ?? 0) || 0;
    const penaltyTier = penaltyEval.tier || (delayMinutes > 0 ? "Late" : "On Time");
    const status = delayMinutes > 0 ? "Late" : "On Time";
    const displayStatus = penaltyEval.status || (delayMinutes > 0 ? "Late" : "On Time");
    const lateReason = String(req.body?.lateReason || req.body?.reason || req.body?.notes || "").trim();

    // 1. Check MongoDB for existing record strictly today
    let existingDoc = null;
    const rawAuthId = req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
    const idCandidates = [employeeId, rawAuthId, resolvedId].filter(Boolean);

    if (isValidObjectId(employeeId)) {
      try {
        existingDoc = await Attendance.findOne({
          $and: [
            {
              $or: [
                { employee: { $in: idCandidates } },
                ...(employeeCode ? [{ employeeId: employeeCode }] : []),
              ],
            },
            {
              $or: [
                { clockIn: { $gte: startOfToday, $lte: endOfToday } },
                { date: today },
              ],
            },
          ],
        }).populate("employee", "fullName employeeId department position email avatar").lean();
      } catch (dbErr) {
        console.warn("DB check in clockIn:", dbErr.message);
      }
    }

    // The working day already closed and the system recorded this employee as Absent:
    // do not let a late clock-in overwrite the permanent absence record.
    if (existingDoc && !existingDoc.clockIn && !existingDoc.clockInTime && existingDoc.absenceSource === SYSTEM_ABSENCE_SOURCE) {
      return res.status(409).json({
        success: false,
        code: "WORKDAY_CLOSED_ABSENT",
        message: "The working day has closed and you were recorded as absent for today. Please contact your administrator if this is incorrect.",
        attendance: existingDoc,
        todayRecord: existingDoc,
      });
    }

    if (existingDoc && (existingDoc.clockIn || existingDoc.clockInTime)) {
      liveAttendanceStore.set(key, existingDoc);
      if (rawAuthId) liveAttendanceStore.set(`${rawAuthId}_${today}`, existingDoc);
      if (employeeCode) liveAttendanceStore.set(`${employeeCode}_${today}`, existingDoc);
      return res.status(200).json({
        success: true,
        alreadyClockedIn: true,
        message: "You have already clocked in today.",
        attendance: existingDoc,
        todayRecord: existingDoc,
        data: existingDoc,
        status: existingDoc.lateMinutes > 0 || (existingDoc.status || "").toLowerCase() === "late" ? "late" : "on-time",
        delayMinutes: existingDoc.delayMinutes ?? existingDoc.lateMinutes ?? 0,
        lateMinutes: existingDoc.lateMinutes ?? existingDoc.delayMinutes ?? 0,
        latePenalty: existingDoc.latePenalty || 0,
        penaltyTier: existingDoc.penaltyTier || "",
        hasClockedIn: true,
        isClockedIn: !Boolean(existingDoc.clockOut || existingDoc.clockOutTime),
        hasClockedOut: Boolean(existingDoc.clockOut || existingDoc.clockOutTime),
        isClockedOut: Boolean(existingDoc.clockOut || existingDoc.clockOutTime),
        forceClosedPreviousShift: Boolean(forceCloseResult?.modifiedCount > 0),
        previousSessionForceClosed: Boolean(forceCloseResult?.modifiedCount > 0),
        forceClosedCount: forceCloseResult?.modifiedCount || 0,
      });
    }

    // 2. Atomically create or update attendance record in MongoDB
    let savedRecord = null;
    if (isValidObjectId(employeeId)) {
      try {
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        savedRecord = await Attendance.findOneAndUpdate(
          {
            employee: employeeId,
            $or: [
              { date: { $gte: startOfToday, $lte: endOfToday } },
              { date: today },
              { clockIn: { $gte: startOfToday, $lte: endOfToday } },
            ],
          },
          {
            $set: {
              employeeId: req.user?._id || employeeCode || employeeId,
              clockIn: validNow,
              clockInTime: validNow,
              status: status,
              workHours: 0,
              delayMinutes: delayMinutes,
              lateMinutes: delayMinutes,
              latePenalty: latePenalty,
              penaltyTier: penaltyTier,
              lateReason: lateReason,
              ...(lateReason ? { notes: lateReason } : {}),
              ...(resolvedOrgId ? { organizationId: resolvedOrgId, companyId: resolvedOrgId } : {}),
            },
            $setOnInsert: {
              employee: employeeId,
              date: startOfToday,
              clockOut: null,
              clockOutTime: null,
              notes: lateReason || "",
              ...(resolvedOrgId ? { organizationId: resolvedOrgId, companyId: resolvedOrgId } : {}),
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).populate("employee", "fullName employeeId department position email avatar");

        if (savedRecord && savedRecord.toObject) {
          savedRecord = savedRecord.toObject();
        }
      } catch (dbErr) {
        console.warn("DB upsert in clockIn:", dbErr.message);
      }
    }

    if (!savedRecord) {
      savedRecord = {
        _id: "att_" + Date.now(),
        employee: employeeDoc || { _id: employeeId, fullName: req.employee?.fullName || "Employee" },
        employeeId: employeeCode,
        date: today,
        clockIn: validNow.toISOString(),
        clockInTime: validNow.toISOString(),
        clockOut: null,
        clockOutTime: null,
        status,
        workHours: 0,
        delayMinutes,
        lateMinutes: delayMinutes,
        latePenalty,
        penaltyTier,
        lateReason,
        notes: lateReason,
      };
    }

    // Update live memory store across employee ID, auth ID, and employee code
    liveAttendanceStore.set(key, savedRecord);
    if (rawAuthId) liveAttendanceStore.set(`${rawAuthId}_${today}`, savedRecord);
    if (employeeCode) liveAttendanceStore.set(`${employeeCode}_${today}`, savedRecord);
    if (resolvedId) liveAttendanceStore.set(`${resolvedId}_${today}`, savedRecord);

    // Push automated notification record targeting Admins
    try {
      const empName = employeeDoc?.fullName || req.employee?.fullName || "Employee";
      const empCode = employeeDoc?.employeeId || req.employee?.employeeId || "Staff";
      const timeStr = validNow.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(employeeId),
        sender_role: "employee",
        sender_name: empName,
        title: "Employee Clock In",
        message: `${empName} (${empCode}) clocked in at ${timeStr} [${status}]${lateReason ? ` — Reason: "${lateReason}"` : ""}`,
        type: "attendance_alert",
        category: "attendance",
        priority: status === "Late" ? "medium" : "info",
        action_url: "/admin/dashboard/attendance",
        action_label: "View Attendance",
        metadata: {
          employeeId: empCode,
          employeeName: empName,
          date: today,
          status,
          clockIn: validNow.toISOString(),
          lateReason,
        },
      });

      // If late, push an automated in-app notification directly to the employee
      if (status === "Late") {
        try {
          const isZeroPenalty = latePenalty === 0;
          const notifTitle = isZeroPenalty
            ? "Clock-In Recorded (No Deduction)"
            : "⚠️ Lateness Penalty Alert: Upcoming Payslip Impact";
          const notifMessage = isZeroPenalty
            ? `Clocked in at ${timeStr} (${delayMinutes} mins late). Company policy applied: No salary deduction for this delay.`
            : `Clocked in at ${timeStr} (${delayMinutes} mins late). Lateness penalty of GH₵${Number(latePenalty).toFixed(
                2
              )} has been applied as per company policy.`;

          await createNotificationRecord({
            recipient_id: String(employeeId),
            recipient_role: "employee",
            sender_id: "system",
            sender_role: "system",
            sender_name: "Attendance System",
            title: notifTitle,
            message: notifMessage,
            type: isZeroPenalty ? "attendance_alert" : "penalty_alert",
            category: isZeroPenalty ? "attendance" : "payroll",
            priority: isZeroPenalty ? "info" : "high",
            action_url: isZeroPenalty ? "/employee/dashboard" : "/employee/dashboard/payslips",
            action_label: isZeroPenalty ? "View Attendance" : "View Payslip Impact",
            metadata: {
              date: today,
              clockIn: validNow.toISOString(),
              minutesLate: delayMinutes,
              penaltyAmount: latePenalty,
              latePenalty: latePenalty,
              tier: penaltyTier,
              deductionApplied: !isZeroPenalty,
            },
          });
        } catch (empNotifErr) {
          console.error("Failed to push lateness alert to employee:", empNotifErr.message);
        }
      }
    } catch (notifErr) {
      console.error("Failed to push clock-in notification:", notifErr.message);
    }

    const isZeroPenalty = delayMinutes > 0 && latePenalty === 0;
    const timeFormatted = penaltyEval.clockInFormatted || (validNow ? validNow.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now");
    const responseMessage = delayMinutes > 0
      ? (isZeroPenalty
          ? `Clocked in at ${timeFormatted} (${delayMinutes} mins late). Company policy applied: No salary deduction for this delay.`
          : `Clocked in at ${timeFormatted} (${delayMinutes} mins late). Lateness penalty of GH₵${Number(latePenalty).toFixed(
              2
            )} has been applied as per company policy.`)
      : `Clock in successful (${status})!`;

    return res.status(201).json({
      success: true,
      alreadyClockedIn: false,
      message: responseMessage,
      attendance: savedRecord,
      todayRecord: savedRecord,
      status: delayMinutes > 0 ? "late" : "on-time",
      displayStatus,
      delayMinutes,
      lateMinutes: delayMinutes,
      latePenalty,
      penaltyTier,
      lateReason,
      notes: lateReason,
      isZeroPenalty,
      deductionApplied: !isZeroPenalty,
      notificationMessage: responseMessage,
      hasClockedIn: true,
      isClockedIn: true,
      hasClockedOut: false,
      isClockedOut: false,
      forceClosedPreviousShift: Boolean(forceCloseResult?.modifiedCount > 0),
      previousSessionForceClosed: Boolean(forceCloseResult?.modifiedCount > 0),
      forceClosedCount: forceCloseResult?.modifiedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Clock out handler - Automatic real-time recording
export const clockOut = async (req, res) => {
  try {
    const rawAuthId = req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
    const empInfo = await resolveEmployeeInfo(req, rawAuthId);
    const { employeeDoc, employeeObjectId, employeeCode, idCandidates, idCandidateStrings, codeCandidates } = empInfo;

    if (!employeeObjectId && idCandidates.length === 0 && codeCandidates.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Employee identification required for clock out.",
      });
    }

    // Auto-close any unclosed shift from prior calendar days before evaluating clock-out
    await autoCloseUnfinishedShifts(employeeObjectId || rawAuthId, req.user || req.employee);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const today = now.toISOString().split("T")[0];
    const localToday = now.toLocaleDateString("en-CA");
    const clientDate = req.body?.date || "";
    const dateList = Array.from(new Set([today, localToday, clientDate].filter(Boolean)));

    // 1. Direct record ID match if provided by client in req.body scoped to tenant
    let record = null;
    const explicitId = req.body?.attendanceId || req.body?.recordId || req.body?.id || req.body?._id;
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    if (explicitId && isValidObjectId(explicitId)) {
      try {
        record = await Attendance.findOne({ _id: explicitId, ...tenantScope }).populate("employee", "fullName employeeId department position email avatar");
      } catch (err) {
        console.warn("[clockOut] Direct findById failed:", err.message);
      }
    }

    // 2. Query conditions for this employee across all resolved identifiers
    const empFilterConditions = [
      ...(idCandidates.length > 0 ? [{ employee: { $in: idCandidates } }] : []),
      ...(codeCandidates.length > 0 ? [{ employeeId: { $in: codeCandidates } }] : []),
    ];

    // 3. Search for active OPEN shift first (clockIn != null and clockOut is null)
    if (!record && empFilterConditions.length > 0) {
      try {
        record = await Attendance.findOne({
          $or: empFilterConditions,
          clockIn: { $ne: null },
          $or: [{ clockOut: null }, { clockOut: { $exists: false } }],
        })
          .sort({ clockIn: -1, createdAt: -1 })
          .populate("employee", "fullName employeeId department position email avatar");
      } catch (dbErr) {
        console.warn("[clockOut] DB search for open shift failed:", dbErr.message);
      }
    }

    // 4. Search for today's record (matching dates or clockIn within today's window)
    if (!record && empFilterConditions.length > 0) {
      try {
        record = await Attendance.findOne({
          $or: empFilterConditions,
          $or: [
            { date: { $in: dateList } },
            { clockIn: { $gte: startOfToday, $lte: endOfToday } },
          ],
        })
          .sort({ clockIn: -1, createdAt: -1 })
          .populate("employee", "fullName employeeId department position email avatar");
      } catch (dbErr) {
        console.warn("[clockOut] DB search by date failed:", dbErr.message);
      }
    }

    // 5. Fallback to in-memory live store
    if (!record) {
      const keysToProbe = [
        ...idCandidateStrings.map((id) => `${id}_${today}`),
        ...codeCandidates.map((code) => `${code}_${today}`),
        ...dateList.flatMap((d) => idCandidateStrings.map((id) => `${id}_${d}`)),
        ...dateList.flatMap((d) => codeCandidates.map((code) => `${code}_${d}`)),
      ];
      for (const k of keysToProbe) {
        const memRecord = liveAttendanceStore.get(k);
        if (memRecord && (memRecord.clockIn || memRecord.clockInTime)) {
          record = memRecord;
          break;
        }
      }
    }

    // 6. Fallback: Search for the most recent unclocked-out attendance record for this employee
    if (!record && empFilterConditions.length > 0) {
      try {
        record = await Attendance.findOne({
          $or: empFilterConditions,
        })
          .sort({ clockIn: -1, createdAt: -1 })
          .populate("employee", "fullName employeeId department position email avatar");
      } catch (dbErr) {
        console.warn("[clockOut] Fallback recent record search failed:", dbErr.message);
      }
    }

    // 7. If client provided clockIn in req.body but no record was found in DB/memory, gracefully create and complete it
    if (!record && (req.body?.clockIn || req.body?.clockInTime)) {
      const parsedClockIn = new Date(req.body.clockIn || req.body.clockInTime);
      if (!isNaN(parsedClockIn.getTime())) {
        const diffMs = Math.max(0, now.getTime() - parsedClockIn.getTime());
        const hoursWorked = Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
        const targetEmpId = employeeDoc?._id || idCandidates[0] || new mongoose.Types.ObjectId();
        record = new Attendance({
          employee: targetEmpId,
          employeeId: employeeCode || "STAFF",
          date: req.body.date || today,
          clockIn: parsedClockIn,
          clockInTime: parsedClockIn,
          clockOut: now,
          clockOutTime: now,
          workHours: hoursWorked,
          status: "On Time",
          shiftStatus: "Completed",
          notes: req.body?.reason ? `Manual recovery: ${req.body.reason}` : "Clocked out via application",
        });
        await record.save();
        await record.populate("employee", "fullName employeeId department position email avatar");
      }
    }

    // Check if already clocked out
    if (record && (record.clockOut || record.clockOutTime)) {
      return res.status(200).json({
        success: true,
        alreadyClockedOut: true,
        message: "You have already clocked out today.",
        attendance: record,
        todayRecord: record,
        hasClockedIn: true,
        isClockedIn: false,
        hasClockedOut: true,
        isClockedOut: true,
      });
    }

    const clockInVal = record?.clockIn || record?.clockInTime;

    if (!record || !clockInVal) {
      return res.status(400).json({
        success: false,
        message: "No clock-in record found for today. Please clock in first.",
      });
    }

    // Calculate hours worked accurately
    const clockInTime = new Date(clockInVal);
    const diffMs = Math.max(0, now.getTime() - clockInTime.getTime());
    const hoursWorked = Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));

    // Persist clock-out to MongoDB
    let updatedRecord = null;
    if (record._id && isValidObjectId(record._id)) {
      try {
        const notesAppend = req.body?.reason ? String(req.body.reason).trim() : "";
        const existingNotes = record.notes || "";
        const updatedNotes = notesAppend
          ? (existingNotes ? `${existingNotes} | ${notesAppend}` : notesAppend)
          : existingNotes;

        updatedRecord = await Attendance.findByIdAndUpdate(
          record._id,
          {
            $set: {
              clockOut: now,
              clockOutTime: now,
              workHours: hoursWorked,
              shiftStatus: "Completed",
              ...(updatedNotes ? { notes: updatedNotes } : {}),
            },
          },
          { returnDocument: "after" }
        ).populate("employee", "fullName employeeId department position email avatar");

        if (updatedRecord && updatedRecord.toObject) {
          updatedRecord = updatedRecord.toObject();
        }
      } catch (dbErr) {
        console.warn("[clockOut] DB update error:", dbErr.message);
      }
    }

    if (!updatedRecord) {
      updatedRecord = {
        ...(record.toObject ? record.toObject() : record),
        clockOut: now.toISOString(),
        clockOutTime: now.toISOString(),
        workHours: hoursWorked,
        shiftStatus: "Completed",
      };
    }

    // Synchronize across in-memory live attendance store keys
    const syncKeys = [
      `${employeeObjectId}_${today}`,
      ...idCandidateStrings.map((id) => `${id}_${today}`),
      ...codeCandidates.map((code) => `${code}_${today}`),
    ];
    for (const k of syncKeys) {
      liveAttendanceStore.set(k, updatedRecord);
    }

    // Push automated notification record targeting Admins
    try {
      const empName = employeeDoc?.fullName || req.employee?.fullName || "Employee";
      const empCode = employeeDoc?.employeeId || req.employee?.employeeId || "Staff";
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      await createNotificationRecord({
        recipient_id: "admin",
        recipient_role: "admin",
        sender_id: String(employeeObjectId || rawAuthId),
        sender_role: "employee",
        sender_name: empName,
        title: "Employee Clock Out",
        message: `${empName} (${empCode}) clocked out at ${timeStr} (${hoursWorked} hrs recorded)`,
        type: "attendance_alert",
        category: "attendance",
        priority: "info",
        action_url: "/admin/dashboard/attendance",
        action_label: "View Attendance",
        metadata: {
          employeeId: empCode,
          employeeName: empName,
          date: today,
          clockOut: now.toISOString(),
          workHours: hoursWorked,
        },
      });
    } catch (notifErr) {
      console.error("[clockOut] Failed to push clock-out notification:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Clock out successful (${hoursWorked} hrs recorded)!`,
      attendance: updatedRecord,
      todayRecord: updatedRecord,
      hasClockedIn: true,
      isClockedIn: false,
      hasClockedOut: true,
      isClockedOut: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Current employee profile
export const getCurrentEmployee = async (req, res) => {
  try {
    let employee = null;
    const targetId = req.employee?.id || req.employee?._id || req.user?.id || req.user?._id;
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    if (isValidObjectId(targetId)) {
      try {
        employee = await Employee.findOne({ _id: targetId, ...tenantScope }).select("-password").lean();
      } catch (dbErr) {
        console.warn("DB find in getCurrentEmployee:", dbErr.message);
      }
    } else if (targetId) {
      try {
        employee = await Employee.findOne({
          ...tenantScope,
          $or: [{ employeeId: targetId }, { email: targetId }],
        }).select("-password").lean();
      } catch (dbErr) {
        console.warn("DB find in getCurrentEmployee by identifier:", dbErr.message);
      }
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found in database.",
      });
    }

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Employee attendance history
export const getEmployeeAttendance = async (req, res) => {
  try {
    await ensureAbsencesProcessed();
    const rawId = req.employee?.id || req.employee?._id || req.user?._id || req.user?.id;
    let attendance = [];

    // Gather all possible identifiers for this employee (User _id, Employee _id, employeeId code, email)
    let userDoc = null;
    let empDoc = null;

    if (isValidObjectId(rawId)) {
      try {
        userDoc = await User.findById(rawId).lean();
      } catch {
        // ignore
      }
      try {
        empDoc = await Employee.findById(rawId).lean();
      } catch {
        // ignore
      }
    }

    if (!empDoc && (userDoc?.email || req.user?.email || req.employee?.email)) {
      const email = (userDoc?.email || req.user?.email || req.employee?.email).toLowerCase();
      empDoc = await Employee.findOne({ email }).lean();
    }
    if (!userDoc && (empDoc?.email || req.user?.email || req.employee?.email)) {
      const email = (empDoc?.email || req.user?.email || req.employee?.email).toLowerCase();
      userDoc = await User.findOne({ email }).lean();
    }
    if (!empDoc && (req.employee?.employeeId || req.user?.employeeId)) {
      const code = req.employee?.employeeId || req.user?.employeeId;
      empDoc = await Employee.findOne({ employeeId: code }).lean();
    }

    const tenantId = req.companyId || req.organizationId || empDoc?.companyId || empDoc?.organizationId || req.user?.companyId || req.employee?.companyId;
    const idList = [userDoc?._id, empDoc?._id, rawId].filter(Boolean);
    const codeList = [
      empDoc?.employeeId,
      userDoc?.employeeId,
      req.user?.employeeId,
      req.employee?.employeeId,
    ].filter(Boolean);

    const empObj = {
      _id: empDoc?._id || userDoc?._id || rawId,
      id: empDoc?._id || userDoc?._id || rawId,
      fullName: empDoc?.fullName || userDoc?.fullName || "Employee",
      employeeId: empDoc?.employeeId || userDoc?.employeeId || "EMP-001",
      department: empDoc?.department || userDoc?.department || "General",
      position: empDoc?.position || userDoc?.position || "Staff",
      email: empDoc?.email || userDoc?.email || "",
      avatar: empDoc?.avatar || userDoc?.avatar || empDoc?.profilePicture || userDoc?.profilePicture || "",
    };

    try {
      const baseOr = [
        { employee: { $in: idList } },
        { employeeId: { $in: [...codeList, ...idList.map(String)] } },
        { userId: { $in: idList } },
      ];
      const filter = tenantId
        ? {
            $and: [
              { $or: baseOr },
              { $or: [{ organizationId: tenantId }, { companyId: tenantId }] },
            ],
          }
        : { $or: baseOr };

      const dbAtt = await Attendance.find(filter)
        .populate("employee", "fullName department position employeeId email avatar profilePicture")
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (dbAtt && dbAtt.length > 0) {
        attendance = dbAtt.map((rec) => {
          const resolvedEmp = rec.employee || empObj;
          return {
            ...rec,
            employee: {
              ...empObj,
              ...(typeof resolvedEmp === "object" ? resolvedEmp : {}),
            },
            employeeId: rec.employeeId || empObj.employeeId,
          };
        });
      }
    } catch (dbErr) {
      console.warn("DB query in getEmployeeAttendance:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Monthly calendar attendance aggregator with robust identifier matching and timezone normalization
export const getMonthlyAttendanceCalendar = async (req, res) => {
  try {
    await ensureAbsencesProcessed();
    const rawId = req.employee?.id || req.employee?._id || req.user?._id || req.user?.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const reqMonth = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();
    // 0-indexed month (0 = Jan, 11 = Dec):
    const monthIndex = reqMonth > 11 ? reqMonth - 1 : reqMonth;
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    const monthPrefix = `${year}-${monthStr}`;

    let userDoc = null;
    let empDoc = null;

    if (isValidObjectId(rawId)) {
      try {
        userDoc = await User.findById(rawId).lean();
      } catch {
        // ignore
      }
      try {
        empDoc = await Employee.findById(rawId).lean();
      } catch {
        // ignore
      }
    }

    if (!empDoc && (userDoc?.email || req.user?.email || req.employee?.email)) {
      const email = (userDoc?.email || req.user?.email || req.employee?.email).toLowerCase();
      empDoc = await Employee.findOne({ email }).lean();
    }
    if (!userDoc && (empDoc?.email || req.user?.email || req.employee?.email)) {
      const email = (empDoc?.email || req.user?.email || req.employee?.email).toLowerCase();
      userDoc = await User.findOne({ email }).lean();
    }

    const idList = [userDoc?._id, empDoc?._id, rawId].filter(Boolean);
    const codeList = [
      empDoc?.employeeId,
      userDoc?.employeeId,
      req.user?.employeeId,
      req.employee?.employeeId,
    ].filter(Boolean);

    const empObj = {
      _id: empDoc?._id || userDoc?._id || rawId,
      id: empDoc?._id || userDoc?._id || rawId,
      fullName: empDoc?.fullName || userDoc?.fullName || "Employee",
      employeeId: empDoc?.employeeId || userDoc?.employeeId || "EMP-001",
      department: empDoc?.department || userDoc?.department || "General",
      position: empDoc?.position || userDoc?.position || "Staff",
      email: empDoc?.email || userDoc?.email || "",
      avatar: empDoc?.avatar || userDoc?.avatar || empDoc?.profilePicture || userDoc?.profilePicture || "",
    };

    const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const filter = {
      $or: [
        { employee: { $in: idList } },
        { employeeId: { $in: [...codeList, ...idList.map(String)] } },
        { userId: { $in: idList } },
      ],
      $and: [
        {
          $or: [
            { date: { $regex: `^${monthPrefix}` } },
            { date: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` } },
            { createdAt: { $gte: startDate, $lte: endDate } },
            { clockIn: { $gte: startDate, $lte: endDate } },
          ],
        },
      ],
    };

    const records = await Attendance.find(filter)
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const populated = records.map((r) => ({
      ...r,
      employee: empObj,
      employeeId: empObj.employeeId,
    }));

    return res.status(200).json({
      success: true,
      year,
      month: monthIndex,
      monthPrefix,
      attendance: populated,
      count: populated.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Get all attendance for admin - Live automated database sync (Single-Tenant Global Access)
export const getAllAttendance = async (req, res) => {
  try {
    // Auto-close today's unclosed shifts if current time is >= 19:30 (7:30 PM)
    await autoCloseEveningPastGracePeriod();
    await ensureAbsencesProcessed();

    let attendance = [];
    try {
      const dbAtt = await Attendance.find({})
        .populate("userId", "fullName department position employeeId email avatar profilePicture")
        .populate("employee", "fullName department position employeeId email avatar profilePicture")
        .sort({ date: -1, createdAt: -1 })
        .lean();

      if (dbAtt) {
        attendance = dbAtt.map((rec) => {
          const emp = rec.employee || rec.userId || {};
          return {
            ...rec,
            userId: emp,
            employee: emp,
          };
        });
      }
    } catch (dbErr) {
      console.warn("DB query in getAllAttendance:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Error in getAllAttendance:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to retrieve attendance records."),
    });
  }
};

// Get single attendance record by ID strictly scoped to company
export const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Access restricted: No company workspace identified for this request.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found.",
      });
    }

    const tenantScope = tenantId ? { $or: [{ organizationId: tenantId }, { companyId: tenantId }] } : {};
    const record = await Attendance.findOne({ _id: id, ...tenantScope })
      .populate("employee", "fullName employeeId department position email avatar")
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in this company workspace.",
      });
    }

    // Validate organization access to prevent cross-tenant data access
    validateOrganizationAccess(record, req);

    return res.status(200).json({
      success: true,
      attendance: record,
      record,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Get today's attendance for active employee
export const getTodayAttendance = async (req, res) => {
  try {
    const rawAuthId = req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
    let employeeId = rawAuthId;
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const today = startOfToday.toISOString().split("T")[0];

    let employee = null;
    let validObjectId = null;

    if (employeeId && !isValidObjectId(employeeId)) {
      const empDoc = await Employee.findOne({
        ...tenantScope,
        $or: [{ employeeId: employeeId }, { email: employeeId }],
      }).lean();
      if (empDoc) {
        employee = empDoc;
        employeeId = empDoc._id.toString();
        validObjectId = employeeId;
      }
    }

    if (isValidObjectId(employeeId)) {
      try {
        if (!employee) {
          employee = await Employee.findOne({ _id: employeeId, ...tenantScope })
            .select("fullName position department employeeId email avatar profile_picture")
            .lean();
        }
        if (employee) {
          validObjectId = employee._id.toString();
        }
      } catch (dbErr) {
        console.warn("Employee lookup in getTodayAttendance:", dbErr.message);
      }
    }

    if (!employee && isValidObjectId(rawAuthId)) {
      try {
        const userDoc = await User.findOne({ _id: rawAuthId, ...tenantScope }).lean();
        if (userDoc) {
          const matchedEmp = await Employee.findOne({
            ...tenantScope,
            $or: [
              ...(userDoc.email ? [{ email: userDoc.email }] : []),
              ...(userDoc.employeeId ? [{ employeeId: userDoc.employeeId }] : []),
            ],
          }).lean();
          if (matchedEmp) {
            employee = matchedEmp;
            validObjectId = matchedEmp._id.toString();
          } else {
            employee = userDoc;
            validObjectId = userDoc._id.toString();
          }
        }
      } catch (userErr) {
        console.warn("User lookup in getTodayAttendance:", userErr.message);
      }
    }

    // Auto-close any lingering shift from prior calendar days that was never clocked out
    await autoCloseUnfinishedShifts(validObjectId || employeeId, req.user || req.employee);

    // 7:30 PM (19:30) check: If server time >= 19:30, auto-close unclosed shift for today
    await autoCloseEveningPastGracePeriod(validObjectId || employeeId);

    // Clean up stale in-memory store records for dates before today
    if (liveAttendanceStore) {
      for (const [k, val] of liveAttendanceStore.entries()) {
        if (val?.date && val.date !== today) {
          liveAttendanceStore.delete(k);
        }
      }
    }

    let attendance = null;
    const employeeCode = employee?.employeeId || req.employee?.employeeId || req.user?.employeeId || "";
    const activeUserId = req.user?._id || req.user?.id || rawAuthId;
    const activeOrgId = req.user?.organizationId || req.organizationId || employee?.organizationId;
    const idCandidates = [activeUserId, validObjectId, employeeId, rawAuthId, employee?._id].filter(Boolean);

    try {
      // 1. First attempt exact query as required: employeeId: req.user._id, organizationId: req.user.organizationId, date: { $gte: startOfToday, $lte: endOfToday }
      if (activeUserId) {
        const exactConditions = {
          $or: [
            { employeeId: activeUserId },
            ...(isValidObjectId(activeUserId) ? [{ employeeId: new mongoose.Types.ObjectId(activeUserId) }] : []),
            ...(isValidObjectId(activeUserId) ? [{ employee: new mongoose.Types.ObjectId(activeUserId) }] : []),
          ],
          date: { $gte: startOfToday, $lte: endOfToday },
        };
        if (activeOrgId) {
          exactConditions.organizationId = isValidObjectId(activeOrgId) ? new mongoose.Types.ObjectId(activeOrgId) : activeOrgId;
        }

        attendance = await Attendance.findOne(exactConditions)
          .populate("employee", "fullName department position employeeId email avatar")
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean();
      }

      // 2. Comprehensive fallback across all candidate IDs and date representations
      if (!attendance) {
        const filterConditions = [
          { employee: { $in: idCandidates } },
          { employeeId: { $in: idCandidates } },
          ...(employeeCode ? [{ employeeId: employeeCode }] : []),
        ];

        const dbAtt = await Attendance.findOne({
          $and: [
            { $or: filterConditions },
            ...(activeOrgId ? [{ $or: [{ organizationId: activeOrgId }, { organizationId: null }, { organizationId: { $exists: false } }] }] : []),
            {
              $or: [
                { date: { $gte: startOfToday, $lte: endOfToday } },
                { clockIn: { $gte: startOfToday, $lte: endOfToday } },
                { date: today },
              ],
            },
          ],
        })
          .populate("employee", "fullName department position employeeId email avatar")
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean();

        if (dbAtt) {
          attendance = dbAtt;
        }
      }
    } catch (dbErr) {
      console.warn("DB query in getTodayAttendance:", dbErr.message);
    }

    // Merge in-memory live attendance store records if fresh and strictly matching today
    if (liveAttendanceStore) {
      const keysToCheck = [
        `${employeeId}_${today}`,
        `${rawAuthId}_${today}`,
        `${validObjectId}_${today}`,
        `${employeeCode}_${today}`,
      ].filter(Boolean);

      for (const k of keysToCheck) {
        const memAtt = liveAttendanceStore.get(k);
        if (memAtt && memAtt.date === today) {
          attendance = { ...(attendance || {}), ...memAtt };
          break;
        }
      }

      if (!attendance) {
        liveAttendanceStore.forEach((liveAtt) => {
          if (
            liveAtt.date === today &&
            (idCandidates.includes(String(liveAtt.employee)) ||
              idCandidates.includes(String(liveAtt.employee?._id)) ||
              (employeeCode && liveAtt.employeeId === employeeCode))
          ) {
            attendance = liveAtt;
          }
        });
      }
    }

    const hasClockedIn = Boolean(attendance?.clockIn || attendance?.clockInTime);
    const hasClockedOut = Boolean(attendance?.clockOut || attendance?.clockOutTime);
    const isClockedIn = hasClockedIn && !hasClockedOut;
    const isClockedOut = hasClockedOut;

    res.status(200).json({
      success: true,
      data: attendance, // null if the employee hasn't clocked in today yet
      todayRecord: attendance,
      attendance,
      employee,
      hasClockedIn,
      isClockedIn,
      hasClockedOut,
      isClockedOut,
      status: attendance?.status || (hasClockedIn ? "On Time" : "Not Clocked In"),
      shiftStatus: attendance?.shiftStatus || (hasClockedOut ? "Completed" : hasClockedIn ? "In-Progress" : "Not Started"),
      clockIn: attendance?.clockIn || attendance?.clockInTime || null,
      clockOut: attendance?.clockOut || attendance?.clockOutTime || null,
      clockInTime: attendance?.clockIn || attendance?.clockInTime || null,
      clockOutTime: attendance?.clockOut || attendance?.clockOutTime || null,
      workHours: attendance?.workHours || 0,
      autoClockedOut: Boolean(attendance?.autoClockedOut),
      notes: attendance?.notes || "",
      lateMinutes: attendance?.lateMinutes ?? attendance?.delayMinutes ?? 0,
      delayMinutes: attendance?.delayMinutes ?? attendance?.lateMinutes ?? 0,
      latePenalty: attendance?.latePenalty || 0,
      penaltyTier: attendance?.penaltyTier || "",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

/**
 * GET /api/attendance/today-status
 * Dedicated attendance status persistence endpoint:
 * Queries the Attendance collection for a document matching the authenticated employee's ID and today's calendar date.
 * Explicitly states the user's current status for the day:
 * - If no record exists: { hasClockedIn: false, hasClockedOut: false, clockInTime: null, clockOutTime: null, attendance: null }
 * - If clocked in but not clocked out: { hasClockedIn: true, hasClockedOut: false, clockInTime: "...", clockOutTime: null, attendance }
 * - If shift is finished: { hasClockedIn: true, hasClockedOut: true, clockInTime: "...", clockOutTime: "...", attendance }
 */
export const getTodayAttendanceStatus = async (req, res) => {
  try {
    const rawAuthId = req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
    let employeeId = rawAuthId;
    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.employee?.companyId;
    const tenantScope = tenantId ? { $or: [{ companyId: tenantId }, { organizationId: tenantId }] } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const today = startOfToday.toISOString().split("T")[0];

    let employee = null;
    let validObjectId = null;

    if (employeeId && !isValidObjectId(employeeId)) {
      const empDoc = await Employee.findOne({
        ...tenantScope,
        $or: [{ employeeId: employeeId }, { email: employeeId }],
      }).lean();
      if (empDoc) {
        employee = empDoc;
        employeeId = empDoc._id.toString();
        validObjectId = employeeId;
      }
    }

    if (isValidObjectId(employeeId)) {
      try {
        if (!employee) {
          employee = await Employee.findOne({ _id: employeeId, ...tenantScope })
            .select("fullName position department employeeId email avatar profile_picture")
            .lean();
        }
        if (employee) {
          validObjectId = employee._id.toString();
        }
      } catch (dbErr) {
        console.warn("Employee lookup in getTodayAttendanceStatus:", dbErr.message);
      }
    }

    if (!employee && isValidObjectId(rawAuthId)) {
      try {
        const userDoc = await User.findOne({ _id: rawAuthId, ...tenantScope }).lean();
        if (userDoc) {
          const matchedEmp = await Employee.findOne({
            ...tenantScope,
            $or: [
              ...(userDoc.email ? [{ email: userDoc.email }] : []),
              ...(userDoc.employeeId ? [{ employeeId: userDoc.employeeId }] : []),
            ],
          }).lean();
          if (matchedEmp) {
            employee = matchedEmp;
            validObjectId = matchedEmp._id.toString();
          } else {
            employee = userDoc;
            validObjectId = userDoc._id.toString();
          }
        }
      } catch (userErr) {
        console.warn("User lookup in getTodayAttendanceStatus:", userErr.message);
      }
    }

    // Auto-close any lingering shift from prior calendar days
    await autoCloseUnfinishedShifts(validObjectId || employeeId, req.user || req.employee);
    await autoCloseEveningPastGracePeriod(validObjectId || employeeId);

    const employeeCode = employee?.employeeId || req.employee?.employeeId || req.user?.employeeId || "";
    const activeUserId = req.user?._id || req.user?.id || rawAuthId;
    const activeOrgId = req.user?.organizationId || req.organizationId || employee?.organizationId;
    const idCandidates = [activeUserId, validObjectId, employeeId, rawAuthId, employee?._id].filter(Boolean);

    let attendance = null;
    try {
      const filterConditions = [
        { employee: { $in: idCandidates } },
        { employeeId: { $in: idCandidates } },
        ...(employeeCode ? [{ employeeId: employeeCode }] : []),
      ];

      attendance = await Attendance.findOne({
        $and: [
          { $or: filterConditions },
          ...(activeOrgId ? [{ $or: [{ organizationId: activeOrgId }, { organizationId: null }, { organizationId: { $exists: false } }] }] : []),
          {
            $or: [
              { date: { $gte: startOfToday, $lte: endOfToday } },
              { clockIn: { $gte: startOfToday, $lte: endOfToday } },
              { date: today },
            ],
          },
        ],
      })
        .populate("employee", "fullName department position employeeId email avatar")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();
    } catch (dbErr) {
      console.warn("DB query in getTodayAttendanceStatus:", dbErr.message);
    }

    // Merge in-memory live attendance store records if fresh and strictly matching today
    if (liveAttendanceStore) {
      const keysToCheck = [
        `${employeeId}_${today}`,
        `${rawAuthId}_${today}`,
        `${validObjectId}_${today}`,
        `${employeeCode}_${today}`,
      ].filter(Boolean);

      for (const k of keysToCheck) {
        const memAtt = liveAttendanceStore.get(k);
        if (memAtt && memAtt.date === today) {
          attendance = { ...(attendance || {}), ...memAtt };
          break;
        }
      }
    }

    const hasClockedIn = Boolean(attendance && (attendance.clockIn || attendance.clockInTime));
    const hasClockedOut = Boolean(attendance && (attendance.clockOut || attendance.clockOutTime));
    const clockInTime = hasClockedIn
      ? (attendance.clockIn || attendance.clockInTime || "").toString()
      : null;
    const clockOutTime = hasClockedOut
      ? (attendance.clockOut || attendance.clockOutTime || "").toString()
      : null;

    if (!hasClockedIn) {
      return res.status(200).json({
        success: true,
        hasClockedIn: false,
        hasClockedOut: false,
        clockInTime: null,
        clockOutTime: null,
        status: "Not Clocked In",
        shiftStatus: "Not Started",
        attendance: null,
        todayRecord: null,
      });
    }

    if (hasClockedIn && !hasClockedOut) {
      return res.status(200).json({
        success: true,
        hasClockedIn: true,
        hasClockedOut: false,
        clockInTime,
        clockOutTime: null,
        status: attendance.status || "On Time",
        shiftStatus: "In-Progress",
        attendance,
        todayRecord: attendance,
      });
    }

    return res.status(200).json({
      success: true,
      hasClockedIn: true,
      hasClockedOut: true,
      clockInTime,
      clockOutTime,
      status: attendance.status || "On Time",
      shiftStatus: "Completed",
      attendance,
      todayRecord: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Admin manual override or retroactive adjustment (optional admin tool)
export const updateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clockIn,
      clockOut,
      status,
      notes,
      workHours,
      delayMinutes,
      lateMinutes,
      latePenalty,
      penaltyTier,
      isExcused,
      excuseReason,
      flaggedForReview,
      flagReason,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    let settingsDoc = null;
    try {
      settingsDoc = await CompanySettings.getSingletonSettings();
    } catch {
      settingsDoc = {};
    }

    const updateFields = {};
    const safeClockIn = clockIn ? safeDateTime(null, clockIn) || new Date(clockIn) : null;
    const safeClockOut = clockOut ? safeDateTime(null, clockOut) || new Date(clockOut) : null;

    if (clockIn !== undefined) {
      updateFields.clockIn = safeClockIn && !isNaN(safeClockIn.getTime()) ? safeClockIn : null;
      if (updateFields.clockIn) {
        const penaltyEval = evaluateLatenessPenalty(
          updateFields.clockIn,
          settingsDoc?.workStartTime || "08:00",
          settingsDoc || {}
        );
        updateFields.delayMinutes = penaltyEval.minutesLate || 0;
        updateFields.lateMinutes = penaltyEval.minutesLate || 0;
        updateFields.latePenalty = penaltyEval.penalty || 0;
        updateFields.penaltyTier = penaltyEval.tier || "";
        if (status === undefined) {
          updateFields.status = penaltyEval.minutesLate > 0 ? "Late" : "On Time";
        }
      } else {
        updateFields.delayMinutes = 0;
        updateFields.lateMinutes = 0;
        updateFields.latePenalty = 0;
        updateFields.penaltyTier = "";
      }
    }

    // Explicit overrides
    if (delayMinutes !== undefined) updateFields.delayMinutes = Number(delayMinutes) || 0;
    if (lateMinutes !== undefined) updateFields.lateMinutes = Number(lateMinutes) || 0;
    if (latePenalty !== undefined) updateFields.latePenalty = Number(latePenalty) || 0;
    if (penaltyTier !== undefined) updateFields.penaltyTier = penaltyTier;
    if (isExcused !== undefined) updateFields.isExcused = Boolean(isExcused);
    if (excuseReason !== undefined) updateFields.excuseReason = excuseReason;
    if (flaggedForReview !== undefined) updateFields.flaggedForReview = Boolean(flaggedForReview);
    if (flagReason !== undefined) updateFields.flagReason = flagReason;

    if (clockOut !== undefined) {
      updateFields.clockOut = safeClockOut && !isNaN(safeClockOut.getTime()) ? safeClockOut : null;
    }
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    updateFields.auditLog = {
      adminId: String(req.admin?._id || req.admin?.id || "admin"),
      adminName: req.admin?.fullName || "HR Administrator",
      reason: notes || "Attendance record adjusted by admin",
      timestamp: new Date(),
    };

    if (workHours !== undefined) {
      const parsedH = Number(workHours);
      updateFields.workHours = !isNaN(parsedH) && Number.isFinite(parsedH) ? parsedH : 0;
    } else if (clockIn && clockOut) {
      updateFields.workHours = calculateWorkHours(clockIn, clockOut);
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const updated = await Attendance.findOneAndUpdate({ _id: id, ...orgQuery }, { $set: updateFields }, { returnDocument: "after" })
      .populate("employee", "fullName department position employeeId email avatar")
      .lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    // Validate organization access to prevent cross-tenant data access
    validateOrganizationAccess(updated, req);

    // If status updated to Absent or Late, notify employee
    if (status === "Absent" || status === "Late") {
      try {
        const targetEmpId = String(updated.employee?._id || updated.employee || "");
        const settingsDoc = await CompanySettings.getSingletonSettings().catch(() => ({}));
        if (status === "Absent") {
          const rate = settingsDoc?.absenceDeductionRate || 10;
          await createNotificationRecord({
            recipient_id: targetEmpId,
            recipient_role: "employee",
            sender_id: String(req.admin?.id || "admin"),
            sender_role: "admin",
            sender_name: req.admin?.fullName || "HR Administrator",
            title: "⚠️ Absence Recorded: Upcoming Payslip Deduction",
            message: `An absence for ${updated.date} was recorded. A deduction of GH₵${rate.toFixed(2)} will be applied to your upcoming payslip.`,
            type: "penalty_alert",
            category: "payroll",
            priority: "high",
            action_url: "/employee/dashboard/payslips",
            action_label: "View Payslip",
            metadata: { date: updated.date, absenceDeductionRate: rate, status: "Absent" },
          });
        } else if (status === "Late" && updated.clockIn) {
          const penaltyEval = evaluateLatenessPenalty(new Date(updated.clockIn), settingsDoc?.workStartTime || "08:00", settingsDoc || {});
          const penaltyVal = updated.latePenalty !== undefined && updated.latePenalty !== null
            ? Number(updated.latePenalty)
            : (penaltyEval.penalty || 0);
          const isZeroPenalty = penaltyVal === 0;
          const minsLate = penaltyEval.minutesLate || updated.lateMinutes || 0;
          const clockInTimeStr = penaltyEval.clockInFormatted || new Date(updated.clockIn).toLocaleTimeString();
          const notifTitle = isZeroPenalty
            ? "Clock-In Recorded (No Deduction)"
            : "⚠️ Lateness Penalty Alert: Upcoming Payslip Impact";
          const notifMessage = isZeroPenalty
            ? `Clocked in at ${clockInTimeStr} (${minsLate} mins late). Company policy applied: No salary deduction for this delay.`
            : `Clocked in at ${clockInTimeStr} (${minsLate} mins late). Lateness penalty of GH₵${penaltyVal.toFixed(
                2
              )} has been applied as per company policy.`;

          await createNotificationRecord({
            recipient_id: targetEmpId,
            recipient_role: "employee",
            sender_id: String(req.admin?.id || "admin"),
            sender_role: "admin",
            sender_name: req.admin?.fullName || "HR Administrator",
            title: notifTitle,
            message: notifMessage,
            type: isZeroPenalty ? "attendance_alert" : "penalty_alert",
            category: isZeroPenalty ? "attendance" : "payroll",
            priority: isZeroPenalty ? "info" : "high",
            action_url: isZeroPenalty ? "/employee/dashboard" : "/employee/dashboard/payslips",
            action_label: isZeroPenalty ? "View Attendance" : "View Payslip Impact",
            metadata: {
              date: updated.date,
              clockIn: updated.clockIn,
              minutesLate: minsLate,
              penaltyAmount: penaltyVal,
              latePenalty: penaltyVal,
              tier: penaltyEval.tier,
              deductionApplied: !isZeroPenalty,
            },
          });
        }
      } catch (notifErr) {
        console.warn("Failed to push update attendance alert:", notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully.",
      attendance: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Manager Quick Action: Excuse lateness entry
export const excuseAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, status = "Present" } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const existing = await Attendance.findOne({ _id: id, ...orgQuery });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    validateOrganizationAccess(existing, req);

    const adminName = req.admin?.fullName || req.user?.fullName || "Manager";
    const excuseNote = `[Excused by ${adminName}: ${reason || "Lateness penalty waived"}]`;
    const updatedNote = existing.notes ? `${existing.notes} | ${excuseNote}` : excuseNote;

    const updateFields = {
      isExcused: true,
      excuseReason: reason || "Lateness penalty waived by management",
      excusedBy: adminName,
      excusedAt: new Date(),
      latePenalty: 0,
      penaltyTier: "Excused",
      status: status || "Present",
      notes: updatedNote,
    };

    const updated = await Attendance.findOneAndUpdate({ _id: id, ...orgQuery }, { $set: updateFields }, { returnDocument: "after" })
      .populate("employee", "fullName department position employeeId email avatar")
      .lean();

    // Push notification to employee
    try {
      const targetEmpId = String(updated.employee?._id || updated.employee || "");
      await createNotificationRecord({
        recipient_id: targetEmpId,
        recipient_role: "employee",
        sender_id: String(req.admin?.id || "admin"),
        sender_role: "admin",
        sender_name: adminName,
        title: "🎉 Lateness Penalty Excused",
        message: `Your lateness on ${updated.date} has been excused by ${adminName}. The payroll penalty has been waived. Reason: "${reason || "Management discretion"}"`,
        type: "general",
        category: "attendance",
        priority: "medium",
        action_url: "/employee/dashboard/attendance",
        action_label: "View Attendance Log",
        metadata: { date: updated.date, isExcused: true, reason },
      });
    } catch (notifErr) {
      console.warn("Failed to push excuse notification:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Lateness for ${updated.employee?.fullName || "employee"} on ${updated.date} has been excused.`,
      attendance: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Manager Quick Action: Flag attendance record for HR/disciplinary review
export const flagAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, severity = "warning" } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const existing = await Attendance.findOne({ _id: id, ...orgQuery });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    validateOrganizationAccess(existing, req);

    const adminName = req.admin?.fullName || req.user?.fullName || "Manager";
    const flagNote = `[Flagged by ${adminName}: ${reason || "Flagged for HR/Manager review"}]`;
    const updatedNote = existing.notes ? `${existing.notes} | ${flagNote}` : flagNote;

    const updateFields = {
      flaggedForReview: true,
      flagReason: reason || "Flagged for HR/Manager Review",
      flaggedBy: adminName,
      flaggedAt: new Date(),
      notes: updatedNote,
    };

    const updated = await Attendance.findOneAndUpdate({ _id: id, ...orgQuery }, { $set: updateFields }, { returnDocument: "after" })
      .populate("employee", "fullName department position employeeId email avatar")
      .lean();

    // Push notification to employee
    try {
      const targetEmpId = String(updated.employee?._id || updated.employee || "");
      await createNotificationRecord({
        recipient_id: targetEmpId,
        recipient_role: "employee",
        sender_id: String(req.admin?.id || "admin"),
        sender_role: "admin",
        sender_name: adminName,
        title: "⚠️ Attendance Record Flagged for Review",
        message: `Your attendance on ${updated.date} has been flagged for administrative review: "${reason || "Requires review"}".`,
        type: "penalty_alert",
        category: "attendance",
        priority: "high",
        action_url: "/employee/dashboard/attendance",
        action_label: "View Attendance Log",
        metadata: { date: updated.date, flagReason: reason, severity },
      });
    } catch (notifErr) {
      console.warn("Failed to push flag notification:", notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Attendance on ${updated.date} flagged for review.`,
      attendance: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Manager Quick Action: Unflag attendance record
export const unflagAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const existing = await Attendance.findOne({ _id: id, ...orgQuery });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    validateOrganizationAccess(existing, req);

    const updated = await Attendance.findOneAndUpdate(
      { _id: id, ...orgQuery },
      { $set: { flaggedForReview: false, flagReason: "", flaggedBy: "", flaggedAt: null } },
      { returnDocument: "after" }
    )
      .populate("employee", "fullName department position employeeId email avatar")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Attendance flag removed.",
      attendance: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Manager Quick Action: Recalculate default penalty
export const recalculateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const record = await Attendance.findOne({ _id: id, ...orgQuery });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    validateOrganizationAccess(record, req);

    const settingsDoc = await CompanySettings.getSingletonSettings().catch(() => ({}));
    const updateFields = {
      isExcused: false,
      excuseReason: "",
      excusedBy: "",
      excusedAt: null,
    };

    if (record.clockIn) {
      const penaltyEval = evaluateLatenessPenalty(
        new Date(record.clockIn),
        settingsDoc?.workStartTime || "08:00",
        settingsDoc || {}
      );
      updateFields.delayMinutes = penaltyEval.minutesLate || 0;
      updateFields.lateMinutes = penaltyEval.minutesLate || 0;
      updateFields.latePenalty = penaltyEval.penalty || 0;
      updateFields.penaltyTier = penaltyEval.tier || "";
      updateFields.status = penaltyEval.minutesLate > 0 ? "Late" : "On Time";
    }

    const updated = await Attendance.findOneAndUpdate({ _id: id, ...orgQuery }, { $set: updateFields }, { returnDocument: "after" })
      .populate("employee", "fullName department position employeeId email avatar")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Attendance penalties and status recalculated according to policy.",
      attendance: updated,
    });
  } catch (error) {
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

// Admin manual entry creation
export const createManualAttendance = async (req, res) => {
  try {
    const { employeeId, date, clockIn, clockOut, status, notes } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and Date are required.",
      });
    }

    const resolvedEmpId = await resolveEmployeeObjectId(employeeId);
    if (!resolvedEmpId) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;

    if (orgId) {
      const empBelongs = await Employee.findOne({
        _id: resolvedEmpId,
        $or: [{ organizationId: orgId }, { companyId: orgId }],
      });
      if (!empBelongs) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Target employee does not belong to your company workspace.",
        });
      }
      validateOrganizationAccess(empBelongs, req);
    }

    let calculatedHours = 0;
    if (clockIn && clockOut) {
      calculatedHours = calculateWorkHours(clockIn, clockOut);
    }

    let settingsDoc = null;
    try {
      settingsDoc = await CompanySettings.getSingletonSettings();
    } catch {
      settingsDoc = {};
    }

    let delayMinutes = 0;
    let latePenalty = 0;
    let penaltyTier = "";
    let finalStatus = status || "Present";

    const safeClockInDate = clockIn ? safeDateTime(date, clockIn) : null;
    const safeClockOutDate = clockOut ? safeDateTime(date, clockOut) : null;

    if (safeClockInDate && !isNaN(safeClockInDate.getTime())) {
      const penaltyEval = evaluateLatenessPenalty(
        safeClockInDate,
        settingsDoc?.workStartTime || "08:00",
        settingsDoc || {}
      );
      delayMinutes = penaltyEval.minutesLate || 0;
      latePenalty = penaltyEval.penalty || 0;
      penaltyTier = penaltyEval.tier || "";
      if (!status) {
        finalStatus = delayMinutes > 0 ? "Late" : "On Time";
      }
    }

    const orgQuery = orgId ? { $or: [{ organizationId: orgId }, { companyId: orgId }] } : {};

    const record = await Attendance.findOneAndUpdate(
      { employee: resolvedEmpId, date, ...orgQuery },
      {
        $set: {
          clockIn: safeClockInDate && !isNaN(safeClockInDate.getTime()) ? safeClockInDate : null,
          clockOut: safeClockOutDate && !isNaN(safeClockOutDate.getTime()) ? safeClockOutDate : null,
          status: finalStatus,
          notes: notes || "Admin manual entry",
          workHours: !isNaN(calculatedHours) && Number.isFinite(calculatedHours) ? calculatedHours : 0,
          delayMinutes,
          lateMinutes: delayMinutes,
          latePenalty,
          penaltyTier,
          ...(orgId ? { organizationId: orgId, companyId: orgId } : {}),
          auditLog: {
            adminId: String(req.admin?._id || req.admin?.id || "admin"),
            adminName: req.admin?.fullName || "HR Administrator",
            reason: notes || "Manual attendance entry created by admin",
            timestamp: new Date(),
          },
        },
        $setOnInsert: {
          employee: resolvedEmpId,
          date,
          ...(orgId ? { organizationId: orgId, companyId: orgId } : {}),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).populate("employee", "fullName department position employeeId email avatar");

    // If status is Absent or Late, notify employee about upcoming deduction
    if (status === "Absent" || status === "Late") {
      try {
        const targetEmpId = String(resolvedEmpId || record?.employee?._id || record?.employee || "");
        const settingsDoc = await CompanySettings.getSingletonSettings().catch(() => ({}));
        if (status === "Absent") {
          const rate = settingsDoc?.absenceDeductionRate || 10;
          await createNotificationRecord({
            recipient_id: targetEmpId,
            recipient_role: "employee",
            sender_id: String(req.admin?.id || "admin"),
            sender_role: "admin",
            sender_name: req.admin?.fullName || "HR Administrator",
            title: "⚠️ Absence Recorded: Upcoming Payslip Deduction",
            message: `An absence for ${date} was recorded by HR. A deduction of GH₵${rate.toFixed(2)} will be applied to your upcoming payslip.`,
            type: "penalty_alert",
            category: "payroll",
            priority: "high",
            action_url: "/employee/dashboard/payslips",
            action_label: "View Payslip",
            metadata: { date, absenceDeductionRate: rate, status: "Absent" },
          });
        } else if (status === "Late" && clockIn) {
          const penaltyEval = evaluateLatenessPenalty(new Date(clockIn), settingsDoc?.workStartTime || "08:00", settingsDoc || {});
          const penaltyVal = latePenalty !== undefined && latePenalty !== null
            ? Number(latePenalty)
            : (penaltyEval.penalty || 0);
          const isZeroPenalty = penaltyVal === 0;
          const minsLate = penaltyEval.minutesLate || delayMinutes || 0;
          const clockInTimeStr = penaltyEval.clockInFormatted || new Date(clockIn).toLocaleTimeString();
          const notifTitle = isZeroPenalty
            ? "Clock-In Recorded (No Deduction)"
            : "⚠️ Lateness Penalty Alert: Upcoming Payslip Impact";
          const notifMessage = isZeroPenalty
            ? `Clocked in at ${clockInTimeStr} (${minsLate} mins late). Company policy applied: No salary deduction for this delay.`
            : `Clocked in at ${clockInTimeStr} (${minsLate} mins late). Lateness penalty of GH₵${penaltyVal.toFixed(
                2
              )} has been applied as per company policy.`;

          await createNotificationRecord({
            recipient_id: targetEmpId,
            recipient_role: "employee",
            sender_id: String(req.admin?.id || "admin"),
            sender_role: "admin",
            sender_name: req.admin?.fullName || "HR Administrator",
            title: notifTitle,
            message: notifMessage,
            type: isZeroPenalty ? "attendance_alert" : "penalty_alert",
            category: isZeroPenalty ? "attendance" : "payroll",
            priority: isZeroPenalty ? "info" : "high",
            action_url: isZeroPenalty ? "/employee/dashboard" : "/employee/dashboard/payslips",
            action_label: isZeroPenalty ? "View Attendance" : "View Payslip Impact",
            metadata: {
              date,
              clockIn,
              minutesLate: minsLate,
              penaltyAmount: penaltyVal,
              latePenalty: penaltyVal,
              tier: penaltyEval.tier,
              deductionApplied: !isZeroPenalty,
            },
          });
        }
      } catch (notifErr) {
        console.warn("Failed to push manual attendance creation alert:", notifErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Manual attendance record saved successfully.",
      attendance: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error),
    });
  }
};

/**
 * Bulk upload daily attendance logs from biometric time-clocks (CSV import)
 * Automatically updates individual employee attendance status, work hours & lateness for the period.
 */
export const bulkUploadBiometricAttendance = async (req, res) => {
  try {
    const { records, deviceId, autoCalculateStatus = true } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No biometric attendance records provided in bulk payload.",
      });
    }

    const tenantId = req.organizationId || req.companyId || req.user?.companyId || req.user?.organizationId;
    const tenantScope = tenantId ? { $or: [{ organizationId: tenantId }, { companyId: tenantId }] } : {};

    // 1. Fetch company settings for shift start time & lateness threshold
    let settings = {
      workStartTime: "08:00",
      absenceDeductionRate: 10,
    };
    try {
      let dbSettings = null;
      if (tenantId) {
        dbSettings = await CompanySettings.findById(tenantId).lean();
        if (!dbSettings) {
          dbSettings = await CompanySettings.findOne(tenantScope).lean();
        }
      }
      if (dbSettings) settings = { ...settings, ...dbSettings };
    } catch (err) {
      console.warn("Could not fetch company settings for bulk attendance:", err.message);
    }

    // 2. Fetch all employees for fast in-memory code/id/email lookup strictly scoped to tenant
    let allEmployeesList = [];
    try {
      allEmployeesList = await Employee.find(tenantScope).select("_id employeeId email fullName").lean();
    } catch (err) {
      console.warn("Could not query employees list:", err.message);
    }

    const employeeLookup = new Map();
    allEmployeesList.forEach((emp) => {
      const idStr = emp._id.toString();
      employeeLookup.set(idStr, emp);
      if (emp.employeeId) employeeLookup.set(emp.employeeId.toUpperCase().trim(), emp);
      if (emp.email) employeeLookup.set(emp.email.toLowerCase().trim(), emp);
      if (emp.fullName) employeeLookup.set(emp.fullName.toLowerCase().trim(), emp);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];
    const processedRecords = [];

    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      const rowNum = i + 1;

      const rawEmpId = String(raw.employeeId || raw.staffId || raw.id || raw.code || raw.badgeNo || "").trim();
      const rawDate = String(raw.date || "").trim();

      if (!rawEmpId || !rawDate) {
        errors.push({
          row: rowNum,
          error: "Missing required Employee ID or Date.",
          data: raw,
        });
        continue;
      }

      // Match employee
      const matchedEmp =
        employeeLookup.get(rawEmpId) ||
        employeeLookup.get(rawEmpId.toUpperCase()) ||
        employeeLookup.get(rawEmpId.toLowerCase());

      if (!matchedEmp) {
        errors.push({
          row: rowNum,
          error: `Employee with identifier "${rawEmpId}" not found in system.`,
          data: raw,
        });
        continue;
      }

      // Normalize date (format to YYYY-MM-DD)
      let normalizedDate = rawDate;
      if (rawDate.includes("/")) {
        const parts = rawDate.split("/");
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            // DD/MM/YYYY or MM/DD/YYYY -> normalize
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const p2 = parseInt(parts[2], 10);
            if (p0 > 12) {
              // DD/MM/YYYY
              normalizedDate = `${p2}-${String(p1).padStart(2, "0")}-${String(p0).padStart(2, "0")}`;
            } else {
              // MM/DD/YYYY or DD/MM/YYYY
              normalizedDate = `${p2}-${String(p0).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
            }
          }
        }
      }

      // Parse clockIn and clockOut
      let clockInDate = null;
      let clockOutDate = null;

      if (raw.clockIn && raw.clockIn !== "--" && raw.clockIn !== "null") {
        if (String(raw.clockIn).includes("T") || String(raw.clockIn).includes("-")) {
          clockInDate = new Date(raw.clockIn);
        } else {
          // Time only e.g. "08:15" or "08:15:00"
          const timeParts = String(raw.clockIn).trim().split(":");
          const d = new Date(`${normalizedDate}T00:00:00`);
          if (timeParts.length >= 2) {
            d.setHours(parseInt(timeParts[0], 10) || 0, parseInt(timeParts[1], 10) || 0, parseInt(timeParts[2], 10) || 0);
            clockInDate = d;
          }
        }
      }

      if (raw.clockOut && raw.clockOut !== "--" && raw.clockOut !== "null") {
        if (String(raw.clockOut).includes("T") || String(raw.clockOut).includes("-")) {
          clockOutDate = new Date(raw.clockOut);
        } else {
          const timeParts = String(raw.clockOut).trim().split(":");
          const d = new Date(`${normalizedDate}T00:00:00`);
          if (timeParts.length >= 2) {
            d.setHours(parseInt(timeParts[0], 10) || 0, parseInt(timeParts[1], 10) || 0, parseInt(timeParts[2], 10) || 0);
            clockOutDate = d;
          }
        }
      }

      // Calculate work hours
      let calculatedHours = Number(raw.workHours) || 0;
      if (!calculatedHours && clockInDate && clockOutDate) {
        const diffMs = Math.max(0, clockOutDate.getTime() - clockInDate.getTime());
        calculatedHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
      } else if (!calculatedHours && clockInDate) {
        calculatedHours = 8; // standard workday default
      }

      // Determine attendance status
      let determinedStatus = raw.status ? String(raw.status).trim() : "";
      if (!determinedStatus || autoCalculateStatus) {
        if (!clockInDate && !clockOutDate) {
          determinedStatus = "Absent";
        } else if (clockInDate) {
          const evalRes = evaluateLatenessPenalty(
            clockInDate,
            settings.workStartTime || "08:00",
            settings
          );
          if (evalRes.minutesLate > 0) {
            determinedStatus = "Late";
          } else {
            determinedStatus = "On Time";
          }
        } else {
          determinedStatus = "Present";
        }
      }

      const noteText = raw.notes || (deviceId || raw.deviceId ? `Biometric Time-Clock (Device: ${deviceId || raw.deviceId})` : "Biometric Time-Clock Log");

      try {
        const existing = await Attendance.findOne({
          employee: matchedEmp._id,
          date: normalizedDate,
          ...(tenantId ? { $or: [{ organizationId: tenantId }, { companyId: tenantId }] } : {}),
        });

        if (existing) {
          existing.clockIn = clockInDate || existing.clockIn;
          existing.clockOut = clockOutDate || existing.clockOut;
          existing.workHours = calculatedHours || existing.workHours;
          existing.status = determinedStatus || existing.status;
          existing.notes = noteText;
          if (tenantId && !existing.companyId) {
            existing.companyId = tenantId;
            existing.organizationId = tenantId;
          }
          await existing.save();
          updatedCount++;
          processedRecords.push(existing);
        } else {
          const newRec = await Attendance.create({
            employee: matchedEmp._id,
            date: normalizedDate,
            clockIn: clockInDate,
            clockOut: clockOutDate,
            workHours: calculatedHours,
            status: determinedStatus,
            notes: noteText,
            ...(tenantId ? { companyId: tenantId, organizationId: tenantId } : {}),
          });
          createdCount++;
          processedRecords.push(newRec);
        }
      } catch (saveErr) {
        errors.push({
          row: rowNum,
          error: safeErrorMessage(saveErr, "Failed to save attendance record to database."),
          data: raw,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Bulk biometric attendance uploaded: ${createdCount} created, ${updatedCount} updated, ${errors.length} skipped.`,
      stats: {
        totalReceived: records.length,
        createdCount,
        updatedCount,
        errorCount: errors.length,
      },
      errors,
    });
  } catch (error) {
    console.error("Error in bulkUploadBiometricAttendance:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to process bulk biometric attendance upload."),
    });
  }
};

// Sync & Re-evaluate attendance lateness & penalty logs for current pay period
export const syncAttendancePenalties = async (req, res) => {
  try {
    let employeeId =
      req.user?._id ||
      req.user?.id ||
      req.employee?.id ||
      req.employee?._id ||
      req.body?.employeeId ||
      req.query?.employeeId;

    const isAdmin = ["admin", "manager", "company_admin"].includes(String(req.user?.role || "").toLowerCase());
    const resolvedId = employeeId ? await resolveEmployeeObjectId(employeeId) : null;

    let settingsDoc = null;
    try {
      settingsDoc = await CompanySettings.getSingletonSettings();
    } catch {
      settingsDoc = {};
    }

    const workStartTime = settingsDoc?.workStartTime || "08:00";
    const now = new Date();
    const currentYear = Number(req.query?.year || req.body?.year || now.getFullYear());
    const currentMonth = Number(req.query?.month || req.body?.month || (now.getMonth() + 1));
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    const tenantId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const tenantScope = tenantId ? { $or: [{ organizationId: tenantId }, { companyId: tenantId }] } : {};

    const dateFilter = {
      $or: [
        { date: { $regex: `^${monthPrefix}` } },
        { clockIn: { $gte: new Date(currentYear, currentMonth - 1, 1), $lte: new Date(currentYear, currentMonth, 0, 23, 59, 59) } },
      ],
    };

    // Build filter for records in the current pay period
    let filter = {};
    if (!isAdmin && resolvedId) {
      filter = {
        employee: resolvedId,
        ...dateFilter,
        ...tenantScope,
      };
    } else {
      filter = {
        ...dateFilter,
        ...tenantScope,
      };
    }

    const records = await Attendance.find(filter).populate("employee", "fullName employeeId email baseSalary");

    let recordsEvaluated = 0;
    let latenessCount = 0;
    let totalPenaltyDeductions = 0;

    for (const record of records) {
      if (record.clockIn) {
        const checkInDate = new Date(record.clockIn);
        if (!isNaN(checkInDate.getTime())) {
          const evalResult = evaluateLatenessPenalty(checkInDate, workStartTime, settingsDoc || {});
          const delayMins = evalResult.delayMinutes ?? evalResult.minutesLate ?? 0;
          const penaltyVal = evalResult.latePenalty ?? evalResult.penalty ?? 0;
          const tierName = evalResult.tier || (delayMins > 0 ? "Late" : "On Time");

          record.delayMinutes = delayMins;
          record.lateMinutes = delayMins;
          record.latePenalty = penaltyVal;
          record.penaltyTier = tierName;

          if (delayMins > 0) {
            record.status = "Late";
            latenessCount += 1;
            totalPenaltyDeductions += penaltyVal;
          } else if (record.status === "Late") {
            record.status = "On Time";
          }

          await record.save();
          recordsEvaluated += 1;

          // Update liveAttendanceStore as well
          const empIdStr = String(record.employee?._id || record.employee || "");
          const dateStr = record.date || checkInDate.toISOString().split("T")[0];
          if (empIdStr && dateStr) {
            const liveKey = `${empIdStr}_${dateStr}`;
            if (liveAttendanceStore.has(liveKey)) {
              const liveRec = liveAttendanceStore.get(liveKey);
              liveAttendanceStore.set(liveKey, {
                ...liveRec,
                delayMinutes: delayMins,
                lateMinutes: delayMins,
                latePenalty: penaltyVal,
                penaltyTier: tierName,
                status: record.status,
              });
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully re-evaluated attendance logs for ${recordsEvaluated} records in pay period ${monthPrefix}.`,
      recordsEvaluated,
      latenessCount,
      totalPenaltyDeductions,
      payPeriod: monthPrefix,
      workStartTime,
    });
  } catch (error) {
    console.error("Error in syncAttendancePenalties:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to re-evaluate attendance penalty logs."),
    });
  }
};

// Delete attendance record permanently from database
export const deleteAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Attendance record ID parameter is required.",
      });
    }

    // Remove from in-memory reactive store
    if (liveAttendanceStore instanceof Map) {
      for (const [key, record] of liveAttendanceStore.entries()) {
        if (
          record &&
          (String(record._id) === String(id) || String(record.id) === String(id))
        ) {
          liveAttendanceStore.delete(key);
        }
      }
    } else if (Array.isArray(liveAttendanceStore)) {
      const storeIdx = liveAttendanceStore.findIndex(
        (a) => String(a._id) === String(id) || String(a.id) === String(id)
      );
      if (storeIdx !== -1) {
        liveAttendanceStore.splice(storeIdx, 1);
      }
    }

    // Remove from MongoDB Database with strict tenant scoping
    const orgId = req.user?.organizationId || req.user?.companyId || req.organizationId || req.companyId;
    const orgQuery = orgId
      ? { $or: [{ organizationId: orgId }, { companyId: orgId }] }
      : {};

    const existingRecord = await Attendance.findOne({ _id: id, ...orgQuery });
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found in your company workspace.",
      });
    }

    validateOrganizationAccess(existingRecord, req);

    let deletedDoc = null;
    try {
      deletedDoc = await Attendance.findOneAndDelete({ _id: id, ...orgQuery });
    } catch (dbErr) {
      console.warn("DB delete attendance error:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record permanently deleted from database.",
      id,
    });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    const statusCode = error.message === "Unauthorized" || error.statusCode === 403 ? 403 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: safeErrorMessage(error, "Failed to delete attendance record."),
    });
  }
};

// GET /api/attendance/performance-metrics
export const getPerformanceMetrics = async (req, res) => {
  try {
    // Only admins/managers may request another employee's metrics; everyone else always gets their own.
    const callerRole = String(req.user?.role || "").toLowerCase();
    const isPrivileged = ["admin", "manager", "company_admin"].includes(callerRole);
    let employeeId = isPrivileged
      ? (req.query?.employeeId || req.user?._id || req.user?.id)
      : (req.user?._id || req.user?.id || req.employee?.id || req.employee?._id);

    const { month, week, startDate, endDate } = req.query;
    const query = {};
    if (req.organizationId) {
      query.$or = [{ organizationId: req.organizationId }, { companyId: req.organizationId }];
    }
    if (employeeId && isValidObjectId(employeeId)) {
      query.employee = employeeId;
    }
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (month) {
      query.date = { $regex: `^${String(month).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` };
    }

    let records = [];
    try {
      records = await Attendance.find(query).sort({ date: 1 }).lean();
    } catch (dbErr) {
      console.warn("Could not query attendance records for performance:", dbErr.message);
    }

    let hoursWorked = 0;
    let onTimeCheckIns = 0;
    let lateCheckIns = 0;
    let absentDays = 0;
    let activeDays = 0;

    for (const r of records) {
      const status = (r.status || "").toLowerCase();
      const hrs = parseFloat(r.workHours) || (r.checkOut && r.checkIn ? 8 : (r.status === "Present" ? 8 : 0));
      hoursWorked += hrs;

      if (status.includes("late")) {
        lateCheckIns++;
        activeDays++;
      } else if (status.includes("absent") || status.includes("leave")) {
        absentDays++;
      } else if (status.includes("present") || hrs > 0) {
        onTimeCheckIns++;
        activeDays++;
      }
    }

    const isWeekRange = week && week !== "all";
    const requiredHours = isWeekRange ? 40 : 160;
    const shiftCompliance = requiredHours > 0 ? Math.min(100, Math.round((hoursWorked / requiredHours) * 100)) : 100;
    const punctualityRate = activeDays > 0 ? Math.round((onTimeCheckIns / activeDays) * 100) : 100;

    return res.status(200).json({
      success: true,
      data: {
        records,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        requiredHours,
        shiftCompliance,
        punctualityRate,
        activeDays,
        onTimeCheckIns,
        lateCheckIns,
        absentDays,
      },
    });
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(error, "Failed to calculate performance metrics"),
    });
  }
};

/**
 * Explicit endpoint handler to force clock-out incomplete sessions from previous days
 */
export const forceClockOutHandler = async (req, res) => {
  try {
    const rawAuthId = req.user?._id || req.user?.id || req.employee?.id || req.employee?._id;
    const resolvedId = await resolveEmployeeObjectId(rawAuthId);
    const result = await autoCloseUnfinishedShifts(resolvedId || rawAuthId, req.user || req.employee);

    return res.status(200).json({
      success: true,
      message: result.modifiedCount > 0
        ? `Successfully force clocked out ${result.modifiedCount} unclosed session(s) from previous day(s).`
        : "No unclosed sessions from previous days were found.",
      forceClosedCount: result.modifiedCount,
      forceClosed: result.modifiedCount > 0,
      records: result.records || [],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: safeErrorMessage(err),
    });
  }
};



// Classify a stored attendance status into the calendar buckets used by Admin and Employee views
const historyBucket = (record) => {
  const s = String(record?.status || "").toLowerCase();
  if (s === "absent") return "absent";
  if (s.includes("late") || Number(record?.lateMinutes || record?.delayMinutes || 0) > 0) return "late";
  if (record?.clockIn || record?.clockInTime || ["present", "on time", "ontime", "completed", "auto-closed"].includes(s)) return "present";
  return "other";
};

/** Attendance history for one employee document: stored records (incl. automatic absences), approved leave and totals. */
const buildAttendanceHistory = async (employee) => {
  const codes = [employee.employeeId].filter(Boolean);
  const records = await Attendance.find({
    $or: [
      { employee: employee._id },
      { userId: employee._id },
      ...(codes.length ? [{ employeeId: { $in: codes } }] : []),
    ],
  })
    .sort({ clockIn: -1, createdAt: -1 })
    .lean();

  // One entry per working day (older records may exist in two date formats)
  const byDay = new Map();
  for (const r of records) {
    const dateKey = attendanceDateKey(r.date) || attendanceDateKey(r.clockIn || r.clockInTime || r.createdAt);
    if (!dateKey) continue;
    const existing = byDay.get(dateKey);
    // Prefer the record that actually holds a clock-in over a bare placeholder
    if (!existing || (!existing.clockIn && r.clockIn)) {
      byDay.set(dateKey, {
        _id: r._id,
        date: dateKey,
        status: r.status || "",
        bucket: historyBucket(r),
        clockIn: r.clockIn || r.clockInTime || null,
        clockOut: r.clockOut || r.clockOutTime || null,
        workHours: Number(r.workHours || 0),
        lateMinutes: Number(r.lateMinutes || r.delayMinutes || 0),
        latePenalty: Number(r.latePenalty || 0),
        lateReason: r.lateReason || "",
        notes: r.notes || "",
        isExcused: Boolean(r.isExcused),
        excuseReason: r.excuseReason || "",
        autoClockedOut: Boolean(r.autoClockedOut),
        automaticAbsence: r.absenceSource === SYSTEM_ABSENCE_SOURCE,
        recordedAbsentAt: r.recordedAbsentAt || null,
      });
    }
  }
  const history = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  const leaves = await Leave.find({ employee: employee._id, status: { $in: ["Approved", "approved"] } })
    .select("leaveType startDate endDate totalDays reason")
    .sort({ startDate: -1 })
    .lean();
  const approvedLeaves = leaves.map((l) => ({
    _id: l._id,
    leaveType: l.leaveType || "Leave",
    startDate: attendanceDateKey(l.startDate),
    endDate: attendanceDateKey(l.endDate),
    totalDays: l.totalDays || null,
    reason: l.reason || "",
  }));

  const count = (bucket) => history.filter((h) => h.bucket === bucket).length;
  return {
    history,
    approvedLeaves,
    summary: {
      totalRecords: history.length,
      present: count("present"),
      late: count("late"),
      absent: count("absent"),
      automaticAbsences: history.filter((h) => h.bucket === "absent" && h.automaticAbsence).length,
      approvedLeaveRequests: approvedLeaves.length,
      totalWorkHours: Number(history.reduce((sum, h) => sum + h.workHours, 0).toFixed(1)),
    },
    workSchedule: await resolveWorkSchedule(),
  };
};

const HISTORY_EMPLOYEE_FIELDS = "fullName employeeId department position email avatar profilePicture employmentDate status";

/**
 * GET /api/attendance/employee/:employeeId/history   (Admin only)
 * Attendance/absence history for the employee being viewed in Employee Details.
 */
export const getEmployeeAttendanceHistory = async (req, res) => {
  try {
    await ensureAbsencesProcessed();
    const rawId = String(req.params.employeeId || "").trim();
    const employee = await Employee.findOne(isValidObjectId(rawId) ? { _id: rawId } : { employeeId: rawId })
      .select(HISTORY_EMPLOYEE_FIELDS)
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }
    return res.status(200).json({ success: true, employee, ...(await buildAttendanceHistory(employee)) });
  } catch (error) {
    console.error("Error in getEmployeeAttendanceHistory:", error);
    return res.status(500).json({ success: false, message: safeErrorMessage(error, "Failed to load attendance history.") });
  }
};

/**
 * GET /api/attendance/my-history   (authenticated employee)
 * The caller's own history. The employee is resolved only from the verified auth token;
 * no id from the URL, query or body is ever used, so other employees' records cannot be requested.
 */
export const getMyAttendanceHistory = async (req, res) => {
  try {
    await ensureAbsencesProcessed();
    const authId = req.user?._id || req.user?.id || req.employee?._id || req.employee?.id;
    const authEmail = String(req.user?.email || req.employee?.email || "").toLowerCase().trim();
    const authCode = req.user?.employeeId || req.employee?.employeeId;

    let employee = null;
    if (isValidObjectId(authId)) {
      employee = await Employee.findById(authId).select(HISTORY_EMPLOYEE_FIELDS).lean();
    }
    if (!employee && authEmail) {
      employee = await Employee.findOne({ email: authEmail }).select(HISTORY_EMPLOYEE_FIELDS).lean();
    }
    if (!employee && authCode) {
      employee = await Employee.findOne({ employeeId: authCode }).select(HISTORY_EMPLOYEE_FIELDS).lean();
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: "No employee profile is linked to this account." });
    }
    return res.status(200).json({ success: true, employee, ...(await buildAttendanceHistory(employee)) });
  } catch (error) {
    console.error("Error in getMyAttendanceHistory:", error);
    return res.status(500).json({ success: false, message: safeErrorMessage(error, "Failed to load your attendance history.") });
  }
};
