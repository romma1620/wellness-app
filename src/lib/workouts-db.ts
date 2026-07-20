import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise, Routine, RoutineExercise } from "@/lib/types";
import {
  exerciseTonnage,
  type DraftExercise,
  type DraftWorkout,
  type LoadedWorkout,
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

export async function loadWorkoutsWithSets(sb: SB, uid: string): Promise<LoadedWorkout[]> {
  const { data, error } = await sb
    .from("workouts")
    .select("id, date, name, routine_id, workout_sets(weight, reps, exercise_id)")
    .eq("user_id", uid)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w: any) => ({
    id: w.id,
    date: w.date,
    name: w.name,
    routine_id: w.routine_id,
    sets: (w.workout_sets ?? []).map((s: any) => ({
      weight: s.weight,
      reps: s.reps,
      exercise_id: s.exercise_id,
    })),
  }));
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
  for (const d of exs) {
    const exId = idMap.get(d.key);
    if (!exId) continue;
    let n = 0;
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
