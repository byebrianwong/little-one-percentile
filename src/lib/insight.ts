import {
  DAYS_PER_MONTH,
  MAX_AGE_DAYS,
  STANDARD_PERCENTILES,
  percentileFromZ,
  valueAtPercentile,
  valueFromZ,
  zFromValue,
  type Metric,
  type Sex,
} from "./growth";

export interface Insight {
  ageDays: number;
  value: number;
  z: number;
  percentile: number;
  median: number;
  /** value minus median, in kg or cm. */
  vsMedian: number;
  below: { p: number; value: number } | null;
  above: { p: number; value: number } | null;
  /** Where a baby on this same percentile would be at later ages. */
  projections: { ageDays: number; value: number }[];
}

const MILESTONE_MONTHS = [1, 2, 3, 4, 6, 9, 12, 18, 24];

export function insightFor(metric: Metric, sex: Sex, ageDays: number, value: number): Insight {
  const z = zFromValue(metric, sex, ageDays, value);
  const percentile = percentileFromZ(z);
  const median = valueAtPercentile(metric, sex, ageDays, 50);

  let below: Insight["below"] = null;
  let above: Insight["above"] = null;
  for (const p of STANDARD_PERCENTILES) {
    const v = valueAtPercentile(metric, sex, ageDays, p);
    if (v < value - 1e-6) below = { p, value: v };
    else if (v > value + 1e-6 && !above) above = { p, value: v };
  }

  const projections = MILESTONE_MONTHS.map((m) => Math.min(m * DAYS_PER_MONTH, MAX_AGE_DAYS))
    .filter((a) => a > ageDays + 10)
    .slice(0, 3)
    .map((a) => ({ ageDays: a, value: valueFromZ(metric, sex, a, z) }));

  return { ageDays, value, z, percentile, median, vsMedian: value - median, below, above, projections };
}
