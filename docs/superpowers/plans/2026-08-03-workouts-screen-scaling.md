# Масштабування екрана «Тренування» — план впровадження

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Екран `/workouts` має відкриватись і гортатись однаково швидко за 10 і за 500 сесій: прогрес зверху, архів — компактними місячними групами з довантаженням, важкі агрегати рахує база.

**Architecture:** Один запит «усе одразу» (`loadWorkoutsWithSets`) розпадається на чотири вузькі: два RPC-агрегати (місячні підсумки, використані вправи) і два звичайних PostgREST-запити (сторінка списку за діапазоном дат, сети однієї вправи). Пагінація йде по цілих календарних місяцях, тож заголовок групи ніколи не суперечить кількості показаних рядків. UI ділиться на чотири компоненти з чіткими межами: `WorkoutProgress` (вибір вправи + графік), `ExercisePicker` (панель вибору), `WorkoutList` (місячні групи), `WorkoutsSkeleton` (плейсхолдер).

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind 3, Supabase (PostgREST + RPC), recharts, vitest.

## Global Constraints

- Тестами (vitest) покривається **лише чиста логіка** — `src/lib/*.ts`. UI перевіряється через `npm run typecheck`, `npm run lint`, `npm run build` і ручну перевірку на мобільній ширині.
- Уся копія — українською. Числівники відмінюються (`5 вправ`, `2 вправи`, `1 вправа`).
- Примітиви з `src/components/ui.tsx` не змінюються. Якщо консьюмеру треба інша поведінка (висота, скрол) — він реалізує її в себе.
- `Card` має вбудований `p-4`. Там, де потрібні рядки впритул до країв, використовуй голий `div` з `rounded-xl2 bg-surface shadow-card` — так само робить наявний `Collapsible`. Не намагайся перебити `p-4` через `className="p-0"`: у Tailwind виграє порядок у згенерованому CSS, а не порядок у рядку класів.
- Файл схеми `supabase/schema.sql` — декларативний і застосовується цілком; усі об'єкти створюються ідемпотентно (`create or replace`, `if not exists`).
- Дати всюди — ISO-рядки `YYYY-MM-DD`. Парсинг тільки через `parseISODate` з `src/lib/utils.ts` (локальний час, без UTC-зсуву).
- Кожна задача завершується зеленими `npm run typecheck` і `npm test`.

---

### Task 1: SQL-агрегати

**Files:**
- Modify: `supabase/schema.sql` (додати в кінець секції «Тренування», після блоку `workout_sets`)

**Interfaces:**
- Consumes: таблиці `workouts`, `workout_sets`, `exercises` з наявними RLS-політиками.
- Produces: RPC `workout_month_totals()` → рядки `(month_start date, sessions integer, tonnage numeric)`; RPC `used_exercises()` → рядки `(id uuid, name text, muscle_group text, last_used date)`. Обидві — `security invoker`, тобто RLS фільтрує рядки за поточним користувачем так само, як для прямих запитів.

- [ ] **Step 1: Додати функції та індекс у схему**

Додай у кінець `supabase/schema.sql`:

```sql
-- ---------- Агрегати для екрана «Тренування» ----------

-- Тоннаж одного підходу. Дзеркалить setTonnage() з src/lib/workouts.ts:
-- порожня вага = власна вага, тож внесок дорівнює кількості повторів.
create or replace function public.set_tonnage(p_weight numeric, p_reps integer)
returns numeric
language sql
immutable
as $$
  select case
           when p_reps is null then 0
           when p_weight is null then p_reps::numeric
           else p_weight * p_reps
         end;
$$;

-- Місячні підсумки користувача, найновіші спершу.
-- Потрібні, щоб малювати заголовки груп і рахувати пагінацію,
-- не тягнучи весь архів на клієнт.
create or replace function public.workout_month_totals()
returns table (month_start date, sessions integer, tonnage numeric)
language sql
stable
security invoker
as $$
  select date_trunc('month', w.date)::date,
         count(distinct w.id)::integer,
         coalesce(sum(public.set_tonnage(s.weight, s.reps)), 0)
  from public.workouts w
  left join public.workout_sets s on s.workout_id = w.id
  where w.user_id = auth.uid()
  group by 1
  order by 1 desc;
$$;

-- Вправи, що реально трапляються в сесіях, з датою останнього використання.
-- PostgREST не вміє distinct по вкладеному ресурсі, тому це RPC.
create or replace function public.used_exercises()
returns table (id uuid, name text, muscle_group text, last_used date)
language sql
stable
security invoker
as $$
  select e.id, e.name, e.muscle_group, max(w.date)
  from public.exercises e
  join public.workout_sets s on s.exercise_id = e.id
  join public.workouts w on w.id = s.workout_id
  where e.user_id = auth.uid()
  group by e.id, e.name, e.muscle_group
  order by e.name;
$$;

-- Під used_exercises() і вибірку сетів однієї вправи для графіка.
create index if not exists workout_sets_exercise_idx
  on public.workout_sets (exercise_id);
```

- [ ] **Step 2: Застосувати схему і перевірити результат**

Виконай `supabase/schema.sql` у Supabase SQL Editor, потім там же, будучи залогіненим користувачем із даними:

```sql
select * from public.workout_month_totals();
select * from public.used_exercises();
```

Очікування: `workout_month_totals()` повертає по рядку на місяць, найновіший зверху, `sessions` збігається з кількістю тренувань у тому місяці. `used_exercises()` повертає лише вправи, що мають хоч один підхід, відсортовані за назвою.

Якщо запускаєш з SQL Editor від імені сервісної ролі, `auth.uid()` буде `null` і обидві функції повернуть нуль рядків — це очікувано, перевіряй з клієнта застосунку або через `set request.jwt.claims`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): month totals and used-exercises aggregates"
```

---

### Task 2: Чисті хелпери дат і числівників

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts`

**Interfaces:**
- Consumes: наявні `parseISODate`, `toISODate`, приватну константу `MONTHS_NOM`.
- Produces: `monthLabel(isoMonth: string): string`, `monthEnd(isoMonth: string): string`, `weekdayShort(iso: string): string`, `plural(n: number, one: string, few: string, many: string): string`.

- [ ] **Step 1: Написати падаючі тести**

Додай у кінець `src/lib/utils.test.ts`:

```ts
describe("monthLabel", () => {
  it("ISO-місяць → назва в називному + рік", () => {
    expect(monthLabel("2026-08-01")).toBe("Серпень 2026");
  });
  it("працює для будь-якого дня місяця", () => {
    expect(monthLabel("2026-01-31")).toBe("Січень 2026");
  });
});

describe("monthEnd", () => {
  it("останній день 31-денного місяця", () => {
    expect(monthEnd("2026-08-01")).toBe("2026-08-31");
  });
  it("останній день лютого невисокосного року", () => {
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
  });
  it("високосний лютий", () => {
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("weekdayShort", () => {
  it("неділя", () => {
    expect(weekdayShort("2026-08-02")).toBe("нд");
  });
  it("пʼятниця", () => {
    expect(weekdayShort("2026-07-31")).toBe("пт");
  });
});

describe("plural", () => {
  const f = (n: number) => plural(n, "сесія", "сесії", "сесій");
  it("одна", () => expect(f(1)).toBe("сесія"));
  it("дві-чотири", () => {
    expect(f(2)).toBe("сесії");
    expect(f(4)).toBe("сесії");
  });
  it("пʼять і більше", () => expect(f(5)).toBe("сесій"));
  it("11–14 — виняток", () => {
    expect(f(11)).toBe("сесій");
    expect(f(12)).toBe("сесій");
    expect(f(14)).toBe("сесій");
  });
  it("складені числа беруть останню цифру", () => {
    expect(f(21)).toBe("сесія");
    expect(f(22)).toBe("сесії");
    expect(f(25)).toBe("сесій");
  });
  it("нуль", () => expect(f(0)).toBe("сесій"));
});
```

І додай нові імена в наявний імпорт зверху файлу:

```ts
import { monthEnd, monthLabel, plural, splitTags, weekdayShort } from "./utils";
```

- [ ] **Step 2: Запустити тести — мають упасти**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — TypeScript/vitest скаржиться, що `monthLabel`, `monthEnd`, `weekdayShort`, `plural` не експортуються з `./utils`.

- [ ] **Step 3: Реалізувати хелпери**

У `src/lib/utils.ts`, одразу після `shortDate` (близько рядка 92), додай:

```ts
const WEEKDAYS_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

/** "2026-08-02" → "нд" */
export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[parseISODate(iso).getDay()];
}
```

У секції «Періоди», після `periodLabel`, додай:

```ts
/** "2026-08-01" → "Серпень 2026". Приймає будь-який день місяця. */
export function monthLabel(isoMonth: string): string {
  const d = parseISODate(isoMonth);
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

/** Останній день місяця: "2026-08-01" → "2026-08-31". */
export function monthEnd(isoMonth: string): string {
  const d = parseISODate(isoMonth);
  // день 0 наступного місяця = останній день поточного
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
```

Тепер `periodLabel` дублює логіку `monthLabel` — прибери дублювання, замінивши в ньому гілку місяця:

```ts
  if (type === "month") {
    return monthLabel(start);
  }
```

У кінець файлу додай:

```ts
// ----------------------- Числівники -----------------------

/**
 * Українське відмінювання за числом: 1 сесія, 2 сесії, 5 сесій.
 * Числа 11–14 — виняток: попри останню цифру беруть форму «багато».
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 14) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
```

- [ ] **Step 4: Запустити тести — мають пройти**

Run: `npx vitest run src/lib/utils.test.ts && npm run typecheck`
Expected: PASS, typecheck без помилок.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat(utils): month label/end, short weekday, ukrainian plural"
```

---

### Task 3: Типи та чиста логіка списку

**Files:**
- Modify: `src/lib/workouts.ts`
- Test: `src/lib/workouts.test.ts`

**Interfaces:**
- Consumes: `monthEnd` з `src/lib/utils.ts` (Task 2).
- Produces:
  - `interface ExerciseSet { date: string; weight: number | null; reps: number }`
  - `interface WorkoutListItem { id: string; date: string; name: string | null; exerciseCount: number }`
  - `interface MonthTotal { month: string; sessions: number; tonnage: number }`
  - `interface UsedExercise { id: string; name: string; muscleGroup: MuscleGroup | null; lastUsed: string }`
  - `interface MonthGroup { month: string; items: WorkoutListItem[] }`
  - `interface MonthPage { months: number; from: string; to: string }`
  - `groupByMonth(items: WorkoutListItem[]): MonthGroup[]`
  - `pickMonthPage(totals: MonthTotal[], loaded: number, minSessions?: number): MonthPage | null`
  - `remainingSessions(totals: MonthTotal[], loaded: number): number`

Ця задача суто адитивна: нічого наявного не змінює, збірка лишається зеленою.

- [ ] **Step 1: Написати падаючі тести**

Додай у кінець `src/lib/workouts.test.ts`:

```ts
const ITEMS: WorkoutListItem[] = [
  { id: "w1", date: "2026-08-02", name: "Сідниці", exerciseCount: 6 },
  { id: "w2", date: "2026-07-31", name: "Верх", exerciseCount: 5 },
  { id: "w3", date: "2026-07-28", name: "Ноги", exerciseCount: 5 },
];

const TOTALS: MonthTotal[] = [
  { month: "2026-08-01", sessions: 8, tonnage: 62000 },
  { month: "2026-07-01", sessions: 12, tonnage: 91000 },
  { month: "2026-06-01", sessions: 10, tonnage: 78000 },
];

describe("groupByMonth", () => {
  it("розбиває на календарні місяці, зберігаючи порядок", () => {
    const g = groupByMonth(ITEMS);
    expect(g.map((x) => x.month)).toEqual(["2026-08-01", "2026-07-01"]);
    expect(g[0].items.map((i) => i.id)).toEqual(["w1"]);
    expect(g[1].items.map((i) => i.id)).toEqual(["w2", "w3"]);
  });
  it("порожній вхід → порожній вихід", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("pickMonthPage", () => {
  it("бере місяці, доки не набереться мінімум сесій", () => {
    // 8 замало, тож додається липень: 8 + 12 = 20
    expect(pickMonthPage(TOTALS, 0)).toEqual({
      months: 2,
      from: "2026-07-01",
      to: "2026-08-31",
    });
  });
  it("остання сторінка коротша за мінімум", () => {
    expect(pickMonthPage(TOTALS, 2)).toEqual({
      months: 1,
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });
  it("null, коли місяці вичерпано", () => {
    expect(pickMonthPage(TOTALS, 3)).toBeNull();
  });
  it("порожній архів → null", () => {
    expect(pickMonthPage([], 0)).toBeNull();
  });
  it("один місяць покриває мінімум сам по собі", () => {
    expect(pickMonthPage(TOTALS, 1)?.months).toBe(1);
  });
});

describe("remainingSessions", () => {
  it("сума сесій у ще не завантажених місяцях", () => {
    expect(remainingSessions(TOTALS, 2)).toBe(10);
  });
  it("нуль, коли все завантажено", () => {
    expect(remainingSessions(TOTALS, 3)).toBe(0);
  });
});
```

Розшир імпорт зверху файлу:

```ts
import {
  bestSet,
  compareLastTwo,
  epley1rm,
  exerciseSeries,
  exerciseTonnage,
  groupByMonth,
  pickMonthPage,
  remainingSessions,
  routineSeries,
  setTonnage,
  workoutTonnage,
  type LoadedWorkout,
  type MonthTotal,
  type WorkoutListItem,
} from "./workouts";
```

- [ ] **Step 2: Запустити тести — мають упасти**

Run: `npx vitest run src/lib/workouts.test.ts`
Expected: FAIL — `groupByMonth`, `pickMonthPage`, `remainingSessions` не експортуються.

- [ ] **Step 3: Реалізувати типи й функції**

У `src/lib/workouts.ts` онови імпорт зверху:

```ts
import { monthEnd, shortDate } from "@/lib/utils";
```

Додай у секцію «Loaded (from DB)», після `LoadedWorkout`:

```ts
/** Один підхід однієї вправи, з датою сесії. Джерело даних для графіка прогресу. */
export interface ExerciseSet {
  date: string; // YYYY-MM-DD
  weight: number | null;
  reps: number;
}

/** Рядок списку сесій. Ваги й повторів не містить — рядок їх не показує. */
export interface WorkoutListItem {
  id: string;
  date: string;
  name: string | null;
  exerciseCount: number;
}

/** Місячний підсумок з RPC `workout_month_totals`. */
export interface MonthTotal {
  month: string; // YYYY-MM-01
  sessions: number;
  tonnage: number;
}

/** Вправа з RPC `used_exercises` — та, що реально трапляється в сесіях. */
export interface UsedExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  lastUsed: string; // YYYY-MM-DD
}
```

Додай у кінець файлу нову секцію:

```ts
// ----------------------- Місячні групи і пагінація -----------------------

export interface MonthGroup {
  month: string; // YYYY-MM-01
  items: WorkoutListItem[];
}

/**
 * Розбиває сесії на календарні місяці.
 * Очікує вхід, відсортований за спаданням дати — саме так їх віддає база;
 * порядок груп і порядок усередині груп зберігається як є.
 */
export function groupByMonth(items: WorkoutListItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const month = `${item.date.slice(0, 7)}-01`;
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

export interface MonthPage {
  months: number; // скільки місяців додає ця сторінка
  from: string; // ISO, включно
  to: string; // ISO, включно
}

/**
 * Діапазон дат наступної сторінки списку.
 *
 * Пагінація йде цілими місяцями, а не фіксованою кількістю сесій: так
 * кожен показаний місяць завжди повний, і його заголовок («8 сесій») не
 * суперечить кількості рядків під ним. Місяці добираються, доки не
 * набереться `minSessions`, тож рідкі місяці не перетворюють список на
 * низку тапів по «Показати ще».
 *
 * `totals` очікується відсортованим за спаданням місяця, `loaded` — скільки
 * місяців уже показано.
 */
export function pickMonthPage(
  totals: MonthTotal[],
  loaded: number,
  minSessions = 12,
): MonthPage | null {
  if (loaded >= totals.length) return null;
  let sessions = 0;
  let end = loaded;
  while (end < totals.length && sessions < minSessions) {
    sessions += totals[end].sessions;
    end += 1;
  }
  return {
    months: end - loaded,
    from: totals[end - 1].month,
    to: monthEnd(totals[loaded].month),
  };
}

/** Скільки сесій лишилось у ще не завантажених місяцях. */
export function remainingSessions(totals: MonthTotal[], loaded: number): number {
  return totals.slice(loaded).reduce((sum, m) => sum + m.sessions, 0);
}
```

- [ ] **Step 4: Запустити тести — мають пройти**

Run: `npm test && npm run typecheck`
Expected: PASS, typecheck без помилок.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workouts.ts src/lib/workouts.test.ts
git commit -m "feat(workouts): month grouping and page picking"
```

---

### Task 4: Нові запити до бази

**Files:**
- Modify: `src/lib/workouts.ts` (сигнатура `exerciseCount`)
- Modify: `src/lib/workouts-db.ts`
- Modify: `src/app/(app)/workouts/page.tsx` (один рядок — виклик `exerciseCount`)
- Test: `src/lib/workouts.test.ts`

**Interfaces:**
- Consumes: RPC з Task 1; типи `ExerciseSet`, `MonthTotal`, `UsedExercise`, `WorkoutListItem` з Task 3.
- Produces:
  - `exerciseCount(sets: { exercise_id: string }[]): number` — сигнатура змінюється з `LoadedWorkout` на список підходів
  - `loadMonthTotals(sb: SB): Promise<MonthTotal[]>`
  - `loadUsedExercises(sb: SB): Promise<UsedExercise[]>`
  - `loadWorkoutList(sb: SB, uid: string, from: string, to: string): Promise<WorkoutListItem[]>`
  - `loadExerciseSets(sb: SB, uid: string, exerciseId: string): Promise<ExerciseSet[]>`

`loadWorkoutsWithSets` поки лишається, його прибирає Task 8.

- [ ] **Step 1: Написати падаючий тест на нову сигнатуру `exerciseCount`**

`exerciseCount` зараз приймає `LoadedWorkout` і має єдиного споживача — старий рядок списку. Новий маппер працює з сирим масивом підходів, тож функція переїжджає на нього; інакше після Task 8 вона лишилась би мертвим експортом.

Додай у `src/lib/workouts.test.ts`:

```ts
describe("exerciseCount", () => {
  it("рахує різні вправи, а не підходи", () => {
    expect(
      exerciseCount([
        { exercise_id: "sq" },
        { exercise_id: "sq" },
        { exercise_id: "abs" },
      ]),
    ).toBe(2);
  });
  it("нуль для порожнього списку", () => {
    expect(exerciseCount([])).toBe(0);
  });
});
```

Додай `exerciseCount` в імпорт зверху файлу.

- [ ] **Step 2: Запустити тест — має впасти**

Run: `npx vitest run src/lib/workouts.test.ts`
Expected: FAIL — `exerciseCount` не експортується під таким входом (тип `{ exercise_id: string }[]` не підходить під `LoadedWorkout`).

- [ ] **Step 3: Змінити `exerciseCount` і його єдиний виклик**

У `src/lib/workouts.ts` заміни (рядки 70–72):

```ts
/** Скільки різних вправ у наборі підходів. */
export function exerciseCount(sets: { exercise_id: string }[]): number {
  return new Set(sets.map((s) => s.exercise_id)).size;
}
```

У `src/app/(app)/workouts/page.tsx` (рядок 79) заміни виклик на `{exerciseCount(w.sets)} вправ`. Це тимчасовий рядок старого списку — Task 8 його прибере разом із усім блоком.

Запусти `npx vitest run src/lib/workouts.test.ts && npm run typecheck` — має бути зелено.

- [ ] **Step 4: Додати завантажувачі**

У `src/lib/workouts-db.ts` розшир імпорти:

```ts
import type { Exercise, MuscleGroup, Routine, RoutineExercise } from "@/lib/types";
import {
  exerciseCount,
  exerciseTonnage,
  type DraftExercise,
  type DraftWorkout,
  type ExerciseSet,
  type LoadedWorkout,
  type MonthTotal,
  type UsedExercise,
  type WorkoutListItem,
} from "@/lib/workouts";
```

Додай після `loadWorkoutsWithSets`:

```ts
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
    .eq("workouts.user_id", uid);
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    date: s.workouts.date as string,
    weight: s.weight,
    reps: s.reps,
  }));
}
```

`workouts!inner(...)` — обов'язковий inner join: без нього PostgREST віддав би підходи без прив'язки до сесії, і фільтр по `user_id` не спрацював би. Через `!inner` вкладений ресурс приходить об'єктом, а не масивом.

`any` тут відповідає наявному стилю файлу (`loadWorkoutsWithSets` уже так робить) — типи PostgREST для вкладених ресурсів не виводяться коректно.

- [ ] **Step 5: Перевірити збірку**

Run: `npm test && npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workouts.ts src/lib/workouts.test.ts src/lib/workouts-db.ts src/app/\(app\)/workouts/page.tsx
git commit -m "feat(workouts): narrow queries for list, totals and exercise sets"
```

---

### Task 5: Компонент `ExercisePicker`

**Files:**
- Create: `src/components/workouts/ExercisePicker.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Input` з `@/components/ui`; `MUSCLE_GROUPS` з `@/lib/types`; `UsedExercise` з `@/lib/workouts`; `cn` з `@/lib/utils`.
- Produces: `<ExercisePicker exercises={UsedExercise[]} value={string | null} onChange={(id: string) => void} />`

Компонент поки ніде не змонтований — його підключає Task 7.

- [ ] **Step 1: Написати компонент**

Створи `src/components/workouts/ExercisePicker.tsx`:

```tsx
"use client";

import { Input, Sheet } from "@/components/ui";
import { MUSCLE_GROUPS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { UsedExercise } from "@/lib/workouts";
import { useMemo, useState } from "react";

const RECENT_COUNT = 5;

/**
 * Вибір вправи для графіка прогресу.
 *
 * За 50+ вправ хмара чипів займала півекрана над графіком, тож вибір живе
 * в панелі: на екрані лишається один рядок із назвою обраної вправи.
 */
export function ExercisePicker({
  exercises,
  value,
  onChange,
}: {
  exercises: UsedExercise[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = exercises.find((e) => e.id === value);
  const q = query.trim().toLocaleLowerCase("uk");

  const matches = useMemo(
    () => (q ? exercises.filter((e) => e.name.toLocaleLowerCase("uk").includes(q)) : []),
    [exercises, q],
  );

  // Групування рахуємо один раз: воно не залежить від пошуку, бо під час
  // пошуку показується плаский список збігів.
  const sections = useMemo(() => {
    const recent = [...exercises]
      .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
      .slice(0, RECENT_COUNT);
    const byGroup = MUSCLE_GROUPS.map((group) => ({
      title: group,
      items: exercises
        .filter((e) => (e.muscleGroup ?? "інше") === group)
        .sort((a, b) => a.name.localeCompare(b.name, "uk")),
    })).filter((s) => s.items.length > 0);
    return recent.length > 0 ? [{ title: "Нещодавні", items: recent }, ...byGroup] : byGroup;
  }, [exercises]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (id: string) => {
    onChange(id);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-2 rounded-[15px] border-[1.5px] border-primary-light bg-surface px-4 py-[13px] text-left transition active:scale-[.99]"
      >
        <span className="truncate text-[15px] font-extrabold text-ink">
          {selected?.name ?? "Вибери вправу"}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted"
          aria-hidden
        >
          <path d="M5 8l6 6 6-6" />
        </svg>
      </button>

      <Sheet open={open} onClose={close} title="Вправа">
        {/* без autoFocus: на мобільному клавіатура зʼїдала б половину панелі */}
        <Input
          value={query}
          placeholder="Пошук вправи"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 max-h-[55vh] overflow-y-auto">
          {q ? (
            matches.length > 0 ? (
              matches.map((e) => (
                <ExerciseRow key={e.id} exercise={e} active={e.id === value} onPick={pick} />
              ))
            ) : (
              <div className="py-6 text-center text-[13px] font-semibold text-muted">
                Нічого не знайшли
              </div>
            )
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <div className="px-1 pb-1 pt-3 text-[12px] font-bold uppercase text-muted">
                  {section.title}
                </div>
                {section.items.map((e) => (
                  <ExerciseRow key={e.id} exercise={e} active={e.id === value} onPick={pick} />
                ))}
              </div>
            ))
          )}
        </div>
      </Sheet>
    </>
  );
}

function ExerciseRow({
  exercise,
  active,
  onPick,
}: {
  exercise: UsedExercise;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(exercise.id)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[11px] px-3 py-[11px] text-left text-[14px] active:bg-primary-light",
        active ? "font-extrabold text-primary" : "font-semibold text-ink",
      )}
    >
      <span className="truncate">{exercise.name}</span>
      {active && (
        <span aria-hidden className="shrink-0 text-[13px]">
          ✓
        </span>
      )}
    </button>
  );
}
```

Вправа з «Нещодавніх» навмисно дублюється у своїй групі м'язів: це ярлик, а не окремий розділ довідника.

- [ ] **Step 2: Перевірити збірку**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 3: Commit**

```bash
git add src/components/workouts/ExercisePicker.tsx
git commit -m "feat(workouts): exercise picker sheet with search"
```

---

### Task 6: Компоненти `WorkoutList` і `WorkoutsSkeleton`

**Files:**
- Create: `src/components/workouts/WorkoutList.tsx`
- Create: `src/components/workouts/WorkoutsSkeleton.tsx`

**Interfaces:**
- Consumes: `groupByMonth`, `MonthTotal`, `WorkoutListItem` з `@/lib/workouts` (Task 3); `monthLabel`, `weekdayShort`, `plural`, `fmtThousands`, `parseISODate` з `@/lib/utils` (Task 2); `Button`, `Skeleton` з `@/components/ui`.
- Produces:
  - `<WorkoutList items={WorkoutListItem[]} totals={MonthTotal[]} remaining={number} loadingMore={boolean} onLoadMore={() => void} />`
  - `<WorkoutsSkeleton />`

Обидва компоненти поки не змонтовані — їх підключає Task 8.

- [ ] **Step 1: Написати `WorkoutList`**

Створи `src/components/workouts/WorkoutList.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui";
import { fmtThousands, monthLabel, parseISODate, plural, weekdayShort } from "@/lib/utils";
import { groupByMonth, type MonthTotal, type WorkoutListItem } from "@/lib/workouts";
import Link from "next/link";

/**
 * Архів сесій, згрупований за календарними місяцями.
 *
 * Тоннаж живе тільки в заголовку групи: у рядку він конкурував би за місце
 * з назвою тренування, а місячний підсумок і так приходить готовим із бази.
 */
export function WorkoutList({
  items,
  totals,
  remaining,
  loadingMore,
  onLoadMore,
}: {
  items: WorkoutListItem[];
  totals: MonthTotal[];
  remaining: number;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const groups = groupByMonth(items);
  const totalOf = new Map(totals.map((t) => [t.month, t]));

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const total = totalOf.get(group.month);
        return (
          // не Card: рядки йдуть впритул до країв, а Card має вбудований p-4
          <div key={group.month} className="overflow-hidden rounded-xl2 bg-surface shadow-card">
            <div className="px-4 pb-2 pt-4">
              <div className="text-[15px] font-extrabold text-ink">{monthLabel(group.month)}</div>
              {total && (
                <div className="mt-0.5 text-[12px] font-semibold text-muted">
                  {total.sessions} {plural(total.sessions, "сесія", "сесії", "сесій")} ·{" "}
                  {fmtThousands(total.tonnage)} т
                </div>
              )}
            </div>
            {group.items.map((w) => (
              <Link
                key={w.id}
                href={`/workouts/${w.id}`}
                className="flex items-center gap-3 border-t border-primary-light px-4 py-[11px] transition active:bg-primary-light"
              >
                <div className="w-[34px] shrink-0 text-center">
                  <div className="text-[15px] font-extrabold leading-tight text-ink">
                    {parseISODate(w.date).getDate()}
                  </div>
                  <div className="text-[11px] font-semibold leading-tight text-muted">
                    {weekdayShort(w.date)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-extrabold text-ink">
                    {w.name ?? "Тренування"}
                  </div>
                  <div className="text-[12px] font-semibold text-muted">
                    {w.exerciseCount} {plural(w.exerciseCount, "вправа", "вправи", "вправ")}
                  </div>
                </div>
                <span aria-hidden className="shrink-0 text-[16px] font-bold text-muted">
                  ›
                </span>
              </Link>
            ))}
          </div>
        );
      })}

      {remaining > 0 && (
        <Button variant="outline" loading={loadingMore} onClick={onLoadMore}>
          Показати ще · лишилось {remaining}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Написати `WorkoutsSkeleton`**

Створи `src/components/workouts/WorkoutsSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui";

/**
 * Плейсхолдер екрана тренувань: картка прогресу + один місячний блок.
 *
 * Висоти повторюють реальні елементи (`WorkoutProgress`, `WorkoutList`):
 * якщо вони розійдуться, поява даних смикне лейаут — саме те, що скелетон
 * має прибрати. Хедер із заголовком і кнопка «Нове тренування» тут не
 * дублюються: вони лишаються живими.
 */
export function WorkoutsSkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy="true">
      <span className="sr-only">Завантаження тренувань</span>

      {/* Прогрес: підпис 18.75 + 12 + тригер 51.5 + 12 + segmented 53 + 12 + графік 150 */}
      <div className="rounded-xl2 bg-surface p-4 shadow-card">
        <Skeleton className="mb-3 h-[18.75px] w-[128px]" />
        <Skeleton className="h-[51.5px] w-full rounded-[15px]" />
        <Skeleton className="mt-3 h-[53px] w-full rounded-[14px]" />
        <Skeleton className="mt-3 h-[150px] w-full rounded-[14px]" />
      </div>

      {/* Заголовок «Історія»: 17px × 1.2 = 20.4 */}
      <Skeleton className="ml-1 h-[20.4px] w-[84px]" />

      {/* Місячний блок: хедер (20.4 + 2 + 18) + три рядки по 56.5 */}
      <div className="overflow-hidden rounded-xl2 bg-surface shadow-card">
        <div className="px-4 pb-2 pt-4">
          <Skeleton className="h-[20.4px] w-[124px]" />
          <Skeleton className="mt-0.5 h-[18px] w-[104px]" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-t border-primary-light px-4 py-[11px]"
          >
            <Skeleton className="h-[34px] w-[34px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-[19.7px] w-[96px]" />
              <Skeleton className="mt-0.5 h-[18px] w-[62px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Висоти тут розраховані з розмірів шрифтів реальних елементів. Після Task 8 обов'язково звір їх візуально: відкрий екран із дроселем мережі й переконайся, що при появі даних блоки не стрибають. Якщо стрибають — правь числа тут, а не в живих компонентах.

- [ ] **Step 3: Перевірити збірку**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 4: Commit**

```bash
git add src/components/workouts/WorkoutList.tsx src/components/workouts/WorkoutsSkeleton.tsx
git commit -m "feat(workouts): monthly list and screen skeleton"
```

---

### Task 7: Прогрес переходить на сети вправи і піднімається нагору

**Files:**
- Modify: `src/lib/workouts.ts` (сигнатури `bestSet`, `exerciseSeries`, `compareLastTwo`)
- Modify: `src/lib/workouts.test.ts`
- Modify: `src/components/workouts/WorkoutProgress.tsx`
- Modify: `src/app/(app)/workouts/page.tsx`

**Interfaces:**
- Consumes: `ExerciseSet`, `UsedExercise` (Task 3); `loadUsedExercises`, `loadExerciseSets` (Task 4); `ExercisePicker` (Task 5).
- Produces:
  - `exerciseSeries(sets: ExerciseSet[], metric: ProgressMetric): ExercisePoint[]`
  - `compareLastTwo(sets: ExerciseSet[]): SessionCompare | null`
  - `bestSet<T extends { weight: number | null; reps: number }>(sets: T[]): T | null`
  - `<WorkoutProgress exercises={UsedExercise[]} loadSets={(exerciseId: string) => Promise<ExerciseSet[]>} />`

Список у цій задачі ще старий — його замінює Task 8. Так кожен крок лишається зі збіркою, що будується.

- [ ] **Step 1: Переписати тести під новий вхід**

У `src/lib/workouts.test.ts` заміни блоки `exerciseSeries` і `compareLastTwo` (рядки 99–119 і 128–139) на:

```ts
const SQ: ExerciseSet[] = [
  { date: "2026-07-01", weight: 50, reps: 10 },
  { date: "2026-07-01", weight: 60, reps: 8 },
  { date: "2026-07-08", weight: 55, reps: 10 },
  { date: "2026-07-08", weight: 65, reps: 8 },
];

const ABS: ExerciseSet[] = [{ date: "2026-07-01", weight: null, reps: 15 }];

describe("exerciseSeries", () => {
  it("weight metric = best working weight per session", () => {
    expect(exerciseSeries(SQ, "weight").map((p) => p.value)).toEqual([60, 65]);
  });
  it("tonnage metric = exercise tonnage per session", () => {
    expect(exerciseSeries(SQ, "tonnage").map((p) => p.value)).toEqual([500 + 480, 550 + 520]);
  });
  it("orm metric = Epley of best set", () => {
    expect(exerciseSeries(SQ, "orm")[0].value).toBeCloseTo(60 * (1 + 8 / 30), 5);
  });
  it("bodyweight exercise → weight metric is null point", () => {
    expect(exerciseSeries(ABS, "weight")[0].value).toBeNull();
  });
  it("one point per session date", () => {
    expect(exerciseSeries(SQ, "weight")).toHaveLength(2);
  });
  it("сортує сесії за датою незалежно від порядку сетів", () => {
    const shuffled = [SQ[2], SQ[0], SQ[3], SQ[1]];
    expect(exerciseSeries(shuffled, "weight").map((p) => p.date)).toEqual([
      "2026-07-01",
      "2026-07-08",
    ]);
  });
  it("порожній вхід → порожня серія", () => {
    expect(exerciseSeries([], "weight")).toEqual([]);
  });
});

describe("compareLastTwo", () => {
  it("returns last vs previous max weight + tonnage", () => {
    const c = compareLastTwo(SQ);
    expect(c?.current.maxWeight).toBe(65);
    expect(c?.previous?.maxWeight).toBe(60);
    expect(c?.current.tonnage).toBe(1070);
    expect(c?.previous?.tonnage).toBe(980);
  });
  it("перша сесія → previous є null", () => {
    expect(compareLastTwo(ABS)?.previous).toBeNull();
  });
  it("null when there are no sets", () => {
    expect(compareLastTwo([])).toBeNull();
  });
});
```

Додай `type ExerciseSet` в імпорт зверху файлу. Фікстура `W: LoadedWorkout[]` лишається — її ще використовують тести `workoutTonnage` і `routineSeries`.

- [ ] **Step 2: Запустити тести — мають упасти**

Run: `npx vitest run src/lib/workouts.test.ts`
Expected: FAIL — `exerciseSeries` очікує три аргументи, отримує два; типи `ExerciseSet[]` не підходять під `LoadedWorkout[]`.

- [ ] **Step 3: Переписати чисті функції**

У `src/lib/workouts.ts` заміни `bestSet` (рядки 80–90) на узагальнену версію — вона тепер приймає будь-який об'єкт із вагою і повторами, а не лише `LoadedSet`:

```ts
/** Найкращий підхід: макс. робоча вага, тай-брейк — більше повторів. */
export function bestSet<T extends { weight: number | null; reps: number }>(sets: T[]): T | null {
  if (sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const bw = best.weight ?? -Infinity;
    const sw = s.weight ?? -Infinity;
    if (sw > bw) return s;
    if (sw === bw && s.reps > best.reps) return s;
    return best;
  });
}
```

Заміни приватну `sessionsWith` (рядки 100–105) на групування сетів за датою:

```ts
/** Сети однієї вправи, згруповані за датою сесії, найстаріші спершу. */
function sessionsOf(sets: ExerciseSet[]): { date: string; sets: ExerciseSet[] }[] {
  const byDate = new Map<string, ExerciseSet[]>();
  for (const s of sets) {
    const bucket = byDate.get(s.date);
    if (bucket) bucket.push(s);
    else byDate.set(s.date, [s]);
  }
  return [...byDate.entries()]
    .map(([date, group]) => ({ date, sets: group }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

Заміни тіло `exerciseSeries`:

```ts
export function exerciseSeries(sets: ExerciseSet[], metric: ProgressMetric): ExercisePoint[] {
  return sessionsOf(sets).map(({ date, sets: group }) => {
    let value: number | null;
    if (metric === "tonnage") {
      value = group.reduce((sum, s) => sum + setTonnage(s), 0);
    } else {
      const best = bestSet(group);
      value =
        metric === "weight"
          ? (best?.weight ?? null)
          : best
            ? epley1rm(best.weight, best.reps)
            : null;
    }
    return { label: shortDate(date), date, value };
  });
}
```

Заміни `compareLastTwo`:

```ts
export function compareLastTwo(sets: ExerciseSet[]): SessionCompare | null {
  const sessions = sessionsOf(sets);
  if (sessions.length === 0) return null;
  const stat = (session: { date: string; sets: ExerciseSet[] }): SessionStat => ({
    date: session.date,
    maxWeight: bestSet(session.sets)?.weight ?? null,
    tonnage: session.sets.reduce((sum, s) => sum + setTonnage(s), 0),
  });
  const current = stat(sessions[sessions.length - 1]);
  const previous = sessions.length >= 2 ? stat(sessions[sessions.length - 2]) : null;
  return { current, previous };
}
```

`routineSeries` не чіпай — воно й далі працює з `LoadedWorkout[]`.

- [ ] **Step 4: Запустити тести — мають пройти**

Run: `npx vitest run src/lib/workouts.test.ts`
Expected: PASS. `npm run typecheck` поки червоний — `WorkoutProgress` ще передає старі аргументи; це чинить наступний крок.

- [ ] **Step 5: Переписати `WorkoutProgress`**

Заміни `src/components/workouts/WorkoutProgress.tsx` цілком:

```tsx
"use client";

import { MetricLine } from "@/components/charts";
import { Card, SectionLabel, Segmented, Spinner } from "@/components/ui";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { cn, fmt, shortDate } from "@/lib/utils";
import {
  compareLastTwo,
  exerciseSeries,
  type ExerciseSet,
  type ProgressMetric,
  type UsedExercise,
} from "@/lib/workouts";
import { useEffect, useMemo, useState } from "react";

const METRIC_OPTS: { value: ProgressMetric; label: string }[] = [
  { value: "weight", label: "Вага" },
  { value: "orm", label: "1ПМ" },
];

/**
 * Прогрес по одній вправі.
 *
 * Сети підвантажуються лише для обраної вправи, а не для всього архіву —
 * тому компонент отримує завантажувач, а не готові дані. Монтувати його
 * можна лише коли `exercises` уже завантажені: початковий вибір береться
 * з першого рендера.
 */
export function WorkoutProgress({
  exercises,
  loadSets,
}: {
  exercises: UsedExercise[];
  loadSets: (exerciseId: string) => Promise<ExerciseSet[]>;
}) {
  // за замовчуванням — вправа з найсвіжішою сесією, а не перша за алфавітом
  const initialId = useMemo(
    () => [...exercises].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))[0]?.id ?? null,
    [exercises],
  );

  const [exId, setExId] = useState<string | null>(initialId);
  const [metric, setMetric] = useState<ProgressMetric>("weight");
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!exId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadSets(exId)
      .then((next) => {
        if (!cancelled) setSets(next);
      })
      .catch(() => {
        if (!cancelled) {
          setSets([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exId, loadSets]);

  if (exercises.length === 0 || !exId) return null;

  const series = exerciseSeries(sets, metric);
  const compare = compareLastTwo(sets);

  return (
    <Card>
      <SectionLabel>Прогрес по вправі</SectionLabel>

      <ExercisePicker exercises={exercises} value={exId} onChange={setExId} />

      <div className="mt-3">
        <Segmented options={METRIC_OPTS} value={metric} onChange={setMetric} />
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex h-[150px] items-center justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : failed ? (
          <div className="py-6 text-center text-[12px] font-semibold text-muted">
            Не вдалося завантажити прогрес
          </div>
        ) : (
          <MetricLine data={series.map((p) => ({ label: p.label, value: p.value }))} unit="кг" />
        )}
      </div>

      {!loading && !failed && compare && (
        <>
          <div className="mt-3">
            <CompareCard
              title="Макс. вага"
              current={compare.current.maxWeight}
              previous={compare.previous?.maxWeight ?? null}
              unit="кг"
              better="up"
            />
          </div>
          <div className="mt-2 text-center text-[11px] font-semibold text-muted">
            {shortDate(compare.current.date)}
            {compare.previous ? ` vs ${shortDate(compare.previous.date)}` : " · перша сесія"}
          </div>
        </>
      )}
    </Card>
  );
}

function CompareCard({
  title,
  current,
  previous,
  unit,
  better,
}: {
  title: string;
  current: number | null;
  previous: number | null;
  unit: string;
  better: "up" | "down";
}) {
  const f = (v: number | null) => (v == null ? "—" : fmt(v, 1));
  const diff = current != null && previous != null ? current - previous : null;
  const good = diff == null ? null : better === "up" ? diff >= 0 : diff <= 0;
  return (
    <div className="rounded-[14px] bg-bg p-[13px]">
      <div className="text-[12px] font-bold text-muted">{title}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[20px] font-extrabold">{f(current)}</span>
        <span className="text-[11px] font-bold text-muted">{unit}</span>
        {diff != null && Math.abs(diff) >= 0.05 ? (
          <span className={cn("ml-auto text-[11px] font-extrabold", good ? "text-pos" : "text-neg")}>
            {diff > 0 ? "↑" : "↓"}
            {fmt(Math.abs(diff), 1)}
          </span>
        ) : (
          <span className="ml-auto text-[11px] font-extrabold text-muted">—</span>
        )}
      </div>
    </div>
  );
}
```

Компонент більше не малює обгортку з `h2 «Прогрес»` і не рендерить `flex flex-col gap-[15px]` — тепер це просто одна картка, а заголовки розставляє сторінка.

- [ ] **Step 6: Підключити нові дані на сторінці**

У `src/app/(app)/workouts/page.tsx` онови імпорти:

```tsx
import { loadUsedExercises, loadWorkoutsWithSets } from "@/lib/workouts-db";
import type { UsedExercise } from "@/lib/workouts";
```

Прибери імпорт `Exercise` з `@/lib/types` і `loadExercises`, заміни стан:

```tsx
  const [uid, setUid] = useState<string | null>(null);
  const [exercises, setExercises] = useState<UsedExercise[]>([]);
```

В ефекті заміни пару запитів:

```tsx
        const [ws, ex] = await Promise.all([
          loadWorkoutsWithSets(supabase, uid),
          loadUsedExercises(supabase),
        ]);
        setUid(uid);
        setWorkouts(ws);
        setExercises(ex);
```

Додай завантажувач сетів (нижче за стан, до `return`):

```tsx
  const loadSets = useCallback(
    async (exerciseId: string) =>
      uid ? loadExerciseSets(supabase, uid, exerciseId) : [],
    [supabase, uid],
  );
```

Імпортуй `useCallback` з react і `loadExerciseSets` з `@/lib/workouts-db`.

У JSX підніми прогрес над списком і додай заголовок «Історія»: блок `{!loading && workouts.length > 0 && <WorkoutProgress .../>}` переїжджає одразу під `{error && ...}`, з новими пропсами:

```tsx
      {!loading && exercises.length > 0 && (
        <WorkoutProgress exercises={exercises} loadSets={loadSets} />
      )}

      {!loading && workouts.length > 0 && (
        <h2 className="px-1 pt-2 text-[17px] font-extrabold">Історія</h2>
      )}
```

Старий рендер списку карток поки лишається без змін — його замінює Task 8.

- [ ] **Step 7: Перевірити збірку і поведінку**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: усе зелене.

Далі `npm run dev` і вручну: прогрес тепер над списком; тап по назві вправи відкриває панель; пошук фільтрує; вибір вправи перемальовує графік; Esc і тап по затемненню закривають панель.

- [ ] **Step 8: Commit**

```bash
git add src/lib/workouts.ts src/lib/workouts.test.ts src/components/workouts/WorkoutProgress.tsx src/app/\(app\)/workouts/page.tsx
git commit -m "feat(workouts): per-exercise progress loading, progress above list"
```

---

### Task 8: Список переходить на місячні сторінки

**Files:**
- Modify: `src/app/(app)/workouts/page.tsx`
- Modify: `src/lib/workouts-db.ts` (видалити `loadWorkoutsWithSets`)

**Interfaces:**
- Consumes: `loadMonthTotals`, `loadWorkoutList` (Task 4); `pickMonthPage`, `remainingSessions` (Task 3); `WorkoutList`, `WorkoutsSkeleton` (Task 6).
- Produces: кінцевий екран `/workouts`.

- [ ] **Step 1: Переписати сторінку**

Заміни `src/app/(app)/workouts/page.tsx` цілком:

```tsx
"use client";

import { Button, EmptyState, ErrorBanner } from "@/components/ui";
import { WorkoutList } from "@/components/workouts/WorkoutList";
import { WorkoutProgress } from "@/components/workouts/WorkoutProgress";
import { WorkoutsSkeleton } from "@/components/workouts/WorkoutsSkeleton";
import { createClient } from "@/lib/supabase/client";
import {
  pickMonthPage,
  remainingSessions,
  type MonthTotal,
  type UsedExercise,
  type WorkoutListItem,
} from "@/lib/workouts";
import {
  loadExerciseSets,
  loadMonthTotals,
  loadUsedExercises,
  loadWorkoutList,
} from "@/lib/workouts-db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function WorkoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [totals, setTotals] = useState<MonthTotal[]>([]);
  const [exercises, setExercises] = useState<UsedExercise[]>([]);
  const [items, setItems] = useState<WorkoutListItem[]>([]);
  const [loadedMonths, setLoadedMonths] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const id = u.user?.id;
        if (!id) throw new Error("no-user");
        const [ts, ex] = await Promise.all([
          loadMonthTotals(supabase),
          loadUsedExercises(supabase),
        ]);
        const page = pickMonthPage(ts, 0);
        const first = page ? await loadWorkoutList(supabase, id, page.from, page.to) : [];
        setUid(id);
        setTotals(ts);
        setExercises(ex);
        setItems(first);
        setLoadedMonths(page?.months ?? 0);
      } catch {
        setError("Не вдалося завантажити тренування.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const loadSets = useCallback(
    async (exerciseId: string) => (uid ? loadExerciseSets(supabase, uid, exerciseId) : []),
    [supabase, uid],
  );

  const loadMore = async () => {
    const page = pickMonthPage(totals, loadedMonths);
    if (!uid || !page) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await loadWorkoutList(supabase, uid, page.from, page.to);
      setItems((prev) => [...prev, ...next]);
      setLoadedMonths((n) => n + page.months);
    } catch {
      // вже показане лишається на місці — банер тільки про невдале довантаження
      setMoreError("Не вдалося довантажити. Спробуй ще раз.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Тренування</h1>
        <Link href="/workouts/routines" className="text-[13px] font-extrabold text-primary">
          Шаблони
        </Link>
      </div>

      <Button type="button" onClick={() => router.push("/workouts/new")}>
        + Нове тренування
      </Button>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <WorkoutsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🏋️"
          title="Ще немає тренувань"
          hint="Додай першу сесію — вправи, вагу і підходи. Далі бачитимеш прогрес на графіках."
        />
      ) : (
        <>
          <WorkoutProgress exercises={exercises} loadSets={loadSets} />

          <h2 className="px-1 pt-2 text-[17px] font-extrabold">Історія</h2>

          <WorkoutList
            items={items}
            totals={totals}
            remaining={remainingSessions(totals, loadedMonths)}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />

          {moreError && <ErrorBanner>{moreError}</ErrorBanner>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Прибрати старий завантажувач**

Видали `loadWorkoutsWithSets` із `src/lib/workouts-db.ts` (рядки 42–60 у поточному файлі) — інших споживачів у нього не лишилось. Прибери з імпортів цього файлу `type LoadedWorkout`, якщо він більше ніде не використовується.

- [ ] **Step 3: Перевірити збірку**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: усе зелене. Якщо lint скаржиться на невикористаний імпорт — це саме той залишок, що треба прибрати.

- [ ] **Step 4: Перевірити вручну**

`npm run dev`, мобільна ширина (375px), і пройдись за списком:

1. На завантаженні видно скелетон, не спінер; при появі даних блоки не стрибають.
2. Порядок: заголовок → кнопка → картка прогресу → «Історія» → місячні групи.
3. Заголовок місяця показує ту саму кількість сесій, скільки рядків під ним.
4. Числівники правильні: «1 вправа», «2 вправи», «5 вправ», «11 сесій», «21 сесія».
5. «Показати ще» довантажує наступні місяці, лічильник решти зменшується, кнопка зникає на останній сторінці.
6. Тап по рядку відкриває `/workouts/{id}`.
7. Тимчасово вимкни мережу і натисни «Показати ще» — зʼявляється банер, уже показані місяці лишаються на місці.
8. Порожній акаунт показує `EmptyState` без картки прогресу.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/workouts/page.tsx src/lib/workouts-db.ts
git commit -m "feat(workouts): monthly pagination, drop full-archive query"
```

---

## Перевірка після всіх задач

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Усі чотири мають бути зеленими. `git grep loadWorkoutsWithSets` має нічого не знаходити.
