import { daysBetween, plural, shortDate, shortDateAbbr } from "@/lib/utils";
import { bestSet, setTonnage, type ExercisePoint, type LoadedWorkout } from "@/lib/workouts";

/**
 * Скільки днів без сесій шаблон ще вважається активним. Три тижні покривають
 * відпустку чи хворобу, але не тримають «активним» шаблон, з якого вже
 * перейшли на інший.
 */
export const ACTIVE_WINDOW_DAYS = 21;

/** Підсумок шаблону з RPC `routine_stats`. Є лише для шаблонів із сесіями. */
export interface RoutineStat {
  routineId: string;
  name: string;
  archived: boolean;
  firstDate: string; // YYYY-MM-DD — «почав займатися»
  lastDate: string;
  sessions: number;
}

/** Архівний шаблон активним не буває: юзер сам сказав, що з ним покінчено. */
export function isActiveRoutine(stat: RoutineStat, today: string): boolean {
  return !stat.archived && daysBetween(stat.lastDate, today) <= ACTIVE_WINDOW_DAYS;
}

/**
 * Активні шаблони, найсвіжіше розпочаті спершу: щойно розпочатий шаблон —
 * те, що юзер найімовірніше хоче побачити.
 */
export function activeRoutines(stats: RoutineStat[], today: string): RoutineStat[] {
  return stats
    .filter((s) => isActiveRoutine(s, today))
    .sort((a, b) => b.firstDate.localeCompare(a.firstDate) || a.name.localeCompare(b.name));
}

/** Кінець періоду: для активного шаблону — сьогодні, інакше остання сесія. */
export function periodEnd(stat: RoutineStat, today: string): string {
  return isActiveRoutine(stat, today) ? today : stat.lastDate;
}

/** Тривалість періоду з обома межами включно: «5 днів», «6 тижнів». */
export function durationLabel(from: string, to: string): string {
  const days = Math.max(1, daysBetween(from, to) + 1);
  if (days < 14) return `${days} ${plural(days, "день", "дні", "днів")}`;
  const weeks = Math.floor(days / 7);
  return `${weeks} ${plural(weeks, "тиждень", "тижні", "тижнів")}`;
}

/** «з 16 вересня» для активного, «1 бер – 15 тра» для завершеного. */
export function spanLabel(stat: RoutineStat, today: string): string {
  if (isActiveRoutine(stat, today)) return `з ${shortDate(stat.firstDate)}`;
  if (stat.firstDate === stat.lastDate) return shortDate(stat.firstDate);
  return `${shortDateAbbr(stat.firstDate)} – ${shortDateAbbr(stat.lastDate)}`;
}

/**
 * Сесій на тиждень за період. Період коротший за тиждень рахується як
 * тиждень — інакше дві сесії за перші два дні дали б «7 на тиждень».
 */
export function sessionsPerWeek(sessions: number, from: string, to: string): number {
  const days = Math.max(7, daysBetween(from, to) + 1);
  return (sessions * 7) / days;
}

/** Підсумок шаблону з уже завантажених сесій — для екрана статистики. */
export function statFromWorkouts(
  routine: { id: string; name: string; archived_at: string | null },
  workouts: LoadedWorkout[],
): RoutineStat | null {
  if (workouts.length === 0) return null;
  const dates = workouts.map((w) => w.date).sort();
  return {
    routineId: routine.id,
    name: routine.name,
    archived: routine.archived_at != null,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    sessions: workouts.length,
  };
}

/**
 * Тоннаж за день, найстаріші спершу. Дві сесії за шаблоном в один день
 * зливаються в одну точку — на графіку дата є ключем.
 */
export function routineTonnageSeries(workouts: LoadedWorkout[]): ExercisePoint[] {
  const byDate = new Map<string, number>();
  for (const w of workouts) {
    const t = w.sets.reduce((sum, s) => sum + setTonnage(s), 0);
    byDate.set(w.date, (byDate.get(w.date) ?? 0) + t);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ label: shortDate(date), date, value }));
}

export function avgSessionTonnage(workouts: LoadedWorkout[]): number | null {
  if (workouts.length === 0) return null;
  const total = workouts.reduce(
    (sum, w) => sum + w.sets.reduce((s, x) => s + setTonnage(x), 0),
    0,
  );
  return total / workouts.length;
}

export interface ProgressPoint {
  date: string;
  weight: number | null;
  reps: number;
}

/** Найкращий підхід вправи в першій і в останній сесії за шаблоном. */
export interface ExerciseProgress {
  exerciseId: string;
  sessions: number;
  first: ProgressPoint;
  last: ProgressPoint;
}

/**
 * Прогрес кожної вправи від першої сесії за шаблоном до останньої.
 * Порядок — перша поява вправи, тобто зазвичай порядок самого шаблону.
 */
export function exerciseProgress(workouts: LoadedWorkout[]): ExerciseProgress[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const order: string[] = [];
  const perExercise = new Map<string, ProgressPoint[]>();
  for (const w of sorted) {
    const byEx = new Map<string, { weight: number | null; reps: number }[]>();
    for (const s of w.sets) {
      const bucket = byEx.get(s.exercise_id);
      if (bucket) bucket.push(s);
      else byEx.set(s.exercise_id, [s]);
    }
    for (const [exId, sets] of byEx) {
      const best = bestSet(sets);
      if (!best) continue;
      if (!perExercise.has(exId)) {
        perExercise.set(exId, []);
        order.push(exId);
      }
      perExercise.get(exId)!.push({ date: w.date, weight: best.weight, reps: best.reps });
    }
  }
  return order.map((exId) => {
    const points = perExercise.get(exId)!;
    return {
      exerciseId: exId,
      sessions: points.length,
      first: points[0],
      last: points[points.length - 1],
    };
  });
}

export interface ProgressDelta {
  unit: "кг" | "повт";
  value: number;
}

/**
 * Зміна від першої сесії до останньої: у вазі, а для вправ із власною вагою —
 * у повторах. Якщо вагу то вказували, то ні, порівнювати нема що.
 */
export function progressDelta(p: ExerciseProgress): ProgressDelta | null {
  if (p.sessions < 2) return null;
  const { first, last } = p;
  if (first.weight != null && last.weight != null) {
    return { unit: "кг", value: last.weight - first.weight };
  }
  if (first.weight == null && last.weight == null) {
    return { unit: "повт", value: last.reps - first.reps };
  }
  return null;
}
