import type { Profile } from "@/lib/types";
import { fmtInt } from "@/lib/utils";

/**
 * Щоденні цілі: калорії, кроки, вода.
 *
 * Ціль — необовʼязкова. `null` означає «не задана», і це не те саме, що нуль:
 * кільце на плитці лишається доріжкою, а сам показник пишеться далі. Тому
 * будь-яке невалідне значення з БД (нуль, відʼємне, NaN) нормалізуємо саме в
 * `null`, а не в дефолт — інакше очищене поле мовчки поверталося б назад.
 *
 * Дефолти живуть у БД (`profiles.steps_goal default 10000`,
 * `water_goal default 8`), а не тут: так у тих, хто користувався застосунком
 * до появи цілей, кроки й вода лишаються там, де були зашиті в коді.
 */

/** Стеля склянок за день. Та сама межа стоїть у check-констрейнті daily_logs.water. */
export const WATER_MAX = 20;

/** Верхні межі полів цілей — вони ж підказка «Допустимо a–b» у формі. */
export const KCAL_GOAL_MAX = 10_000;
export const STEPS_GOAL_MAX = 100_000;

export interface DailyGoals {
  kcal: number | null;
  steps: number | null;
  water: number | null;
}

/** Ціль, придатна для кільця: додатне ціле або null. */
function normalizeGoal(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function dailyGoals(profile: Profile | null | undefined): DailyGoals {
  return {
    kcal: normalizeGoal(profile?.kcal_goal),
    steps: normalizeGoal(profile?.steps_goal),
    water: normalizeGoal(profile?.water_goal),
  };
}

/**
 * Частка виконання для кільця. Не обрізається зверху навмисно: обрізає сам
 * `Ring`, а решті коду корисно бачити, що ціль перевищено.
 */
export function goalFraction(value: number | null, goal: number | null): number {
  if (value === null || goal === null || goal <= 0) return 0;
  if (!Number.isFinite(value)) return 0;
  return value / goal;
}

/** Підпис під плиткою: «ціль 10 000» або запрошення її задати. */
export function goalSub(goal: number | null): string {
  return goal === null ? "задай ціль" : `ціль ${fmtInt(goal)}`;
}

/**
 * Наступне значення води після натискання «−» або «+».
 * Порожній день рахуємо за нуль, у стелю впираємось, нижче нуля не йдемо.
 */
export function stepWater(current: number | null, delta: number): number {
  const base = current ?? 0;
  return Math.min(WATER_MAX, Math.max(0, base + delta));
}
