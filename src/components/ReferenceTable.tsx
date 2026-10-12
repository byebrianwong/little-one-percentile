"use client";

import { DAYS_PER_MONTH, MAX_AGE_DAYS, STANDARD_PERCENTILES, valueAtPercentile, type Metric, type Sex } from "@/lib/growth";
import { METRIC_NOUN, capitalize, formatAge, formatValue, ordinal, type Units } from "@/lib/format";

const AGES: number[] = [
  ...Array.from({ length: 14 }, (_, w) => w * 7), // birth to 13 weeks
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24].map((m) => Math.min(m * DAYS_PER_MONTH, MAX_AGE_DAYS)),
];

interface Props {
  sex: Sex;
  metric: Metric;
  units: Units;
  onPick: (ageDays: number, percentile: number) => void;
}

export default function ReferenceTable({ sex, metric, units, onPick }: Props) {
  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--ink)]">
        <span>
          Full table: {sex === "girl" ? "girls'" : "boys'"} {METRIC_NOUN[metric]} by age
        </span>
        <span className="text-[var(--ink-3)] transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="mt-4 -mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[560px] text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-[var(--ink-3)]">
              <th className="py-2 pr-3 text-left font-medium">Age</th>
              {STANDARD_PERCENTILES.map((p) => (
                <th key={p} className={`px-2 py-2 text-right font-medium ${p === 50 ? "text-[var(--ink)]" : ""}`}>
                  {ordinal(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AGES.map((a) => (
              <tr key={a} className="border-t border-[var(--line)]">
                <td className="py-1.5 pr-3 whitespace-nowrap text-[var(--ink-2)]">{capitalize(formatAge(a))}</td>
                {STANDARD_PERCENTILES.map((p) => (
                  <td key={p} className="px-0 py-0 text-right">
                    <button
                      className={`w-full rounded px-2 py-1.5 text-right whitespace-nowrap hover:bg-[var(--surface-2)] ${p === 50 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}
                      onClick={() => onPick(a, p)}
                      title="Show on the chart"
                    >
                      {formatValue(metric, units, valueAtPercentile(metric, sex, a, p))}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
