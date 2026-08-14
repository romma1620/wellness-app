import { addDays } from "@/lib/utils";

/**
 * Скільки днів поспіль ведеться щоденник, рахуючи до сьогодні.
 *
 * Незаповнене «сьогодні» стрік не обриває: зранку запису ще нема, і лічильник,
 * який щоночі скидається в нуль до першого вводу, виглядав би зламаним.
 * Обрив — це пропущений цілий день (останній запис позавчора або раніше).
 */
export function currentStreak(dates: string[], today: string): number {
  const have = new Set(dates);
  const start = have.has(today) ? today : addDays(today, -1);
  let streak = 0;
  let d = start;
  while (have.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}
