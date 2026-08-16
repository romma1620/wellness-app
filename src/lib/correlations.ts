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

// ----------------------- Аналіз пари -----------------------

export type PairKey = "kcal-weight" | "steps-weight" | "protein-tonnage";

export interface PairThresholds {
  /** Мінімальна різниця середніх X між групами — без контрасту нема що порівнювати. */
  minXContrast: number;
  /** Поріг значущості різниці Y: кг/тиж (absolute) або частка (relative). */
  minYDiff: number;
  yDiffMode: "absolute" | "relative";
}

/**
 * Пороги — зі спеки. Контраст ккал 120 — нижче точності підрахунку калорій;
 * 0.2 кг/тиж — типовий шум води навіть після тижневого усереднення;
 * 0.12 — той самий дух, що MIN_MEANINGFUL_DIFF у інсайтах циклу.
 */
export const THRESHOLDS: Record<PairKey, PairThresholds> = {
  "kcal-weight": { minXContrast: 120, minYDiff: 0.2, yDiffMode: "absolute" },
  "steps-weight": { minXContrast: 1000, minYDiff: 0.2, yDiffMode: "absolute" },
  "protein-tonnage": { minXContrast: 10, minYDiff: 0.12, yDiffMode: "relative" },
};

export type PairAnalysis =
  | { state: "collecting"; n: number; needed: number }
  | { state: "no-contrast"; n: number; points: PairPoint[] }
  | { state: "no-link"; n: number; r: number | null; points: PairPoint[] }
  | {
      state: "link";
      n: number;
      r: number | null;
      points: PairPoint[];
      /** Середні X груп — для тексту «≈1650 проти ≈2100». */
      lowX: number;
      highX: number;
      lowY: number;
      highY: number;
      /** highY − lowY; знак — напрям звʼязку. */
      diff: number;
      /** Межа груп — вертикальна лінія на scatter. */
      medianX: number;
    };

/** Пірсонів r; null, якщо точок < 3 або дисперсія X чи Y нульова. */
export function pearson(points: PairPoint[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type LinkStrength = "weak" | "notable" | "strong";

/** Словесна шкала |r| для підпису під scatter; вердикт картки від неї не залежить. */
export function strengthOf(r: number): LinkStrength {
  const a = Math.abs(r);
  if (a < 0.3) return "weak";
  if (a <= 0.6) return "notable";
  return "strong";
}

function mean(arr: PairPoint[], key: "x" | "y"): number {
  return arr.reduce((s, p) => s + p[key], 0) / arr.length;
}

/**
 * Медіанний спліт із трьома чесними порогами (мінімум тижнів, контраст X,
 * значуща різниця Y). При непарній кількості точок середня відкидається з
 * обох груп — контраст між ними стає різкішим, а не розмитим.
 */
export function analyzePair(points: PairPoint[], t: PairThresholds): PairAnalysis {
  const n = points.length;
  if (n < MIN_WEEKS) return { state: "collecting", n, needed: MIN_WEEKS };

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const half = Math.floor(n / 2);
  const low = sorted.slice(0, half);
  const high = sorted.slice(n - half);

  const lowX = mean(low, "x");
  const highX = mean(high, "x");
  if (highX - lowX < t.minXContrast) return { state: "no-contrast", n, points };

  const r = pearson(points);
  const lowY = mean(low, "y");
  const highY = mean(high, "y");
  const diff = highY - lowY;

  // Симетрична відносна різниця не ламається, коли нижня група близька до нуля.
  const denom = Math.abs((lowY + highY) / 2);
  const significant =
    t.yDiffMode === "absolute"
      ? Math.abs(diff) >= t.minYDiff
      : denom > 0 && Math.abs(diff) / denom >= t.minYDiff;
  if (!significant) return { state: "no-link", n, r, points };

  const medianX = (sorted[half - 1].x + sorted[n - half].x) / 2;
  return { state: "link", n, r, points, lowX, highX, lowY, highY, diff, medianX };
}
