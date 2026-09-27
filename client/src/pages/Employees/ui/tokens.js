/**
 * Employee-side design tokens.
 * Shared class strings so every Employee page uses the same surfaces, type scale and controls.
 * Palette is the existing one: navy #002185 (hover #001760), accent #ff5500,
 * dark surfaces #111927 / #162033, slate neutrals, emerald/amber/rose/blue for status.
 */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002185]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/60 dark:focus-visible:ring-offset-[#111927]";

const btnBase = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer ${focusRing}`;

const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition-colors duration-150 hover:border-slate-300 focus:outline-none focus:border-[#002185] focus:ring-4 focus:ring-[#002185]/10 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed dark:bg-[#162033] dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/15 dark:disabled:bg-slate-800/60";

export const ui = {
  focusRing,

  // Layout
  page: "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 space-y-6 sm:space-y-7",
  section: "space-y-4",

  // Surfaces
  card: "bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-[0_3px_16px_-10px_rgba(15,23,42,0.12)]",
  cardPad: "p-5 sm:p-6",
  cardInteractive:
    "transition-[box-shadow,border-color] duration-200 hover:border-slate-300/80 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.12)] dark:hover:border-slate-700",
  subtle: "bg-slate-50/80 dark:bg-[#162033]/60 border border-slate-200/70 dark:border-slate-800 rounded-xl",
  divider: "border-slate-100 dark:border-slate-800",

  // Typography
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
  h1: "text-2xl sm:text-3xl leading-tight font-bold tracking-tight text-slate-900 dark:text-white",
  h2: "text-base font-semibold tracking-tight text-slate-900 dark:text-white",
  h3: "text-sm font-semibold text-slate-900 dark:text-white",
  body: "text-sm text-slate-600 dark:text-slate-300",
  muted: "text-sm text-slate-500 dark:text-slate-400",
  caption: "text-xs text-slate-500 dark:text-slate-400",
  mono: "font-mono tabular-nums",

  // Buttons
  btnPrimary: `${btnBase} h-11 px-4 text-sm bg-[#002185] text-white shadow-[0_1px_2px_rgba(0,33,133,0.25)] hover:bg-[#001760] dark:bg-blue-600 dark:hover:bg-blue-500`,
  btnSecondary: `${btnBase} h-11 px-4 text-sm bg-white text-slate-700 border border-slate-200 shadow-[0_1px_1px_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 dark:bg-[#162033] dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white`,
  btnGhost: `${btnBase} h-11 px-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white`,
  btnDanger: `${btnBase} h-11 px-4 text-sm bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 dark:bg-transparent dark:text-rose-400 dark:border-rose-900/60 dark:hover:bg-rose-950/40`,
  btnAccent: `${btnBase} h-11 px-4 text-sm bg-[#ff5500] text-white shadow-[0_1px_2px_rgba(255,85,0,0.3)] hover:bg-[#e64d00]`,
  btnSm: "h-8! px-3! text-xs! rounded-lg!",
  btnLg: "h-11! px-5!",
  iconBtn: `${btnBase} h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white`,

  // Form controls
  input: `${fieldBase} h-11 px-3.5`,
  select: `${fieldBase} h-10 pl-3.5 pr-9 appearance-none bg-no-repeat cursor-pointer`,
  textarea: `${fieldBase} px-3.5 py-2.5 min-h-24 resize-y`,
  label: "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5",
  hint: "mt-1.5 text-xs text-slate-500 dark:text-slate-400",
  error: "mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400",

  // Tables
  tableWrap: "w-full overflow-x-auto",
  table: "w-full min-w-[640px] text-sm text-left",
  th: "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-[#162033]/70 whitespace-nowrap",
  td: "px-4 py-3.5 text-slate-700 dark:text-slate-300 align-middle",
  tr: "border-t border-slate-100 dark:border-slate-800/80 transition-colors hover:bg-slate-50/70 dark:hover:bg-[#162033]/50",

  // Tabs / segmented control
  tabList:
    "inline-flex max-w-full items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-[#162033] border border-slate-200/60 dark:border-slate-800 overflow-x-auto no-scrollbar",
  tab: `inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${focusRing}`,
  tabActive: "bg-[#002185] text-white shadow-sm dark:bg-blue-600 dark:text-white",
  tabIdle: "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",

  // Modal
  overlay: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4",
  modal:
    "w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)]",
  modalHeader: "flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800",
  modalBody: "px-5 sm:px-6 py-5",
  modalFooter:
    "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#162033]/40 rounded-b-2xl",
};

// Status tones for badges, icons and soft surfaces
export const tones = {
  neutral: {
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
    text: "text-slate-700 dark:text-slate-300",
  },
  brand: {
    badge: "bg-[#002185]/[0.07] text-[#002185] border-[#002185]/15 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    icon: "bg-[#002185]/[0.07] text-[#002185] dark:bg-blue-500/10 dark:text-blue-300",
    dot: "bg-[#002185] dark:bg-blue-400",
    text: "text-[#002185] dark:text-blue-300",
  },
  accent: {
    badge: "bg-[#ff5500]/10 text-[#c2410c] border-[#ff5500]/20 dark:bg-[#ff5500]/15 dark:text-orange-300 dark:border-[#ff5500]/25",
    icon: "bg-[#ff5500]/10 text-[#ff5500] dark:bg-[#ff5500]/15 dark:text-orange-300",
    dot: "bg-[#ff5500]",
    text: "text-[#ff5500] dark:text-orange-300",
  },
  success: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  info: {
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
};

// Maps the status strings used across attendance, leave and payroll records to a tone
export const statusTone = (status) => {
  const s = String(status || "").toLowerCase();
  if (/(approved|present|paid|on.?time|active|completed|success|processed)/.test(s)) return "success";
  if (/(pending|late|review|processing|draft|partial)/.test(s)) return "warning";
  if (/(rejected|absent|declined|cancel|failed|overdue)/.test(s)) return "danger";
  if (/(leave|holiday|excused|scheduled)/.test(s)) return "info";
  return "neutral";
};

// Chevron background for native <select> elements styled with ui.select
export const selectChevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 0.65rem center",
  backgroundSize: "1.1rem",
};
