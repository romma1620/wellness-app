"use client";

import { ExerciseAutocomplete } from "@/components/workouts/ExerciseAutocomplete";
import { SetRow } from "@/components/workouts/SetRow";
import { SaveIndicator, type SaveState } from "@/components/inputs";
import {
  Button,
  Card,
  ErrorBanner,
  FullLoader,
  Input,
  SectionLabel,
  Textarea,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, Routine } from "@/lib/types";
import {
  newDraftExercise,
  newDraftSet,
  type DraftExercise,
  type DraftWorkout,
} from "@/lib/workouts";
import {
  deleteWorkout,
  loadExercises,
  loadRoutineExercises,
  loadRoutines,
  loadWorkoutDraft,
  saveWorkout,
} from "@/lib/workouts-db";
import { humanDate, todayISO } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const EMPTY_DRAFT = (): DraftWorkout => ({
  date: todayISO(),
  routineId: null,
  name: "",
  note: "",
  exercises: [newDraftExercise()],
});

export function WorkoutSessionEditor({ workoutId }: { workoutId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [draft, setDraft] = useState<DraftWorkout>(EMPTY_DRAFT);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const [ex, rt] = await Promise.all([loadExercises(supabase, uid), loadRoutines(supabase, uid)]);
        setExercises(ex);
        setRoutines(rt);
        if (workoutId) {
          const d = await loadWorkoutDraft(supabase, uid, workoutId);
          if (d) setDraft(d);
        }
      } catch {
        setError("Не вдалося завантажити дані.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, workoutId]);

  function patch(p: Partial<DraftWorkout>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function patchExercise(key: string, p: Partial<DraftExercise>) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.key === key ? { ...e, ...p } : e)),
    }));
  }
  function move(key: string, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.exercises.findIndex((e) => e.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.exercises.length) return d;
      const arr = [...d.exercises];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, exercises: arr };
    });
  }

  async function applyRoutine(routineId: string) {
    try {
      const links = await loadRoutineExercises(supabase, routineId);
      const byId = new Map(exercises.map((e) => [e.id, e]));
      const rt = routines.find((r) => r.id === routineId);
      const exs: DraftExercise[] = links.map((l, idx) => {
        const ex = byId.get(l.exercise_id);
        return {
          key: `rt-${l.id}-${idx}`,
          exerciseId: l.exercise_id,
          name: ex?.name ?? "",
          muscleGroup: ex?.muscle_group ?? null,
          sets: [newDraftSet()],
        };
      });
      patch({
        routineId,
        name: rt?.name ?? "",
        exercises: exs.length ? exs : [newDraftExercise()],
      });
    } catch {
      setError("Не вдалося підтягнути шаблон.");
    }
  }

  async function onSave() {
    const hasValid = draft.exercises.some(
      (e) => e.name.trim() && e.sets.some((s) => s.reps != null && s.reps > 0),
    );
    if (!hasValid) {
      setError("Додай хоча б одну вправу з підходом.");
      setSaveState("idle");
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");
      await saveWorkout(supabase, uid, draft, workoutId);
      setSaveState("saved");
      router.push("/workouts");
      router.refresh();
    } catch {
      setSaveState("error");
      setError("Не вдалося зберегти тренування. Спробуй ще раз.");
    }
  }

  async function onDelete() {
    if (!workoutId) return;
    try {
      await deleteWorkout(supabase, workoutId);
      router.push("/workouts");
      router.refresh();
    } catch {
      setError("Не вдалося видалити тренування.");
    }
  }

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[22px] font-extrabold">
          {workoutId ? "Редагувати" : "Нове тренування"}
        </h1>
        <SaveIndicator state={saveState} />
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Дата + шаблон */}
      <Card>
        <SectionLabel>Дата</SectionLabel>
        <Input
          type="date"
          value={draft.date}
          onChange={(e) => patch({ date: e.target.value || todayISO() })}
        />
        <div className="mt-1 text-[12px] font-semibold text-muted">{humanDate(draft.date)}</div>

        {routines.length > 0 && (
          <>
            <SectionLabel className="mb-2 mt-4">Шаблон</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => applyRoutine(r.id)}
                  className={
                    draft.routineId === r.id
                      ? "rounded-full bg-primary px-[14px] py-[9px] text-[13px] font-bold text-white"
                      : "rounded-full border-[1.5px] border-primary-light bg-bg px-[14px] py-[9px] text-[13px] font-semibold text-muted"
                  }
                >
                  {r.name}
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Вправи */}
      {draft.exercises.map((ex, exIdx) => (
        <Card key={ex.key}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1">
              <ExerciseAutocomplete
                value={ex.name}
                exerciseId={ex.exerciseId}
                exercises={exercises}
                onPick={(pick) =>
                  patchExercise(ex.key, {
                    name: pick.name,
                    exerciseId: pick.exerciseId,
                    muscleGroup: pick.muscleGroup,
                  })
                }
              />
            </div>
            <button
              type="button"
              onClick={() => move(ex.key, -1)}
              disabled={exIdx === 0}
              aria-label="Вгору"
              className="flex h-8 w-7 items-center justify-center rounded-lg text-muted disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l6-6 6 6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => move(ex.key, 1)}
              disabled={exIdx === draft.exercises.length - 1}
              aria-label="Вниз"
              className="flex h-8 w-7 items-center justify-center rounded-lg text-muted disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l6 6 6-6" /></svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {ex.sets.map((s, sIdx) => (
              <SetRow
                key={sIdx}
                index={sIdx}
                set={s}
                onChange={(next) =>
                  patchExercise(ex.key, {
                    sets: ex.sets.map((v, i) => (i === sIdx ? next : v)),
                  })
                }
                onRemove={() =>
                  patchExercise(ex.key, {
                    sets: ex.sets.length > 1 ? ex.sets.filter((_, i) => i !== sIdx) : ex.sets,
                  })
                }
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                patchExercise(ex.key, { sets: [...ex.sets, newDraftSet(ex.sets[ex.sets.length - 1])] })
              }
              className="rounded-full bg-primary-light px-4 py-2 text-[13px] font-extrabold text-primary active:scale-95"
            >
              + підхід
            </button>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== ex.key) }))
              }
              className="text-[12.5px] font-bold text-neg"
            >
              Прибрати вправу
            </button>
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={() => setDraft((d) => ({ ...d, exercises: [...d.exercises, newDraftExercise()] }))}
        className="rounded-2xl border-[1.5px] border-dashed border-primary-light bg-surface py-4 text-center text-[14px] font-extrabold text-primary active:scale-[.99]"
      >
        + додати вправу
      </button>

      {/* Нотатка */}
      <Card>
        <SectionLabel>Нотатка</SectionLabel>
        <Textarea
          rows={2}
          placeholder="Самопочуття, деталі…"
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
      </Card>

      <Button type="button" onClick={onSave} loading={saveState === "saving"}>
        Зберегти
      </Button>

      {workoutId && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full text-center text-[13px] font-extrabold text-neg"
        >
          Видалити тренування
        </button>
      )}
    </div>
  );
}
