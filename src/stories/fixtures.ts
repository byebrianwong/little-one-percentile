// Shared data for the stories. Values are kilograms and centimetres, as the app stores them.

import type { Baby, Prefs } from "@/lib/store";

/** The date every story treats as today (see .storybook/preview.tsx). */
export const TODAY = "2026-06-15";

/** A girl with a birthday and five dated checkups, the last one 3 days before TODAY. */
export const MAYA: Baby = {
  name: "Maya",
  sex: "girl",
  birthDate: "2026-02-10",
  measurements: [
    { id: "m1", ageDays: 0, date: "2026-02-10", weight: 3.3, length: 49.5, head: 34.5 },
    { id: "m2", ageDays: 30, date: "2026-03-12", weight: 4.3 },
    { id: "m3", ageDays: 63, date: "2026-04-14", weight: 5.3, length: 58.1 },
    { id: "m4", ageDays: 98, date: "2026-05-19", weight: 6.0, length: 61.2, head: 40.1 },
    { id: "m5", ageDays: 122, date: "2026-06-12", weight: 6.5 },
  ],
};

/** A boy entered by age only: no name, no birthday. */
export const BY_AGE: Baby = {
  name: "",
  sex: "boy",
  measurements: [
    { id: "a1", ageDays: 14, weight: 3.9 },
    { id: "a2", ageDays: 56, weight: 5.6, length: 58.4 },
    { id: "a3", ageDays: 91, weight: 6.4, length: 61.4, head: 41.0 },
  ],
};

// ---- saved state ----

/** The localStorage key App saves under (see src/lib/store.ts). */
const STORAGE_KEY = "little-one-percentile:v1";

export const DEFAULT_PREFS: Prefs = { sex: "girl", metric: "weight", units: "imperial" };

/**
 * Saves settings and a baby the way App does, so App loads them when it mounts. Saving the units
 * also stops App from guessing them from the browser's language. Returns a function that clears it.
 */
export function seedStorage(prefs: Prefs = DEFAULT_PREFS, baby: Baby | null = null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ prefs, baby }));
  return () => localStorage.removeItem(STORAGE_KEY);
}

/** What App has saved. */
export function readStorage(): { prefs?: Prefs; baby?: Baby | null } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
}

// ---- phone width ----

/**
 * Story settings for the phone layout: Storybook shows it at phone width, and Chromatic snapshots it
 * at phone width in both themes instead of at desktop width.
 */
export const PHONE = {
  globals: { viewport: { value: "phone", isRotated: false } },
  parameters: {
    chromatic: {
      modes: {
        light: { disable: true },
        dark: { disable: true },
        "light phone": { theme: "light", viewport: "phone" },
        "dark phone": { theme: "dark", viewport: "phone" },
      },
    },
  },
};
