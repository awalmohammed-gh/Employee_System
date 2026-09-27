import { useEffect, useMemo, useState } from "react";
import { api } from "../apis/axios";

/**
 * Company working days as configured in Admin → Settings → Attendance.
 * Sunday is always a rest day; every other day follows the admin's selection.
 */
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHANGE_EVENT = "work-schedule-changed";

const toSet = (days) =>
  new Set(
    (Array.isArray(days) && days.length ? days : DEFAULT_WORKING_DAYS)
      .map((d) => String(d).trim().toLowerCase())
      .filter((d) => d && d !== "sunday")
  );

let workingDaySet = toSet(DEFAULT_WORKING_DAYS);
let loadPromise = null;

const load = () => {
  if (!loadPromise) {
    loadPromise = api
      .get("/attendance/work-schedule")
      .then((res) => {
        if (res?.data?.success) {
          workingDaySet = toSet(res.data.workSchedule?.workingDays);
          window.dispatchEvent(new Event(CHANGE_EVENT));
        }
      })
      .catch(() => {
        loadPromise = null; // retry on next use
      });
  }
  return loadPromise;
};

/** Whether the company works on this date (per the admin's working days). */
export const isWorkingDay = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return workingDaySet.has(WEEKDAY_NAMES[d.getDay()].toLowerCase());
};

/** Whether this weekday index (0 = Sunday … 6 = Saturday) is a working day. */
export const isWorkingWeekday = (dayIndex) => workingDaySet.has(WEEKDAY_NAMES[dayIndex]?.toLowerCase());

/** Call after the admin saves new working days so every calendar re-reads them. */
export const setWorkingDays = (days) => {
  workingDaySet = toSet(days);
  loadPromise = Promise.resolve();
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

// Checker bound to one snapshot of the working days, so its identity changes when they change.
const makeChecker = (days) => (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return days.has(WEEKDAY_NAMES[d.getDay()].toLowerCase());
};

/**
 * React hook: loads the schedule once and re-renders when it changes.
 * `isWorkingDay` gets a new identity whenever the working days change, so list it in memo deps.
 */
export const useWorkSchedule = () => {
  const [days, setDays] = useState(workingDaySet);
  useEffect(() => {
    const onChange = () => setDays(workingDaySet);
    window.addEventListener(CHANGE_EVENT, onChange);
    load();
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  const check = useMemo(() => makeChecker(days), [days]);
  return { isWorkingDay: check };
};
