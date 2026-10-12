// The ages the chart and slider snap to. Using a fixed set of ages keeps every
// label exact: a point labelled "13 weeks" is plotted at exactly 91 days.
//   Birth to 13 days: every day
//   2 to 16 weeks:    every week
//   4 to 12 months:   every half month
//   12 to 24 months:  every month

import { DAYS_PER_MONTH, MAX_AGE_DAYS } from "./growth";

function build(): number[] {
  const ages: number[] = [];
  for (let d = 0; d < 14; d++) ages.push(d);
  for (let w = 2; w <= 16; w++) ages.push(w * 7);
  for (let m = 4; m <= 12; m += 0.5) ages.push(m * DAYS_PER_MONTH);
  for (let m = 13; m <= 24; m++) ages.push(Math.min(m * DAYS_PER_MONTH, MAX_AGE_DAYS));
  return ages;
}

export const SNAP_AGES = build();

/** Index of the snap age nearest to `days`. */
export function nearestSnapIndex(days: number): number {
  let best = 0;
  for (let i = 1; i < SNAP_AGES.length; i++) {
    if (Math.abs(SNAP_AGES[i] - days) < Math.abs(SNAP_AGES[best] - days)) best = i;
  }
  return best;
}

export function snapAge(days: number): number {
  return SNAP_AGES[nearestSnapIndex(days)];
}

export interface AgeRange {
  id: string;
  label: string;
  days: number;
  tick: "week" | "month";
}

export const RANGES: AgeRange[] = [
  { id: "3m", label: "3 mo", days: 98, tick: "week" },
  { id: "6m", label: "6 mo", days: Math.round(6 * DAYS_PER_MONTH), tick: "month" },
  { id: "1y", label: "1 yr", days: Math.round(12 * DAYS_PER_MONTH), tick: "month" },
  { id: "2y", label: "2 yr", days: MAX_AGE_DAYS, tick: "month" },
];

/** The smallest range that shows `days` with a little room to the right. */
export function rangeFor(days: number): AgeRange {
  return RANGES.find((r) => days <= r.days * 0.85) ?? RANGES[RANGES.length - 1];
}
