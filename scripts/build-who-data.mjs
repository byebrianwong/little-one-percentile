// Converts the WHO Child Growth Standards LMS tables in data/who/ into
// src/lib/who-data.json, keeping one row per day from birth to 730 days (24 months).
// Source: https://github.com/WorldHealthOrganization/anthro (data-raw/growthstandards)
import { readFileSync, writeFileSync } from "node:fs";

const MAX_DAY = 730;
const files = { weight: "weianthro.txt", length: "lenanthro.txt", head: "hcanthro.txt" };
const sexes = { 1: "boy", 2: "girl" };
const out = {};

for (const [metric, file] of Object.entries(files)) {
  out[metric] = { boy: { L: [], M: [], S: [] }, girl: { L: [], M: [], S: [] } };
  const rows = readFileSync(new URL(`../data/who/${file}`, import.meta.url), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t"));
  for (const [sex, age, l, m, s] of rows) {
    const day = Number(age);
    if (day > MAX_DAY) continue;
    const t = out[metric][sexes[sex]];
    if (t.M.length !== day) throw new Error(`${file}: expected day ${t.M.length}, got ${day}`);
    t.L.push(Number(l));
    t.M.push(Number(m));
    t.S.push(Number(s));
  }
}

writeFileSync(new URL("../src/lib/who-data.json", import.meta.url), JSON.stringify(out));
console.log("wrote src/lib/who-data.json");
