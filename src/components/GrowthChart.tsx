"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  STANDARD_PERCENTILES,
  neighborPercentiles,
  percentileFromValue,
  valueAtPercentile,
  valueFromZ,
  type Metric,
  type Sex,
} from "@/lib/growth";
import { snapAge, type AgeRange } from "@/lib/ages";
import {
  capitalize,
  formatAge,
  formatAgeTick,
  formatDelta,
  formatPercentile,
  formatTick,
  formatValue,
  fromDisplay,
  ordinal,
  toDisplay,
  unitLabel,
  type Units,
} from "@/lib/format";
import { DAYS_PER_MONTH, DAYS_PER_WEEK } from "@/lib/growth";

export interface ChartPoint {
  ageDays: number;
  value: number;
}

interface Props {
  sex: Sex;
  metric: Metric;
  units: Units;
  range: AgeRange;
  /** Percentile line to draw in bold, with a dot at `focusAge`. Only in explore mode. */
  explore: { ageDays: number; percentile: number } | null;
  probe: ChartPoint | null;
  babyPoints: (ChartPoint & { id: string })[];
  /** Where the dashed "stays on this percentile" line starts. */
  projectFrom: (ChartPoint & { z: number }) | null;
  selectedId: string | null;
  onHoverAge: (ageDays: number | null) => void;
  onProbe: (p: ChartPoint) => void;
  onSelectBaby: (id: string) => void;
}

const M = { top: 20, right: 46, bottom: 30, left: 40 };
const SAMPLES = 140;

export default function GrowthChart(props: Props) {
  const { sex, metric, units, range, explore, probe, babyPoints, projectFrom, selectedId, onHoverAge, onProbe, onSelectBaby } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Until the real width is measured (and in the server-rendered HTML), the chart
  // is drawn at 720 px and scaled to fit, so the page never shows an empty box.
  const [measured, setWidth] = useState(0);
  const width = measured || 720;
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(Math.min(460, Math.max(300, width * 0.58)));
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const maxAge = range.days;

  // Percentile curves sampled across the visible ages.
  const curves = useMemo(() => {
    const ages = Array.from({ length: SAMPLES + 1 }, (_, i) => (i / SAMPLES) * maxAge);
    const lines = new Map<number, number[]>();
    for (const p of STANDARD_PERCENTILES) {
      lines.set(p, ages.map((a) => valueAtPercentile(metric, sex, a, p)));
    }
    return { ages, lines };
  }, [metric, sex, maxAge]);

  // Y range: the 3rd to 97th percentile curves, plus any baby points, with padding.
  const [yMin, yMax] = useMemo(() => {
    let lo = Math.min(...curves.lines.get(3)!);
    let hi = Math.max(...curves.lines.get(97)!);
    for (const b of babyPoints) {
      if (b.ageDays <= maxAge) {
        lo = Math.min(lo, b.value);
        hi = Math.max(hi, b.value);
      }
    }
    const pad = (hi - lo) * 0.06;
    return [Math.max(0, lo - pad), hi + pad];
  }, [curves, babyPoints, maxAge]);

  const x = (a: number) => M.left + (a / maxAge) * innerW;
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const invX = (px: number) => ((px - M.left) / innerW) * maxAge;
  const invY = (py: number) => yMin + (1 - (py - M.top) / innerH) * (yMax - yMin);

  const path = (vals: number[]) =>
    vals.map((v, i) => `${i ? "L" : "M"}${x(curves.ages[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const band = (lo: number, hi: number) => {
    const a = curves.lines.get(lo)!;
    const b = curves.lines.get(hi)!;
    const top = b.map((v, i) => `${i ? "L" : "M"}${x(curves.ages[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const bottom = a
      .map((v, i) => [x(curves.ages[i]), y(v)] as const)
      .reverse()
      .map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`)
      .join("");
    return `${top}${bottom}Z`;
  };

  // Axis ticks.
  const yTicks = useMemo(() => niceTicks(toDisplay(metric, units, yMin), toDisplay(metric, units, yMax), innerH / 46), [metric, units, yMin, yMax, innerH]);
  const xTicks = useMemo(() => {
    const out: { days: number; label: string | null }[] = [];
    if (range.tick === "week") {
      const every = innerW < 420 ? 2 : 1;
      for (let w = 0; w * DAYS_PER_WEEK <= maxAge; w++) {
        out.push({ days: w * DAYS_PER_WEEK, label: w % every === 0 ? (w === 0 ? "Birth" : `${w}w`) : null });
      }
    } else {
      const months = Math.floor(maxAge / DAYS_PER_MONTH + 0.01);
      const every = months <= 6 ? 1 : months <= 12 ? (innerW < 420 ? 2 : 1) : innerW < 420 ? 6 : 3;
      for (let m = 0; m <= months; m++) {
        out.push({ days: Math.min(m * DAYS_PER_MONTH, maxAge), label: m % every === 0 ? formatAgeTick(m * DAYS_PER_MONTH, "month") : null });
      }
    }
    return out;
  }, [range.tick, maxAge, innerW]);

  // Labels at the right end of each percentile line, nudged apart so they never overlap.
  const endLabels = useMemo(() => {
    const items: { p: number; y: number; bold: boolean }[] = STANDARD_PERCENTILES.map((p) => ({
      p,
      y: y(curves.lines.get(p)![SAMPLES]),
      bold: p === 50,
    }));
    if (explore && !STANDARD_PERCENTILES.includes(explore.percentile as (typeof STANDARD_PERCENTILES)[number])) {
      items.push({ p: explore.percentile, y: y(valueAtPercentile(metric, sex, maxAge, explore.percentile)), bold: true });
    }
    items.sort((a, b) => a.y - b.y);
    const gap = 12;
    for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + gap);
    for (let i = items.length - 2; i >= 0; i--) items[i].y = Math.min(items[i].y, items[i + 1].y - gap);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, explore, yMin, yMax, innerH, innerW]);

  // ---- pointer handling ----
  // Moving over the chart reads out the percentile under the pointer.
  // Pressing pins a point there; dragging moves the pinned point.

  function pointFromEvent(e: React.PointerEvent): ChartPoint | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const age = snapAge(Math.min(maxAge, Math.max(0, invX(px))));
    const value = Math.min(yMax, Math.max(yMin, invY(py)));
    return { ageDays: age, value };
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = pointFromEvent(e);
    if (!p) return;
    setHover(p);
    onHoverAge(p.ageDays);
    if (dragging.current) onProbe(p);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const p = pointFromEvent(e);
    if (!p) return;
    // Pressing on a saved measurement selects it instead of pinning a new point.
    const r = svgRef.current!.getBoundingClientRect();
    const hit = babyPoints.find(
      (b) => b.ageDays <= maxAge && Math.hypot(x(b.ageDays) - (e.clientX - r.left), y(b.value) - (e.clientY - r.top)) < 14,
    );
    if (hit && !(probe && Math.hypot(x(probe.ageDays) - x(hit.ageDays), y(probe.value) - y(hit.value)) < 1)) {
      onSelectBaby(hit.id);
      return;
    }
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setHover(p);
    onProbe(p);
  }

  function endDrag(e: React.PointerEvent) {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (e.pointerType !== "mouse") {
      setHover(null);
      onHoverAge(null);
    }
  }

  function onPointerLeave() {
    if (dragging.current) return;
    setHover(null);
    onHoverAge(null);
  }

  // ---- derived marks ----

  const exploreLine = explore
    ? path(curves.ages.map((a) => valueAtPercentile(metric, sex, a, explore.percentile)))
    : null;
  const exploreDot = explore
    ? { x: x(explore.ageDays), y: y(valueAtPercentile(metric, sex, explore.ageDays, explore.percentile)) }
    : null;

  const projection = useMemo(() => {
    if (!projectFrom || projectFrom.ageDays >= maxAge) return null;
    const n = 60;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const a = projectFrom.ageDays + (i / n) * (maxAge - projectFrom.ageDays);
      const v = i === 0 ? projectFrom.value : valueFromZ(metric, sex, a, projectFrom.z);
      pts.push(`${i ? "L" : "M"}${x(a).toFixed(1)},${y(v).toFixed(1)}`);
    }
    return pts.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFrom, maxAge, metric, sex, yMin, yMax, innerW, innerH]);

  const visibleBaby = babyPoints.filter((b) => b.ageDays <= maxAge).sort((a, b) => a.ageDays - b.ageDays);
  const babyLine = visibleBaby.length > 1 ? visibleBaby.map((b, i) => `${i ? "L" : "M"}${x(b.ageDays)},${y(b.value)}`).join("") : null;

  const hoverPct = hover ? percentileFromValue(metric, sex, hover.ageDays, hover.value) : null;
  // The chart lines just above and below the hovered point, top one first.
  const hoverNeighbors =
    hover && hoverPct !== null
      ? (() => {
          const { below, above } = neighborPercentiles(hoverPct);
          return [above, below]
            .filter((p): p is number => p !== null)
            .map((p) => ({ p, value: valueAtPercentile(metric, sex, hover.ageDays, p) }));
        })()
      : [];
  const neighborSet = new Set(hoverNeighbors.map((n) => n.p));
  const tipLeft = hover ? x(hover.ageDays) : 0;
  const tipFlip = tipLeft > width - 230;

  const summary = `${sex === "girl" ? "Girls" : "Boys"}' ${metric} percentiles from birth to ${formatAge(maxAge)}, showing the 3rd, 10th, 25th, 50th, 75th, 90th and 97th percentile lines.`;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        ref={svgRef}
        width={measured ? width : "100%"}
        height={measured ? height : undefined}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        className="block overflow-visible"
      >
        {/* grid */}
        <g className="text-[11px]" fill="var(--ink-3)">
          {yTicks.map((t) => {
            const py = y(fromDisplay(metric, units, t));
            return (
              <g key={t}>
                <line x1={M.left} x2={M.left + innerW} y1={py} y2={py} stroke="var(--grid)" />
                <text x={M.left - 8} y={py} dy="0.32em" textAnchor="end" className="tabular-nums">
                  {formatTick(metric, units, fromDisplay(metric, units, t))}
                </text>
              </g>
            );
          })}
          {xTicks.map((t) => (
            <g key={t.days}>
              <line x1={x(t.days)} x2={x(t.days)} y1={M.top + innerH} y2={M.top + innerH + (t.label ? 5 : 3)} stroke="var(--axis)" />
              {t.label && (
                <text x={x(t.days)} y={M.top + innerH + 18} textAnchor="middle">
                  {t.label}
                </text>
              )}
            </g>
          ))}
          <line x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} stroke="var(--axis)" />
          <text x={M.left - 8} y={M.top - 4} textAnchor="end" fontWeight={600}>
            {unitLabel(metric, units)}
          </text>
        </g>

        {/* percentile bands, lightest at the extremes */}
        <path d={band(3, 97)} fill="var(--band-1)" />
        <path d={band(10, 90)} fill="var(--band-2)" />
        <path d={band(25, 75)} fill="var(--band-3)" />
        {STANDARD_PERCENTILES.map((p) => (
          <path
            key={p}
            d={path(curves.lines.get(p)!)}
            fill="none"
            stroke={p === 50 ? "var(--median)" : "var(--pline)"}
            strokeWidth={p === 50 ? 2 : 1}
          />
        ))}

        {/* the two lines around the hovered point, drawn stronger */}
        {hoverNeighbors.map((n) => (
          <path key={n.p} d={path(curves.lines.get(n.p)!)} fill="none" stroke="var(--median)" strokeWidth={1.75} pointerEvents="none" />
        ))}

        {/* explore: the chosen percentile and age */}
        {exploreLine && exploreDot && explore && (
          <g>
            <line x1={exploreDot.x} x2={exploreDot.x} y1={M.top} y2={M.top + innerH} stroke="var(--median)" strokeDasharray="2 3" opacity={0.6} />
            <path d={exploreLine} fill="none" stroke="var(--highlight)" strokeWidth={2.5} />
            <circle cx={exploreDot.x} cy={exploreDot.y} r={6} fill="var(--highlight)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}

        {/* end-of-line labels */}
        <g className="text-[11px]">
          {endLabels.map((l) => (
            <text
              key={l.p}
              x={M.left + innerW + 6}
              y={l.y}
              dy="0.32em"
              fill={l.bold || neighborSet.has(l.p) ? "var(--ink)" : "var(--ink-3)"}
              fontWeight={l.bold || neighborSet.has(l.p) ? 600 : 400}
            >
              {ordinal(l.p)}
            </text>
          ))}
        </g>

        {/* baby: history, projection, points */}
        {projection && (
          <path d={projection} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />
        )}
        {babyLine && <path d={babyLine} fill="none" stroke="var(--accent)" strokeWidth={2} />}
        {visibleBaby.map((b) =>
          b.id === selectedId ? (
            <g key={b.id}>
              <circle cx={x(b.ageDays)} cy={y(b.value)} r={13} fill="var(--accent)" opacity={0.15} />
              <circle cx={x(b.ageDays)} cy={y(b.value)} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} />
            </g>
          ) : (
            <circle key={b.id} cx={x(b.ageDays)} cy={y(b.value)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          ),
        )}
        {probe && probe.ageDays <= maxAge && (
          <g>
            <circle cx={x(probe.ageDays)} cy={y(probe.value)} r={14} fill="var(--accent)" opacity={0.15} />
            <circle cx={x(probe.ageDays)} cy={y(probe.value)} r={7} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
          </g>
        )}

        {/* hover crosshair */}
        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.ageDays)} x2={x(hover.ageDays)} y1={M.top} y2={M.top + innerH} stroke="var(--ink-3)" strokeWidth={1} />
            {hoverNeighbors.map((n) => (
              <circle key={n.p} cx={x(hover.ageDays)} cy={y(n.value)} r={3.5} fill="var(--surface)" stroke="var(--median)" strokeWidth={1.75} />
            ))}
            <circle cx={x(hover.ageDays)} cy={y(hover.value)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}

        {/* hit area for the plot */}
        <rect
          x={M.left}
          y={M.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          style={{ touchAction: "none", cursor: "crosshair" }}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={onPointerLeave}
        />
      </svg>

      {measured > 0 && hover && hoverPct !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg"
          style={{
            top: Math.max(0, Math.min(y(hover.value) - 30, height - 130)),
            left: tipFlip ? undefined : tipLeft + 14,
            right: tipFlip ? width - tipLeft + 14 : undefined,
          }}
        >
          <div className="text-[var(--ink-2)]">{capitalize(formatAge(hover.ageDays))}</div>
          <div className="mt-0.5 whitespace-nowrap">
            <span className="font-semibold text-[var(--ink)]">{formatValue(metric, units, hover.value)}</span>
            <span className="text-[var(--ink-2)]"> · {formatPercentile(hoverPct)} percentile</span>
          </div>
          {hoverNeighbors.length > 0 && (
            <div className="mt-1.5 grid grid-cols-[auto_auto_auto] gap-x-3 gap-y-0.5 border-t border-[var(--line)] pt-1.5 tabular-nums whitespace-nowrap">
              {hoverNeighbors.map((n) => (
                <div key={n.p} className="contents">
                  <span className="text-[var(--ink-2)]">{ordinal(n.p)}</span>
                  <span className="text-[var(--ink)]">{formatValue(metric, units, n.value)}</span>
                  <span className="text-[var(--ink-3)]">
                    {n.value >= hover.value ? "+" : "−"}
                    {formatDelta(metric, units, n.value - hover.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Round-number ticks between lo and hi, about `count` of them. */
function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  const raw = span / Math.max(2, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}
