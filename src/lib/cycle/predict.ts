import { addDays } from "@/lib/utils";
import { completedCycles } from "@/lib/cycle/derive";
import type { Confidence, Cycle } from "@/lib/cycle/types";

/** Скільки останніх завершених циклів беремо в середнє. */
const WINDOW = 6;
/** Мінімум завершених циклів, щоб довіряти власній статистиці замість налаштувань. */
const MIN_CYCLES = 2;
/** Лютеїнова фаза стабільна ~14 днів — овуляцію рахуємо назад від старту. */
export const LUTEAL_DAYS = 14;
/** Вікно прогнозу ніколи не вужче за ±2 дні, навіть при ідеальній регулярності. */
const MIN_WINDOW = 2;

export interface Prediction {
  /** Середня довжина циклу: власна статистика або typical з налаштувань. */
  avgLength: number;
  /** Середня тривалість менструації. */
  avgPeriodLength: number;
  /** Стандартне відхилення довжин. 0, якщо статистики ще немає. */
  sd: number;
  confidence: Confidence;
  /** Найімовірніший старт наступної менструації. */
  nextStart: string;
  /** Вікно прогнозу, ±max(2, round(sd)) днів. */
  windowStart: string;
  windowEnd: string;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  /** Скільки завершених циклів стоїть за цифрами. */
  basedOn: number;
  /**
   * true, коли розкид завеликий, щоб називати одну дату (плану п. 2.3).
   * UI у цьому разі мусить показувати діапазон.
   */
  rangeOnly: boolean;
  /** Поточний цикл вийшов за avg + 2sd — нейтральна згадка про затримку. */
  overdue: boolean;
}

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Стандартне відхилення генеральної сукупності: циклів мало, вибірковий поділ на n-1 роздував би вікно. */
function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((v) => (v - m) ** 2)));
}

function confidenceFor(sd: number, sampleSize: number): Confidence {
  if (sampleSize < MIN_CYCLES) return "low";
  if (sd <= 2) return "high";
  if (sd <= 4) return "medium";
  return "low";
}

/**
 * Прогноз від останнього відомого старту менструації.
 *
 * Овуляція рахується назад від прогнозованого старту НАСТУПНОГО циклу,
 * а не як «14-й день від початку»: при циклі 33 дні другий спосіб
 * промахнувся б майже на тиждень.
 *
 * null, якщо стартів менструації ще немає — прогнозувати нема від чого.
 */
export function predict(
  cycles: Cycle[],
  settings: { typical_cycle_length: number; typical_period_length: number },
  today: string,
): Prediction | null {
  const lastStart = cycles[cycles.length - 1]?.start;
  if (!lastStart) return null;

  const done = completedCycles(cycles).slice(-WINDOW);
  const lengths = done.map((c) => c.length as number);

  const enough = lengths.length >= MIN_CYCLES;
  const avgLength = enough ? mean(lengths) : settings.typical_cycle_length;
  const sd = enough ? stdDev(lengths) : 0;
  const confidence = confidenceFor(sd, lengths.length);

  // Тривалість менструації: власні дані точніші за налаштування, але
  // остання менструація може бути ще не дописана — беремо завершені цикли.
  const periods = done.map((c) => c.periodLength).filter((p) => p > 0);
  const avgPeriodLength = periods.length ? mean(periods) : settings.typical_period_length;

  const nextStart = addDays(lastStart, Math.round(avgLength));
  const spread = Math.max(MIN_WINDOW, Math.round(sd));
  const ovulation = addDays(nextStart, -LUTEAL_DAYS);

  return {
    avgLength,
    avgPeriodLength,
    sd,
    confidence,
    nextStart,
    windowStart: addDays(nextStart, -spread),
    windowEnd: addDays(nextStart, spread),
    ovulation,
    fertileStart: addDays(ovulation, -5),
    fertileEnd: addDays(ovulation, 1),
    basedOn: lengths.length,
    rangeOnly: sd > 4,
    // Затримка починається за межами avg + 2sd, але не раніше краю вікна
    // прогнозу: при ідеальній регулярності sd = 0, і без цього порогу
    // застосунок оголошував би затримку на наступний же день після прогнозу.
    overdue: today > addDays(nextStart, Math.max(MIN_WINDOW, Math.round(2 * sd))),
  };
}
