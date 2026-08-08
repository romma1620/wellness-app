import { cycleDayFor } from "@/lib/cycle/derive";
import { phaseAt, type PhaseRange } from "@/lib/cycle/phases";
import { PHASES, type Cycle, type CycleEntry, type Phase } from "@/lib/cycle/types";

/**
 * Наскільки різниця мусить бути помітною, щоб її взагалі показувати, %.
 * Нижче цього — шум циклу з двох-трьох спостережень, і назвати його
 * закономірністю було б неправдою.
 */
export const MIN_MEANINGFUL_DIFF = 12;

/** Мінімум днів у фазі, щоб середнє по ній щось значило. */
const MIN_DAYS_PER_PHASE = 3;

export interface PhaseStat {
  phase: Phase;
  avg: number | null;
  /** Скільки днів із даними стало за середнім. */
  n: number;
}

export interface DatedValue {
  date: string;
  value: number | null;
}

/**
 * Середнє метрики по кожній фазі. Фази без достатньої кількості
 * спостережень повертаються з avg === null, а не викидаються: викликач
 * має бачити, що фаза існує, але даних по ній ще нема.
 */
export function averageByPhase(rows: DatedValue[], ranges: PhaseRange[]): PhaseStat[] {
  const buckets = new Map<Phase, number[]>(PHASES.map((p) => [p, []]));

  for (const row of rows) {
    if (row.value === null || !Number.isFinite(row.value)) continue;
    const phase = phaseAt(row.date, ranges);
    if (!phase) continue;
    buckets.get(phase)!.push(row.value);
  }

  return PHASES.map((phase) => {
    const vals = buckets.get(phase)!;
    return {
      phase,
      n: vals.length,
      avg:
        vals.length >= MIN_DAYS_PER_PHASE
          ? vals.reduce((s, v) => s + v, 0) / vals.length
          : null,
    };
  });
}

/** Відносна різниця a проти b у відсотках. null, якщо порівнювати нема з чим. */
export function relDiff(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

export function statFor(stats: PhaseStat[], phase: Phase): PhaseStat | undefined {
  return stats.find((s) => s.phase === phase);
}

/**
 * Порівняння двох фаз, готове до показу. null означає «нема що сказати» —
 * або даних мало, або різниця в межах шуму.
 */
export function comparePhases(
  stats: PhaseStat[],
  phase: Phase,
  against: Phase,
): { diffPct: number; value: number; base: number } | null {
  const a = statFor(stats, phase);
  const b = statFor(stats, against);
  if (!a?.avg || !b?.avg) return null;
  const diffPct = relDiff(a.avg, b.avg);
  if (diffPct === null || Math.abs(diffPct) < MIN_MEANINGFUL_DIFF) return null;
  return { diffPct, value: a.avg, base: b.avg };
}

// ----------------------- Симптоми -----------------------

export interface SymptomStat {
  key: string;
  /** Скільки днів симптом відмічений. */
  days: number;
  /** Частка від найчастішого симптому, 0..1 — довжина смужки. */
  share: number;
  /** Типовий діапазон днів циклу, у які він трапляється. null, якщо циклів нема. */
  dayFrom: number | null;
  dayTo: number | null;
}

/** Персентиль на відсортованому масиві, лінійна інтерполяція. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Найчастіші симптоми з типовим вікном днів циклу.
 *
 * Вікно — це міжквартильний діапазон, а не min–max: один випадковий
 * головний біль на 19-й день не має розтягувати «дні 1–3» на «дні 1–19».
 */
export function symptomStats(
  entries: CycleEntry[],
  cycles: Cycle[],
  topN = 3,
): SymptomStat[] {
  // days рахує всі відмітки, cycleDays — лише ті, що лягли у відомий цикл:
  // симптом за межами історії циклів усе одно частий, просто без вікна днів.
  const acc = new Map<string, { days: number; cycleDays: number[] }>();

  for (const e of entries) {
    const day = cycleDayFor(e.date, cycles);
    for (const key of e.symptoms ?? []) {
      const rec = acc.get(key) ?? { days: 0, cycleDays: [] };
      rec.days++;
      if (day !== null) rec.cycleDays.push(day);
      acc.set(key, rec);
    }
  }

  const ranked = [...acc.entries()]
    .sort((a, b) => b[1].days - a[1].days || a[0].localeCompare(b[0]))
    .slice(0, topN);
  const max = ranked[0]?.[1].days ?? 0;

  return ranked.map(([key, rec]) => {
    const sorted = rec.cycleDays.slice().sort((a, b) => a - b);
    return {
      key,
      days: rec.days,
      share: max > 0 ? rec.days / max : 0,
      dayFrom: sorted.length ? Math.round(percentile(sorted, 0.25)) : null,
      dayTo: sorted.length ? Math.round(percentile(sorted, 0.75)) : null,
    };
  });
}

// ----------------------- Затримка води -----------------------

/**
 * Приріст ваги у ПМС/менструації проти фолікулярної фази.
 *
 * Це найцінніша підказка фічі: без неї сходинка на терезах у ці дні
 * читається як провал, хоч це вода. Повертає null, коли приросту немає
 * або даних замало — вигадувати заспокоєння теж не варто.
 */
export function waterRetention(
  weights: DatedValue[],
  ranges: PhaseRange[],
  todayPhase: Phase | null,
): { deltaKg: number; phase: Phase } | null {
  if (todayPhase !== "late_luteal" && todayPhase !== "menstrual") return null;

  const stats = averageByPhase(weights, ranges);
  const now = statFor(stats, todayPhase);
  const base = statFor(stats, "follicular");
  if (!now?.avg || !base?.avg) return null;

  const delta = now.avg - base.avg;
  // до 2 кг — типова затримка води; більше вже не варто списувати на фазу
  if (delta < 0.2 || delta > 2) return null;
  return { deltaKg: delta, phase: todayPhase };
}
