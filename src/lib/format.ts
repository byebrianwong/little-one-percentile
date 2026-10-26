// Display helpers. All values are stored in WHO units (kg and cm) and only
// converted when shown to the person or read from an input.

import { DAYS_PER_MONTH, DAYS_PER_WEEK, type Metric } from "./growth";

export type Units = "imperial" | "metric";

const LB_PER_KG = 2.20462262;
const CM_PER_IN = 2.54;

export const METRIC_LABEL: Record<Metric, string> = {
  weight: "Weight",
  length: "Length",
  head: "Head",
};

export const METRIC_NOUN: Record<Metric, string> = {
  weight: "weight",
  length: "length",
  head: "head circumference",
};

export function unitLabel(metric: Metric, units: Units): string {
  if (metric === "weight") return units === "imperial" ? "lb" : "kg";
  return units === "imperial" ? "in" : "cm";
}

/** Converts a WHO value (kg or cm) to the display unit (lb, kg, in or cm). */
export function toDisplay(metric: Metric, units: Units, v: number): number {
  if (units === "metric") return v;
  return metric === "weight" ? v * LB_PER_KG : v / CM_PER_IN;
}

/** Converts a display-unit number back to kg or cm. */
export function fromDisplay(metric: Metric, units: Units, v: number): number {
  if (units === "metric") return v;
  return metric === "weight" ? v / LB_PER_KG : v * CM_PER_IN;
}

/** "11 lb 6 oz", "5.2 kg", "23.4 in", "59.5 cm". */
export function formatValue(metric: Metric, units: Units, v: number): string {
  if (metric === "weight") {
    if (units === "metric") return `${v.toFixed(2).replace(/0$/, "")} kg`;
    const totalOz = Math.round(v * LB_PER_KG * 16);
    const lb = Math.floor(totalOz / 16);
    const oz = totalOz % 16;
    return oz === 0 ? `${lb} lb` : `${lb} lb ${oz} oz`;
  }
  const d = toDisplay(metric, units, v);
  return `${d.toFixed(1)} ${unitLabel(metric, units)}`;
}

/** A difference between two values, always positive: "14 oz", "1 lb 3 oz", "0.4 kg", "1.2 cm". */
export function formatDelta(metric: Metric, units: Units, dv: number): string {
  const v = Math.abs(dv);
  if (metric === "weight" && units === "imperial") {
    const totalOz = Math.round(v * LB_PER_KG * 16);
    if (totalOz < 16) return `${totalOz} oz`;
    return formatValue(metric, units, v);
  }
  if (metric === "weight") return `${v.toFixed(2).replace(/0$/, "")} kg`;
  return `${toDisplay(metric, units, v).toFixed(1)} ${unitLabel(metric, units)}`;
}

/** Short tick label for an axis value in display units. */
export function formatTick(metric: Metric, units: Units, v: number): string {
  const d = toDisplay(metric, units, v);
  return Number.isInteger(Math.round(d * 10) / 10) ? String(Math.round(d)) : d.toFixed(1);
}

// ---- percentiles ----

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "38th", "<1st", ">99th". Rounded to a whole number between 1 and 99. */
export function formatPercentile(p: number): string {
  if (p < 0.5) return p < 0.1 ? "below 0.1st" : "below 1st";
  if (p > 99.5) return p > 99.9 ? "above 99.9th" : "above 99th";
  return ordinal(Math.min(99, Math.max(1, Math.round(p))));
}

// ---- ages ----

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "3 days", "13 weeks", "4½ months", "1 year 2 months". */
export function formatAge(days: number): string {
  const d = Math.round(days);
  if (d === 0) return "birth";
  if (d < 14) return d === 1 ? "1 day" : `${d} days`;
  // Exact whole months (from the "1 mo" style shortcuts) read as months, not weeks.
  const exactMonths = Math.round(days / DAYS_PER_MONTH);
  if (d < 116 && Math.abs(days - exactMonths * DAYS_PER_MONTH) < 0.2) {
    return exactMonths === 1 ? "1 month" : `${exactMonths} months`;
  }
  if (d < 116) {
    const w = Math.round(d / DAYS_PER_WEEK);
    return `${w} weeks`;
  }
  const months = days / DAYS_PER_MONTH;
  if (months < 12) {
    const half = Math.round(months * 2) / 2;
    const whole = Math.floor(half);
    return `${whole}${half % 1 ? "½" : ""} months`;
  }
  const m = Math.round(months);
  if (m >= 24) return "2 years";
  const extra = m - 12;
  return extra === 0 ? "1 year" : `1 year ${extra} month${extra === 1 ? "" : "s"}`;
}

/** Short axis label: "4w", "6m", "1y". */
export function formatAgeTick(days: number, unit: "week" | "month"): string {
  if (unit === "week") return `${Math.round(days / DAYS_PER_WEEK)}w`;
  const m = Math.round(days / DAYS_PER_MONTH);
  if (m === 0) return "Birth";
  if (m === 12) return "1y";
  if (m === 24) return "2y";
  return `${m}m`;
}

export type AgeUnit = "days" | "weeks" | "months";

export function ageToDays(n: number, unit: AgeUnit): number {
  if (unit === "days") return n;
  if (unit === "weeks") return n * DAYS_PER_WEEK;
  return n * DAYS_PER_MONTH;
}

/** Days between a birth date and another date, both "YYYY-MM-DD". */
export function daysBetween(birth: string, on: string): number {
  const a = Date.parse(`${birth}T00:00:00Z`);
  const b = Date.parse(`${on}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * The exact age on a date, counted from the birthday. Weeks and days until the
 * baby turns 6 months, then calendar months, weeks and days:
 * "5 days", "15 weeks, 3 days", "7 months, 2 weeks, 1 day".
 * Returns null when the date is before the birthday.
 */
export function formatExactAge(birth: string, on: string): string | null {
  const total = daysBetween(birth, on);
  if (!(total >= 0)) return null;
  const months = wholeMonths(birth, on);
  const parts: string[] = [];
  let rest = total;
  if (months >= 6) {
    parts.push(`${months} months`);
    rest = daysBetween(addMonths(birth, months), on);
  }
  const weeks = Math.floor(rest / DAYS_PER_WEEK);
  const days = rest % DAYS_PER_WEEK;
  if (weeks) parts.push(weeks === 1 ? "1 week" : `${weeks} weeks`);
  if (days || parts.length === 0) parts.push(days === 1 ? "1 day" : `${days} days`);
  return parts.join(", ");
}

/** The same day of the month `n` months later. A day the month lacks becomes its last day: Jan 31 + 1 month is Feb 28. */
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** Whole calendar months from the birthday to a date. */
function wholeMonths(birth: string, on: string): number {
  const [by, bm] = birth.split("-").map(Number);
  const [oy, om] = on.split("-").map(Number);
  const n = (oy - by) * 12 + (om - bm);
  return addMonths(birth, n) > on ? n - 1 : n;
}

export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
