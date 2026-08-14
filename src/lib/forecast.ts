import { addDays, daysBetween } from "@/lib/utils";

export interface WeightRow {
  date: string; // YYYY-MM-DD
  weight: number | null;
}

/** Тренд ваги за останні тижні. */
export interface WeightTrend {
  /** Кг за день; від'ємний = схуднення. */
  slope: number;
  /** Регресійна оцінка ваги на день `today`. */
  level: number;
  /** Скільки точок стало за трендом. */
  n: number;
}

/**
 * Вікно тренду. Шість тижнів, а не вся історія: прогноз має відповідати
 * поточному темпу, а не усередненню з давніх плато і зривів.
 */
export const TREND_WINDOW_DAYS = 42;

/** Мінімум точок і охоплення, нижче яких пряма — це вгадування, а не тренд. */
export const TREND_MIN_POINTS = 8;
export const TREND_MIN_SPAN_DAYS = 14;

/**
 * Лінійний тренд ваги за останні TREND_WINDOW_DAYS.
 *
 * Звичайні найменші квадрати по днях: пропуски в щоденнику просто дають
 * менше точок, а не ламають шкалу. null — коли даних замало, щоб пряма
 * щось означала (мало точок або всі вони збилися в купку днів).
 */
export function weightTrend(rows: WeightRow[], today: string): WeightTrend | null {
  const from = addDays(today, -TREND_WINDOW_DAYS);
  const pts = rows
    .filter(
      (r): r is { date: string; weight: number } =>
        r.weight != null && Number.isFinite(r.weight) && r.date >= from && r.date <= today,
    )
    .map((r) => ({ x: daysBetween(from, r.date), y: r.weight }));

  if (pts.length < TREND_MIN_POINTS) return null;
  const xs = pts.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < TREND_MIN_SPAN_DAYS) return null;

  const n = pts.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) return null;

  const slope = num / den;
  // рівень на сьогодні: x сьогоднішнього дня = TREND_WINDOW_DAYS
  const level = meanY + slope * (TREND_WINDOW_DAYS - meanX);
  return { slope, level, n };
}

export interface Eta {
  days: number;
  date: string; // YYYY-MM-DD
}

/**
 * Повільніше за 10 г/день прогноз не обіцяє: дата за таким нахилом
 * стрибала б на місяці від одного зважування.
 */
export const ETA_MIN_LOSS_PER_DAY = 0.01;

/** Далі, ніж на рік, екстраполювати нечесно. */
export const ETA_MAX_DAYS = 365;

/**
 * Дата досягнення цільової ваги за поточним трендом.
 * null = тренд не веде до цілі (плоский, висхідний, надто повільний
 * або ціль далі за рік).
 */
export function etaTo(trend: WeightTrend, target: number, today: string): Eta | null {
  if (trend.level <= target) return { days: 0, date: today };
  if (trend.slope > -ETA_MIN_LOSS_PER_DAY) return null;
  const days = Math.ceil((target - trend.level) / trend.slope);
  if (days > ETA_MAX_DAYS) return null;
  return { days, date: addDays(today, days) };
}
