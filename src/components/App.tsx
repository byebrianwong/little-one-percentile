"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GrowthChart, { type ChartPoint } from "./GrowthChart";
import InsightPanel, { type InsightMode } from "./InsightPanel";
import ExplorePanel, { ExploreControls } from "./ExplorePanel";
import BabyPanel from "./BabyPanel";
import ReferenceTable from "./ReferenceTable";
import { valueAtPercentile, zFromValue, type Metric, type Sex } from "@/lib/growth";
import { RANGES, rangeFor, snapAge } from "@/lib/ages";
import { METRIC_LABEL, daysBetween, todayISO, type Units } from "@/lib/format";
import { insightFor } from "@/lib/insight";
import { defaultUnits, loadSaved, newId, readUrl, save, writeUrl, type Baby, type Measurement } from "@/lib/store";

const DEFAULT_AGE = 91; // 13 weeks

/** The baby's age today, snapped to the ages the chart uses (so between birth and 2 years). */
function ageToday(birthDate: string): number {
  return snapAge(daysBetween(birthDate, todayISO()));
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [sex, setSex] = useState<Sex>("girl");
  const [metric, setMetric] = useState<Metric>("weight");
  const [units, setUnits] = useState<Units>("imperial");
  const [ageDays, setAgeDays] = useState(DEFAULT_AGE);
  const [percentile, setPercentile] = useState(50);
  const [rangeId, setRangeId] = useState(rangeFor(DEFAULT_AGE).id);
  const [probe, setProbe] = useState<ChartPoint | null>(null);
  const [view, setView] = useState<"explore" | "baby">("explore");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverAge, setHoverAge] = useState<number | null>(null);
  const [baby, setBaby] = useState<Baby | null>(null);
  const chartRef = useRef<HTMLElement>(null);

  // Load saved settings and the URL once, after the first render.
  useEffect(() => {
    const saved = loadSaved();
    const url = readUrl(location.search);
    const b = saved.baby ?? null;
    // Measurements entered by date get their age refreshed against the birthday.
    if (b?.birthDate) {
      b.measurements = b.measurements.map((m) => (m.date ? { ...m, ageDays: daysBetween(b.birthDate!, m.date) } : m));
    }
    const latest = b?.measurements.reduce<Measurement | null>((acc, m) => (!acc || m.ageDays > acc.ageDays ? m : acc), null);
    const age = url.ageDays ?? (b?.birthDate ? ageToday(b.birthDate) : latest?.ageDays) ?? DEFAULT_AGE;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time load from browser storage */
    setSex(url.sex ?? saved.prefs?.sex ?? "girl");
    setMetric(url.metric ?? saved.prefs?.metric ?? "weight");
    setUnits(url.units ?? saved.prefs?.units ?? defaultUnits());
    setAgeDays(age);
    setPercentile(url.percentile ?? 50);
    setBaby(b);
    if (latest && url.ageDays === undefined) setView("baby");
    setRangeId(rangeFor(Math.max(age, latest?.ageDays ?? 0)).id);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    save({ sex, metric, units }, baby);
  }, [ready, sex, metric, units, baby]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => writeUrl({ sex, metric, units, ageDays, percentile }), 250);
    return () => clearTimeout(t);
  }, [ready, sex, metric, units, ageDays, percentile]);

  // Escape clears the pinned point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProbe(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1];

  // Widen the chart when the age in focus would fall off its right edge.
  function showAge(days: number) {
    if (days > range.days) setRangeId(rangeFor(days).id);
  }

  // The baby's measurements are only drawn on the chart for the baby's own sex.
  const babySex = baby?.sex ?? sex;
  const babyPoints = useMemo(
    () =>
      babySex !== sex
        ? []
        : (baby?.measurements ?? [])
            .filter((m) => m[metric] !== undefined)
            .map((m) => ({ id: m.id, ageDays: m.ageDays, value: m[metric]! })),
    [baby, metric, babySex, sex],
  );

  const selectedBabyPoint = useMemo(() => {
    if (babyPoints.length === 0) return null;
    return babyPoints.find((p) => p.id === selectedId) ?? babyPoints.reduce((a, p) => (p.ageDays > a.ageDays ? p : a));
  }, [babyPoints, selectedId]);

  const mode: InsightMode = probe ? "probe" : view === "baby" && selectedBabyPoint ? "baby" : "explore";

  const focus: ChartPoint =
    mode === "probe"
      ? probe!
      : mode === "baby"
        ? selectedBabyPoint!
        : { ageDays, value: valueAtPercentile(metric, sex, ageDays, percentile) };
  const insight = insightFor(metric, sex, focus.ageDays, focus.value);

  const projectFrom = mode === "explore" ? null : { ...focus, z: zFromValue(metric, sex, focus.ageDays, focus.value) };

  function exploreAt(days: number, p = percentile) {
    setProbe(null);
    setView("explore");
    setAgeDays(days);
    setPercentile(p);
    showAge(days);
  }

  /** Shows a measurement on the chart. With id null, the latest measurement is selected. */
  function focusMeasurement(m: Measurement, id: string | null) {
    setProbe(null);
    setSelectedId(id);
    setView("baby");
    if (m[metric] === undefined) {
      const k = (["weight", "length", "head"] as Metric[]).find((x) => m[x] !== undefined);
      if (k) setMetric(k);
    }
    showAge(m.ageDays);
  }

  function saveProbe() {
    if (!probe) return;
    const prev: Baby = baby ?? { name: "", measurements: [] };
    // A baby whose sex was never chosen takes the sex of the chart the point was saved from.
    const b: Baby = prev.sex ? prev : { ...prev, sex };
    const m: Measurement = { id: newId(), ageDays: probe.ageDays, [metric]: probe.value };
    if (b.birthDate) {
      const d = new Date(`${b.birthDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + Math.round(probe.ageDays));
      m.date = d.toISOString().slice(0, 10);
    }
    setBaby({ ...b, measurements: [...b.measurements, m] });
    if (b.sex) setSex(b.sex);
    setSelectedId(null);
    setView("baby");
    setProbe(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Controls: one row above everything they affect. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Sex"
          value={sex}
          onChange={setSex}
          options={[
            ["girl", "Girl"],
            ["boy", "Boy"],
          ]}
        />
        <Segmented
          label="Measure"
          value={metric}
          onChange={setMetric}
          options={(["weight", "length", "head"] as Metric[]).map((m) => [m, METRIC_LABEL[m]])}
        />
        <Segmented
          label="Units"
          value={units}
          onChange={setUnits}
          options={[
            ["imperial", <>lb<span className="hidden sm:inline"> · in</span></>],
            ["metric", <>kg<span className="hidden sm:inline"> · cm</span></>],
          ]}
        />
      </div>

      {/* Phones show the baby panel, the chart, then the lookup table, in page order. Wide screens put the
          chart on the left and stack the baby panel and lookup table on the right. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-2 lg:row-start-1">
          <BabyPanel
            baby={baby}
            sex={sex}
            metric={metric}
            units={units}
            onChange={(b) => {
              setBaby(b);
              if (!b || b.measurements.length === 0) setView("explore");
              // A new birthday moves the chart to the baby's age today.
              if (b?.birthDate && b.birthDate !== baby?.birthDate) {
                const age = ageToday(b.birthDate);
                setAgeDays(age);
                setRangeId(rangeFor(age).id);
                if (b.measurements.length === 0) setProbe(null);
              }
            }}
            onShowChart={setSex}
            onSelect={(m) => focusMeasurement(m, m.id)}
            onAdded={(m) => focusMeasurement(m, null)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section ref={chartRef} className="card scroll-mt-4 p-5 sm:p-6" aria-label="Growth chart">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {babyPoints.length > 0 ? (
                  <Segmented
                    label="View"
                    small
                    value={mode === "explore" ? "explore" : mode === "baby" ? "baby" : ""}
                    onChange={(v) => {
                      setProbe(null);
                      setView(v as "explore" | "baby");
                      if (v === "baby" && selectedBabyPoint) showAge(selectedBabyPoint.ageDays);
                    }}
                    options={[
                      ["baby", baby?.name.trim() || "My baby"],
                      ["explore", "Explore"],
                    ]}
                  />
                ) : (
                  // On a phone the Clear button takes the label's place, so this row
                  // does not wrap and push the chart down when a point is pinned.
                  <span className={`text-xs font-medium tracking-wide text-[var(--ink-3)] uppercase ${mode === "probe" ? "hidden sm:inline" : ""}`}>
                    {mode === "probe" ? "Pinned point" : "Exploring"}
                  </span>
                )}
                {mode === "probe" && (
                  <button onClick={() => setProbe(null)} className="btn-ghost" aria-label="Clear the pinned point">
                    Clear
                  </button>
                )}
              </div>
              <Segmented
                label="Age range"
                small
                value={rangeId}
                onChange={setRangeId}
                options={RANGES.map((r) => [r.id, r.label])}
              />
            </div>

            <InsightPanel
              part="headline"
              mode={mode}
              sex={sex}
              metric={metric}
              units={units}
              insight={insight}
              babyName={baby?.name ?? ""}
            />

            <div className="mt-4 -mx-2 sm:mx-0">
              <GrowthChart
                sex={sex}
                metric={metric}
                units={units}
                range={range}
                explore={mode === "explore" ? { ageDays, percentile } : null}
                probe={probe}
                babyPoints={babyPoints}
                projectFrom={projectFrom}
                selectedId={mode === "baby" ? (selectedBabyPoint?.id ?? null) : null}
                onSelectBaby={(id) => {
                  setProbe(null);
                  setSelectedId(id);
                  setView("baby");
                }}
                onHoverAge={setHoverAge}
                onProbe={(p) => {
                  setProbe(p);
                  setAgeDays(p.ageDays);
                }}
              />
            </div>
            <ChartKey hasBaby={babyPoints.length > 0 || !!probe} />

            <div className="mt-5 flex flex-col gap-5 border-t border-[var(--line)] pt-5 lg:hidden">
              <ExploreControls
                idPrefix="inline"
                ageDays={mode === "explore" ? ageDays : focus.ageDays}
                percentile={percentile}
                active={mode === "explore"}
                onAge={(d) => exploreAt(d)}
                onPercentile={(p) => exploreAt(mode === "explore" ? ageDays : focus.ageDays, p)}
              />
            </div>

            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <InsightPanel
                part="details"
                mode={mode}
                sex={sex}
                metric={metric}
                units={units}
                insight={insight}
                babyName={baby?.name ?? ""}
                onSaveProbe={saveProbe}
              />
            </div>
          </section>
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <ExplorePanel
            sex={sex}
            metric={metric}
            units={units}
            ageDays={mode === "explore" ? ageDays : focus.ageDays}
            hoverAge={hoverAge}
            percentile={percentile}
            active={mode === "explore"}
            marker={
              mode === "explore"
                ? null
                : { label: mode === "probe" ? "Pinned" : baby?.name.trim() || "Your baby", value: focus.value, percentile: insight.percentile }
            }
            onAge={(d) => exploreAt(d)}
            onPercentile={(p) => exploreAt(mode === "explore" ? ageDays : focus.ageDays, p)}
          />
        </div>
      </div>

      <ReferenceTable sex={sex} metric={metric} units={units} onPick={(a, p) => {
        exploreAt(a, p);
        // Scroll to the chart, not the page top: on phones the baby panel sits above it.
        chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }} />
    </div>
  );
}

function ChartKey({ hasBaby }: { hasBaby: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--ink-2)]">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-[var(--median)]" /> Median (50th)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm bg-[var(--band-3)]" /> 25th–75th
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm bg-[var(--band-2)]" /> 10th–90th
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm bg-[var(--band-1)]" /> 3rd–97th
      </span>
      {hasBaby && (
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden>
            <line x1="1" y1="2" x2="17" y2="2" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
          </svg>
          If they stay on the same percentile
        </span>
      )}
      <span className="ml-auto hidden text-[var(--ink-3)] sm:inline">Point at the chart to read any spot. Click to pin it.</span>
      <span className="text-[var(--ink-3)] sm:hidden">Tap the chart to pin a point, then drag it.</span>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  small,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: [T, React.ReactNode][];
  small?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${small ? "segmented-sm" : ""}`}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={v === value} data-on={v === value || undefined} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
