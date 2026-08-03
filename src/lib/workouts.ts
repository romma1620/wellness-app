import { monthEnd, shortDate } from "@/lib/utils";
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

/** Один підхід однієї вправи, з датою сесії. Джерело даних для графіка прогресу. */
export interface ExerciseSet {
  date: string; // YYYY-MM-DD
  weight: number | null;
  reps: number;
}

/** Рядок списку сесій. Ваги й повторів не містить — рядок їх не показує. */
export interface WorkoutListItem {
  id: string;
  date: string;
  name: string | null;
  exerciseCount: number;
}

/** Місячний підсумок з RPC `workout_month_totals`. */
export interface MonthTotal {
  month: string; // YYYY-MM-01
  sessions: number;
  tonnage: number;
}

/** Вправа з RPC `used_exercises` — та, що реально трапляється в сесіях. */
export interface UsedExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  lastUsed: string; // YYYY-MM-DD
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

/** Скільки різних вправ у наборі підходів. */
export function exerciseCount(sets: { exercise_id: string }[]): number {
  return new Set(sets.map((s) => s.exercise_id)).size;
}

/** Оцінка 1ПМ за Еплі. null для власної ваги або невалідних повторів. */
export function epley1rm(weight: number | null, reps: number): number | null {
  if (weight == null || reps == null || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

/** Найкращий підхід: макс. робоча вага, тай-брейк — більше повторів. */
export function bestSet<T extends { weight: number | null; reps: number }>(sets: T[]): T | null {
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

/** Сети однієї вправи, згруповані за датою сесії, найстаріші спершу. */
function sessionsOf(sets: ExerciseSet[]): { date: string; sets: ExerciseSet[] }[] {
  const byDate = new Map<string, ExerciseSet[]>();
  for (const s of sets) {
    const bucket = byDate.get(s.date);
    if (bucket) bucket.push(s);
    else byDate.set(s.date, [s]);
  }
  return [...byDate.entries()]
    .map(([date, group]) => ({ date, sets: group }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function exerciseSeries(sets: ExerciseSet[], metric: ProgressMetric): ExercisePoint[] {
  return sessionsOf(sets).map(({ date, sets: group }) => {
    let value: number | null;
    if (metric === "tonnage") {
      value = group.reduce((sum, s) => sum + setTonnage(s), 0);
    } else {
      const best = bestSet(group);
      value =
        metric === "weight"
          ? (best?.weight ?? null)
          : best
            ? epley1rm(best.weight, best.reps)
            : null;
    }
    return { label: shortDate(date), date, value };
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

export function compareLastTwo(sets: ExerciseSet[]): SessionCompare | null {
  const sessions = sessionsOf(sets);
  if (sessions.length === 0) return null;
  const stat = (session: { date: string; sets: ExerciseSet[] }): SessionStat => ({
    date: session.date,
    maxWeight: bestSet(session.sets)?.weight ?? null,
    tonnage: session.sets.reduce((sum, s) => sum + setTonnage(s), 0),
  });
  const current = stat(sessions[sessions.length - 1]);
  const previous = sessions.length >= 2 ? stat(sessions[sessions.length - 2]) : null;
  return { current, previous };
}

// ----------------------- Місячні групи і пагінація -----------------------

export interface MonthGroup {
  month: string; // YYYY-MM-01
  items: WorkoutListItem[];
}

/**
 * Розбиває сесії на календарні місяці.
 * Очікує вхід, відсортований за спаданням дати — саме так їх віддає база;
 * порядок груп і порядок усередині груп зберігається як є.
 */
export function groupByMonth(items: WorkoutListItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const month = `${item.date.slice(0, 7)}-01`;
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

export interface MonthPage {
  months: number; // скільки місяців додає ця сторінка
  from: string; // ISO, включно
  to: string; // ISO, включно
}

/**
 * Діапазон дат наступної сторінки списку.
 *
 * Пагінація йде цілими місяцями, а не фіксованою кількістю сесій: так
 * кожен показаний місяць завжди повний, і його заголовок («8 сесій») не
 * суперечить кількості рядків під ним. Місяці добираються, доки не
 * набереться `minSessions`, тож рідкі місяці не перетворюють список на
 * низку тапів по «Показати ще».
 *
 * `totals` очікується відсортованим за спаданням місяця, `loaded` — скільки
 * місяців уже показано.
 */
export function pickMonthPage(
  totals: MonthTotal[],
  loaded: number,
  minSessions = 12,
): MonthPage | null {
  if (loaded >= totals.length) return null;
  let sessions = 0;
  let end = loaded;
  // do/while, а не while: хоча б один місяць забирається завжди, навіть коли
  // minSessions <= 0 — інакше end лишався б рівним loaded і totals[end - 1]
  // читав би totals[-1].
  do {
    sessions += totals[end].sessions;
    end += 1;
  } while (end < totals.length && sessions < minSessions);
  return {
    months: end - loaded,
    from: totals[end - 1].month,
    to: monthEnd(totals[loaded].month),
  };
}

/** Скільки сесій лишилось у ще не завантажених місяцях. */
export function remainingSessions(totals: MonthTotal[], loaded: number): number {
  return totals.slice(loaded).reduce((sum, m) => sum + m.sessions, 0);
}
