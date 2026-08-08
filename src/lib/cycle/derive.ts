import { addDays, daysBetween } from "@/lib/utils";
import type { Cycle, Flow } from "@/lib/cycle/types";

/** Мінімум, який потрібен derivation-у від денного запису. */
export interface FlowDay {
  date: string; // YYYY-MM-DD
  flow: Flow | null;
}

/**
 * Скільки порожніх днів усередині однієї менструації ще не рвуть її на дві.
 * 2 порожні дні = різниця дат 3.
 */
const MAX_GAP_DAYS = 3;

/**
 * Менструація — послідовність днів із кровотечею, у якій сусідні дні
 * розділені не більш ніж MAX_GAP_DAYS.
 */
function groupBleedingDays(days: FlowDay[]): FlowDay[][] {
  const bleeding = days
    .filter((d) => d.flow !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const groups: FlowDay[][] = [];
  for (const day of bleeding) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && daysBetween(prev.date, day.date) <= MAX_GAP_DAYS) {
      last.push(day);
    } else {
      groups.push([day]);
    }
  }
  return groups;
}

/**
 * Цикли, обчислені з денних записів. Це єдине джерело правди про цикли —
 * у БД вони не лежать, тож будь-яке редагування заднім числом просто
 * дає іншу відповідь на цій же функції, без міграцій даних.
 *
 * Ізольовані сліди циклом не вважаються: старт нової менструації мусить
 * містити хоч один день реальної кровотечі. Але сліди, що прилягають до
 * такої менструації, до неї входять — і можуть бути її першим днем.
 *
 * Вхід не обовʼязково відсортований і може містити дні без кровотечі
 * (запис лише про симптоми) — вони ігноруються.
 */
export function deriveCycles(days: FlowDay[]): Cycle[] {
  const menstruations = groupBleedingDays(days).filter((g) =>
    g.some((d) => d.flow !== "spotting"),
  );

  return menstruations.map((group, i) => {
    const start = group[0].date;
    const last = group[group.length - 1].date;
    const nextStart = menstruations[i + 1]?.[0].date ?? null;

    return {
      start,
      end: nextStart ? addDays(nextStart, -1) : null,
      periodLength: daysBetween(start, last) + 1,
      length: nextStart ? daysBetween(start, nextStart) : null,
    };
  });
}

/** Завершені цикли — ті, у яких уже відомий наступний старт. */
export function completedCycles(cycles: Cycle[]): Cycle[] {
  return cycles.filter((c) => c.length !== null);
}

/** Поточний (незавершений) цикл, якщо він є. */
export function currentCycle(cycles: Cycle[]): Cycle | null {
  const last = cycles[cycles.length - 1];
  return last && last.length === null ? last : null;
}

/**
 * Номер дня циклу для дати: 1 = перший день менструації.
 * null, якщо дата не належить жодному відомому циклу (раніше першого
 * запису або після кінця останнього — для майбутнього це прогноз, а не факт).
 */
export function cycleDayFor(iso: string, cycles: Cycle[]): number | null {
  for (const c of cycles) {
    if (iso < c.start) continue;
    if (c.end !== null && iso > c.end) continue;
    return daysBetween(c.start, iso) + 1;
  }
  return null;
}

/** Цикл, якому належить дата. */
export function cycleFor(iso: string, cycles: Cycle[]): Cycle | null {
  for (const c of cycles) {
    if (iso < c.start) continue;
    if (c.end !== null && iso > c.end) continue;
    return c;
  }
  return null;
}
