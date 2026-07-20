"use client";

import { ExerciseAutocomplete } from "@/components/workouts/ExerciseAutocomplete";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  FullLoader,
  Input,
  SectionLabel,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, MuscleGroup, Routine } from "@/lib/types";
import {
  deleteRoutine,
  loadExercises,
  loadRoutineExercises,
  loadRoutines,
  resolveExerciseIds,
  saveRoutine,
} from "@/lib/workouts-db";
import type { DraftExercise } from "@/lib/workouts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

let seq = 0;
const rowKey = () => `r${(seq += 1)}`;

export function RoutinesManager() {
  const supabase = useMemo(() => createClient(), []);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const [rt, ex] = await Promise.all([loadRoutines(supabase, uid), loadExercises(supabase, uid)]);
        setRoutines(rt);
        setExercises(ex);
        const entries = await Promise.all(
          rt.map(async (r) => [r.id, (await loadRoutineExercises(supabase, r.id)).length] as const),
        );
        setCounts(Object.fromEntries(entries));
      } catch {
        setError("Не вдалося завантажити шаблони.");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    load();
  }, [load]);

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
      setError("Вкажи назву шаблону.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");
      const drafts: DraftExercise[] = editor.rows
        .filter((r) => r.name.trim())
        .map((r) => ({ key: r.key, exerciseId: r.exerciseId, name: r.name, muscleGroup: r.muscleGroup, sets: [] }));
      const idMap = await resolveExerciseIds(supabase, uid, drafts);
      const exerciseIds = drafts.map((d) => idMap.get(d.key)).filter((v): v is string => !!v);
      await saveRoutine(supabase, uid, editor.name, exerciseIds, editor.id);
      setEditor(null);
      await load();
    } catch {
      setError("Не вдалося зберегти шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await deleteRoutine(supabase, id);
      setEditor(null);
      await load();
    } catch {
      setError("Не вдалося видалити шаблон.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="px-1 pt-1 text-[22px] font-extrabold">Шаблони</h1>
        <FullLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2">
          <Link href="/workouts" aria-label="Назад" className="text-muted">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l-6 6 6 6" /></svg>
          </Link>
          <h1 className="text-[22px] font-extrabold">Шаблони</h1>
        </div>
        {!editor && (
          <button type="button" onClick={() => openEditor(null)} className="text-[13px] font-extrabold text-primary">
            + Новий
          </button>
        )}
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {editor && (
        <Card>
          <SectionLabel>{editor.id ? "Редагувати шаблон" : "Новий шаблон"}</SectionLabel>
          <Input
            placeholder="Назва (напр., Ноги)"
            value={editor.name}
            onChange={(e) => setEditor((s) => (s ? { ...s, name: e.target.value } : s))}
          />
          <div className="mt-3 flex flex-col gap-2">
            {editor.rows.map((r, idx) => (
              <div key={r.key} className="flex items-center gap-2">
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
                <button type="button" onClick={() => moveRow(r.key, -1)} disabled={idx === 0} aria-label="Вгору" className="flex h-8 w-7 items-center justify-center text-muted disabled:opacity-30">
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l6-6 6 6" /></svg>
                </button>
                <button type="button" onClick={() => moveRow(r.key, 1)} disabled={idx === editor.rows.length - 1} aria-label="Вниз" className="flex h-8 w-7 items-center justify-center text-muted disabled:opacity-30">
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l6 6 6-6" /></svg>
                </button>
                <button type="button" onClick={() => setEditor((s) => (s ? { ...s, rows: s.rows.filter((x) => x.key !== r.key) } : s))} aria-label="Прибрати" className="flex h-8 w-8 items-center justify-center text-muted">
                  <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l10 10M16 6L6 16" /></svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditor((s) => (s ? { ...s, rows: [...s.rows, { key: rowKey(), exerciseId: null, name: "", muscleGroup: null }] } : s))}
              className="self-start rounded-full bg-primary-light px-4 py-2 text-[13px] font-extrabold text-primary"
            >
              + вправа
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={save} loading={saving}>Зберегти</Button>
            <Button type="button" variant="outline" onClick={() => { setEditor(null); setError(null); }}>Скасувати</Button>
          </div>
          {editor.id && (
            <button type="button" onClick={() => remove(editor.id!)} className="mt-3 w-full text-center text-[13px] font-extrabold text-neg">
              Видалити шаблон
            </button>
          )}
        </Card>
      )}

      {routines.length === 0 && !editor && (
        <EmptyState emoji="🗂️" title="Ще немає шаблонів" hint="Створи шаблон (напр., «Ноги»), додай до нього вправи — і збиратимеш сесію в один тап." />
      )}

      {routines.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => openEditor(r)}
          className="flex items-center justify-between rounded-2xl bg-surface p-4 text-left shadow-card active:scale-[.99]"
        >
          <span className="text-[15px] font-extrabold text-ink">{r.name}</span>
          <span className="text-[12.5px] font-semibold text-muted">{counts[r.id] ?? 0} вправ</span>
        </button>
      ))}
    </div>
  );
}
