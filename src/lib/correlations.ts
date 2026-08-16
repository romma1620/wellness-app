import type { WeekBucket } from "@/lib/utils";

/** Скільки завершених тижнів Пн–Нд іде в аналіз (~6 місяців). */
export const ANALYSIS_WEEKS = 26;
/** Мінімум парних тижнів, щоб порівняння груп щось значило. */
export const MIN_WEEKS = 8;
/** Мінімум заповнених днів, щоб середнє тижня по метриці щось значило. */
const MIN_DAYS_PER_WEEK = 4;
/** Для ваги досить трьох зважувань: терези беруть не щодня, але 3 точки вже дають середнє. */
const MIN_WEIGHINGS_PER_WEEK = 3;

export interface DayInput {
  date: string; // YYYY-MM-DD
  weight: number | null;
  kcal: number | null;
  steps: number | null;
  protein: number | null;
}

export interface WeekAgg {
  start: string; // ISO-понеділок
  kcal: number | null;
  steps: number | null;
  protein: number | null;
  weight: number | null;
  /** 0 = тиждень без тренувань: це справжній нуль, а не пропуск даних. */
  tonnage: number;
}

/** Середнє, якщо заповнених значень не менше minN; інакше null. */
function validAvg(vals: (number | null | undefined)[], minN: number): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length < minN) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Згортає дні в тижні-агрегати. Кошики мають бути повними тижнями Пн–Нд —
 * інакше пороги валідності (4 із 7 днів) втрачають сенс.
 */
export function buildWeekAggs(
  days: DayInput[],
  tonnageByDate: Map<string, number>,
  weeks: WeekBucket[],
): WeekAgg[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return weeks.map((w) => {
    const rows = w.dates.map((d) => byDate.get(d));
    return {
      start: w.start,
      kcal: validAvg(rows.map((r) => r?.kcal), MIN_DAYS_PER_WEEK),
      steps: validAvg(rows.map((r) => r?.steps), MIN_DAYS_PER_WEEK),
      protein: validAvg(rows.map((r) => r?.protein), MIN_DAYS_PER_WEEK),
      weight: validAvg(rows.map((r) => r?.weight), MIN_WEIGHINGS_PER_WEEK),
      tonnage: w.dates.reduce((s, d) => s + (tonnageByDate.get(d) ?? 0), 0),
    };
  });
}

export interface PairPoint {
  weekStart: string;
  x: number;
  y: number;
}

/**
 * Точки вагових пар: x = драйвер тижня i, y = вага(i+1) − вага(i).
 * Зсув на тиждень уперед — зʼїдене цього тижня видно на терезах наступного;
 * порівняння з минулим тижнем змішувало б причину з наслідком.
 */
export function deltaWeightPoints(aggs: WeekAgg[], xKey: "kcal" | "steps"): PairPoint[] {
  const pts: PairPoint[] = [];
  for (let i = 0; i + 1 < aggs.length; i++) {
    const x = aggs[i][xKey];
    const w0 = aggs[i].weight;
    const w1 = aggs[i + 1].weight;
    if (x === null || w0 === null || w1 === null) continue;
    pts.push({ weekStart: aggs[i].start, x, y: w1 - w0 });
  }
  return pts;
}

/** Точки «білок ↔ тоннаж»: обидві метрики того самого тижня, без зсуву. */
export function tonnagePoints(aggs: WeekAgg[]): PairPoint[] {
  return aggs.flatMap((a) =>
    a.protein === null ? [] : [{ weekStart: a.start, x: a.protein, y: a.tonnage }],
  );
}
