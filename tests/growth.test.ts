// Checks the growth math against values printed in the WHO percentile tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { neighborPercentiles, percentileFromValue, valueAtPercentile, valueFromZ, zFromValue } from "../src/lib/growth";
import { formatAge, formatPercentile, formatValue } from "../src/lib/format";
import { snapAge } from "../src/lib/ages";

const close = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("matches WHO weight-for-age percentiles (boys)", () => {
  // WHO tables, boys weight: birth P3 2.5, P50 3.3, P97 4.3; 12 months P3 7.8, P50 9.6, P97 11.8 (kg, 1 dp).
  close(valueAtPercentile("weight", "boy", 0, 3), 2.5, 0.05);
  close(valueAtPercentile("weight", "boy", 0, 50), 3.3464, 0.0001);
  close(valueAtPercentile("weight", "boy", 0, 97), 4.3, 0.06);
  close(valueAtPercentile("weight", "boy", 365.25, 3), 7.8, 0.06);
  close(valueAtPercentile("weight", "boy", 365.25, 50), 9.6, 0.06);
  close(valueAtPercentile("weight", "boy", 365.25, 97), 11.8, 0.06);
});

test("matches WHO length and head percentiles (girls, 6 months)", () => {
  // WHO tables, girls at 6 months: length P50 65.7 cm, head P50 42.2 cm.
  close(valueAtPercentile("length", "girl", 6 * 30.4375, 50), 65.7, 0.06);
  close(valueAtPercentile("head", "girl", 6 * 30.4375, 50), 42.2, 0.06);
});

test("the median is the 50th percentile", () => {
  const m = valueAtPercentile("weight", "girl", 91, 50);
  close(percentileFromValue("weight", "girl", 91, m), 50, 1e-6);
});

test("value and z-score convert both ways, including beyond 3 SD for weight", () => {
  for (const z of [-4.5, -3.2, -1, 0, 1.7, 3.5, 5]) {
    close(zFromValue("weight", "boy", 120, valueFromZ("weight", "boy", 120, z)), z, 1e-9);
    close(zFromValue("length", "girl", 300, valueFromZ("length", "girl", 300, z)), z, 1e-9);
  }
});

test("formats values and ages for people", () => {
  assert.equal(formatValue("weight", "imperial", 3.3464), "7 lb 6 oz");
  assert.equal(formatValue("weight", "metric", 5.25), "5.25 kg");
  assert.equal(formatValue("length", "imperial", 60), "23.6 in");
  assert.equal(formatAge(0), "birth");
  assert.equal(formatAge(91), "13 weeks");
  assert.equal(formatAge(30.4375), "1 month");
  assert.equal(formatAge(4.5 * 30.4375), "4½ months");
  assert.equal(formatAge(15 * 30.4375), "1 year 3 months");
  assert.equal(formatPercentile(37.6), "38th");
  assert.equal(formatPercentile(0.3), "below 1st");
});

test("chart snapping lands on ages with exact labels", () => {
  assert.equal(snapAge(93), 91);
  assert.equal(snapAge(5.4), 5);
  assert.equal(formatAge(snapAge(200)), "6½ months");
});

test("finds the chart lines around a percentile", () => {
  assert.deepEqual(neighborPercentiles(12), { below: 10, above: 25 });
  assert.deepEqual(neighborPercentiles(10.2), { below: 3, above: 25 });
  assert.deepEqual(neighborPercentiles(1.5), { below: null, above: 3 });
  assert.deepEqual(neighborPercentiles(98.9), { below: 97, above: null });
});
