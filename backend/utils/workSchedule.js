import { Settings } from "../models/adminSettingsModel.js";
import { CompanySettings } from "../models/CompanySettings.js";
import { WEEKDAY_NAMES } from "./attendanceDate.js";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DEFAULTS = {
  workStartTime: "08:00",
  workEndTime: "19:00",
  // Sunday is the only rest day unless the admin configures otherwise.
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// Last resolved working days, for synchronous day-of-week checks (payroll maths, dashboards).
let cachedWorkingDays = new Set(DEFAULTS.workingDays.map((d) => d.toLowerCase()));
let cachedAt = 0;
const CACHE_TTL_MS = 30 * 1000;

const validTime = (t) => (typeof t === "string" && TIME_RE.test(t.trim()) ? t.trim() : null);
const validDays = (d) => (Array.isArray(d) && d.length > 0 ? d.map((x) => String(x).trim()).filter(Boolean) : null);

/**
 * Company working schedule as configured by the admin.
 * Source of truth is the Attendance settings saved from Admin → Settings → Attendance
 * (Settings.attendance). CompanySettings attendance/working-hours values are the fallback,
 * then the model defaults. No timezone is stored anywhere in the system, so times are
 * interpreted in the server's local time, exactly like clock-in/out already does.
 */
export const resolveWorkSchedule = async () => {
  let attendance = null;
  let company = null;
  try {
    attendance = (await Settings.findOne().select("attendance").lean())?.attendance || null;
  } catch {
    attendance = null;
  }
  try {
    company = await CompanySettings.findOne().select("attendanceSettings workingHours").lean();
  } catch {
    company = null;
  }

  const schedule = {
    workStartTime:
      validTime(attendance?.workStartTime) ||
      validTime(company?.attendanceSettings?.workStartTime) ||
      validTime(company?.workingHours?.workStartTime) ||
      DEFAULTS.workStartTime,
    workEndTime:
      validTime(attendance?.workEndTime) ||
      validTime(company?.attendanceSettings?.workEndTime) ||
      validTime(company?.workingHours?.workEndTime) ||
      DEFAULTS.workEndTime,
    workingDays:
      (validDays(attendance?.workingDays) ||
      validDays(company?.attendanceSettings?.workingDays) ||
      validDays(company?.workingHours?.workingDays) ||
      DEFAULTS.workingDays).filter((day) => day.toLowerCase() !== "sunday"),
  };

  cachedWorkingDays = new Set(schedule.workingDays.map((d) => d.toLowerCase()));
  cachedAt = Date.now();
  return schedule;
};

/**
 * Re-reads the admin's working days into the cache (at most every 30s unless forced).
 * Called before API requests and immediately after the admin saves attendance settings.
 */
export const refreshWorkingDays = async ({ force = false } = {}) => {
  if (!force && Date.now() - cachedAt < CACHE_TTL_MS) return;
  try {
    await resolveWorkSchedule();
  } catch {
    // keep the previous cache
  }
};

/** Whether the company works on this date, per the admin's working days (Sunday is always a rest day). */
export const isWorkingDay = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return cachedWorkingDays.has(WEEKDAY_NAMES[d.getDay()].toLowerCase());
};

/** Current working day names (from the cache), e.g. ["Monday", …, "Saturday"]. */
export const getCachedWorkingDays = () =>
  WEEKDAY_NAMES.filter((name) => cachedWorkingDays.has(name.toLowerCase()));

/** Date at which the working day identified by `dayStart` (local midnight) closes. */
export const closingTimeFor = (dayStart, workEndTime) => {
  const [h, m] = workEndTime.split(":").map(Number);
  const close = new Date(dayStart.getTime());
  close.setHours(h, m, 0, 0);
  return close;
};
