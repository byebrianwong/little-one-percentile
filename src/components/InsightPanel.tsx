"use client";

import { STANDARD_PERCENTILES, type Metric, type Sex } from "@/lib/growth";
import { capitalize, formatAge, formatDelta, formatPercentile, formatValue, ordinal, type Units } from "@/lib/format";
import type { Insight } from "@/lib/insight";

export type InsightMode = "explore" | "probe" | "baby";

interface Props {
  mode: InsightMode;
  sex: Sex;
  metric: Metric;
  units: Units;
  insight: Insight;
  babyName: string;
  onSaveProbe?: () => void;
  onClearProbe?: () => void;
  /** The headline sits above the chart; the details sit below it. */
  part: "headline" | "details";
}

const LESS: Record<Metric, string> = { weight: "weigh less", length: "are shorter", head: "have a smaller head" };

export default function InsightPanel({ mode, sex, metric, units, insight, babyName, onSaveProbe, onClearProbe, part }: Props) {
  const v = (n: number) => formatValue(metric, units, n);
  const d = (n: number) => formatDelta(metric, units, n);
  const age = formatAge(insight.ageDays);
  const kid = sex === "girl" ? "girl" : "boy";
  const kids = sex === "girl" ? "girls" : "boys";
  const pct = formatPercentile(insight.percentile);
  const pctWord = mode === "explore" ? ordinal(Math.round(insight.percentile)) : pct;
  const name = babyName.trim() || "Your baby";

  const measure = (value: string) =>
    metric === "weight" ? <>weighs <B>{value}</B></> : metric === "length" ? <>is <B>{value}</B> long</> : <>has a head circumference of <B>{value}</B></>;

  let headline: React.ReactNode;
  if (mode === "explore") {
    headline = (
      <>
        At {age}, a {kid} on the <B>{pctWord} percentile</B> {measure(v(insight.value))}.
      </>
    );
  } else if (mode === "probe") {
    headline = (
      <>
        At {age}, a {kid} who {measure(v(insight.value))} is on the <B>{pct} percentile</B>.
      </>
    );
  } else {
    headline = (
      <>
        {name} is on the <B>{pct} percentile</B> for {metric === "head" ? "head size" : metric}: <span className="whitespace-nowrap">{v(insight.value)}</span> at {age}.
      </>
    );
  }

  const nearMedian = Math.abs(insight.percentile - 50) < 1;
  const medianText = nearMedian
    ? "Right on the median."
    : `${d(insight.vsMedian)} ${insight.vsMedian > 0 ? "above" : "below"} the median`;

  const lessCount = Math.round(insight.percentile);

  if (part === "headline") {
    return (
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[1.35rem] leading-snug text-[var(--ink)] sm:text-[1.6rem]" aria-live="polite">
          {headline}
        </p>
        {mode === "probe" && onClearProbe && (
          <button onClick={onClearProbe} className="btn-ghost shrink-0" aria-label="Clear the pinned point">
            Clear
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "probe" && onSaveProbe && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--accent)] px-3.5 py-3">
          <button onClick={onSaveProbe} className="btn-accent">
            Save as my baby&rsquo;s measurement
          </button>
          <span className="text-xs text-[var(--ink-2)]">Drag the point to adjust first. Saved only on this device.</span>
        </div>
      )}

      <div>
        <PercentileBar percentile={insight.percentile} accent={mode !== "explore"} />
        <p className="text-sm text-[var(--ink-2)]">
          {insight.percentile < 0.5
            ? `Fewer than 1 in 100 ${kids} this age ${LESS[metric]}.`
            : insight.percentile > 99.5
              ? `More than 99 in 100 ${kids} this age ${LESS[metric]}.`
              : `About ${lessCount} in 100 ${kids} this age ${LESS[metric]}.`}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Compared with the median">
          <span className="font-semibold text-[var(--ink)]">{medianText}</span>
          {!nearMedian && <span className="block text-[var(--ink-2)]">Median: {v(insight.median)}</span>}
        </Stat>
        <Stat label="Nearest lines">
          {insight.above && (
            <span className="block">
              <span className="font-semibold text-[var(--ink)]">{ordinal(insight.above.p)}</span>{" "}
              <span className="text-[var(--ink-2)]">is {d(insight.above.value - insight.value)} more</span>
            </span>
          )}
          {insight.below && (
            <span className="block">
              <span className="font-semibold text-[var(--ink)]">{ordinal(insight.below.p)}</span>{" "}
              <span className="text-[var(--ink-2)]">is {d(insight.value - insight.below.value)} less</span>
            </span>
          )}
        </Stat>
        <Stat label={`If ${mode === "baby" ? "they stay" : "staying"} on the ${pctWord}`}>
          {insight.projections.length === 0 ? (
            <span className="text-[var(--ink-2)]">The WHO charts end at 2 years.</span>
          ) : (
            insight.projections.map((p) => (
              <span key={p.ageDays} className="block">
                <span className="text-[var(--ink-2)]">{capitalize(formatAge(p.ageDays))}:</span>{" "}
                <span className="font-semibold text-[var(--ink)]">~{v(p.value)}</span>
              </span>
            ))
          )}
        </Stat>
      </dl>
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold whitespace-nowrap">{children}</strong>;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3.5 py-3 text-sm">
      <dt className="mb-1 text-xs font-medium tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="leading-relaxed">{children}</dd>
    </div>
  );
}

/** A 0 to 100 track with the same bands as the chart and a marker at the percentile. */
function PercentileBar({ percentile, accent }: { percentile: number; accent: boolean }) {
  const pos = Math.min(99.5, Math.max(0.5, percentile));
  const stops = [0, 3, 10, 25, 75, 90, 97, 100];
  const fills = ["var(--band-0)", "var(--band-1)", "var(--band-2)", "var(--band-3)", "var(--band-2)", "var(--band-1)", "var(--band-0)"];
  return (
    <div className="relative pt-1 pb-6" aria-hidden>
      <div className="relative h-3 overflow-hidden rounded-full">
        {fills.map((f, i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{ left: `${stops[i]}%`, width: `${stops[i + 1] - stops[i]}%`, background: f }}
          />
        ))}
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--median)]" />
      </div>
      <div
        className="absolute top-0 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-[var(--surface)] shadow transition-[left] duration-150"
        style={{ left: `${pos}%`, background: accent ? "var(--accent)" : "var(--highlight)" }}
      />
      {STANDARD_PERCENTILES.filter((p) => p === 3 || p === 25 || p === 50 || p === 75 || p === 97).map((p) => (
        <span key={p} className="absolute top-5 -translate-x-1/2 text-[10px] text-[var(--ink-3)] tabular-nums" style={{ left: `${p}%` }}>
          {p}
        </span>
      ))}
    </div>
  );
}
