/** Sundays are company holidays, using the company's Ghana calendar day. */
export const isSundayHoliday = (value = new Date()) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Accra", weekday: "short" }).format(date) === "Sun";
};
export const SUNDAY_HOLIDAY_MESSAGE = "Sunday is a holiday. Clock-in is unavailable and no attendance will be recorded.";
