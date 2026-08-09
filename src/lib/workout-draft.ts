import type { MuscleGroup } from "@/lib/types";
import { plural, shortDate, toISODate } from "@/lib/utils";
import type { DraftExercise, DraftSet, DraftWorkout } from "@/lib/workouts";

const KEY = "aura-workout-draft";
const VERSION = 1;

/**
 * Незбережене нове тренування в localStorage. Одночасно існує максимум одне.
 *
 * `userId` тут не для безпеки, а для коректності: `routineId` і `exerciseId`
 * усередині чернетки — це id рядків конкретного користувача. Після
 * перелогіну на тому самому пристрої чужа чернетка при збереженні дала б
 * посилання на неіснуючі для нового юзера вправи.
 */
export interface StoredDraft {
  v: number;
  userId: string;
  savedAt: string; // ISO-мить, коли чернетку записали
  draft: DraftWorkout;
}

/**
 * Чи є в формі щось варте збереження.
 *
 * Дата свідомо не рахується: вона заповнена завжди (сьогодні за замовчуванням),
 * тож інакше кожне відкриття редактора з наступним виходом лишало б
 * сміттєве «незакінчене тренування» на вкладці.
 */
export function isDraftMeaningful(draft: DraftWorkout): boolean {
  if (draft.routineId !== null) return true;
  if (draft.note.trim() !== "") return true;
  return draft.exercises.some(
    (e) =>
      e.name.trim() !== "" ||
      e.sets.some((s) => s.weight !== null || s.reps !== null),
  );
}

export function serializeDraft(draft: DraftWorkout, userId: string, now: Date): string {
  const stored: StoredDraft = { v: VERSION, userId, savedAt: now.toISOString(), draft };
  return JSON.stringify(stored);
}

function normalizeSet(value: unknown): DraftSet {
  const s = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { weight: num(s.weight), reps: num(s.reps) };
}

function normalizeExercise(value: unknown, index: number): DraftExercise | null {
  if (typeof value !== "object" || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.name !== "string") return null;
  if (!Array.isArray(e.sets)) return null;
  const sets = e.sets.map(normalizeSet);
  return {
    // Ключі перегенеровуємо: `key` видає лічильник у workouts.ts, який
    // обнуляється щосесії, тож ключи зі старої сесії покладались би на
    // випадковість. `restored-N` унікальний у межах масиву — цього досить.
    key: `restored-${index}`,
    exerciseId: typeof e.exerciseId === "string" ? e.exerciseId : null,
    name: e.name,
    muscleGroup: (typeof e.muscleGroup === "string" ? e.muscleGroup : null) as MuscleGroup | null,
    // SetRow завжди рендерить хоча б один рядок; порожній масив зробив би
    // вправу без жодного поля вводу
    sets: sets.length > 0 ? sets : [{ weight: null, reps: null }],
  };
}

function normalizeDraft(value: unknown): DraftWorkout | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as Record<string, unknown>;
  if (typeof d.date !== "string" || d.date === "") return null;
  if (!Array.isArray(d.exercises)) return null;
  const exercises: DraftExercise[] = [];
  for (let i = 0; i < d.exercises.length; i += 1) {
    const ex = normalizeExercise(d.exercises[i], i);
    if (!ex) return null;
    exercises.push(ex);
  }
  return {
    date: d.date,
    routineId: typeof d.routineId === "string" ? d.routineId : null,
    name: typeof d.name === "string" ? d.name : "",
    note: typeof d.note === "string" ? d.note : "",
    exercises,
  };
}

/**
 * Розбирає збережений рядок. Повертає null на будь-якому відхиленні —
 * зіпсоване сховище не має ламати сторінку.
 */
export function parseDraft(raw: string | null, userId: string): StoredDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== VERSION) return null;
  if (typeof o.userId !== "string" || o.userId !== userId) return null;
  if (typeof o.savedAt !== "string") return null;
  const draft = normalizeDraft(o.draft);
  if (!draft || draft.exercises.length === 0) return null;
  return { v: VERSION, userId, savedAt: o.savedAt, draft };
}

/**
 * Підпис чернетки: «Ноги · 3 вправи · 12 серпня».
 *
 * `routineName` передає викликач, бо в чернетці лежить лише `routineId`:
 * редактор має завантажені шаблони, вкладка «Тренування» — ні.
 */
export function draftSummary(stored: StoredDraft, routineName?: string | null): string {
  const count = stored.draft.exercises.filter((e) => e.name.trim() !== "").length;
  const parts: string[] = [];
  if (routineName) parts.push(routineName);
  parts.push(`${count} ${plural(count, "вправа", "вправи", "вправ")}`);
  // savedAt — мить у UTC; показуємо локальну дату користувача
  parts.push(shortDate(toISODate(new Date(stored.savedAt))));
  return parts.join(" · ");
}

// ----------------------- Доступ до сховища -----------------------
// Кожна операція в try/catch: у приватному режимі Safari доступ до
// localStorage кидає, і фіча має тихо вимкнутись, а не зламати редактор.

export function readDraft(userId: string): StoredDraft | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  const stored = parseDraft(raw, userId);
  // сміття, стара версія або чернетка іншого юзера — прибираємо, щоб не
  // висіли вічно: слот однаково один
  if (!stored && raw !== null) clearDraft();
  return stored;
}

export function writeDraft(draft: DraftWorkout, userId: string): void {
  try {
    window.localStorage.setItem(KEY, serializeDraft(draft, userId, new Date()));
  } catch {
    // приватний режим або вичерпана квота
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // те саме
  }
}
