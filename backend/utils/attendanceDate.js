/**
 * Attendance day keys.
 * Every attendance record is keyed by a "YYYY-MM-DD" string. This mirrors the convention
 * already used by clock-in/clock-out (`startOfToday.toISOString().split("T")[0]` with
 * startOfToday at local midnight), so records written by any code path agree on the same key.
 */

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const attendanceDateKey = (value = new Date()) => {
  if (typeof value === "string" && DAY_KEY_RE.test(value)) return value;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
};

/** Mongoose setter: normalise Date objects and long date strings to the day key; leave anything unparseable untouched. */
export const normalizeAttendanceDate = (value) => {
  if (value === null || value === undefined || value === "") return value;
  return attendanceDateKey(value) ?? value;
};

/** Local-midnight Date for a day key (inverse of attendanceDateKey for keys it produced). */
export const startOfAttendanceDay = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  const probe = new Date(y, m - 1, d, 12, 0, 0, 0);
  probe.setHours(0, 0, 0, 0);
  // In zones east of UTC, local midnight serialises to the previous UTC date; shift until keys agree.
  if (attendanceDateKey(probe) !== key) probe.setDate(probe.getDate() + 1);
  return probe;
};

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
