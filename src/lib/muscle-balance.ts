import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/types";
import { daysBetween } from "@/lib/utils";
import { setTonnage, type UsedExercise } from "@/lib/workouts";

/** Підхід періоду з групою його вправи. Дата не потрібна — період уже вирізано. */
export interface MuscleSetRow {
  muscleGroup: MuscleGroup | null;
  weight: number | null;
  reps: number;
}

export interface GroupStat {
  group: MuscleGroup;
  sets: number;
  tonnage: number;
  /** Частка підходів групи серед усіх підходів періоду, 0..1. */
  share: number;
}

/**
 * Розподіл підходів і тоннажу по м'язових групах за період.
 * Підходи без групи падають у «інше»: для балансу важливо, що вони були,
 * навіть якщо юзерка не розклала вправи по групах. Групи без підходів
 * не повертаються — нульовий рядок бару нічого не каже.
 */
export function muscleBalance(rows: MuscleSetRow[]): GroupStat[] {
  if (rows.length === 0) return [];
  const bySets = new Map<MuscleGroup, { sets: number; tonnage: number }>();
  for (const r of rows) {
    const group: MuscleGroup = r.muscleGroup ?? "інше";
    const acc = bySets.get(group) ?? { sets: 0, tonnage: 0 };
    acc.sets += 1;
    acc.tonnage += setTonnage(r);
    bySets.set(group, acc);
  }
  const total = rows.length;
  return MUSCLE_GROUPS.filter((g) => bySets.has(g)).map((g) => {
    const { sets, tonnage } = bySets.get(g)!;
    return { group: g, sets, tonnage, share: sets / total };
  });
}

/** Скільки днів без тренувань групи вважаємо нормою. */
export const STALE_THRESHOLD_DAYS = 10;

export interface StaleGroup {
  group: MuscleGroup;
  daysAgo: number;
}

/**
 * Групи, що давно не тренувались, найзанедбаніші перші.
 *
 * Джерело — вправи з датою останнього використання: воно охоплює всю
 * історію, тож «не тренувалась» тут означає справді ніколи за поріг,
 * а не «не потрапила у вибраний період». «Інше» і вправи без групи
 * не смикають: нагадування про безіменну купу вправ нічого не радить.
 */
export function staleGroups(
  exercises: UsedExercise[],
  today: string,
  thresholdDays = STALE_THRESHOLD_DAYS,
): StaleGroup[] {
  const last = new Map<MuscleGroup, string>();
  for (const e of exercises) {
    if (!e.muscleGroup || e.muscleGroup === "інше") continue;
    const prev = last.get(e.muscleGroup);
    if (!prev || e.lastUsed > prev) last.set(e.muscleGroup, e.lastUsed);
  }
  const out: StaleGroup[] = [];
  for (const [group, lastUsed] of last) {
    const daysAgo = daysBetween(lastUsed, today);
    if (daysAgo > thresholdDays) out.push({ group, daysAgo });
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo);
}
