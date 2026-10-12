"use client";

import { useState } from "react";
import { MAX_AGE_DAYS, percentileFromValue, zFromValue, type Metric, type Sex } from "@/lib/growth";
import {
  ageToDays,
  capitalize,
  daysBetween,
  formatAge,
  formatPercentile,
  formatValue,
  fromDisplay,
  todayISO,
  unitLabel,
  type AgeUnit,
  type Units,
} from "@/lib/format";
import { newId, type Baby, type Measurement } from "@/lib/store";

interface Props {
  baby: Baby | null;
  sex: Sex;
  metric: Metric;
  units: Units;
  onChange: (baby: Baby | null) => void;
  onSelect: (m: Measurement) => void;
  onAdded: (m: Measurement) => void;
  onShowBabyChart: () => void;
}

const METRICS: Metric[] = ["weight", "length", "head"];

export default function BabyPanel({ baby, sex: chartSex, metric, units, onChange, onSelect, onAdded, onShowBabyChart }: Props) {
  const [adding, setAdding] = useState(false);
  const b: Baby = baby ?? { name: "", measurements: [] };
  const sex = b.sex ?? chartSex;
  const otherChart = sex !== chartSex && b.measurements.length > 0;
  const sorted = [...b.measurements].sort((x, y) => y.ageDays - x.ageDays);

  function update(next: Partial<Baby>) {
    onChange({ ...b, ...next });
  }

  function setBirthDate(birthDate: string) {
    // Re-date measurements that were entered by date.
    const measurements = b.measurements.map((m) =>
      m.date && birthDate ? { ...m, ageDays: Math.max(0, daysBetween(birthDate, m.date)) } : m,
    );
    update({ birthDate: birthDate || undefined, measurements });
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="baby-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="baby-title" className="text-sm font-semibold text-[var(--ink)]">
            Your baby
          </h2>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">Saved only in this browser. Nothing is uploaded.</p>
        </div>
        {baby && baby.measurements.length > 0 && (
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              if (confirm("Remove your baby's saved measurements from this browser?")) onChange(null);
            }}
          >
            Reset
          </button>
        )}
      </div>

      {otherChart && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--ink-2)]">
          <span>Your baby&rsquo;s measurements are on the {sex === "girl" ? "girls'" : "boys'"} chart.</span>
          <button className="btn-accent px-3 py-1.5 text-xs" onClick={onShowBabyChart}>
            Show {sex === "girl" ? "girls'" : "boys'"} chart
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-[var(--ink-3)]">
        <span>Your baby is a</span>
        <div role="radiogroup" aria-label="Your baby's sex" className="segmented segmented-sm">
          {(["girl", "boy"] as Sex[]).map((v) => (
            <button key={v} role="radio" aria-checked={sex === v} data-on={sex === v || undefined} onClick={() => update({ sex: v })}>
              {v === "girl" ? "Girl" : "Boy"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          Name (optional)
          <input className="input" value={b.name} placeholder="Baby" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          Birthday (optional)
          <input className="input" type="date" value={b.birthDate ?? ""} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {sorted.map((m) => (
            <li key={m.id} className="flex items-start gap-2 px-3 py-2.5">
              <button className="flex-1 text-left" onClick={() => onSelect(m)}>
                <div className="text-sm font-medium text-[var(--ink)]">
                  {capitalize(formatAge(m.ageDays))}
                  {m.date && <span className="ml-1.5 text-xs font-normal text-[var(--ink-3)]">{m.date}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {METRICS.map((k) =>
                    m[k] === undefined ? null : (
                      <span key={k} className={k === metric ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}>
                        {formatValue(k, units, m[k]!)}{" "}
                        <span className="text-[var(--ink-3)]">({formatPercentile(percentileFromValue(k, sex, m.ageDays, m[k]!))})</span>
                      </span>
                    ),
                  )}
                </div>
              </button>
              <button
                className="btn-ghost -mr-1 px-2 text-base leading-none"
                aria-label={`Delete the measurement at ${formatAge(m.ageDays)}`}
                onClick={() => update({ measurements: b.measurements.filter((x) => x.id !== m.id) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <AddForm
          baby={b}
          sex={sex}
          units={units}
          defaultMetric={metric}
          onCancel={() => setAdding(false)}
          onAdd={(m) => {
            update({ measurements: [...b.measurements, m] });
            setAdding(false);
            onAdded(m);
          }}
        />
      ) : (
        <button className="btn-accent self-start" onClick={() => setAdding(true)}>
          + Add a measurement
        </button>
      )}

      {sorted.length === 0 && !adding && (
        <p className="text-xs leading-relaxed text-[var(--ink-3)]">
          Don&rsquo;t have exact numbers? Tap the chart where you think your baby is, drag the point to adjust, then save it.
        </p>
      )}
    </section>
  );
}

function AddForm({
  baby,
  sex,
  units,
  defaultMetric,
  onAdd,
  onCancel,
}: {
  baby: Baby;
  sex: Sex;
  units: Units;
  defaultMetric: Metric;
  onAdd: (m: Measurement) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [ageN, setAgeN] = useState("");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("weeks");
  const [lb, setLb] = useState("");
  const [oz, setOz] = useState("");
  const [kg, setKg] = useState("");
  const [len, setLen] = useState("");
  const [head, setHead] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ageDays = baby.birthDate ? daysBetween(baby.birthDate, date) : ageToDays(Number(ageN), ageUnit);
    if (!Number.isFinite(ageDays) || (!baby.birthDate && ageN.trim() === "")) return setError("Enter your baby's age.");
    if (ageDays < 0) return setError("That date is before the birthday.");
    if (ageDays > MAX_AGE_DAYS) return setError("These charts cover birth to 2 years.");

    const m: Measurement = { id: newId(), ageDays };
    if (baby.birthDate) m.date = date;
    if (units === "imperial" && (lb || oz)) m.weight = fromDisplay("weight", units, Number(lb || 0) + Number(oz || 0) / 16);
    if (units === "metric" && kg) m.weight = Number(kg);
    if (len) m.length = fromDisplay("length", units, Number(len));
    if (head) m.head = fromDisplay("head", units, Number(head));

    const given = METRICS.filter((k) => m[k] !== undefined);
    if (given.length === 0) return setError("Add at least one measurement.");
    for (const k of given) {
      const v = m[k]!;
      if (!(v > 0) || Math.abs(zFromValue(k, sex, ageDays, v)) > 6) {
        return setError(`That ${k === "head" ? "head size" : k} looks far outside the chart. Check the units (${unitLabel(k, units)}).`);
      }
    }
    onAdd(m);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-[var(--surface-2)] p-3.5">
      {baby.birthDate ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          Date measured
          <input className="input" type="date" value={date} min={baby.birthDate} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
      ) : (
        <div className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          <span>Age when measured</span>
          <div className="flex gap-2">
            <input
              className="input w-20"
              inputMode="decimal"
              value={ageN}
              onChange={(e) => setAgeN(e.target.value)}
              placeholder="13"
              aria-label="Age"
              autoFocus
            />
            <select className="input flex-1" value={ageUnit} onChange={(e) => setAgeUnit(e.target.value as AgeUnit)} aria-label="Age unit">
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
        <span className={defaultMetric === "weight" ? "text-[var(--ink-2)]" : ""}>Weight</span>
        {units === "imperial" ? (
          <div className="flex gap-2">
            <UnitInput value={lb} onChange={setLb} unit="lb" label="Pounds" />
            <UnitInput value={oz} onChange={setOz} unit="oz" label="Ounces" />
          </div>
        ) : (
          <UnitInput value={kg} onChange={setKg} unit="kg" label="Kilograms" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          <span>Length</span>
          <UnitInput value={len} onChange={setLen} unit={unitLabel("length", units)} label="Length" />
        </div>
        <div className="flex flex-col gap-1 text-xs text-[var(--ink-3)]">
          <span>Head</span>
          <UnitInput value={head} onChange={setHead} unit={unitLabel("head", units)} label="Head circumference" />
        </div>
      </div>
      <p className="text-[11px] text-[var(--ink-3)]">Fill in any you know; the rest can stay blank.</p>

      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-accent">
          Save
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function UnitInput({ value, onChange, unit, label }: { value: string; onChange: (v: string) => void; unit: string; label: string }) {
  return (
    <div className="relative flex-1">
      <input
        className="input w-full pr-9"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        aria-label={label}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--ink-3)]">{unit}</span>
    </div>
  );
}
