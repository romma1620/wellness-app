# Незакінчене тренування (чернетка в localStorage) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Незбережене нове тренування переживає вихід зі сторінки — воно лежить у `localStorage` і пропонується до продовження при наступному вході в редактор.

**Architecture:** Чиста логіка (поріг «змістовної зміни», серіалізація, розбір і санітизація) живе в `src/lib/workout-draft.ts` і не торкається `localStorage` — саме тому її можна тестувати під `environment: "node"`. Доступ до сховища — три тонкі обгортки в тому ж файлі, кожна в `try/catch`. `WorkoutSessionEditor` пише чернетку дебаунсованим ефектом і показує `Sheet` відновлення; `WorkoutsPage` показує картку незакінченого.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind, Vitest.

## Global Constraints

- Мова всього UI-тексту і коментарів у коді — українська.
- Тести — тільки на чисту логіку (`src/**/*.test.ts`, `environment: "node"`). UI перевіряється `npm run typecheck`, `npm run lint`, `npm run build` і вручну. Не писати тестів, що торкаються `window` чи `localStorage`.
- Ключ сховища — рівно `aura-workout-draft`. Версія формату — `1`.
- Фіча діє **тільки** при `workoutId === null` (створення). Режим редагування збереженої сесії не змінюється.
- Жодних міграцій БД, жодних нових залежностей.
- Будь-яка операція з `localStorage` — у `try/catch`: у приватному режимі Safari `setItem` кидає, і редактор мусить працювати як раніше.
- Гілка вже створена: `feat/workout-draft`. Коміти — conventional commits, з `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` в кінці.

---

## File Structure

| Файл | Відповідальність |
|---|---|
| `src/lib/workout-draft.ts` (новий) | Формат `StoredDraft`, поріг `isDraftMeaningful`, серіалізація/розбір/санітизація, підпис `draftSummary`, обгортки `readDraft`/`writeDraft`/`clearDraft` |
| `src/lib/workout-draft.test.ts` (новий) | Тести чистих функцій |
| `src/components/workouts/DraftResumeSheet.tsx` (новий) | Шіт «Продовжити / Почати нове / Скасувати» |
| `src/components/workouts/UnfinishedWorkoutCard.tsx` (новий) | Картка незакінченого на вкладці |
| `src/components/workouts/WorkoutSessionEditor.tsx` (правки) | Автозбереження, стан `decision`, рендер шіта, `clearDraft` після сейву |
| `src/app/(app)/workouts/page.tsx` (правки) | Читання чернетки, рендер картки над списком і над `EmptyState` |

---

## Task 1: Модуль чернетки

**Files:**
- Create: `src/lib/workout-draft.ts`
- Test: `src/lib/workout-draft.test.ts`

**Interfaces:**
- Consumes: `DraftWorkout`, `DraftExercise`, `DraftSet` з `@/lib/workouts`; `MuscleGroup` з `@/lib/types`; `plural`, `shortDate`, `toISODate` з `@/lib/utils`.
- Produces:
  - `interface StoredDraft { v: number; userId: string; savedAt: string; draft: DraftWorkout }`
  - `isDraftMeaningful(draft: DraftWorkout): boolean`
  - `serializeDraft(draft: DraftWorkout, userId: string, now: Date): string`
  - `parseDraft(raw: string | null, userId: string): StoredDraft | null`
  - `draftSummary(stored: StoredDraft, routineName?: string | null): string`
  - `readDraft(userId: string): StoredDraft | null`
  - `writeDraft(draft: DraftWorkout, userId: string): void`
  - `clearDraft(): void`

- [ ] **Step 1: Написати тести, що падають**

Створити `src/lib/workout-draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  draftSummary,
  isDraftMeaningful,
  parseDraft,
  serializeDraft,
  type StoredDraft,
} from "./workout-draft";
import type { DraftWorkout } from "./workouts";

const UID = "user-1";
const AT = new Date("2026-08-12T12:00:00.000Z");

function emptyDraft(): DraftWorkout {
  return {
    date: "2026-08-12",
    routineId: null,
    name: "",
    note: "",
    exercises: [
      { key: "d1", exerciseId: null, name: "", muscleGroup: null, sets: [{ weight: null, reps: null }] },
    ],
  };
}

describe("isDraftMeaningful", () => {
  it("порожня форма — ні", () => {
    expect(isDraftMeaningful(emptyDraft())).toBe(false);
  });
  it("змінена лише дата — ні", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), date: "2026-08-01" })).toBe(false);
  });
  it("обраний шаблон — так", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), routineId: "rt-1" })).toBe(true);
  });
  it("назва вправи — так", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("назва з самих пробілів — ні", () => {
    const d = emptyDraft();
    d.exercises[0].name = "   ";
    expect(isDraftMeaningful(d)).toBe(false);
  });
  it("вага без повторів — так", () => {
    const d = emptyDraft();
    d.exercises[0].sets[0].weight = 60;
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("повтори без ваги — так", () => {
    const d = emptyDraft();
    d.exercises[0].sets[0].reps = 8;
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("нотатка — так", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), note: "спина боліла" })).toBe(true);
  });
});

describe("parseDraft", () => {
  const raw = () => serializeDraft({ ...emptyDraft(), routineId: "rt-1", note: "ок" }, UID, AT);

  it("валідний payload повертає ті самі дані", () => {
    const stored = parseDraft(raw(), UID);
    expect(stored?.draft.routineId).toBe("rt-1");
    expect(stored?.draft.note).toBe("ок");
    expect(stored?.draft.date).toBe("2026-08-12");
    expect(stored?.savedAt).toBe("2026-08-12T12:00:00.000Z");
  });
  it("null на вході — null", () => {
    expect(parseDraft(null, UID)).toBeNull();
  });
  it("невалідний JSON — null", () => {
    expect(parseDraft("{нє json", UID)).toBeNull();
  });
  it("інша версія формату — null", () => {
    expect(parseDraft(JSON.stringify({ v: 0, userId: UID, savedAt: "x", draft: emptyDraft() }), UID)).toBeNull();
  });
  it("чужий userId — null", () => {
    expect(parseDraft(raw(), "user-2")).toBeNull();
  });
  it("exercises не масив — null", () => {
    const bad = JSON.stringify({ v: 1, userId: UID, savedAt: "x", draft: { ...emptyDraft(), exercises: "нє" } });
    expect(parseDraft(bad, UID)).toBeNull();
  });
  it("немає дати — null", () => {
    const bad = JSON.stringify({ v: 1, userId: UID, savedAt: "x", draft: { ...emptyDraft(), date: "" } });
    expect(parseDraft(bad, UID)).toBeNull();
  });
  it("ключі вправ перегенеровано й унікальні", () => {
    const d = emptyDraft();
    d.exercises = [
      { key: "dup", exerciseId: null, name: "A", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "dup", exerciseId: null, name: "B", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
    ];
    const keys = parseDraft(serializeDraft(d, UID, AT), UID)!.draft.exercises.map((e) => e.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys).not.toContain("dup");
  });
  it("сміття в підході стає null, а не NaN", () => {
    const bad = JSON.stringify({
      v: 1,
      userId: UID,
      savedAt: "x",
      draft: {
        ...emptyDraft(),
        exercises: [{ key: "k", exerciseId: null, name: "A", muscleGroup: null, sets: [{ weight: "важко", reps: null }] }],
      },
    });
    expect(parseDraft(bad, UID)!.draft.exercises[0].sets[0].weight).toBeNull();
  });
  it("вправа без підходів отримує один порожній", () => {
    const bad = JSON.stringify({
      v: 1,
      userId: UID,
      savedAt: "x",
      draft: {
        ...emptyDraft(),
        exercises: [{ key: "k", exerciseId: null, name: "A", muscleGroup: null, sets: [] }],
      },
    });
    expect(parseDraft(bad, UID)!.draft.exercises[0].sets).toEqual([{ weight: null, reps: null }]);
  });
});

describe("draftSummary", () => {
  const stored = (draft: DraftWorkout): StoredDraft => ({
    v: 1,
    userId: UID,
    savedAt: AT.toISOString(),
    draft,
  });

  it("рахує лише названі вправи і додає дату", () => {
    const d = emptyDraft();
    d.exercises = [
      { key: "a", exerciseId: null, name: "Присідання", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "b", exerciseId: null, name: "Жим", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "c", exerciseId: null, name: "", muscleGroup: null, sets: [{ weight: null, reps: null }] },
    ];
    expect(draftSummary(stored(d))).toBe("2 вправи · 12 серпня");
  });
  it("одна вправа — однина", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(draftSummary(stored(d))).toBe("1 вправа · 12 серпня");
  });
  it("пʼять вправ — множина", () => {
    const d = emptyDraft();
    d.exercises = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      exerciseId: null,
      name: `Вправа ${i}`,
      muscleGroup: null,
      sets: [{ weight: null, reps: 5 }],
    }));
    expect(draftSummary(stored(d))).toBe("5 вправ · 12 серпня");
  });
  it("назва шаблону йде першою, коли відома", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(draftSummary(stored(d), "Ноги")).toBe("Ноги · 1 вправа · 12 серпня");
  });
});
```

- [ ] **Step 2: Запустити тести, переконатись що падають**

Run: `npm test -- src/lib/workout-draft.test.ts`
Expected: FAIL — `Failed to resolve import "./workout-draft"`.

- [ ] **Step 3: Написати модуль**

Створити `src/lib/workout-draft.ts`:

```ts
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
    // обнуляється щосесії, тож ключі зі старої сесії покладались би на
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
```

- [ ] **Step 4: Запустити тести, переконатись що проходять**

Run: `npm test -- src/lib/workout-draft.test.ts`
Expected: PASS, усі 22 тести.

- [ ] **Step 5: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 6: Коміт**

```bash
git add src/lib/workout-draft.ts src/lib/workout-draft.test.ts
git commit -m "$(cat <<'EOF'
feat(workouts): модуль чернетки незакінченого тренування

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Автозбереження й відновлення в редакторі

**Files:**
- Create: `src/components/workouts/DraftResumeSheet.tsx`
- Modify: `src/components/workouts/WorkoutSessionEditor.tsx`

**Interfaces:**
- Consumes з Task 1: `readDraft`, `writeDraft`, `clearDraft`, `isDraftMeaningful`, `draftSummary`, `StoredDraft`.
- Consumes наявне: `Sheet` і `Button` з `@/components/ui` (`Sheet` приймає `open`, `onClose`, `title`, `subtitle`, `children`).
- Produces: `DraftResumeSheet({ stored, routineName, onResume, onFresh, onCancel })`.

- [ ] **Step 1: Створити шіт**

Створити `src/components/workouts/DraftResumeSheet.tsx`:

```tsx
"use client";

import { Button, Sheet } from "@/components/ui";
import { draftSummary, type StoredDraft } from "@/lib/workout-draft";

/**
 * Пропозиція продовжити незакінчене тренування. Живе в редакторі, а не на
 * кнопці вкладки: у редактор можна зайти й повз неї — перезавантаженням PWA
 * прямо на /workouts/new, кнопкою «назад», з історії браузера. Тут перевірка
 * одна на всі входи.
 */
export function DraftResumeSheet({
  stored,
  routineName,
  onResume,
  onFresh,
  onCancel,
}: {
  stored: StoredDraft;
  routineName: string | null;
  onResume: () => void;
  onFresh: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onCancel}
      title="Незакінчене тренування"
      subtitle={draftSummary(stored, routineName)}
    >
      <div className="flex flex-col gap-3">
        <Button type="button" onClick={onResume}>
          Продовжити
        </Button>
        <Button type="button" variant="outline" onClick={onFresh}>
          Почати нове
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Додати імпорти й стан у редактор**

У `src/components/workouts/WorkoutSessionEditor.tsx` додати до наявних імпортів:

```tsx
import { DraftResumeSheet } from "@/components/workouts/DraftResumeSheet";
import {
  clearDraft,
  isDraftMeaningful,
  readDraft,
  writeDraft,
  type StoredDraft,
} from "@/lib/workout-draft";
```

Одразу після `const [error, setError] = useState<string | null>(null);` (рядок ~53) додати:

```tsx
  const [uid, setUid] = useState<string | null>(null);
  // чернетка, знайдена в сховищі: поки вона тут, над редактором висить шіт
  const [stored, setStored] = useState<StoredDraft | null>(null);
  // "pending" — рішення про чернетку ще не ухвалене, автозбереження мовчить,
  // щоб порожня форма під шітом не затерла знайдену чернетку
  const [decision, setDecision] = useState<"pending" | "resume" | "fresh">(
    workoutId ? "fresh" : "pending",
  );
```

- [ ] **Step 3: Читати чернетку в ефекті завантаження**

У тому ж файлі замінити блок усередині першого `useEffect` (рядки ~59–68):

```tsx
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
```

на:

```tsx
        const { data: u } = await supabase.auth.getUser();
        const id = u.user?.id;
        if (!id) throw new Error("no-user");
        const [ex, rt] = await Promise.all([loadExercises(supabase, id), loadRoutines(supabase, id)]);
        setUid(id);
        setExercises(ex);
        setRoutines(rt);
        if (workoutId) {
          const d = await loadWorkoutDraft(supabase, id, workoutId);
          if (d) setDraft(d);
        } else {
          const found = readDraft(id);
          if (found) setStored(found);
          else setDecision("fresh");
        }
```

- [ ] **Step 4: Додати ефект автозбереження**

Одразу після цього `useEffect` (перед `function patch`) додати:

```tsx
  // Автозбереження чернетки. Дебаунс 400 мс: набір ваги в SetRow міняє draft
  // на кожне натискання клавіші, а серіалізація всієї сесії на кожен символ
  // тут не потрібна.
  useEffect(() => {
    if (workoutId || loading || decision === "pending" || !uid) return;
    const timer = setTimeout(() => {
      if (isDraftMeaningful(draft)) writeDraft(draft, uid);
      // юзер стер усе назад до порожнього — незакінченого більше нема
      else clearDraft();
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, workoutId, loading, decision, uid]);
```

- [ ] **Step 5: Додати обробники рішень**

Після функції `move` (рядок ~95) додати:

```tsx
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
```

- [ ] **Step 6: Чистити чернетку після збереження**

У `onSave` замінити:

```tsx
      await saveWorkout(supabase, uid, draft, workoutId);
      setSaveState("saved");
```

на:

```tsx
      await saveWorkout(supabase, uid, draft, workoutId);
      clearDraft();
      setSaveState("saved");
```

Примітка: у `onSave` є власна локальна `const uid`, оголошена рядком вище — вона затінює стан `uid` і лишається як є, ця частина не змінюється.

- [ ] **Step 7: Відрендерити шіт**

У кінці JSX, безпосередньо перед закривним `</div>` кореневого блоку (після кнопки «Видалити тренування»), додати:

```tsx
      {stored && (
        <DraftResumeSheet
          stored={stored}
          routineName={routines.find((r) => r.id === stored.draft.routineId)?.name ?? null}
          onResume={resumeDraft}
          onFresh={startFresh}
          onCancel={() => router.back()}
        />
      )}
```

- [ ] **Step 8: Перевірити типи, лінт і збірку**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: без помилок і попереджень.

Якщо лінт свариться на `react-hooks/exhaustive-deps` у новому ефекті — список залежностей уже повний (`draft`, `workoutId`, `loading`, `decision`, `uid`); не додавати `// eslint-disable`, а розібратись, чого саме бракує.

- [ ] **Step 9: Перевірити вручну**

Run: `npm run dev`, відкрити `/workouts`.

1. «+ Нове тренування» → тапнути шаблон → вийти назад, не зберігаючи.
2. Знову «+ Нове тренування» → має зʼявитись шіт «Незакінчене тренування» з підписом «‹назва шаблону› · N вправ · сьогодні».
3. «Продовжити» → форма заповнена шаблоном, шіт зник.
4. Заповнити підхід, зберегти → повернуло на `/workouts`; знову «+ Нове» → шіта нема (чернетку почищено).
5. Повторити крок 1, потім «Почати нове» → форма порожня; вийти й зайти знову → шіта нема.
6. Повторити крок 1, потім «Скасувати» → повернуло на `/workouts`; зайти знову → шіт на місці.
7. Відкрити `/workouts/new`, нічого не чіпати, вийти → шіта наступного разу нема (поріг «змістовної зміни» не пройдено).

- [ ] **Step 10: Коміт**

```bash
git add src/components/workouts/DraftResumeSheet.tsx src/components/workouts/WorkoutSessionEditor.tsx
git commit -m "$(cat <<'EOF'
feat(workouts): автозбереження й відновлення чернетки в редакторі

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Картка незакінченого на вкладці

**Files:**
- Create: `src/components/workouts/UnfinishedWorkoutCard.tsx`
- Modify: `src/app/(app)/workouts/page.tsx`

**Interfaces:**
- Consumes з Task 1: `readDraft`, `clearDraft`, `draftSummary`, `StoredDraft`.
- Produces: `UnfinishedWorkoutCard({ stored, onDiscard })`.

- [ ] **Step 1: Створити картку**

Створити `src/components/workouts/UnfinishedWorkoutCard.tsx`:

```tsx
"use client";

import { draftSummary, type StoredDraft } from "@/lib/workout-draft";
import Link from "next/link";

/**
 * Незбережене тренування над архівом. Назви шаблону не показує: сторінка
 * «Тренування» не вантажить `routines`, а окремий запит заради одного
 * підпису того не вартий — шаблон буде видно в шіті вже в редакторі.
 */
export function UnfinishedWorkoutCard({
  stored,
  onDiscard,
}: {
  stored: StoredDraft;
  onDiscard: () => void;
}) {
  return (
    // не Card: «Відкинути» йде окремим рядком впритул до країв, а Card має p-4
    <div className="overflow-hidden rounded-xl2 border-[1.5px] border-primary-light bg-surface shadow-card">
      <Link
        href="/workouts/new"
        className="flex items-center gap-3 px-4 py-[13px] transition active:bg-primary-light"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-extrabold text-ink">Незакінчене тренування</div>
          <div className="truncate text-[12px] font-semibold text-muted">
            {draftSummary(stored)}
          </div>
        </div>
        <span aria-hidden className="shrink-0 text-[16px] font-bold text-muted">
          ›
        </span>
      </Link>
      <button
        type="button"
        onClick={onDiscard}
        className="w-full border-t border-primary-light py-[10px] text-[12.5px] font-bold text-muted transition active:bg-primary-light"
      >
        Відкинути
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Підключити картку на сторінці**

У `src/app/(app)/workouts/page.tsx` додати імпорти:

```tsx
import { UnfinishedWorkoutCard } from "@/components/workouts/UnfinishedWorkoutCard";
import { clearDraft, readDraft, type StoredDraft } from "@/lib/workout-draft";
```

Після `const [moreError, setMoreError] = useState<string | null>(null);` (рядок ~38) додати:

```tsx
  const [draft, setDraft] = useState<StoredDraft | null>(null);
```

У першому `useEffect`, одразу після `setUid(id);` додати:

```tsx
        // читаємо тут, а не в тілі рендера: localStorage недоступний на
        // сервері, і читання під час рендера дало б розбіжність гідрації
        setDraft(readDraft(id));
```

- [ ] **Step 3: Відрендерити картку над списком і над порожнім станом**

У тому ж файлі замінити:

```tsx
      <Button type="button" onClick={() => router.push("/workouts/new")}>
        + Нове тренування
      </Button>

      {error && <ErrorBanner>{error}</ErrorBanner>}
```

на:

```tsx
      <Button type="button" onClick={() => router.push("/workouts/new")}>
        + Нове тренування
      </Button>

      {/* поза гілкою `items.length === 0`: незакінчене показуємо й тоді,
          коли архів іще порожній */}
      {draft && (
        <UnfinishedWorkoutCard
          stored={draft}
          onDiscard={() => {
            clearDraft();
            setDraft(null);
          }}
        />
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}
```

- [ ] **Step 4: Перевірити типи, лінт і збірку**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: без помилок.

- [ ] **Step 5: Перевірити вручну**

Run: `npm run dev`

1. Створити чернетку (нове тренування → тапнути шаблон → вийти назад).
2. На `/workouts` під кнопкою «+ Нове тренування» — картка «Незакінчене тренування · N вправ · сьогодні».
3. Тап по картці → редактор із шітом відновлення.
4. «Відкинути» на картці → картка зникає без переходу; перезавантажити сторінку — картки нема.
5. Зберегти чернетку як тренування → після повернення на `/workouts` картки нема, сесія зʼявилась в «Історії».
6. Перевірити темну тему (`/settings`) — рамка й текст картки читаються.

- [ ] **Step 6: Прогнати весь набір тестів**

Run: `npm test`
Expected: PASS, усі файли.

- [ ] **Step 7: Коміт**

```bash
git add src/components/workouts/UnfinishedWorkoutCard.tsx "src/app/(app)/workouts/page.tsx"
git commit -m "$(cat <<'EOF'
feat(workouts): картка незакінченого тренування на вкладці

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Покриття спеки

| Вимога спеки | Задача |
|---|---|
| `StoredDraft` з `v` / `userId` / `savedAt` | 1 |
| `isDraftMeaningful` — поріг змістовної зміни | 1 |
| `parseDraft` — санітизація, версія, чужий `userId`, перегенерація ключів | 1 |
| `readDraft` / `writeDraft` / `clearDraft` у `try/catch` | 1 |
| Автозбереження з дебаунсом, тільки для нового тренування | 2 |
| `clearDraft()` після успішного сейву | 2 |
| Шіт відновлення в редакторі, три дії | 2 |
| Обнулення мертвого `routineId` при відновленні | 2 |
| Картка на вкладці, «Відкинути», показ над `EmptyState` | 3 |
| Тести чистої логіки | 1 |
