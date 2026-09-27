import mongoose from "mongoose";
import { Attendance } from "../models/attendanceModel.js";
import { Employee } from "../models/employeeModel.js";
import { Leave } from "../models/leaveModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { attendanceDateKey, startOfAttendanceDay, WEEKDAY_NAMES } from "../utils/attendanceDate.js";
import { resolveWorkSchedule, closingTimeFor } from "../utils/workSchedule.js";

/**
 * Automatic absence recording at company closing time.
 *
 * For each working day whose configured closing time has passed:
 *  - every active employee (same population as the admin employee directory: role not admin/manager,
 *    not inactive/suspended/terminated/on leave, already hired on that day)
 *  - who has no attendance record for that day (any status, including admin overrides)
 *  - and is not covered by an approved leave request
 * gets a permanent "Absent" record for that date.
 *
 * Idempotent: records are inserted with an upsert on { employee, date } (unique index), so
 * repeated or concurrent runs never create duplicates, and existing records are never modified.
 */

const LOOKBACK_DAYS = 7; // catch up on recently closed days if the server was offline at closing time
const EXCLUDED_STATUSES = ["inactive", "suspended", "terminated", "on leave", "on-leave"];
export const SYSTEM_ABSENCE_SOURCE = "system";

let inFlight = null;
let lastRunAt = 0;

/** First day automatic absences apply to; persisted so enabling the feature never back-fills older history. */
const resolveTrackingStart = async (todayKey) => {
  try {
    const company = await CompanySettings.findOne().select("_id absenceTrackingStartedOn").lean();
    if (!company) return { startKey: todayKey, companyId: null };
    if (company.absenceTrackingStartedOn) return { startKey: company.absenceTrackingStartedOn, companyId: company._id };
    await CompanySettings.updateOne(
      { _id: company._id, $or: [{ absenceTrackingStartedOn: { $exists: false } }, { absenceTrackingStartedOn: "" }, { absenceTrackingStartedOn: null }] },
      { $set: { absenceTrackingStartedOn: todayKey } }
    );
    const refreshed = await CompanySettings.findById(company._id).select("absenceTrackingStartedOn").lean();
    return { startKey: refreshed?.absenceTrackingStartedOn || todayKey, companyId: company._id };
  } catch {
    return { startKey: todayKey, companyId: null };
  }
};

const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v ? String(v) : "");

const processDay = async ({ dayStart, key, schedule, employees, companyId, now }) => {
  const dayEnd = new Date(dayStart.getTime());
  dayEnd.setHours(23, 59, 59, 999);

  // Anyone with any record for the day (clock-in, admin override, excuse, previous absence...) is left alone.
  const recorded = new Set();
  const [records, legacy, leaves] = await Promise.all([
    Attendance.find({
      $or: [{ date: key }, { clockIn: { $gte: dayStart, $lte: dayEnd } }, { clockInTime: { $gte: dayStart, $lte: dayEnd } }],
    })
      .select("employee userId employeeId")
      .lean(),
    // Records written before date normalisation stored Date.toString() (e.g. "Sun Sep 27 2026 00:00:00 GMT...").
    Attendance.collection
      .find({ date: { $regex: `^${dayStart.toDateString()}` } }, { projection: { employee: 1, userId: 1, employeeId: 1 } })
      .toArray(),
    Leave.find({
      status: { $in: ["Approved", "approved"] },
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .select("employee")
      .lean(),
  ]);
  for (const r of [...records, ...legacy]) {
    [idOf(r.employee), idOf(r.userId), r.employeeId ? String(r.employeeId) : ""].filter(Boolean).forEach((v) => recorded.add(v));
  }
  const onLeave = new Set(leaves.map((l) => idOf(l.employee)).filter(Boolean));

  let created = 0;
  for (const emp of employees) {
    const id = String(emp._id);
    if (recorded.has(id) || (emp.employeeId && recorded.has(String(emp.employeeId)))) continue;
    if (onLeave.has(id)) continue;
    const hiredOn = emp.employmentDate || emp.createdAt;
    if (hiredOn && new Date(hiredOn) > dayEnd) continue;

    const orgId = emp.organizationId || emp.companyId || companyId || null;
    try {
      const result = await Attendance.updateOne(
        { employee: emp._id, date: key },
        {
          $setOnInsert: {
            employee: emp._id,
            userId: emp._id,
            employeeId: emp.employeeId || "",
            date: key,
            status: "Absent",
            shiftStatus: "Absent",
            clockIn: null,
            clockInTime: null,
            clockOut: null,
            clockOutTime: null,
            workHours: 0,
            absenceSource: SYSTEM_ABSENCE_SOURCE,
            recordedAbsentAt: now,
            notes: `Automatically recorded as Absent: no check-in was recorded before the company closing time (${schedule.workEndTime}).`,
            auditLog: { adminId: "system", adminName: "System (automatic)", reason: "No check-in by company closing time", timestamp: now },
            ...(orgId ? { organizationId: orgId, companyId: orgId } : {}),
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) created += 1;
    } catch (err) {
      if (err?.code !== 11000) console.warn(`[Absence] Could not record absence for ${id} on ${key}:`, err.message);
    }
  }
  return created;
};

export const processClosedDayAbsences = async ({ now = new Date() } = {}) => {
  if (mongoose.connection.readyState !== 1) return { created: 0, skipped: true };

  const schedule = await resolveWorkSchedule();
  const workingDays = new Set(schedule.workingDays.map((d) => d.toLowerCase()));
  const todayKey = attendanceDateKey(now);
  const { startKey, companyId } = await resolveTrackingStart(todayKey);

  // Closed working days inside the look-back window, oldest first
  const days = [];
  for (let offset = LOOKBACK_DAYS; offset >= 0; offset -= 1) {
    const probe = new Date(now.getTime());
    probe.setDate(probe.getDate() - offset);
    const key = attendanceDateKey(probe);
    if (key < startKey) continue;
    const dayStart = startOfAttendanceDay(key);
    if (!workingDays.has(WEEKDAY_NAMES[dayStart.getDay()].toLowerCase())) continue;
    if (now < closingTimeFor(dayStart, schedule.workEndTime)) continue; // never before official closing time
    days.push({ key, dayStart });
  }
  if (days.length === 0) return { created: 0, days: 0 };

  const employees = await Employee.find({
    role: { $nin: ["admin", "manager"] },
    isActive: { $ne: false },
    status: { $nin: EXCLUDED_STATUSES },
  })
    .select("_id employeeId employmentDate createdAt organizationId companyId")
    .lean();
  if (employees.length === 0) return { created: 0, days: days.length };

  let created = 0;
  for (const day of days) {
    created += await processDay({ ...day, schedule, employees, companyId, now });
  }
  if (created > 0) {
    console.log(`[Absence] Recorded ${created} automatic absence(s) after closing time (${schedule.workEndTime}).`);
  }
  return { created, days: days.length };
};

/**
 * Throttled entry point used by the scheduled sweep and by attendance read endpoints
 * (the latter keeps serverless deployments, which have no background timer, up to date).
 */
export const ensureAbsencesProcessed = async ({ minIntervalMs = 60 * 1000 } = {}) => {
  if (inFlight) return inFlight;
  if (Date.now() - lastRunAt < minIntervalMs) return { created: 0, throttled: true };
  inFlight = processClosedDayAbsences()
    .catch((err) => {
      console.warn("[Absence] Processing error:", err.message);
      return { created: 0, error: true };
    })
    .finally(() => {
      lastRunAt = Date.now();
      inFlight = null;
    });
  return inFlight;
};
