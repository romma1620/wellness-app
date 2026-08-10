# Максимальна вага вправи в редакторі — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** У редакторі тренування під назвою кожної вправи видно максимальну вагу, яку юзер у ній брав, і рядок стає акцентним, щойно введена вага цей максимум перевищує.

**Architecture:** Агрегація — в БД: новий RPC `exercise_maxes(p_exclude_workout)` віддає найкращий підхід по кожній вправі юзера одним запитом. `loadExerciseMaxes` перетворює його на `Map<exercise_id, ExerciseMax>`, яку `WorkoutSessionEditor` вантажить у наявному `Promise.all` на маунті. Вирішує, що саме показати, чиста функція `prState(max, sets)` у `src/lib/workouts.ts` — вона й покривається тестами; `ExerciseMaxLine` лише рендерить її результат.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind, Supabase (PostgREST + RPC), Vitest.

Спека: `docs/superpowers/specs/2026-08-11-exercise-max-weight-design.md`

## Global Constraints

- Мова всього UI-тексту й коментарів у коді — українська.
- Тести — тільки на чисту логіку (`src/**/*.test.ts`, `environment: "node"`). UI перевіряється `npm run typecheck`, `npm run lint`, `npm run build` і вручну. Не писати тестів на React-компоненти.
- Фіча живе **тільки** в `WorkoutSessionEditor`. `ExercisePicker`, `WorkoutProgress`, `WorkoutList` і сторінки не чіпаються.
- Жодних емодзі й жодних нових залежностей. Усі іконки в кодбейсі — inline SVG; тут іконки немає взагалі.
- Кольори — тільки токени Tailwind з `tailwind.config.ts` (`text-muted`, `text-pos`). Ніяких hex-значень у компонентах.
- Числа форматуються через `fmt()` з `@/lib/utils` (українська локаль, кома як десятковий роздільник), дати — через `shortDate()`.
- Гілка вже створена: `feat/exercise-max-weight`. Коміти — conventional commits, з `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` в кінці.
- `supabase/schema.sql` — єдине джерело схеми, окремих файлів міграцій у проєкті немає. Новий RPC дописується туди; застосувати його до живої бази має користувач вручну (крок у Task 2).

---

## File Structure

| Файл | Відповідальність |
|---|---|
| `src/lib/workouts.ts` (правки) | Тип `ExerciseMax`, тип `PrState`, чиста функція `prState` |
| `src/lib/workouts.test.ts` (правки) | Тести `prState` |
| `supabase/schema.sql` (правки) | RPC `exercise_maxes(p_exclude_workout)` |
| `src/lib/workouts-db.ts` (правки) | `loadExerciseMaxes` — виклик RPC і збірка мапи |
| `src/components/workouts/ExerciseMaxLine.tsx` (новий) | Рендер рядка рекорду; жодної логіки, крім виклику `prState` |
| `src/components/workouts/WorkoutSessionEditor.tsx` (правки) | Стан `maxes`, завантаження в `Promise.all`, рендер рядка в картці вправи |

Порядок задач: чиста логіка → доступ до даних → UI. Кожна задача самодостатня й компілюється окремо.

---

## Task 1: Чиста логіка `prState`

**Files:**
- Modify: `src/lib/workouts.ts` (додати після `bestSet`, тобто після рядка 121)
- Test: `src/lib/workouts.test.ts`

**Interfaces:**
- Consumes: `DraftSet` — уже оголошений у цьому ж файлі (`{ weight: number | null; reps: number | null }`).
- Produces:
  - `interface ExerciseMax { weight: number; reps: number; date: string }`
  - `type PrState = { kind: "none" } | { kind: "record"; max: ExerciseMax } | { kind: "beaten"; delta: number }`
  - `function prState(max: ExerciseMax | null, sets: DraftSet[]): PrState`

- [ ] **Step 1: Написати тести, що падають**

У `src/lib/workouts.test.ts` додати `prState` і тип `ExerciseMax` до наявного імпорту з `"./workouts"` (список імпорту відсортований за абеткою, типи — в кінці через `type`), а в кінець файлу дописати блок:

```ts
describe("prState", () => {
  const MAX: ExerciseMax = { weight: 80, reps: 5, date: "2026-06-12" };
  const set = (weight: number | null, reps: number | null): DraftSet => ({ weight, reps });

  it("немає історії — стан none", () => {
    expect(prState(null, [set(100, 5)])).toEqual({ kind: "none" });
  });

  it("порожні підходи — показує рекорд", () => {
    expect(prState(MAX, [set(null, null)])).toEqual({ kind: "record", max: MAX });
  });

  it("вага нижча за рекорд — показує рекорд", () => {
    expect(prState(MAX, [set(75, 8)])).toEqual({ kind: "record", max: MAX });
  });

  it("вага, що дорівнює рекорду, рекордом не є", () => {
    expect(prState(MAX, [set(80, 8)])).toEqual({ kind: "record", max: MAX });
  });

  it("вага вища за рекорд — новий рекорд із дельтою", () => {
    expect(prState(MAX, [set(82.5, 3)])).toEqual({ kind: "beaten", delta: 2.5 });
  });

  it("дельта рахується від найбільшої ваги в картці, а не від останнього підходу", () => {
    expect(prState(MAX, [set(90, 3), set(70, 8)])).toEqual({ kind: "beaten", delta: 10 });
  });

  it("підхід із вагою й без повторів усе одно рахується", () => {
    expect(prState(MAX, [set(85, null)])).toEqual({ kind: "beaten", delta: 5 });
  });

  it("підхід із повторами й без ваги ігнорується", () => {
    expect(prState(MAX, [set(null, 12)])).toEqual({ kind: "record", max: MAX });
  });

  it("порожній масив підходів — показує рекорд", () => {
    expect(prState(MAX, [])).toEqual({ kind: "record", max: MAX });
  });
});
```

Імпорт має включати `prState` серед функцій і `type DraftSet`, `type ExerciseMax` серед типів.

- [ ] **Step 2: Запустити тести й переконатися, що вони падають**

Run: `npm test -- src/lib/workouts.test.ts`
Expected: FAIL — TypeScript/Vitest не знаходить експорту `prState` у `./workouts`.

- [ ] **Step 3: Реалізувати**

У `src/lib/workouts.ts` одразу після функції `bestSet` (рядок 121) додати:

```ts
/** Найкращий підхід вправи за всю історію. Існує тільки для вправ із вагою. */
export interface ExerciseMax {
  weight: number;
  reps: number;
  date: string; // YYYY-MM-DD
}

/** Що показує рядок рекорду під назвою вправи в редакторі. */
export type PrState =
  | { kind: "none" }
  | { kind: "record"; max: ExerciseMax }
  | { kind: "beaten"; delta: number };

/**
 * Стан рядка рекорду для однієї вправи редактора.
 *
 * У розрахунок ідуть підходи з введеною вагою незалежно від повторів: вагу
 * набирають першою, і чекати на повтори означало б показувати «новий рекорд»
 * аж після заповнення всього рядка, тобто запізно. Плата — підхід із вагою
 * і без повторів дасть «рекорд», хоча saveWorkout його відкине; це видно
 * лише всередині незбереженого редактора.
 *
 * Рівність рекорду рекордом не вважається.
 */
export function prState(max: ExerciseMax | null, sets: DraftSet[]): PrState {
  if (!max) return { kind: "none" };
  let top = -Infinity;
  for (const s of sets) {
    if (s.weight != null && Number.isFinite(s.weight) && s.weight > top) top = s.weight;
  }
  return top > max.weight ? { kind: "beaten", delta: top - max.weight } : { kind: "record", max };
}
```

- [ ] **Step 4: Запустити тести й переконатися, що вони проходять**

Run: `npm test -- src/lib/workouts.test.ts`
Expected: PASS — усі 9 нових тестів `prState` зелені, наявні тести файлу не зламані.

- [ ] **Step 5: Перевірити типи**

Run: `npm run typecheck`
Expected: без помилок.

- [ ] **Step 6: Коміт**

```bash
git add src/lib/workouts.ts src/lib/workouts.test.ts
git commit -m "feat(workouts): prState — стан рядка рекорду вправи

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: RPC `exercise_maxes` і завантаження мапи рекордів

**Files:**
- Modify: `supabase/schema.sql` (після функції `used_exercises()`, рядок 325)
- Modify: `src/lib/workouts-db.ts` (імпорт типів угорі; нова функція після `loadUsedExercises`, рядок 67)

**Interfaces:**
- Consumes: `ExerciseMax` з `@/lib/workouts` (Task 1); наявний локальний аліас `type SB = SupabaseClient`.
- Produces: `function loadExerciseMaxes(sb: SB, excludeWorkoutId: string | null): Promise<Map<string, ExerciseMax>>` — ключ мапи це `exercise_id`.

Тестів немає: це шар доступу до даних, який за конвенцією проєкту (`src/lib/*-db.ts`) не покривається vitest. Перевірка — typecheck, build і ручний прогін у Task 3.

- [ ] **Step 1: Додати RPC у схему**

У `supabase/schema.sql` одразу після тіла функції `used_exercises()` (після рядка `$$;`, рядок 325) і **перед** коментарем про `workout_sets_exercise_idx` вставити:

```sql
-- Рекорд кожної вправи: підхід із найбільшою вагою за всю історію юзера.
-- Порядок дзеркалить bestSet() зі src/lib/workouts.ts (макс. вага, тай-брейк —
-- більше повторів); третій ключ по даті потрібен лише для детермінованості
-- achieved_on, коли та сама вага × повтори траплялися в кількох сесіях.
--
-- p_exclude_workout виключає сесію, яку зараз редагують: її підходи вже в базі,
-- і без виключення рекордом вважалося б рівно те, що юзер щойно ввів.
create or replace function public.exercise_maxes(p_exclude_workout uuid default null)
returns table (exercise_id uuid, weight numeric, reps integer, achieved_on date)
language sql
stable
security invoker
as $$
  select distinct on (s.exercise_id) s.exercise_id, s.weight, s.reps, w.date
  from public.workout_sets s
  join public.workouts w on w.id = s.workout_id
  where w.user_id = auth.uid()
    and s.weight is not null
    and (p_exclude_workout is null or w.id <> p_exclude_workout)
  order by s.exercise_id, s.weight desc, s.reps desc, w.date desc;
$$;
```

Далі оновити коментар над наявним індексом — він тепер обслуговує й новий RPC. Замінити:

```sql
-- Під used_exercises() і вибірку сетів однієї вправи для графіка.
```

на:

```sql
-- Під used_exercises(), exercise_maxes() і вибірку сетів однієї вправи для графіка.
```

- [ ] **Step 2: Застосувати схему до бази**

Це ручний крок — у проєкті немає інструмента міграцій. Виконати щойно доданий блок `create or replace function public.exercise_maxes ...` у SQL Editor свого Supabase-проєкту.

Перевірка прямо в SQL Editor:

```sql
select * from public.exercise_maxes() limit 5;
```

Expected: таблиця з колонками `exercise_id, weight, reps, achieved_on`. Порожній результат теж валідний — він означає, що в жодного підходу немає ваги.

- [ ] **Step 3: Додати завантажувач на клієнті**

У `src/lib/workouts-db.ts` дописати `type ExerciseMax` до наявного імпорту з `"@/lib/workouts"` (типи в тому імпорті йдуть за абеткою: `DraftExercise`, `DraftWorkout`, `ExerciseMax`, `ExerciseSet`, `MonthTotal`, `UsedExercise`, `WorkoutListItem`).

Одразу після `loadUsedExercises` (рядок 67) додати:

```ts
/**
 * Рекорди по всіх вправах юзера одним запитом: exercise_id → найкращий підхід.
 * Одним, а не по вправі: вправ у юзера десятки, а ліниве довантаження давало б
 * затримку після кожного вибору вправи й N запитів на застосування шаблону.
 *
 * `excludeWorkoutId` — сесія, яку зараз редагують; її підходи не рахуються.
 */
export async function loadExerciseMaxes(
  sb: SB,
  excludeWorkoutId: string | null,
): Promise<Map<string, ExerciseMax>> {
  const { data, error } = await sb.rpc("exercise_maxes", {
    p_exclude_workout: excludeWorkoutId,
  });
  if (error) throw error;
  const map = new Map<string, ExerciseMax>();
  for (const r of (data ?? []) as any[]) {
    // weight — numeric, а такі PostgREST віддає рядком; те саме робить loadMonthTotals
    map.set(r.exercise_id as string, {
      weight: Number(r.weight),
      reps: Number(r.reps),
      date: r.achieved_on as string,
    });
  }
  return map;
}
```

- [ ] **Step 4: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок. (`any` у циклі відповідає наявному стилю файлу — так само типізовані `loadMonthTotals` і `loadUsedExercises`.)

- [ ] **Step 5: Коміт**

```bash
git add supabase/schema.sql src/lib/workouts-db.ts
git commit -m "feat(workouts): RPC exercise_maxes і завантаження мапи рекордів

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Рядок рекорду в картці вправи

**Files:**
- Create: `src/components/workouts/ExerciseMaxLine.tsx`
- Modify: `src/components/workouts/WorkoutSessionEditor.tsx` (імпорти; стан; `Promise.all` у рядках 78–81; блок хедера вправи, рядки 276–309)

**Interfaces:**
- Consumes: `prState`, `type ExerciseMax`, `type DraftSet` з `@/lib/workouts` (Task 1); `loadExerciseMaxes` з `@/lib/workouts-db` (Task 2); `fmt`, `shortDate` з `@/lib/utils`.
- Produces: `function ExerciseMaxLine({ max, sets }: { max: ExerciseMax | null; sets: DraftSet[] })`.

- [ ] **Step 1: Створити компонент**

Створити `src/components/workouts/ExerciseMaxLine.tsx`:

```tsx
"use client";

import { fmt, shortDate } from "@/lib/utils";
import { prState, type DraftSet, type ExerciseMax } from "@/lib/workouts";

/**
 * Підпис під назвою вправи: історичний максимум ваги, а коли введена вага його
 * перевищує — той самий рядок стає акцентним. Розмір шрифту в обох станах
 * однаковий, тож підходи під ним не стрибають під час набору.
 *
 * Стану «немає даних» не існує: рядок просто не рендериться, бо «—» додало б
 * шуму рівно там, де інформації нема.
 */
export function ExerciseMaxLine({ max, sets }: { max: ExerciseMax | null; sets: DraftSet[] }) {
  const state = prState(max, sets);

  if (state.kind === "none") return null;

  if (state.kind === "beaten") {
    return (
      <div className="mt-1.5 text-[12px] font-extrabold text-pos">
        Новий рекорд · +{fmt(state.delta, 1)} кг
      </div>
    );
  }

  return (
    <div className="mt-1.5 text-[12px] font-semibold text-muted">
      Макс {fmt(state.max.weight, 1)} кг × {state.max.reps} · {shortDate(state.max.date)}
    </div>
  );
}
```

- [ ] **Step 2: Підключити імпорти й стан у редакторі**

У `src/components/workouts/WorkoutSessionEditor.tsx`:

Додати до імпортів компонентів (поряд із `ExerciseAutocomplete`, рядок 4):

```tsx
import { ExerciseMaxLine } from "@/components/workouts/ExerciseMaxLine";
```

До імпорту з `@/lib/workouts` (рядки 18–23) додати тип `ExerciseMax`, щоб вийшло:

```tsx
import {
  newDraftExercise,
  newDraftSet,
  type DraftExercise,
  type DraftWorkout,
  type ExerciseMax,
} from "@/lib/workouts";
```

До імпорту з `@/lib/workouts-db` (рядки 24–31) додати `loadExerciseMaxes` (список відсортований за абеткою — одразу після `deleteWorkout`):

```tsx
import {
  deleteWorkout,
  loadExerciseMaxes,
  loadExercises,
  loadRoutineExercises,
  loadRoutines,
  loadWorkoutDraft,
  saveWorkout,
} from "@/lib/workouts-db";
```

Поряд із наявним `const [exercises, setExercises] = useState<Exercise[]>([]);` (рядок 57) додати:

```tsx
  const [maxes, setMaxes] = useState<Map<string, ExerciseMax>>(() => new Map());
```

- [ ] **Step 3: Завантажити мапу в наявному `Promise.all`**

У `useEffect` маунта замінити рядки 78–81:

```tsx
        const [ex, rt] = await Promise.all([loadExercises(supabase, id), loadRoutines(supabase, id)]);
        setUid(id);
        setExercises(ex);
        setRoutines(rt);
```

на:

```tsx
        const [ex, rt, mx] = await Promise.all([
          loadExercises(supabase, id),
          loadRoutines(supabase, id),
          loadExerciseMaxes(supabase, workoutId),
        ]);
        setUid(id);
        setExercises(ex);
        setRoutines(rt);
        setMaxes(mx);
```

Запит іде в тому самому `Promise.all`, тож додаткової затримки на маунті немає. Помилка RPC потрапляє в наявний `catch` і дає загальний банер «Не вдалося завантажити дані» — окремої обробки не додаємо.

- [ ] **Step 4: Вставити рядок у картку вправи**

Замінити блок хедера вправи (рядки 276–309) — увесь `<div className="mb-3 flex items-center gap-2">…</div>` — на:

```tsx
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
            <ExerciseMaxLine
              max={ex.exerciseId ? (maxes.get(ex.exerciseId) ?? null) : null}
              sets={ex.sets}
            />
          </div>
```

Що змінилось: `mb-3` переїхав із флекс-рядка на новий зовнішній `div`, а рядок рекорду став другим дитям цього ж блоку з `mt-1.5`. Так підпис тісно тулиться до поля назви (він про неї), а відступ до першого підходу лишається тим самим, що й раніше — і однаковим для вправ із рекордом та без.

`maxes.get()` викликається лише коли `ex.exerciseId` не `null`: поки юзер друкує нову назву, привʼязки до довідника ще немає, і рядок не показується.

- [ ] **Step 5: Перевірити збірку**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: тести зелені, типів і лінту без помилок, білд успішний.

- [ ] **Step 6: Ручна перевірка**

Запустити `npm run dev` і на `/workouts/new`:

1. Обрати зі списку вправу, яку вже робив із вагою → під полем назви зʼявляється `Макс 80 кг × 5 · 12 черв` сірим.
2. Ввести в перший підхід вагу, меншу за максимум → рядок не змінюється.
3. Ввести вагу, рівну максимуму → рядок не змінюється.
4. Ввести вагу, більшу за максимум → рядок стає зеленим: `Новий рекорд · +2,5 кг`; підходи під ним не зсуваються.
5. Стерти вагу → рядок повертається до сірого максимуму.
6. Надрукувати назву нової вправи, не обираючи зі списку → рядка немає.
7. Обрати вправу, яку робив тільки з власною вагою (без ваги в підходах) → рядка немає.
8. Відкрити на редагування збережену сесію (`/workouts/<id>`), у якій стоїть особистий рекорд вправи → рядок показує **попередній** максимум, а не той, що в цій сесії; введена в ній вага одразу підсвічується як новий рекорд.
9. Перевірити в темній темі, що `text-pos` читабельний.

- [ ] **Step 7: Коміт**

```bash
git add src/components/workouts/ExerciseMaxLine.tsx src/components/workouts/WorkoutSessionEditor.tsx
git commit -m "feat(workouts): рядок максимальної ваги в картці вправи

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Покриття спеки

| Розділ спеки | Задача |
|---|---|
| RPC `exercise_maxes`, `p_exclude_workout`, порядок сортування | Task 2, Step 1 |
| `ExerciseMax`, `PrState`, `prState` та їх семантика | Task 1 |
| `loadExerciseMaxes` і приведення `numeric` | Task 2, Step 3 |
| Рендер, три стани, класи, відсутність іконки | Task 3, Steps 1, 4 |
| Підключення в редакторі, `Promise.all`, читання за `exerciseId` | Task 3, Steps 2–4 |
| Крайні випадки з таблиці спеки | Task 1 (тести), Task 3, Step 6 (ручна перевірка) |
| Тести `prState` | Task 1, Step 1 |
