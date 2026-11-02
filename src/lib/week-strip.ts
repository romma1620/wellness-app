import { addDays, daysBetween, monthLabel, monthName, parseISODate } from "./utils";

/** Скільки тижнів стрічка дорендерює за раз, коли юзер догортає до лівого краю. */
export const WEEKS_CHUNK = 12;

/** Понеділок тижня, у якому лежить дата. */
export function weekStartOf(iso: string): string {
  const fromMonday = (parseISODate(iso).getDay() + 6) % 7; // 0=Нд -> 6
  return addDays(iso, -fromMonday);
}

/** Скільки повних тижнів від тижня `fromIso` до тижня `toIso` (0 — той самий тиждень). */
export function weeksBetween(fromIso: string, toIso: string): number {
  return Math.round(daysBetween(weekStartOf(fromIso), weekStartOf(toIso)) / 7);
}

/**
 * Понеділки тижнів стрічки, від найстаршого до тижня `today` включно.
 * Майбутніх тижнів нема: щоденник не пишеться наперед.
 */
export function stripWeeks(today: string, count: number): string[] {
  const last = weekStartOf(today);
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => addDays(last, -7 * (n - 1 - i)));
}

/**
 * Скільки тижнів має бути в стрічці, щоб у ній точно лежав `selected`:
 * дату могли вибрати в календарі далеко за межами вже догорнутого.
 * Кількість лише росте — інакше стрічка стрибала б під пальцем.
 */
export function weeksToCover(current: number, selected: string, today: string): number {
  const need = weeksBetween(selected, today) + 1;
  if (need <= current) return current;
  // з запасом на шматок, щоб одразу можна було гортати ще назад
  return Math.ceil(need / WEEKS_CHUNK) * WEEKS_CHUNK;
}

/** Підпис над стрічкою: «Листопад 2026», «Жовтень – Листопад 2026», «Грудень 2026 – Січень 2027». */
export function weekSpanLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = parseISODate(weekStart);
  const e = parseISODate(end);
  if (s.getMonth() === e.getMonth()) return monthLabel(weekStart);
  if (s.getFullYear() === e.getFullYear()) return `${monthName(weekStart)} – ${monthLabel(end)}`;
  return `${monthLabel(weekStart)} – ${monthLabel(end)}`;
}
