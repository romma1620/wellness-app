"use client";

import { Icon } from "@/components/icons";
import { BackLink } from "@/components/BackLink";
import { ExerciseAutocomplete } from "@/components/workouts/ExerciseAutocomplete";
import { MuscleGroupChips } from "@/components/workouts/MuscleGroupChips";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  FullLoader,
  Input,
  Pill,
  SectionLabel,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import type { Exercise, MuscleGroup, Routine } from "@/lib/types";
import {
  deleteRoutine,
  loadExercises,
  loadRoutineExercises,
  loadRoutines,
  resolveExerciseIds,
  saveRoutine,
} from "@/lib/workouts-db";
import { cn, plural } from "@/lib/utils";
import type { DraftExercise } from "@/lib/workouts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface Row {
  key: string;
  exerciseId: string | null;
  name: string;
  muscleGroup: MuscleGroup | null;
}

interface Editor {
  id: string | null;
  name: string;
  rows: Row[];
}

/** Кнопки «вгору/вниз/прибрати» біля назви вправи: без рамки, лише іконка. */
const ROW_BTN =
  "flex h-[34px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-muted transition active:bg-field disabled:opacity-30";

let seq = 0;
const rowKey = () => `r${(seq += 1)}`;

export function RoutinesManager() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  const dataQ = useQuery({
    queryKey: ["workouts", uid, "routines"],
    queryFn: async () => {
      const [rt, ex] = await Promise.all([loadRoutines(supabase, uid), loadExercises(supabase, uid)]);
      const entries = await Promise.all(
        rt.map(async (r) => [r.id, (await loadRoutineExercises(supabase, r.id)).length] as const),
      );
      return { routines: rt, exercises: ex, counts: Object.fromEntries(entries) };
    },
  });
  const routines = dataQ.data?.routines ?? [];
  const exercises = dataQ.data?.exercises ?? [];
  const counts = dataQ.data?.counts ?? {};
  const loading = dataQ.isPending;
  const error = actionError ?? (dataQ.isError ? "Не вдалося завантажити шаблони." : null);

  async function openEditor(r: Routine | null) {
    if (!r) {
      setEditor({ id: null, name: "", rows: [] });
      return;
    }
    const links = await loadRoutineExercises(supabase, r.id);
    const byId = new Map(exercises.map((e) => [e.id, e]));
    setEditor({
      id: r.id,
      name: r.name,
      rows: links.map((l) => {
        const ex = byId.get(l.exercise_id);
        return {
          key: rowKey(),
          exerciseId: l.exercise_id,
          name: ex?.name ?? "",
          muscleGroup: ex?.muscle_group ?? null,
        };
      }),
    });
  }

  // Чіпи групи — лише для справді нової назви: наявну вправу збереження
  // прив'яже за назвою, і вибрана тут група була б проігнорована.
  function isNewName(r: Row): boolean {
    const n = r.name.trim().toLowerCase();
    return !r.exerciseId && !!n && !exercises.some((x) => x.name.trim().toLowerCase() === n);
  }

  function moveRow(key: string, dir: -1 | 1) {
    setEditor((e) => {
      if (!e) return e;
      const i = e.rows.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= e.rows.length) return e;
      const rows = [...e.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...e, rows };
    });
  }

  async function save() {
    if (!editor) return;
    if (!editor.name.trim()) {
      setActionError("Вкажи назву шаблону.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const drafts: DraftExercise[] = editor.rows
        .filter((r) => r.name.trim())
        .map((r) => ({ key: r.key, exerciseId: r.exerciseId, name: r.name, muscleGroup: r.muscleGroup, sets: [] }));
      const idMap = await resolveExerciseIds(supabase, uid, drafts);
      const exerciseIds = drafts.map((d) => idMap.get(d.key)).filter((v): v is string => !!v);
      await saveRoutine(supabase, uid, editor.name, exerciseIds, editor.id);
      setEditor(null);
      // шаблони й вправи читає також редактор сесії — зносимо його кеш,
      // бо той засівається один раз на маунт
      queryClient.removeQueries({ queryKey: ["workouts", uid, "editor"] });
      await queryClient.invalidateQueries({ queryKey: ["workouts", uid] });
    } catch {
      setActionError("Не вдалося зберегти шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await deleteRoutine(supabase, id);
      setEditor(null);
      queryClient.removeQueries({ queryKey: ["workouts", uid, "editor"] });
      await queryClient.invalidateQueries({ queryKey: ["workouts", uid] });
    } catch {
      setActionError("Не вдалося видалити шаблон.");
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <div className="flex items-center justify-between gap-3 px-[2px]">
      <div className="flex min-w-0 items-center gap-3">
        <BackLink href="/workouts" />
        <h1 className="truncate text-[24px] font-bold tracking-[-.01em]">Шаблони</h1>
      </div>
      {!loading && !editor && (
        <Pill icon="plus" onClick={() => openEditor(null)}>
          Новий
        </Pill>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {header}
        <FullLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {header}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {editor && (
        <Card>
          <SectionLabel icon="grid">{editor.id ? "Редагувати шаблон" : "Новий шаблон"}</SectionLabel>
          <Input
            placeholder="Назва (напр., Ноги)"
            value={editor.name}
            onChange={(e) => setEditor((s) => (s ? { ...s, name: e.target.value } : s))}
          />
          <div className="mt-3 flex flex-col gap-2">
            {editor.rows.map((r, idx) => (
              <div key={r.key}>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ExerciseAutocomplete
                      value={r.name}
                      exerciseId={r.exerciseId}
                      exercises={exercises}
                      onPick={(pick) =>
                        setEditor((s) =>
                          s
                            ? {
                                ...s,
                                rows: s.rows.map((x) =>
                                  x.key === r.key
                                    ? { ...x, name: pick.name, exerciseId: pick.exerciseId, muscleGroup: pick.muscleGroup }
                                    : x,
                                ),
                              }
                            : s,
                        )
                      }
                    />
                  </div>
                  <button type="button" onClick={() => moveRow(r.key, -1)} disabled={idx === 0} aria-label="Вгору" className={ROW_BTN}>
                    <span className="flex rotate-180">
                      <Icon name="chevronDown" size={15} strokeWidth={1.8} />
                    </span>
                  </button>
                  <button type="button" onClick={() => moveRow(r.key, 1)} disabled={idx === editor.rows.length - 1} aria-label="Вниз" className={ROW_BTN}>
                    <Icon name="chevronDown" size={15} strokeWidth={1.8} />
                  </button>
                  <button type="button" onClick={() => setEditor((s) => (s ? { ...s, rows: s.rows.filter((x) => x.key !== r.key) } : s))} aria-label="Прибрати" className={ROW_BTN}>
                    <Icon name="x" size={14} strokeWidth={2} />
                  </button>
                </div>
                {isNewName(r) && (
                  <MuscleGroupChips
                    value={r.muscleGroup}
                    onChange={(g) =>
                      setEditor((s) =>
                        s
                          ? { ...s, rows: s.rows.map((x) => (x.key === r.key ? { ...x, muscleGroup: g } : x)) }
                          : s,
                      )
                    }
                  />
                )}
              </div>
            ))}
            <Chip
              dashed
              icon="plus"
              className="self-start"
              onClick={() => setEditor((s) => (s ? { ...s, rows: [...s.rows, { key: rowKey(), exerciseId: null, name: "", muscleGroup: null }] } : s))}
            >
              Вправа
            </Chip>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={save} loading={saving}>Зберегти</Button>
            <Button type="button" variant="outline" onClick={() => { setEditor(null); setActionError(null); }}>Скасувати</Button>
          </div>
          {editor.id && (
            <Button type="button" variant="danger" className="mt-3" onClick={() => remove(editor.id!)}>
              <Icon name="trash" size={14} strokeWidth={1.8} />
              Видалити шаблон
            </Button>
          )}
        </Card>
      )}

      {routines.length === 0 && !editor && (
        <EmptyState icon="grid" title="Ще немає шаблонів" hint="Створи шаблон (напр., «Ноги»), додай до нього вправи — і збиратимеш сесію в один тап." />
      )}

      {routines.length > 0 && (
        <div className="overflow-hidden rounded-xl2 bg-surface">
          {routines.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openEditor(r)}
              className={cn(
                "flex w-full items-center gap-3 px-[18px] py-[13px] text-left transition active:bg-field",
                i > 0 && "border-t border-line",
              )}
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
                <Icon name="dumbbell" size={17} strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                <span className="mt-[2px] block text-[11.5px] font-normal text-muted">
                  {counts[r.id] ?? 0} {plural(counts[r.id] ?? 0, "вправа", "вправи", "вправ")}
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-muted">
                <Icon name="chevronRight" size={16} strokeWidth={1.8} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
