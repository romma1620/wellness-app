import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise, MuscleGroup, Routine, RoutineExercise } from "@/lib/types";
import {
  exerciseCount,
  exerciseTonnage,
  type DraftExercise,
  type DraftWorkout,
  type ExerciseSet,
  type MonthTotal,
  type UsedExercise,
  type WorkoutListItem,
} from "@/lib/workouts";

type SB = SupabaseClient;

export async function loadExercises(sb: SB, uid: string): Promise<Exercise[]> {
  const { data, error } = await sb
    .from("exercises")
    .select("*")
    .eq("user_id", uid)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function loadRoutines(sb: SB, uid: string): Promise<Routine[]> {
  const { data, error } = await sb
    .from("routines")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Routine[];
}

export async function loadRoutineExercises(sb: SB, routineId: string): Promise<RoutineExercise[]> {
  const { data, error } = await sb
    .from("routine_exercises")
    .select("*")
    .eq("routine_id", routineId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RoutineExercise[];
}

/** Місячні підсумки — усі одразу. Навіть за 5 років це десятки рядків. */
export async function loadMonthTotals(sb: SB): Promise<MonthTotal[]> {
  const { data, error } = await sb.rpc("workout_month_totals");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    month: r.month_start as string,
    sessions: Number(r.sessions),
    tonnage: Number(r.tonnage),
  }));
}

/** Вправи, що трапляються в сесіях, з датою останнього використання. */
export async function loadUsedExercises(sb: SB): Promise<UsedExercise[]> {
  const { data, error } = await sb.rpc("used_exercises");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    name: r.name as string,
    muscleGroup: (r.muscle_group ?? null) as MuscleGroup | null,
    lastUsed: r.last_used as string,
  }));
}

/**
 * Сторінка списку сесій за діапазоном дат (обидві межі включно).
 * Тягне лише `exercise_id` підходів: рядок списку показує кількість вправ,
 * а тоннаж приходить готовим із `loadMonthTotals`.
 */
export async function loadWorkoutList(
  sb: SB,
  uid: string,
  from: string,
  to: string,
): Promise<WorkoutListItem[]> {
  const { data, error } = await sb
    .from("workouts")
    .select("id, date, name, workout_sets(exercise_id)")
    .eq("user_id", uid)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    id: w.id,
    date: w.date,
    name: w.name,
    exerciseCount: exerciseCount(w.workout_sets ?? []),
  }));
}

/** Усі підходи однієї вправи з датами сесій — джерело графіка прогресу. */
export async function loadExerciseSets(
  sb: SB,
  uid: string,
  exerciseId: string,
): Promise<ExerciseSet[]> {
  const { data, error } = await sb
    .from("workout_sets")
    .select("weight, reps, workouts!inner(date, user_id)")
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", uid)
    // 1000 — стандартний ліміт PostgREST (db-max-rows) на рядки одного запиту.
    // Робимо його явним: стабільна вправа за сотні сесій (4 підходи × 300 =
    // 1200 рядків) інакше мовчки втратила б хвіст даних на графіку прогресу.
    .limit(1000);
  if (error) throw error;
  const rows: ExerciseSet[] = [];
  for (const s of (data ?? []) as any[]) {
    // workout_sets.workout_id → workouts.id — many-to-one, тож PostgREST мав
    // би віддавати embed `workouts` обʼєктом; без живої бази це не перевірено,
    // тож приймаємо й масив та відкидаємо рядок без дати, а не пропускаємо
    // undefined у рендер графіка.
    const w = Array.isArray(s.workouts) ? s.workouts[0] : s.workouts;
    const date = w?.date as string | undefined;
    if (!date) continue;
    rows.push({ date, weight: s.weight, reps: s.reps });
  }
  return rows;
}

export async function loadWorkoutDraft(
  sb: SB,
  uid: string,
  workoutId: string,
): Promise<DraftWorkout | null> {
  const { data: w, error } = await sb
    .from("workouts")
    .select("id, date, name, note, routine_id")
    .eq("user_id", uid)
    .eq("id", workoutId)
    .maybeSingle();
  if (error) throw error;
  if (!w) return null;

  const { data: sets, error: sErr } = await sb
    .from("workout_sets")
    .select("exercise_id, set_number, weight, reps")
    .eq("workout_id", workoutId)
    .order("set_number", { ascending: true });
  if (sErr) throw sErr;

  const exercises = await loadExercises(sb, uid);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  // групуємо підходи за вправою, зберігаючи перший порядок появи
  const order: string[] = [];
  const grouped = new Map<string, { weight: number | null; reps: number | null }[]>();
  for (const s of sets ?? []) {
    if (!grouped.has(s.exercise_id)) {
      grouped.set(s.exercise_id, []);
      order.push(s.exercise_id);
    }
    grouped.get(s.exercise_id)!.push({ weight: s.weight, reps: s.reps });
  }

  let seq = 0;
  const draftExercises: DraftExercise[] = order.map((exId) => {
    seq += 1;
    const ex = byId.get(exId);
    return {
      key: `load-${exId}-${seq}`,
      exerciseId: exId,
      name: ex?.name ?? "—",
      muscleGroup: ex?.muscle_group ?? null,
      sets: grouped.get(exId)!.map((s) => ({ weight: s.weight, reps: s.reps })),
    };
  });

  return {
    date: w.date,
    routineId: w.routine_id,
    name: w.name ?? "",
    note: w.note ?? "",
    exercises: draftExercises,
  };
}

/**
 * Гарантує, що кожна draft-вправа має id у довіднику.
 * Нові назви (exerciseId=null) — insert. Повертає мапу draft.key → exercise id.
 */
export async function resolveExerciseIds(
  sb: SB,
  uid: string,
  drafts: DraftExercise[],
): Promise<Map<string, string>> {
  const existing = await loadExercises(sb, uid);
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
  const result = new Map<string, string>();

  for (const d of drafts) {
    const nameKey = d.name.trim().toLowerCase();
    if (!nameKey) continue;
    if (d.exerciseId) {
      result.set(d.key, d.exerciseId);
      continue;
    }
    const found = byName.get(nameKey);
    if (found) {
      result.set(d.key, found);
      continue;
    }
    const { data, error } = await sb
      .from("exercises")
      .insert({ user_id: uid, name: d.name.trim(), muscle_group: d.muscleGroup })
      .select("id")
      .single();
    if (error) throw error;
    byName.set(nameKey, data.id);
    result.set(d.key, data.id);
  }
  return result;
}

/** Валідна вправа = має назву і хоча б один підхід з reps > 0. */
function validExercises(draft: DraftWorkout): DraftExercise[] {
  return draft.exercises.filter(
    (d) => d.name.trim() && d.sets.some((s) => s.reps != null && s.reps > 0),
  );
}

export async function saveWorkout(
  sb: SB,
  uid: string,
  draft: DraftWorkout,
  workoutId: string | null,
): Promise<string> {
  const exs = validExercises(draft);
  const idMap = await resolveExerciseIds(sb, uid, exs);

  const name = draft.name.trim() || exs[0]?.name.trim() || "Тренування";
  const payload = {
    user_id: uid,
    date: draft.date,
    routine_id: draft.routineId,
    name,
    note: draft.note.trim() || null,
  };

  let id = workoutId;
  if (id) {
    const { error } = await sb.from("workouts").update(payload).eq("id", id);
    if (error) throw error;
    const { error: dErr } = await sb.from("workout_sets").delete().eq("workout_id", id);
    if (dErr) throw dErr;
  } else {
    const { data, error } = await sb.from("workouts").insert(payload).select("id").single();
    if (error) throw error;
    id = data.id as string;
  }

  const rows: {
    workout_id: string;
    exercise_id: string;
    set_number: number;
    weight: number | null;
    reps: number;
  }[] = [];
  // set_number — наскрізний лічильник у межах усього тренування (порядок вставки),
  // а не лічильник у межах вправи: loadWorkoutDraft сортує підходи за set_number
  // і за першою появою exercise_id відновлює порядок вправ, тож значення мають
  // бути монотонними по всій сесії, інакше вправи з однаковими set_number
  // впорядковуються недетерміновано.
  let n = 0;
  for (const d of exs) {
    const exId = idMap.get(d.key);
    if (!exId) continue;
    for (const s of d.sets) {
      if (s.reps == null || s.reps <= 0) continue;
      n += 1;
      rows.push({
        workout_id: id,
        exercise_id: exId,
        set_number: n,
        weight: s.weight,
        reps: s.reps,
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await sb.from("workout_sets").insert(rows);
    if (error) throw error;
  }
  return id;
}

export async function saveRoutine(
  sb: SB,
  uid: string,
  name: string,
  exerciseIds: string[],
  routineId: string | null,
): Promise<string> {
  let id = routineId;
  if (id) {
    const { error } = await sb.from("routines").update({ name: name.trim() }).eq("id", id);
    if (error) throw error;
    const { error: dErr } = await sb.from("routine_exercises").delete().eq("routine_id", id);
    if (dErr) throw dErr;
  } else {
    const { data, error } = await sb
      .from("routines")
      .insert({ user_id: uid, name: name.trim() })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as string;
  }
  if (exerciseIds.length > 0) {
    const rows = exerciseIds.map((exId, i) => ({
      routine_id: id!,
      exercise_id: exId,
      position: i,
    }));
    const { error } = await sb.from("routine_exercises").insert(rows);
    if (error) throw error;
  }
  return id;
}

export async function deleteRoutine(sb: SB, routineId: string): Promise<void> {
  const { error } = await sb.from("routines").delete().eq("id", routineId);
  if (error) throw error;
}

export async function deleteWorkout(sb: SB, workoutId: string): Promise<void> {
  const { error } = await sb.from("workouts").delete().eq("id", workoutId);
  if (error) throw error;
}

// re-export для зручності списку
export { exerciseTonnage };
