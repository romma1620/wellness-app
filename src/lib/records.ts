import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/types";
import { addDays } from "@/lib/utils";
import type { ExerciseMax, UsedExercise } from "@/lib/workouts";

/** Рядок таблиці рекордів: вправа + її найкращий підхід. */
export interface RecordRow {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  weight: number;
  reps: number;
  date: string; // YYYY-MM-DD, коли встановлено
}

/** Вікно секції «нові рекорди», днів. */
export const RECENT_RECORD_DAYS = 30;

function groupOrder(g: MuscleGroup | null): number {
  // null (без групи) — останні
  const i = g ? MUSCLE_GROUPS.indexOf(g) : -1;
  return i === -1 ? MUSCLE_GROUPS.length : i;
}

/**
 * Рекорди всіх вправ, відсортовані для таблиці: за порядком м'язових груп
 * (як усюди в застосунку), в межах групи — найважчі перші. Вправи без
 * рекорду (тільки власна вага) в таблицю не потрапляють — їм нема чого
 * показати в колонці ваги.
 */
export function buildRecordRows(
  exercises: UsedExercise[],
  maxes: Map<string, ExerciseMax>,
): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const e of exercises) {
    const m = maxes.get(e.id);
    if (!m) continue;
    rows.push({
      exerciseId: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      weight: m.weight,
      reps: m.reps,
      date: m.date,
    });
  }
  return rows.sort((a, b) => {
    const g = groupOrder(a.muscleGroup) - groupOrder(b.muscleGroup);
    if (g !== 0) return g;
    return b.weight - a.weight;
  });
}

/** Рекорди, встановлені в діапазоні дат (обидві межі включно), найсвіжіші перші. */
export function recordsInRange(rows: RecordRow[], from: string, to: string): RecordRow[] {
  return rows
    .filter((r) => r.date >= from && r.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Рекорди, встановлені за останні `days` днів, найсвіжіші перші. */
export function recentRecords(
  rows: RecordRow[],
  today: string,
  days = RECENT_RECORD_DAYS,
): RecordRow[] {
  return recordsInRange(rows, addDays(today, -days), today);
}
