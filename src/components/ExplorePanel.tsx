"use client";

import { Fragment } from "react";
import { STANDARD_PERCENTILES, valueAtPercentile, type Metric, type Sex } from "@/lib/growth";
import { SNAP_AGES, nearestSnapIndex } from "@/lib/ages";
import { capitalize, formatAge, formatPercentile, formatValue, ordinal, type Units } from "@/lib/format";

interface Props {
  sex: Sex;
  metric: Metric;
  units: Units;
  ageDays: number;
  /** Age under the pointer while hovering the chart; shown instead of ageDays. */
  hoverAge: number | null;
  percentile: number;
  active: boolean;
  /** The pinned point or baby measurement, shown as its own row among the percentiles. */
  marker: { label: string; value: number; percentile: number } | null;
  onAge: (days: number) => void;
  onPercentile: (p: number) => void;
}

export default function ExplorePanel({ sex, metric, units, ageDays, hoverAge, percentile, active, marker, onAge, onPercentile }: Props) {
  const shownAge = hoverAge ?? ageDays;
  const rows = [...STANDARD_PERCENTILES] as number[];
  if (active && !rows.includes(percentile)) rows.push(percentile);
  rows.sort((a, b) => b - a);
  const showMarker = marker && hoverAge === null;
  const markerAt = showMarker ? rows.findIndex((p) => p < marker.percentile) : -1;

  return (
    <section className="card flex flex-col gap-5 p-5" aria-labelledby="explore-title">
      {/* On small screens these controls sit under the chart instead (see App). */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div>
          <h2 id="explore-title" className="text-sm font-semibold text-[var(--ink)]">
            Look up any age
          </h2>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">No measurements needed.</p>
        </div>
        <ExploreControls idPrefix="side" ageDays={ageDays} percentile={percentile} active={active} onAge={onAge} onPercentile={onPercentile} />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-medium tracking-wide text-[var(--ink-3)] uppercase">
            {sex === "girl" ? "Girls" : "Boys"} at {formatAge(shownAge)}
          </span>
          {hoverAge !== null && <span className="text-[var(--ink-3)]">following pointer</span>}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p, i) => {
              const on = active && p === percentile;
              return (
                <Fragment key={p}>
                  {showMarker && markerAt === i && <MarkerRow marker={marker} metric={metric} units={units} />}
                  <tr
                    onClick={() => onPercentile(p)}
                    className="cursor-pointer border-t border-[var(--line)] hover:bg-[var(--surface-2)]"
                  >
                    <td className={`py-1.5 pl-1 ${on ? "font-semibold text-[var(--highlight-ink)]" : p === 50 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>
                      {ordinal(p)}
                      {p === 50 && <span className="ml-1 text-xs font-normal text-[var(--ink-3)]">median</span>}
                    </td>
                    <td className={`py-1.5 pr-1 text-right tabular-nums ${on ? "font-semibold text-[var(--highlight-ink)]" : "text-[var(--ink)]"}`}>
                      {formatValue(metric, units, valueAtPercentile(metric, sex, shownAge, p))}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {showMarker && markerAt === -1 && <MarkerRow marker={marker} metric={metric} units={units} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const AGE_SHORTCUTS: [string, number][] = [
  ["Birth", 0],
  ["1 wk", 7],
  ["1 mo", 30.4375],
  ["2 mo", 60.875],
  ["4 mo", 121.75],
  ["6 mo", 182.625],
  ["9 mo", 273.9375],
  ["1 yr", 365.25],
];

/** Age slider and percentile buttons. Used in the side panel and, on phones, under the chart. */
export function ExploreControls({
  idPrefix,
  ageDays,
  percentile,
  active,
  onAge,
  onPercentile,
}: {
  idPrefix: string;
  ageDays: number;
  percentile: number;
  active: boolean;
  onAge: (days: number) => void;
  onPercentile: (p: number) => void;
}) {
  const idx = nearestSnapIndex(ageDays);
  const step = (dir: 1 | -1) => onAge(SNAP_AGES[Math.min(SNAP_AGES.length - 1, Math.max(0, idx + dir))]);

  return (
    <>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${idPrefix}-age`} className="text-xs font-medium tracking-wide text-[var(--ink-3)] uppercase">
            Age
          </label>
          <span className="font-display text-xl text-[var(--ink)]">{capitalize(formatAge(ageDays))}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button className="btn-step" onClick={() => step(-1)} aria-label="Younger" disabled={idx === 0}>
            −
          </button>
          <input
            id={`${idPrefix}-age`}
            type="range"
            min={0}
            max={SNAP_AGES.length - 1}
            value={idx}
            onChange={(e) => onAge(SNAP_AGES[Number(e.target.value)])}
            aria-valuetext={formatAge(ageDays)}
            className="slider min-w-0 flex-1"
          />
          <button className="btn-step" onClick={() => step(1)} aria-label="Older" disabled={idx === SNAP_AGES.length - 1}>
            +
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AGE_SHORTCUTS.map(([label, d]) => (
            <button key={label} className="chip" data-on={(active && Math.abs(d - ageDays) < 0.5) || undefined} onClick={() => onAge(d)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tracking-wide text-[var(--ink-3)] uppercase">Percentile</span>
          <label className="flex items-center gap-1 text-xs text-[var(--ink-3)]">
            Other
            <input
              type="number"
              min={1}
              max={99}
              value={percentile}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (n >= 1 && n <= 99) onPercentile(n);
              }}
              className="input w-14 px-2 py-1 text-right tabular-nums"
              aria-label="Choose any percentile from 1 to 99"
            />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {STANDARD_PERCENTILES.map((p) => (
            <button key={p} className="chip justify-center" data-on={(active && p === percentile) || undefined} onClick={() => onPercentile(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function MarkerRow({ marker, metric, units }: { marker: NonNullable<Props["marker"]>; metric: Metric; units: Units }) {
  return (
    <tr className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]">
      <td className="py-1.5 pl-1 font-semibold text-[var(--ink)]">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-middle" />
        {marker.label} <span className="font-normal text-[var(--ink-2)]">({formatPercentile(marker.percentile)})</span>
      </td>
      <td className="py-1.5 pr-1 text-right font-semibold text-[var(--ink)] tabular-nums">{formatValue(metric, units, marker.value)}</td>
    </tr>
  );
}
