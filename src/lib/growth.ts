// Growth math based on the WHO Child Growth Standards (birth to 24 months).
//
// WHO publishes each chart as three numbers per day of age, called L, M and S:
//   M is the median, S is the spread, L corrects for skew.
// A measurement X turns into a z-score with
//   z = ((X / M)^L - 1) / (L * S)
// and the z-score turns into a percentile through the normal distribution.

import data from "./who-data.json";

export type Sex = "girl" | "boy";
export type Metric = "weight" | "length" | "head";

export interface LMS {
  L: number;
  M: number;
  S: number;
}

type Table = { L: number[]; M: number[]; S: number[] };
const tables = data as Record<Metric, Record<Sex, Table>>;

export const MAX_AGE_DAYS = tables.weight.boy.M.length - 1; // 730
export const DAYS_PER_MONTH = 30.4375;
export const DAYS_PER_WEEK = 7;

/** The percentile lines drawn on the chart. */
export const STANDARD_PERCENTILES = [3, 10, 25, 50, 75, 90, 97] as const;

/**
 * The chart lines just below and just above a percentile, for example 10 and 25
 * for the 12th. Uses the whole-number percentile people see, so a point shown as
 * "10th" sits between the 3rd and 25th lines. Below the 3rd there is no line
 * under it, and above the 97th there is no line over it; those sides are null.
 */
export function neighborPercentiles(p: number): { below: number | null; above: number | null } {
  const r = Math.round(p);
  const below = [...STANDARD_PERCENTILES].reverse().find((s) => s < r) ?? null;
  const above = STANDARD_PERCENTILES.find((s) => s > r) ?? null;
  return { below, above };
}

/** L, M and S for an age in days. Ages between whole days are interpolated. */
export function lmsAt(metric: Metric, sex: Sex, ageDays: number): LMS {
  const t = tables[metric][sex];
  const a = Math.min(Math.max(ageDays, 0), MAX_AGE_DAYS);
  const i = Math.floor(a);
  const j = Math.min(i + 1, MAX_AGE_DAYS);
  const f = a - i;
  return {
    L: t.L[i] + (t.L[j] - t.L[i]) * f,
    M: t.M[i] + (t.M[j] - t.M[i]) * f,
    S: t.S[i] + (t.S[j] - t.S[i]) * f,
  };
}

function rawValue(z: number, { L, M, S }: LMS): number {
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

function rawZ(x: number, { L, M, S }: LMS): number {
  if (Math.abs(L) < 1e-9) return Math.log(x / M) / S;
  return (Math.pow(x / M, L) - 1) / (L * S);
}

// For weight, WHO does not trust the LMS curve beyond 3 standard deviations,
// because the skew correction stretches the far tail too much. Past ±3 it
// extends the curve in a straight line, using the gap between the 2 and 3 SD
// lines as the unit. Length and head circumference have L = 1, so they need
// no correction.
function usesTailCorrection(metric: Metric) {
  return metric === "weight";
}

export function zFromValue(metric: Metric, sex: Sex, ageDays: number, x: number): number {
  const lms = lmsAt(metric, sex, ageDays);
  const z = rawZ(x, lms);
  if (!usesTailCorrection(metric) || Math.abs(z) <= 3) return z;
  const sign = Math.sign(z);
  const sd3 = rawValue(3 * sign, lms);
  const sd2 = rawValue(2 * sign, lms);
  return sign * 3 + (x - sd3) / Math.abs(sd3 - sd2);
}

export function valueFromZ(metric: Metric, sex: Sex, ageDays: number, z: number): number {
  const lms = lmsAt(metric, sex, ageDays);
  if (!usesTailCorrection(metric) || Math.abs(z) <= 3) return rawValue(z, lms);
  const sign = Math.sign(z);
  const sd3 = rawValue(3 * sign, lms);
  const sd2 = rawValue(2 * sign, lms);
  return sd3 + (z - sign * 3) * Math.abs(sd3 - sd2);
}

export function valueAtPercentile(metric: Metric, sex: Sex, ageDays: number, p: number): number {
  return valueFromZ(metric, sex, ageDays, zFromPercentile(p));
}

export function percentileFromValue(metric: Metric, sex: Sex, ageDays: number, x: number): number {
  return percentileFromZ(zFromValue(metric, sex, ageDays, x));
}

// ---- normal distribution ----

/** Standard normal CDF, returned as a percentile from 0 to 100. */
export function percentileFromZ(z: number): number {
  return 100 * normCdf(z);
}

export function zFromPercentile(p: number): number {
  return normInv(Math.min(Math.max(p / 100, 1e-9), 1 - 1e-9));
}

function normCdf(z: number): number {
  // Abramowitz and Stegun 7.1.26 on erf, accurate to about 1e-7.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

function normInv(p: number): number {
  // Acklam's rational approximation, accurate to about 1e-9.
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
