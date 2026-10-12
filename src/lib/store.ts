// Saved state. The baby's measurements live only in this browser's
// localStorage; nothing is sent to a server. The chart settings (sex, measure,
// age, percentile) also go in the URL so a view can be shared as a link.

import type { Metric, Sex } from "./growth";
import type { Units } from "./format";

export interface Measurement {
  id: string;
  /** Age in days at the time of measurement. */
  ageDays: number;
  /** Date measured, "YYYY-MM-DD". Only set when the baby has a birthday. */
  date?: string;
  /** Kilograms. */
  weight?: number;
  /** Centimetres. */
  length?: number;
  /** Centimetres. */
  head?: number;
}

export interface Baby {
  name: string;
  /** Which chart the measurements belong on. */
  sex?: Sex;
  birthDate?: string;
  measurements: Measurement[];
}

export interface Prefs {
  sex: Sex;
  metric: Metric;
  units: Units;
}

export interface ViewState extends Prefs {
  ageDays: number;
  percentile: number;
}

const KEY = "little-one-percentile:v1";

interface Saved {
  prefs?: Partial<Prefs>;
  baby?: Baby | null;
}

export function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

export function save(prefs: Prefs, baby: Baby | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ prefs, baby } satisfies Saved));
  } catch {
    // Private mode or storage full. The app still works for this visit.
  }
}

export function defaultUnits(): Units {
  if (typeof navigator === "undefined") return "imperial";
  // The US, Liberia and Myanmar weigh babies in pounds.
  return /-(US|LR|MM)$/i.test(navigator.language) ? "imperial" : "metric";
}

const SEXES: Sex[] = ["girl", "boy"];
const METRICS: Metric[] = ["weight", "length", "head"];

/** Reads view settings from the URL. Missing or invalid values are left out. */
export function readUrl(search: string): Partial<ViewState> {
  const q = new URLSearchParams(search);
  const out: Partial<ViewState> = {};
  const sex = q.get("sex") as Sex | null;
  if (sex && SEXES.includes(sex)) out.sex = sex;
  const metric = q.get("measure") as Metric | null;
  if (metric && METRICS.includes(metric)) out.metric = metric;
  const units = q.get("units");
  if (units === "imperial" || units === "metric") out.units = units;
  const age = parseAgeParam(q.get("age"));
  if (age !== null) out.ageDays = age;
  const p = Number(q.get("p"));
  if (q.has("p") && p >= 1 && p <= 99) out.percentile = p;
  return out;
}

/** Writes a short, readable URL such as ?sex=girl&measure=weight&age=13w&p=25 */
export function writeUrl(v: ViewState) {
  const q = new URLSearchParams();
  q.set("sex", v.sex);
  q.set("measure", v.metric);
  q.set("age", ageParam(v.ageDays));
  q.set("p", String(v.percentile));
  q.set("units", v.units);
  const url = `${location.pathname}?${q.toString()}`;
  if (url !== location.pathname + location.search) history.replaceState(null, "", url);
}

function ageParam(days: number): string {
  const d = Math.round(days);
  if (d % 7 === 0 && d <= 26 * 7) return `${d / 7}w`;
  return `${d}d`;
}

function parseAgeParam(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)([dwm]?)$/.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const days = m[2] === "w" ? n * 7 : m[2] === "m" ? n * 30.4375 : n;
  return Math.min(730, Math.max(0, days));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
