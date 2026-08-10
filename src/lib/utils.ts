/** Парсинг числа з комою або крапкою. Порожнє -> null. */
export function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Форматування числа з комою як десятковим роздільником. */
export function fmt(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  return rounded.toLocaleString("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Як fmt, але з фіксованою кількістю знаків: fmtFixed(67, 1) -> "67,0". */
export function fmtFixed(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Ціле число з розділювачем тисяч (1 640). */
export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("uk-UA");
}

/** Кроки в тисячах: 8432 -> "8,4". */
export function fmtThousands(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return fmt(value / 1000, 1);
}

// ----------------------- Дати -----------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, delta: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = parseISODate(aIso).getTime();
  const b = parseISODate(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

const WEEKDAYS = ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"];
const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/** "субота, 19 липня" */
export function humanDate(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "19 липня" */
export function shortDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "19 лип" */
export function shortDateAbbr(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

const WEEKDAYS_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

/** "2026-08-02" → "нд" */
export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[parseISODate(iso).getDay()];
}

const WEEKDAY_HEADS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** Заголовок колонки календаря за днем тижня JS (0 = неділя): "Пн". */
export function weekdayHead(jsDay: number): string {
  return WEEKDAY_HEADS[jsDay];
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

// ----------------------- Періоди (тиждень / місяць) -----------------------

const MONTHS_NOM = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];
const MONTHS_SHORT = [
  "січ", "лют", "бер", "кві", "тра", "чер",
  "лип", "сер", "вер", "жов", "лис", "гру",
];

export type PeriodType = "week" | "month";

export interface PeriodRange {
  start: string; // ISO, включно
  end: string; // ISO, включно
  days: number;
}

/**
 * Календарний період, зсунутий на `offset` назад (0 = поточний).
 * Тиждень — Пн–Нд; місяць — календарний місяць.
 */
export function periodRange(type: PeriodType, offset: number): PeriodRange {
  const now = new Date();
  if (type === "week") {
    const fromMonday = (now.getDay() + 6) % 7; // 0=Sun -> 6, 1=Mon -> 0
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - fromMonday - offset * 7,
    );
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end), days: 7 };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0); // останній день місяця
  return { start: toISODate(start), end: toISODate(end), days: end.getDate() };
}

/** Підпис періоду: "20–26 лип", "28 лип – 3 сер" або "Липень 2026". */
export function periodLabel(type: PeriodType, offset: number): string {
  const { start, end } = periodRange(type, offset);
  if (type === "month") {
    return monthLabel(start);
  }
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

/** "2026-08-01" → "Серпень 2026". Приймає будь-який день місяця. */
export function monthLabel(isoMonth: string): string {
  const d = parseISODate(isoMonth);
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

/** Останній день місяця: "2026-08-01" → "2026-08-31". */
export function monthEnd(isoMonth: string): string {
  const d = parseISODate(isoMonth);
  // день 0 наступного місяця = останній день поточного
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Перше число місяця, у якому лежить дата: "2026-08-19" → "2026-08-01". */
export function monthStartOf(iso: string): string {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Та сама дата через `delta` місяців. День затискається по довжині
 * цільового місяця, тому 31 січня + 1 міс = 28/29 лютого, а не 2 березня.
 */
export function addMonths(iso: string, delta: number): string {
  const d = parseISODate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

// ----------------------- Дельти -----------------------

export interface Delta {
  pct: number | null; // відсоток зміни
  dir: "up" | "down" | "flat";
}

export function computeDelta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null || previous === 0) {
    return { pct: null, dir: "flat" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const dir = Math.abs(pct) < 0.05 ? "flat" : pct > 0 ? "up" : "down";
  return { pct, dir };
}

/** Середнє по непорожніх значеннях. Порожній масив -> null. */
export function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ----------------------- Теги -----------------------

/** "Скраб, Крем" -> ["Скраб", "Крем"] */
export function splitTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ----------------------- Числівники -----------------------

/**
 * Українське відмінювання за числом: 1 сесія, 2 сесії, 5 сесій.
 * Числа 11–14 — виняток: попри останню цифру беруть форму «багато».
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 14) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
