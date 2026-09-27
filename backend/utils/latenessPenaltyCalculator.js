/**
 * Centralized Dynamic Lateness Penalty Calculator
 * Single source of truth across Attendance tracking, manual overrides, and Payroll processing.
 *
 * 6 Lateness Tiers:
 * - Tier 1: 1 – 30 mins
 * - Tier 2: 31 – 60 mins (up to 1 hr)
 * - Tier 3: 61 – 120 mins (1 – 2 hrs)
 * - Tier 4: 121 – 180 mins (2 – 3 hrs)
 * - Tier 5: 181 – 240 mins (3 – 4 hrs)
 * - Tier 6: 241 – 300+ mins (4+ hrs)
 */

export const DEFAULT_LATENESS_TIERS = [
  { tier: 1, name: "Tier 1: 1–30 mins late", minMinutes: 1, maxMinutes: 30, fine: 10, amount: 10, penalty: 10, defaultFine: 10 },
  { tier: 2, name: "Tier 2: 31–60 mins late", minMinutes: 31, maxMinutes: 60, fine: 30, amount: 30, penalty: 30, defaultFine: 30 },
  { tier: 3, name: "Tier 3: 61–120 mins (1–2 hrs)", minMinutes: 61, maxMinutes: 120, fine: 50, amount: 50, penalty: 50, defaultFine: 50 },
  { tier: 4, name: "Tier 4: 121–180 mins (2–3 hrs)", minMinutes: 121, maxMinutes: 180, fine: 75, amount: 75, penalty: 75, defaultFine: 75 },
  { tier: 5, name: "Tier 5: 181–240 mins (3–4 hrs)", minMinutes: 181, maxMinutes: 240, fine: 100, amount: 100, penalty: 100, defaultFine: 100 },
  { tier: 6, name: "Tier 6: 241+ mins (4+ hrs)", minMinutes: 241, maxMinutes: 9999, fine: 150, amount: 150, penalty: 150, defaultFine: 150 },
];

/**
 * Helper to safely extract numeric tier fine without treating 0 as falsy or fallbacking.
 */
export const getTierConfiguredFine = (tierNum, tierKey, settings, defaultFallback) => {
  if (!settings) return defaultFallback;

  const targetSettings = settings.settings || settings.attendance || settings.company || settings;

  // 1. Direct explicit key check (e.g. settings.lateTier1_amount)
  // Ensure we check !== undefined and !== null so 0 is strictly preserved.
  if (targetSettings[tierKey] !== undefined && targetSettings[tierKey] !== null && targetSettings[tierKey] !== "") {
    const num = Number(targetSettings[tierKey]);
    if (!isNaN(num) && num >= 0) {
      return num;
    }
  }

  if (settings[tierKey] !== undefined && settings[tierKey] !== null && settings[tierKey] !== "") {
    const num = Number(settings[tierKey]);
    if (!isNaN(num) && num >= 0) {
      return num;
    }
  }

  // 2. Check latenessTiers array if present in settings
  const tiersArr =
    Array.isArray(targetSettings.latenessTiers) && targetSettings.latenessTiers.length > 0
      ? targetSettings.latenessTiers
      : Array.isArray(settings.latenessTiers) && settings.latenessTiers.length > 0
      ? settings.latenessTiers
      : null;

  if (tiersArr) {
    const matched = tiersArr.find((t) => Number(t.tier) === Number(tierNum));
    if (matched) {
      if (matched.amount !== undefined && matched.amount !== null && matched.amount !== "") {
        const a = Number(matched.amount);
        if (!isNaN(a) && a >= 0) return a;
      }
      if (matched.fine !== undefined && matched.fine !== null && matched.fine !== "") {
        const f = Number(matched.fine);
        if (!isNaN(f) && f >= 0) return f;
      }
      if (matched.penalty !== undefined && matched.penalty !== null && matched.penalty !== "") {
        const p = Number(matched.penalty);
        if (!isNaN(p) && p >= 0) return p;
      }
    }
  }

  return defaultFallback;
};

/**
 * Builds standard 6 tiers array using active settings
 */
export const getStandardizedLatenessTiers = (settings = {}) => {
  const t1 = getTierConfiguredFine(1, "lateTier1_amount", settings, 10);
  const t2 = getTierConfiguredFine(2, "lateTier2_amount", settings, 30);
  const t3 = getTierConfiguredFine(3, "lateTier3_amount", settings, 50);
  const t4 = getTierConfiguredFine(4, "lateTier4_amount", settings, 75);
  const t5 = getTierConfiguredFine(5, "lateTier5_amount", settings, 100);
  const t6 = getTierConfiguredFine(6, "lateTier6_amount", settings, 150);

  return [
    {
      tier: 1,
      name: "Tier 1: 1–30 mins late",
      minMinutes: 1,
      maxMinutes: 30,
      fine: t1,
      amount: t1,
      penalty: t1,
    },
    {
      tier: 2,
      name: "Tier 2: 31–60 mins late",
      minMinutes: 31,
      maxMinutes: 60,
      fine: t2,
      amount: t2,
      penalty: t2,
    },
    {
      tier: 3,
      name: "Tier 3: 61–120 mins (1–2 hrs)",
      minMinutes: 61,
      maxMinutes: 120,
      fine: t3,
      amount: t3,
      penalty: t3,
    },
    {
      tier: 4,
      name: "Tier 4: 121–180 mins (2–3 hrs)",
      minMinutes: 121,
      maxMinutes: 180,
      fine: t4,
      amount: t4,
      penalty: t4,
    },
    {
      tier: 5,
      name: "Tier 5: 181–240 mins (3–4 hrs)",
      minMinutes: 181,
      maxMinutes: 240,
      fine: t5,
      amount: t5,
      penalty: t5,
    },
    {
      tier: 6,
      name: "Tier 6: 241+ mins (4+ hrs)",
      minMinutes: 241,
      maxMinutes: 9999,
      fine: t6,
      amount: t6,
      penalty: t6,
    },
  ];
};

/**
 * Centralized Notification Text Builder
 * Dictates notification titles, messages, and priority according to penalty amount.
 */
export const buildLatenessNotification = (clockInFormatted, delayMinutes, penaltyAmount) => {
  const penalty = Number(penaltyAmount) || 0;
  const mins = Math.max(0, Number(delayMinutes) || 0);
  const formattedTime = clockInFormatted || "--:--";

  if (penalty === 0) {
    return {
      status: "Late",
      penaltyStatus: "zero-penalty",
      penaltyAmount: 0,
      latePenalty: 0,
      title: "Clock-In Recorded (No Deduction)",
      message: `Clocked in at ${formattedTime} (${mins} mins late). Company policy applied: No salary deduction for this delay.`,
      notificationType: "attendance_alert",
      priority: "info",
      isDeductionApplied: false,
      suppressWarningBanner: true,
    };
  }

  return {
    status: "Late",
    penaltyStatus: "penalty-applied",
    penaltyAmount: penalty,
    latePenalty: penalty,
    title: "⚠️ Lateness Penalty Alert: Upcoming Payslip Impact",
    message: `Clocked in at ${formattedTime} (${mins} mins late). Lateness penalty of GH₵${penalty.toFixed(
      2
    )} has been applied as per company policy.`,
    notificationType: "penalty_alert",
    priority: "high",
    isDeductionApplied: true,
    suppressWarningBanner: false,
  };
};

/**
 * Core function: calculateLatenessPenalty(delayMinutes, settings)
 * Determines exact tier range and returns penalty amount based on configured settings.
 * If configured fine is 0, returns 0.00 without any fallback.
 */
export const calculateLatenessPenalty = (delayMinutesInput, settings = {}) => {
  const delayMinutes = Math.max(0, Number(delayMinutesInput) || 0);

  if (delayMinutes <= 0) {
    return {
      isLate: false,
      status: "On Time",
      attendanceStatus: "On Time",
      delayMinutes: 0,
      minutesLate: 0,
      lateMinutes: 0,
      penalty: 0,
      latePenalty: 0,
      penaltyAmount: 0,
      tier: "On Time",
      tierNumber: 0,
      isZeroPenalty: false,
      isDeductionApplied: false,
      suppressWarningBanner: true,
      notificationMessage: "Clocked in on time. Shift started on schedule.",
    };
  }

  const tiers = getStandardizedLatenessTiers(settings);

  let matchedTier = tiers.find(
    (t) => delayMinutes >= t.minMinutes && delayMinutes <= t.maxMinutes
  );

  // If beyond highest minMinutes, match Tier 6
  if (!matchedTier) {
    matchedTier = tiers[tiers.length - 1];
  }

  const tierAmount = Number(
    matchedTier.amount !== undefined
      ? matchedTier.amount
      : matchedTier.fine !== undefined
      ? matchedTier.fine
      : matchedTier.penalty
  );
  const penaltyAmount = isNaN(tierAmount) || tierAmount < 0 ? 0 : tierAmount;
  const isZeroPenalty = penaltyAmount === 0;
  const status = "Late";

  return {
    isLate: true,
    status,
    attendanceStatus: "Late",
    delayMinutes,
    minutesLate: delayMinutes,
    lateMinutes: delayMinutes,
    penalty: penaltyAmount,
    latePenalty: penaltyAmount,
    penaltyAmount,
    tier: matchedTier.name,
    tierNumber: matchedTier.tier,
    isZeroPenalty,
    isDeductionApplied: penaltyAmount > 0,
    suppressWarningBanner: isZeroPenalty,
  };
};

/**
 * High-level evaluator: evaluateLatenessPenalty(clockInDate, workStartTime, settings)
 * Parses clock-in time and evaluates against work start time and active tier configuration.
 */
export const evaluateLatenessPenalty = (
  clockInDate,
  workStartTime = "08:00",
  settings = {}
) => {
  let startHour = 8;
  let startMinute = 0;

  if (typeof workStartTime === "string" && workStartTime.includes(":")) {
    const parts = workStartTime.trim().split(":");
    startHour = parseInt(parts[0], 10) || 8;
    startMinute = parseInt(parts[1], 10) || 0;
  }

  if (!clockInDate) {
    return {
      isLate: false,
      status: "unknown",
      minutesLate: 0,
      lateMinutes: 0,
      delayMinutes: 0,
      penalty: 0,
      latePenalty: 0,
      penaltyAmount: 0,
      tier: "On Time",
      tierNumber: 0,
      clockInFormatted: "--",
      notificationMessage: "No clock-in recorded",
      suppressWarningBanner: true,
    };
  }

  let clockIn = null;
  if (clockInDate instanceof Date) {
    clockIn = clockInDate;
  } else if (typeof clockInDate === "string") {
    const parsed = new Date(clockInDate);
    if (!isNaN(parsed.getTime())) {
      clockIn = parsed;
    } else {
      const timeMatch = clockInDate.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const dummy = new Date();
        let h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        if (/pm/i.test(clockInDate) && h < 12) h += 12;
        if (/am/i.test(clockInDate) && h === 12) h = 0;
        dummy.setHours(h, m, 0, 0);
        clockIn = dummy;
      }
    }
  }

  if (!clockIn || isNaN(clockIn.getTime())) {
    return {
      isLate: false,
      status: "unknown",
      minutesLate: 0,
      lateMinutes: 0,
      delayMinutes: 0,
      penalty: 0,
      latePenalty: 0,
      penaltyAmount: 0,
      tier: "On Time",
      tierNumber: 0,
      clockInFormatted: "--",
      notificationMessage: "Invalid clock-in time",
      suppressWarningBanner: true,
    };
  }

  const clockInHour = clockIn.getHours();
  const clockInMinute = clockIn.getMinutes();

  const startTotalMinutes = startHour * 60 + startMinute;
  const clockInTotalMinutes = clockInHour * 60 + clockInMinute;
  const delayMinutes = Math.max(0, clockInTotalMinutes - startTotalMinutes);

  const penaltyObj = calculateLatenessPenalty(delayMinutes, settings);

  let formattedTime = "--";
  try {
    formattedTime = clockIn.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    const period = clockInHour >= 12 ? "PM" : "AM";
    const h12 = clockInHour % 12 === 0 ? 12 : clockInHour % 12;
    formattedTime = `${String(h12).padStart(2, "0")}:${String(clockInMinute).padStart(2, "0")} ${period}`;
  }

  const notif = buildLatenessNotification(formattedTime, delayMinutes, penaltyObj.penaltyAmount);

  return {
    ...penaltyObj,
    clockInFormatted: formattedTime,
    notificationMessage: notif.message,
    notificationTitle: notif.title,
    notificationPriority: notif.priority,
    notificationType: notif.notificationType,
    notification: notif,
  };
};

export default {
  DEFAULT_LATENESS_TIERS,
  getTierConfiguredFine,
  getStandardizedLatenessTiers,
  buildLatenessNotification,
  calculateLatenessPenalty,
  evaluateLatenessPenalty,
};
