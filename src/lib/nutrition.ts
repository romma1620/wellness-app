/**
 * Аналітика харчування: чисті розрахунки над щоденником.
 * Калорійність макросів — стандартні коефіцієнти Етвотера: 4/9/4 ккал на грам.
 */

import { avg, parseISODate } from "./utils";

const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 } as const;

export interface MacroSplit {
  /** Частки калорій, у сумі 100. */
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
  /** Середні грами на день. */
  protein: number;
  fat: number;
  carbs: number;
}

/** Розподіл калорій між Б/Ж/В за середніми грамами періоду. */
export function macroSplit(
  logs: { protein: number | null; fat: number | null; carbs: number | null }[],
): MacroSplit | null {
  const protein = avg(logs.map((l) => l.protein)) ?? 0;
  const fat = avg(logs.map((l) => l.fat)) ?? 0;
  const carbs = avg(logs.map((l) => l.carbs)) ?? 0;
  const total =
    protein * KCAL_PER_G.protein + fat * KCAL_PER_G.fat + carbs * KCAL_PER_G.carbs;
  if (total <= 0) return null;
  return {
    proteinPct: (protein * KCAL_PER_G.protein * 100) / total,
    fatPct: (fat * KCAL_PER_G.fat * 100) / total,
    carbsPct: (carbs * KCAL_PER_G.carbs * 100) / total,
    protein,
    fat,
    carbs,
  };
}

/** Грами білка на кілограм ваги. */
export function proteinPerKg(
  proteinG: number | null,
  weightKg: number | null,
): number | null {
  if (proteinG == null || weightKg == null || weightKg <= 0) return null;
  return proteinG / weightKg;
}

export type ProteinZone = "low" | "mid" | "high";

/** Зони білка при силових: <1.2 — мало, 1.2–1.6 — середньо, ≥1.6 — ціль. */
export function proteinZone(gPerKg: number): ProteinZone {
  if (gPerKg < 1.2) return "low";
  if (gPerKg < 1.6) return "mid";
  return "high";
}

export interface WeekdayPattern {
  /** Середні ккал за днями тижня; індекс 0 = понеділок, 6 = неділя. */
  byWeekday: (number | null)[];
  /** Вихідні проти буднів, %; плюс = у вихідні більше. */
  weekendDeltaPct: number | null;
}

/** Патерн калорій по днях тижня. Дні без ккал не враховуються. */
export function weekdayPattern(
  logs: { date: string; kcal: number | null }[],
): WeekdayPattern {
  const perDay: number[][] = Array.from({ length: 7 }, () => []);
  for (const l of logs) {
    if (l.kcal == null || !Number.isFinite(l.kcal)) continue;
    const mondayIdx = (parseISODate(l.date).getDay() + 6) % 7;
    perDay[mondayIdx].push(l.kcal);
  }
  const byWeekday = perDay.map((vals) => avg(vals));
  const weekdayAvg = avg(perDay.slice(0, 5).flat());
  const weekendAvg = avg(perDay.slice(5).flat());
  const weekendDeltaPct =
    weekdayAvg != null && weekendAvg != null && weekdayAvg > 0
      ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100
      : null;
  return { byWeekday, weekendDeltaPct };
}
