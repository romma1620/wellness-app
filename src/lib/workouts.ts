import { shortDate } from "@/lib/utils";
import type { MuscleGroup } from "@/lib/types";

// ----------------------- Draft (editor) -----------------------
export interface DraftSet {
  weight: number | null;
  reps: number | null;
}

export interface DraftExercise {
  key: string; // локальний id для React-ключів
  exerciseId: string | null; // null = нова назва (створиться при сейві)
  name: string;
  muscleGroup: MuscleGroup | null;
  sets: DraftSet[];
}

export interface DraftWorkout {
  date: string; // YYYY-MM-DD
  routineId: string | null;
  name: string;
  note: string;
  exercises: DraftExercise[];
}

let keySeq = 0;
function localKey(): string {
  keySeq += 1;
  return `d${Date.now().toString(36)}-${keySeq}`;
}

export function newDraftSet(prev?: DraftSet): DraftSet {
  return prev ? { weight: prev.weight, reps: prev.reps } : { weight: null, reps: null };
}

export function newDraftExercise(): DraftExercise {
  return { key: localKey(), exerciseId: null, name: "", muscleGroup: null, sets: [newDraftSet()] };
}

// ----------------------- Loaded (from DB) -----------------------
export interface LoadedSet {
  weight: number | null;
  reps: number;
  exercise_id: string;
}

export interface LoadedWorkout {
  id: string;
  date: string;
  name: string | null;
  routine_id: string | null;
  sets: LoadedSet[];
}

// ----------------------- Calculations -----------------------
export function setTonnage(s: { weight: number | null; reps: number | null }): number {
  if (s.reps == null || !Number.isFinite(s.reps)) return 0;
  // порожня вага (власна вага) → внесок дорівнює повторам
  return s.weight == null ? s.reps : s.weight * s.reps;
}

export function exerciseTonnage(sets: DraftSet[]): number {
  return sets.reduce((sum, s) => sum + setTonnage(s), 0);
}

export function workoutTonnage(w: LoadedWorkout): number {
  return w.sets.reduce((sum, s) => sum + setTonnage(s), 0);
}

export function exerciseCount(w: LoadedWorkout): number {
  return new Set(w.sets.map((s) => s.exercise_id)).size;
}

/** Оцінка 1ПМ за Еплі. null для власної ваги або невалідних повторів. */
export function epley1rm(weight: number | null, reps: number): number | null {
  if (weight == null || reps == null || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

/** Найкращий підхід: макс. робоча вага, тай-брейк — більше повторів. */
export function bestSet(sets: LoadedSet[]): LoadedSet | null {
  if (sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const bw = best.weight ?? -Infinity;
    const sw = s.weight ?? -Infinity;
    if (sw > bw) return s;
    if (sw === bw && s.reps > best.reps) return s;
    return best;
  });
}

export type ProgressMetric = "weight" | "tonnage" | "orm";

export interface ExercisePoint {
  label: string;
  date: string;
  value: number | null;
}

/** Сесії, відсортовані за датою, у яких є ця вправа. */
function sessionsWith(workouts: LoadedWorkout[], exerciseId: string): LoadedWorkout[] {
  return [...workouts]
    .filter((w) => w.sets.some((s) => s.exercise_id === exerciseId))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function exerciseSeries(
  workouts: LoadedWorkout[],
  exerciseId: string,
  metric: ProgressMetric,
): ExercisePoint[] {
  return sessionsWith(workouts, exerciseId).map((w) => {
    const sets = w.sets.filter((s) => s.exercise_id === exerciseId);
    let value: number | null;
    if (metric === "tonnage") {
      value = sets.reduce((sum, s) => sum + setTonnage(s), 0);
    } else {
      const best = bestSet(sets);
      value =
        metric === "weight"
          ? (best?.weight ?? null)
          : best
            ? epley1rm(best.weight, best.reps)
            : null;
    }
    return { label: shortDate(w.date), date: w.date, value };
  });
}

export function routineSeries(
  workouts: LoadedWorkout[],
  routineId: string,
): { label: string; value: number }[] {
  return [...workouts]
    .filter((w) => w.routine_id === routineId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ label: shortDate(w.date), value: workoutTonnage(w) }));
}

export interface SessionStat {
  date: string;
  maxWeight: number | null;
  tonnage: number;
}

export interface SessionCompare {
  current: SessionStat;
  previous: SessionStat | null;
}

export function compareLastTwo(
  workouts: LoadedWorkout[],
  exerciseId: string,
): SessionCompare | null {
  const sessions = sessionsWith(workouts, exerciseId);
  if (sessions.length === 0) return null;
  const stat = (w: LoadedWorkout): SessionStat => {
    const sets = w.sets.filter((s) => s.exercise_id === exerciseId);
    return {
      date: w.date,
      maxWeight: bestSet(sets)?.weight ?? null,
      tonnage: sets.reduce((sum, s) => sum + setTonnage(s), 0),
    };
  };
  const current = stat(sessions[sessions.length - 1]);
  const previous = sessions.length >= 2 ? stat(sessions[sessions.length - 2]) : null;
  return { current, previous };
}
