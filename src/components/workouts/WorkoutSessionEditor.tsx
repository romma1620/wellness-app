"use client";

import { Icon } from "@/components/icons";
import { BackLink } from "@/components/BackLink";
import { DraftResumeSheet } from "@/components/workouts/DraftResumeSheet";
import { ExerciseAutocomplete } from "@/components/workouts/ExerciseAutocomplete";
import { ExerciseMaxLine } from "@/components/workouts/ExerciseMaxLine";
import { MuscleGroupChips } from "@/components/workouts/MuscleGroupChips";
import { SetRow } from "@/components/workouts/SetRow";
import { SaveIndicator, type SaveState } from "@/components/inputs";
import {
  Button,
  Card,
  Chip,
  DateField,
  ErrorBanner,
  FullLoader,
  SectionLabel,
  Textarea,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import type { Exercise, Routine } from "@/lib/types";
import {
  newDraftExercise,
  newDraftSet,
  type DraftExercise,
  type DraftWorkout,
  type ExerciseMax,
} from "@/lib/workouts";
import {
  deleteWorkout,
  loadExerciseMaxes,
  loadExercises,
  loadRoutineExercises,
  loadRoutines,
  loadWorkoutDraft,
  saveWorkout,
} from "@/lib/workouts-db";
import { humanDate, todayISO } from "@/lib/utils";
import {
  clearDraft,
  isDraftMeaningful,
  readDraft,
  writeDraft,
  type StoredDraft,
} from "@/lib/workout-draft";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_DRAFT = (): DraftWorkout => ({
  date: todayISO(),
  routineId: null,
  name: "",
  note: "",
  exercises: [newDraftExercise()],
});

/** Кнопки «вгору/вниз» біля назви вправи: без рамки, лише іконка. */
const MOVE_BTN =
  "flex h-[34px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-muted transition active:bg-field disabled:opacity-30";

const NO_EXERCISES: Exercise[] = [];
const NO_ROUTINES: Routine[] = [];
const NO_MAXES = new Map<string, ExerciseMax>();

export function WorkoutSessionEditor({ workoutId }: { workoutId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [draft, setDraft] = useState<DraftWorkout>(EMPTY_DRAFT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  // чернетка, знайдена в сховищі: поки вона тут, над редактором висить шіт
  const [stored, setStored] = useState<StoredDraft | null>(null);
  // "pending" — рішення про чернетку ще не ухвалене, автозбереження мовчить,
  // щоб порожня форма під шітом не затерла знайдену чернетку
  const [decision, setDecision] = useState<"pending" | "resume" | "fresh">(
    workoutId ? "fresh" : "pending",
  );

  const editorQ = useQuery({
    queryKey: ["workouts", uid, "editor", workoutId ?? "new"],
    queryFn: async () => {
      const [ex, rt, mx] = await Promise.all([
        loadExercises(supabase, uid),
        loadRoutines(supabase, uid),
        // RPC ще не розкочена в проді — падає до появи міграції. На відміну
        // від інших членів Promise.all, її провал не має валити весь маунт:
        // без цього fallback редактор показав би порожню форму поверх
        // існуючої сесії, а збереження стерло б її підходи.
        loadExerciseMaxes(supabase, workoutId).catch(() => new Map<string, ExerciseMax>()),
      ]);
      const workout = workoutId ? await loadWorkoutDraft(supabase, uid, workoutId) : null;
      return { exercises: ex, routines: rt, maxes: mx, workout };
    },
  });
  const exercises = editorQ.data?.exercises ?? NO_EXERCISES;
  const routines = editorQ.data?.routines ?? NO_ROUTINES;
  const maxes = editorQ.data?.maxes ?? NO_MAXES;
  const loading = editorQ.isPending;
  const error = actionError ?? (editorQ.isError ? "Не вдалося завантажити дані." : null);

  // Чернетка редагованої сесії і рішення про збережену чернетку — один раз
  // на маунт: фонове оновлення кешу не має перезбирати форму під руками.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !editorQ.data) return;
    seeded.current = true;
    if (workoutId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- разовий seed чернетки зі знімка кешу
      if (editorQ.data.workout) setDraft(editorQ.data.workout);
    } else {
      // localStorage читаємо лише після гідратації — під час рендера це
      // дало б розбіжність із серверною розміткою
      const found = readDraft(uid);
      if (found) setStored(found);
      else setDecision("fresh");
    }
  }, [editorQ.data, workoutId, uid]);

  // Автозбереження чернетки. Дебаунс 400 мс: набір ваги в SetRow міняє draft
  // на кожне натискання клавіші, а серіалізація всієї сесії на кожен символ
  // тут не потрібна.
  useEffect(() => {
    if (workoutId || loading || decision === "pending") return;
    // під час і одразу після збереження новий таймер не зводимо: інакше
    // таймер, зведений останнім натисканням клавіші, пережив би onSave —
    // щоб зведений таймер не переписав чернетку вже після clearDraft().
    // Ефект перезапускається на зміну saveState, а cleanup нижче скасовує
    // таймер, зведений до переходу в "saving".
    if (saveState === "saving" || saveState === "saved") return;
    const timer = setTimeout(() => {
      if (isDraftMeaningful(draft)) writeDraft(draft, uid);
      // юзер стер усе назад до порожнього — незакінченого більше нема
      else clearDraft();
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, workoutId, loading, decision, uid, saveState]);

  function patch(p: Partial<DraftWorkout>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function patchExercise(key: string, p: Partial<DraftExercise>) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.key === key ? { ...e, ...p } : e)),
    }));
  }
  // Чіпи групи показуємо лише для справді нової назви: якщо така вправа вже
  // є в довіднику, збереження прив'яже до неї і вибрана тут група пропала б.
  function isNewName(e: DraftExercise): boolean {
    const n = e.name.trim().toLowerCase();
    return !e.exerciseId && !!n && !exercises.some((x) => x.name.trim().toLowerCase() === n);
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

  function resumeDraft() {
    if (!stored) return;
    const known = new Set(routines.map((r) => r.id));
    const d = stored.draft;
    setDraft({
      ...d,
      // шаблон могли видалити, поки чернетка лежала: мертвий routine_id
      // впав би на FK при збереженні. Назви вправ у чернетці вже
      // матеріалізовані, тож саме тренування від цього не страждає.
      routineId: d.routineId && known.has(d.routineId) ? d.routineId : null,
    });
    setStored(null);
    setDecision("resume");
  }

  function startFresh() {
    clearDraft();
    setStored(null);
    setDecision("fresh");
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
      setActionError("Не вдалося підтягнути шаблон.");
    }
  }

  async function onSave() {
    const hasValid = draft.exercises.some(
      (e) => e.name.trim() && e.sets.some((s) => s.reps != null && s.reps > 0),
    );
    if (!hasValid) {
      setActionError("Додай хоча б одну вправу з підходом.");
      setSaveState("idle");
      return;
    }
    setSaveState("saving");
    setActionError(null);
    try {
      await saveWorkout(supabase, uid, draft, workoutId);
      // слот чернетки один на юзера, тож збереження правок чужої сесії
      // (редагування вже існуючого тренування) не має його чіпати
      if (!workoutId) clearDraft();
      invalidateAfterWrite();
      setSaveState("saved");
      router.push("/workouts");
      router.refresh();
    } catch {
      setSaveState("error");
      setActionError("Не вдалося зберегти тренування. Спробуй ще раз.");
    }
  }

  /**
   * Після запису: кеші редакторів зносимо повністю (seed-один-раз узяв би
   * з них дочекані, але вже застарілі підходи), решту — звичайна інвалідація;
   * тоннаж і рекорди читає й щоденниковий кеш.
   */
  function invalidateAfterWrite() {
    queryClient.removeQueries({ queryKey: ["workouts", uid, "editor"] });
    void queryClient.invalidateQueries({ queryKey: ["workouts", uid] });
    void queryClient.invalidateQueries({ queryKey: ["diary", uid] });
  }

  async function onDelete() {
    if (!workoutId) return;
    try {
      await deleteWorkout(supabase, workoutId);
      invalidateAfterWrite();
      router.push("/workouts");
      router.refresh();
    } catch {
      setActionError("Не вдалося видалити тренування.");
    }
  }

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between gap-3 px-[2px]">
        <div className="flex min-w-0 items-center gap-3">
          <BackLink href="/workouts" />
          <h1 className="truncate text-[24px] font-bold tracking-[-.01em]">
            {workoutId ? "Редагувати" : "Нове тренування"}
          </h1>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Дата + шаблон */}
      <Card>
        <SectionLabel icon="calendar">Дата</SectionLabel>
        <DateField
          value={draft.date}
          onChange={(v) => patch({ date: v || todayISO() })}
          label="Дата тренування"
        >
          <span className="flex items-center justify-between gap-2 rounded-[13px] border border-line bg-field px-[14px] py-3">
            <span className="text-[14px] font-semibold text-ink">{humanDate(draft.date)}</span>
            <span aria-hidden className="shrink-0 text-muted">
              <Icon name="chevronDown" size={16} strokeWidth={1.8} />
            </span>
          </span>
        </DateField>

        {routines.length > 0 && (
          <>
            <SectionLabel icon="grid" className="mb-[10px] mt-4">
              Шаблон
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {routines.map((r) => (
                <Chip key={r.id} active={draft.routineId === r.id} onClick={() => applyRoutine(r.id)}>
                  {r.name}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Вправи */}
      {draft.exercises.map((ex, exIdx) => (
        <Card key={ex.key}>
          <div className="mb-3">
            <div className="flex items-center gap-2">
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
                className={MOVE_BTN}
              >
                <span className="flex rotate-180">
                  <Icon name="chevronDown" size={15} strokeWidth={1.8} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => move(ex.key, 1)}
                disabled={exIdx === draft.exercises.length - 1}
                aria-label="Вниз"
                className={MOVE_BTN}
              >
                <Icon name="chevronDown" size={15} strokeWidth={1.8} />
              </button>
            </div>
            <ExerciseMaxLine
              max={ex.exerciseId ? (maxes.get(ex.exerciseId) ?? null) : null}
              sets={ex.sets}
            />
            {isNewName(ex) && (
              <MuscleGroupChips
                value={ex.muscleGroup}
                onChange={(g) => patchExercise(ex.key, { muscleGroup: g })}
              />
            )}
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
            <Chip
              dashed
              icon="plus"
              onClick={() =>
                patchExercise(ex.key, { sets: [...ex.sets, newDraftSet(ex.sets[ex.sets.length - 1])] })
              }
            >
              Підхід
            </Chip>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== ex.key) }))
              }
              className="flex items-center gap-[5px] px-1 text-[12px] font-semibold text-neg"
            >
              <Icon name="trash" size={12} strokeWidth={1.8} />
              Прибрати вправу
            </button>
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={() => setDraft((d) => ({ ...d, exercises: [...d.exercises, newDraftExercise()] }))}
        className="flex w-full items-center justify-center gap-2 rounded-xl2 border border-dashed border-line py-4 text-[14px] font-semibold text-accent transition active:scale-[.99]"
      >
        <Icon name="plus" size={14} strokeWidth={2.2} />
        Додати вправу
      </button>

      {/* Нотатка */}
      <Card>
        <SectionLabel icon="pencil">Нотатка</SectionLabel>
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
        <Button type="button" variant="danger" onClick={onDelete}>
          <Icon name="trash" size={14} strokeWidth={1.8} />
          Видалити тренування
        </Button>
      )}

      {stored && (
        <DraftResumeSheet
          stored={stored}
          routineName={routines.find((r) => r.id === stored.draft.routineId)?.name ?? null}
          onResume={resumeDraft}
          onFresh={startFresh}
          // push, а не back: на холодному старті PWA (deep link на
          // /workouts/new) в історії може не бути попередньої сторінки,
          // і back() тоді нічого не робить — шіт лишався б без виходу
          onCancel={() => router.push("/workouts")}
        />
      )}
    </div>
  );
}
