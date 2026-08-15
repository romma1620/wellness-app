/**
 * Річна теплокарта активності: чиста логіка рівнів кольору,
 * повноти дня щоденника та розкладки днів у тижневу сітку.
 */

import type { DailyLog } from "./types";
import { addDays, parseISODate } from "./utils";

/** Поля щоденника, що входять у «повноту дня». */
const COMPLETENESS_FIELDS = [
  "weight", "kcal", "protein", "fat", "carbs", "water", "steps",
] as const;

/** Частка заповнених числових полів дня, 0..1. Нуль — теж запис. */
export function dayCompleteness(log: Partial<DailyLog>): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => log[f] != null).length;
  return filled / COMPLETENESS_FIELDS.length;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Рівень насиченості клітинки: 0 = порожньо, 1..4 — чверті від максимуму. */
export function heatLevel(value: number | null, max: number): HeatLevel {
  if (value == null || value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as HeatLevel;
}

const MONTHS_SHORT = [
  "січ", "лют", "бер", "кві", "тра", "чер",
  "лип", "сер", "вер", "жов", "лис", "гру",
];

export interface HeatRow {
  /** 7 клітинок Пн–Нд; null — день поза діапазоном. */
  days: (string | null)[];
  /** Підпис місяця: перший рядок і рядки, де починається новий місяць. */
  monthLabel: string | null;
}

/** Розкладає діапазон дат у рядки-тижні Пн–Нд для сітки теплокарти. */
export function weekRows(startIso: string, endIso: string): HeatRow[] {
  const rows: HeatRow[] = [];
  // Відмотуємо до понеділка тижня початку.
  let cur = addDays(startIso, -((parseISODate(startIso).getDay() + 6) % 7));
  while (cur <= endIso) {
    const days: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(cur, i);
      days.push(d >= startIso && d <= endIso ? d : null);
    }
    let monthLabel: string | null = null;
    if (rows.length === 0) {
      const first = days.find((d) => d != null);
      if (first) monthLabel = MONTHS_SHORT[parseISODate(first).getMonth()];
    } else {
      const firstOfMonth = days.find((d) => d != null && parseISODate(d).getDate() === 1);
      if (firstOfMonth) monthLabel = MONTHS_SHORT[parseISODate(firstOfMonth).getMonth()];
    }
    rows.push({ days, monthLabel });
    cur = addDays(cur, 7);
  }
  return rows;
}
