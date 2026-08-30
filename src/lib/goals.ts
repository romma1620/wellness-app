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

/** Підпис цілі: «ціль 10 000» або запрошення її задати. */
export function goalSub(goal: number | null): string {
  return goal === null ? "задай ціль" : `ціль ${fmtInt(goal)}`;
}

/** Скільки крапель у ряду, коли ціль води не задана. */
export const WATER_DROPS_DEFAULT = 8;

export interface WaterRow {
  /** Скільки крапель малювати — рівно стільки, скільки склянок у цілі. */
  slots: number;
  /** Скільки з них налиті. */
  filled: number;
  /** Випите понад ціль: іде окремим «+N», а не зайвими крапельками. */
  over: number;
}

/**
 * Розкладка ряду крапель під поточне значення й ціль.
 *
 * Ціль керує КІЛЬКІСТЮ крапель, а не лише підписом: 8 склянок — вісім
 * крапель, 10 — десять. Випите понад ціль ряд не подовжує (інакше він
 * переносився б і стрибала б висота картки) — надлишок іде в `over`.
 *
 * `goal` сюди приходить уже нормалізованим із `dailyGoals`, але межі
 * ставимо й тут: розкладка не має права повернути порожній ряд, навіть
 * якщо колись у неї передадуть нуль напряму.
 */
export function waterRow(value: number | null, goal: number | null): WaterRow {
  const slots = Math.min(WATER_MAX, Math.max(1, Math.round(goal ?? WATER_DROPS_DEFAULT)));
  const count = Math.min(WATER_MAX, Math.max(0, value ?? 0));
  return {
    slots,
    filled: Math.min(count, slots),
    over: Math.max(0, count - slots),
  };
}
