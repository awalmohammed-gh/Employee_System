import { ui, tones } from "./tokens";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Page title block with optional eyebrow, description and right-aligned actions. */
export const PageHeader = ({ eyebrow, title, description, actions, className = "" }) => (
  <div className={cx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-5 border-b border-slate-200/70 dark:border-slate-800", className)}>
    <div className="min-w-0">
      {eyebrow && <p className={cx(ui.eyebrow, "mb-1.5")}>{eyebrow}</p>}
      <h1 className={ui.h1}>{title}</h1>
      {description && <p className={cx(ui.muted, "mt-2 max-w-2xl leading-relaxed")}>{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Base surface. `padded` adds the standard inner spacing. */
export const Card = ({ as: Tag = "section", padded = true, interactive = false, className = "", children, ...rest }) => (
  <Tag className={cx(ui.card, padded && ui.cardPad, interactive && ui.cardInteractive, className)} {...rest}>
    {children}
  </Tag>
);

/** Card heading row: icon + title/description on the left, action on the right. */
export const CardHeader = ({ icon: Icon, tone = "brand", title, description, action, className = "" }) => (
  <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <span className={cx("grid place-items-center w-9 h-9 rounded-xl shrink-0", tones[tone]?.icon)}>
          <Icon className="w-4.5 h-4.5" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0">
        <h2 className={ui.h2}>{title}</h2>
        {description && <p className={cx(ui.caption, "mt-0.5 leading-relaxed")}>{description}</p>}
      </div>
    </div>
    {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
  </div>
);

/** Compact KPI tile. */
export const StatCard = ({ label, value, hint, icon: Icon, tone = "brand", className = "" }) => (
  <div className={cx(ui.card, ui.cardInteractive, "p-4 sm:p-5 flex flex-col gap-3 min-w-0", className)}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{label}</p>
      {Icon && (
        <span className={cx("grid place-items-center w-8 h-8 rounded-lg shrink-0", tones[tone]?.icon)}>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
      )}
    </div>
    <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums truncate">{value}</p>
    {hint && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed -mt-1">{hint}</p>}
  </div>
);

/** Status pill. */
export const Badge = ({ tone = "neutral", dot = false, pulse = false, className = "", children }) => (
  <span
    className={cx(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold leading-5 whitespace-nowrap",
      tones[tone]?.badge,
      className
    )}
  >
    {dot && <span className={cx("w-1.5 h-1.5 rounded-full", tones[tone]?.dot, pulse && "animate-pulse")} />}
    {children}
  </span>
);

/** Segmented tab control. tabs: [{ value, label, icon?, count? }] */
export const Tabs = ({ tabs, value, onChange, className = "", ariaLabel = "Sections" }) => (
  <div role="tablist" aria-label={ariaLabel} className={cx(ui.tabList, className)}>
    {tabs.map(({ value: v, label, icon: Icon, count }) => {
      const active = v === value;
      return (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(v)}
          className={cx(ui.tab, active ? ui.tabActive : ui.tabIdle)}
        >
          {Icon && <Icon className="w-4 h-4" />}
          <span>{label}</span>
          {count !== undefined && count !== null && (
            <span
              className={cx(
                "ml-0.5 px-1.5 rounded-md text-[11px] font-semibold tabular-nums",
                active
                  ? "bg-[#002185]/[0.08] text-[#002185] dark:bg-blue-500/15 dark:text-blue-300"
                  : "bg-slate-200/70 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
              )}
            >
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** Friendly empty/zero state. */
export const EmptyState = ({ icon: Icon, title, description, action, className = "" }) => (
  <div className={cx("flex flex-col items-center justify-center text-center px-6 py-12", className)}>
    {Icon && (
      <span className="grid place-items-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-4">
        <Icon className="w-6 h-6" />
      </span>
    )}
    <p className={ui.h3}>{title}</p>
    {description && <p className={cx(ui.caption, "mt-1 max-w-sm leading-relaxed")}>{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/** Label/value row used in summary lists. */
export const DataRow = ({ label, value, valueClassName = "", className = "" }) => (
  <div className={cx("flex items-center justify-between gap-4 py-3 border-b last:border-b-0", ui.divider, className)}>
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className={cx("text-sm font-semibold text-slate-900 dark:text-white tabular-nums text-right", valueClassName)}>
      {value}
    </span>
  </div>
);
