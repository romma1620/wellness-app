import { addDays, parseISODate, toISODate } from "@/lib/utils";
import { LUTEAL_DAYS, type Prediction } from "@/lib/cycle/predict";
import type { Cycle, CycleEntry, Flow } from "@/lib/cycle/types";

/** Фертильне вікно: 5 днів до овуляції та день після. */
const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;

/** Скільки тижнів малює сітка. Шість — щоб висота календаря не стрибала між місяцями. */
const WEEKS = 6;

export const WEEKDAY_HEADS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/**
 * 42 дати сітки місяця, від понеділка тижня, у якому лежить 1-е число.
 * Дні сусідніх місяців входять — вони малюються приглушено.
 */
export function monthGrid(monthStartISO: string): string[] {
  const first = parseISODate(monthStartISO);
  const firstOfMonth = toISODate(new Date(first.getFullYear(), first.getMonth(), 1));
  const fromMonday = (parseISODate(firstOfMonth).getDay() + 6) % 7; // 0=Нд -> 6
  const gridStart = addDays(firstOfMonth, -fromMonday);
  return Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i));
}

export interface CycleMarks {
  /** Дні овуляції — по одному на цикл, включно з прогнозованим для поточного. */
  ovulation: Set<string>;
  fertile: Set<string>;
  /** Прогнозовані дні наступної менструації. */
  predictedPeriod: Set<string>;
}

/**
 * Позначки, що не є фактом: овуляція й фертильне вікно рахуються назад від
 * старту наступного циклу (для минулих — від фактичного, для поточного —
 * від прогнозу), прогноз менструації — від прогнозованого старту.
 */
export function cycleMarks(cycles: Cycle[], prediction: Prediction | null): CycleMarks {
  const ovulation = new Set<string>();
  const fertile = new Set<string>();
  const predictedPeriod = new Set<string>();

  for (const c of cycles) {
    const nextStart = c.end !== null ? addDays(c.end, 1) : prediction?.nextStart;
    if (!nextStart) continue;
    const o = addDays(nextStart, -LUTEAL_DAYS);
    // Овуляція раніше кінця менструації — цикл занадто короткий, щоб
    // ставити позначку: вона впала б на дні кровотечі.
    if (o < addDays(c.start, c.periodLength)) continue;
    ovulation.add(o);
    for (let d = -FERTILE_BEFORE; d <= FERTILE_AFTER; d++) fertile.add(addDays(o, d));
  }

  if (prediction) {
    const len = Math.max(1, Math.round(prediction.avgPeriodLength));
    for (let i = 0; i < len; i++) predictedPeriod.add(addDays(prediction.nextStart, i));
  }

  return { ovulation, fertile, predictedPeriod };
}

export type DayMark = "flow" | "predicted" | "ovulation" | "fertile" | "none";

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  /** День сусіднього місяця. */
  outside: boolean;
  today: boolean;
  /** Майбутнє: логувати ще нічого. */
  future: boolean;
  mark: DayMark;
  /** Сила виділень, якщо mark === "flow". */
  flow: Flow | null;
  /** Є будь-який запис (симптоми, настрій, нотатка) — маленька крапка під числом. */
  hasEntry: boolean;
}

/**
 * Модель одного місяця календаря.
 *
 * Пріоритет позначок: факт кровотечі перекриває будь-який прогноз, далі
 * овуляція, далі прогноз менструації, далі фертильний тінт. Позначка
 * «сьогодні» — не позначка стану, її малює UI поверх будь-якої іншої.
 */
export function buildMonth(
  monthStartISO: string,
  entries: Map<string, CycleEntry>,
  marks: CycleMarks,
  today: string,
  showFertile: boolean,
): CalendarDay[] {
  const month = parseISODate(monthStartISO).getMonth();

  return monthGrid(monthStartISO).map((date) => {
    const d = parseISODate(date);
    const entry = entries.get(date) ?? null;

    let mark: DayMark = "none";
    if (entry?.flow) mark = "flow";
    else if (marks.ovulation.has(date)) mark = "ovulation";
    else if (marks.predictedPeriod.has(date)) mark = "predicted";
    else if (showFertile && marks.fertile.has(date)) mark = "fertile";

    return {
      date,
      dayOfMonth: d.getDate(),
      outside: d.getMonth() !== month,
      today: date === today,
      future: date > today,
      mark,
      flow: entry?.flow ?? null,
      hasEntry: entry !== null,
    };
  });
}
