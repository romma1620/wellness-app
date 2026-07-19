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

export function isToday(iso: string): boolean {
  return iso === todayISO();
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
