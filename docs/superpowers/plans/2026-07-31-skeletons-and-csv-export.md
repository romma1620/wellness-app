# Скелетони при перемиканні дня + експорт CSV — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показувати скелетон замість порожньої форми при завантаженні дня на головній та дати можливість вивантажити всі дані у CSV за тиждень / місяць / весь час.

**Architecture:** Дві незалежні фічі. Перша — окремий стан `loading` у `page.tsx` плюс новий примітив `Skeleton` і компонент `DaySkeleton`, що дзеркалить структуру карток. Друга — чистий модуль `csv.ts` (збірка файлу, тестується vitest), окремий `export-db.ts` (три паралельні запити), примітив `Sheet` і `ExportSheet` з логікою завантаження. Спільного між фічами — тільки те, що обидві додають примітиви в `src/components/ui.tsx`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind 3, Supabase JS v2, vitest.

**Спека:** `docs/superpowers/specs/2026-07-31-skeletons-and-csv-export-design.md`

## Global Constraints

- **Тести — лише на чисту логіку.** Конвенція проєкту: vitest покриває `src/lib/*.ts` без React і без Supabase. UI перевіряється `npm run typecheck`, `npm run lint`, `npm run build` і руками. Не додавай testing-library, jsdom чи моки Supabase.
- **Мова інтерфейсу — українська.** Усі підписи, помилки, `aria-label` — українською. Апостроф — `ʼ` (U+02BC), як у наявному коді (`зʼєднання`), не `'`.
- **Кольори — тільки через токени Tailwind** (`bg-surface`, `text-muted`, `border-primary-light`, `bg-primary-light`…). Жодних хардкоджених hex у компонентах: застосунок має чотири теми, які перемикаються через CSS-змінні.
- **Змін у БД немає.** `supabase/schema.sql` не чіпається.
- **Нових залежностей немає.** Ні для CSV, ні для zip, ні для анімацій.
- **Коментарі — українською**, у стилі наявного коду: пояснюють *чому*, а не *що*.
- CSV-константи, зафіксовані спекою: роздільник `;`, кінець рядка `\r\n`, префікс `"\uFEFF"` (BOM), десятковий роздільник — кома, дати в ISO `YYYY-MM-DD`. **BOM пиши escape-послідовністю `"\uFEFF"`, не літеральним символом** — літерал невидимий у діффах і губиться при копіюванні.

---

## Структура файлів

| Файл | Відповідальність | Задача |
|------|------------------|--------|
| `src/app/globals.css` | `@keyframes aura-pulse`, `@keyframes aura-sheet-up`, блок `prefers-reduced-motion` | 1, 7 |
| `src/components/ui.tsx` | `Skeleton` (примітив), `Sheet` (примітив) | 1, 7 |
| `src/components/DaySkeleton.tsx` | **новий.** Скелетон карток головної | 2 |
| `src/app/(app)/page.tsx` | Стан `loading`, рендер скелетона | 3 |
| `src/lib/csv.ts` | **новий.** Чиста логіка: екранування, збірка файлу, імʼя файлу | 4, 5 |
| `src/lib/csv.test.ts` | **новий.** vitest на `csv.ts` | 4, 5 |
| `src/lib/export-db.ts` | **новий.** Три запити до Supabase + `Promise.all` | 6 |
| `src/components/ExportSheet.tsx` | **новий.** Вміст шіта, стани, завантаження файлу | 8 |
| `src/app/(app)/settings/page.tsx` | Кнопка «Завантажити CSV» + монтування шіта | 9 |

Задачі 1–3 (скелетони) і 4–9 (експорт) незалежні: їх можна виконувати в будь-якому порядку між собою, але всередині кожної групи порядок обовʼязковий.

---

## Task 1: Примітив `Skeleton` та анімація пульсації

**Files:**
- Modify: `src/app/globals.css` (в кінець файлу, після блока `.aura-fade`)
- Modify: `src/components/ui.tsx` (після секції `// ----------------------- Spinner -----------------------`)

**Interfaces:**
- Consumes: `cn` з `@/lib/utils` (уже імпортовано в `ui.tsx`)
- Produces: `export function Skeleton({ className }: { className?: string })` — рендерить `<span aria-hidden>` з класами `aura-pulse block rounded-[8px] bg-primary-light` плюс переданий `className`. Форму й розмір задає викликач.

- [ ] **Step 1: Додати keyframes у `globals.css`**

Дописати в кінець файлу (після блока `.aura-fade`, рядок ~128):

```css
/* Скелетони */
@keyframes aura-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
.aura-pulse {
  animation: aura-pulse 1.4s ease-in-out infinite;
}

/* Пульсація тут — не окраса: без неї скелетон не відрізнити від порожньої
   картки. Але для тих, хто просив менше руху, форма й місце контенту
   комунікуються й статикою. */
@media (prefers-reduced-motion: reduce) {
  .aura-pulse {
    animation: none;
  }
}
```

Не використовуй shimmer-градієнт: його довелося б підганяти під кожну з чотирьох тем окремо, а пульсація прозорості працює на будь-якому фоні.

- [ ] **Step 2: Додати `Skeleton` у `ui.tsx`**

Вставити одразу після функції `FullLoader` (рядок ~189), перед секцією `// ----------------------- Empty state -----------------------`:

```tsx
// ----------------------- Skeleton -----------------------
/**
 * Плейсхолдер контенту. Розмір і форму задає викликач через `className` —
 * примітив нічого не знає про конкретні картки.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("aura-pulse block rounded-[8px] bg-primary-light", className)}
    />
  );
}
```

`bg-primary-light` — токен теми, тож скелетон працює на всіх чотирьох темах без окремої палітри. `aria-hidden` — скрінрідеру нема що прочитати з плейсхолдера; озвучення бере на себе `DaySkeleton` (Task 2).

- [ ] **Step 3: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: обидві команди завершуються без помилок.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/ui.tsx
git commit -m "feat(ui): skeleton primitive with reduced-motion-aware pulse"
```

---

## Task 2: Компонент `DaySkeleton`

**Files:**
- Create: `src/components/DaySkeleton.tsx`

**Interfaces:**
- Consumes: `Card`, `Skeleton` з `@/components/ui` (Task 1)
- Produces: `export function DaySkeleton()` — компонент без пропсів. Рендерить `<div className="flex flex-col gap-[15px]" aria-busy="true">` із сімома картками-плейсхолдерами.

**Контекст:** висоти взяті з реальних карток `src/app/(app)/page.tsx` — вони мають збігатися, щоб поява даних не зсувала лейаут. Розрахунок на кожну картку наведено в коментарях нижче; не «округлюй красиво».

- [ ] **Step 1: Створити файл**

```tsx
import { Card, Skeleton } from "@/components/ui";

/** Ширини чипів догляду — фіксовані рядки, щоб Tailwind знайшов класи при скануванні. */
const CHIP_WIDTHS = ["w-[62px]", "w-[58px]", "w-[66px]", "w-[62px]"];

/**
 * Плейсхолдер карток головної на час завантаження дня.
 *
 * Висоти повторюють реальні картки (`src/app/(app)/page.tsx`): якщо вони
 * розійдуться, поява даних смикне лейаут — саме те, що скелетон має прибрати.
 * Хедер із датою тут не дублюється: він лишається живим і клікабельним.
 */
export function DaySkeleton() {
  return (
    <div className="flex flex-col gap-[15px]" aria-busy="true">
      <span className="sr-only">Завантаження дня</span>

      {/* Вага: підпис 17 + 4 + число 40 + 4 + примітка 16 */}
      <Card>
        <Skeleton className="h-[17px] w-[52px]" />
        <Skeleton className="mt-1 h-[40px] w-[132px]" />
        <Skeleton className="mt-1 h-[16px] w-[148px]" />
      </Card>

      {/* Харчування: заголовок 17 + 12, далі сітка 2×2 полів по 73 з gap 12 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[86px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-[7px] h-[17px] w-[54px]" />
              <Skeleton className="h-[49px] w-full rounded-[15px]" />
            </div>
          ))}
        </div>
      </Card>

      {/* Вода: рядок заголовка 18 + 12, далі 8 крапель по 26 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-[18px] w-[48px]" />
          <Skeleton className="h-[18px] w-[96px]" />
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[26px] w-[26px] rounded-full" />
          ))}
        </div>
      </Card>

      {/* Кроки: одне числове поле */}
      <Card>
        <Skeleton className="mb-[7px] h-[17px] w-[54px]" />
        <Skeleton className="h-[49px] w-full rounded-[15px]" />
      </Card>

      {/* Спорт: заголовок 17 + 12, далі рядок вводу тегів 37 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[46px]" />
        <Skeleton className="h-[37px] w-full rounded-full" />
      </Card>

      {/* Догляд: заголовок 17 + 12, далі чипи 37 + gap 12 + рядок вводу 37 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[118px]" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((w) => (
              <Skeleton key={w} className={`h-[37px] rounded-full ${w}`} />
            ))}
          </div>
          <Skeleton className="h-[37px] w-full rounded-full" />
        </div>
      </Card>

      {/* Коментар: заголовок 17 + 12, далі textarea на 3 рядки 95 */}
      <Card>
        <Skeleton className="mb-3 h-[17px] w-[110px]" />
        <Skeleton className="h-[95px] w-full rounded-[15px]" />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 3: Commit**

```bash
git add src/components/DaySkeleton.tsx
git commit -m "feat(today): day skeleton mirroring card heights"
```

---

## Task 3: Стан `loading` на головній

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `DaySkeleton` з `@/components/DaySkeleton` (Task 2)
- Produces: нічого для інших задач

**Контекст:** зараз `day === null` означає одночасно «вантажиться» і «помилка». Через це стану завантаження в рендері немає взагалі, і новий день до приходу даних виглядає як порожній. Розділяємо ці значення.

- [ ] **Step 1: Додати імпорт**

У блок імпортів (після рядка з `@/components/ui`):

```tsx
import { DaySkeleton } from "@/components/DaySkeleton";
```

- [ ] **Step 2: Додати стан**

Поруч із рештою `useState` (після `const [day, setDay] = useState<DayState | null>(null);`):

```tsx
const [loading, setLoading] = useState(true);
```

Початкове значення — `true`: перший рендер відбувається до першого `load`, і показувати в цей момент порожню форму — та сама проблема, яку фіча прибирає.

- [ ] **Step 3: Оновити `load`**

Замінити тіло `load` (рядки ~85–112) на:

```tsx
  const load = useCallback(
    async (d: string) => {
      const my = ++reqId.current;
      setLoadError(null);
      setLoading(true);
      // Стан попереднього дня не має лишатись під новою датою: ефект
      // автозбереження рахує дифф саме з нього.
      setDay(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("no-user");

        const { current, baselineWeight: baseline } = await loadDayWindow(supabase, uid, d);
        if (my !== reqId.current) return; // застаріла відповідь

        const form = formFromRow(current);
        setBaselineWeight(baseline);
        setDay({ date: d, loaded: form, form });
        setLoading(false);
      } catch (err) {
        if (my !== reqId.current) return;
        setLoadError(
          err instanceof Error && err.message === "no-user"
            ? "Сесія завершилась. Онови сторінку."
            : "Не вдалося завантажити день. Перевір зʼєднання.",
        );
        // без знімка з сервера редагувати нічого — інакше писали б наосліп
        setDay(null);
        setLoading(false);
      }
    },
    [supabase],
  );
```

**Не переноси `setLoading(false)` у `finally`.** `finally` виконався б і для застарілої відповіді, яка вилітає через `if (my !== reqId.current) return` — і погасив би скелетон живого, ще не завершеного запиту. Обидва виклики стоять *після* захисту, всередині гілок.

- [ ] **Step 4: Обгорнути картки в умову**

У JSX замінити блок від коментаря `{/* Вага */}` до закриття картки коментаря (`{/* Коментар */}` … `</Card>`, рядки ~216–326) так, щоб він опинився всередині тернарника. Тобто конструкція стає такою:

```tsx
      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {loading ? (
        <DaySkeleton />
      ) : (
        <>
          {/* Вага */}
          <Card className="flex items-end justify-between">
            {/* …без змін… */}
          </Card>

          {/* Харчування */}
          {/* …без змін… */}

          {/* Вода */}
          {/* …без змін… */}

          {/* Кроки + спорт */}
          {/* …без змін… */}

          {/* Догляд */}
          {/* …без змін… */}

          {/* Коментар */}
          {/* …без змін… */}
        </>
      )}

      <p className="px-2 pt-1 text-center text-[12px] font-semibold text-muted">
        Зміни зберігаються автоматично
      </p>
```

Це **чисто механічна операція**: вирізати наявний блок семи карток, вставити його в гілку `:` тернарника всередині фрагмента `<>…</>`, поправити відступ. Жодного рядка JSX усередині карток чіпати не треба — якщо після кроку `git diff` показує зміни глибші за відступи, щось пішло не так. Хедер із датою, стрілками, датапікером і `SaveIndicator` лишається вище тернарника й працює під час завантаження: так можна швидко клацати по днях, не чекаючи кожного запиту. Підпис «Зміни зберігаються автоматично» лишається поза тернарником — він статичний.

- [ ] **Step 5: Перевірити типи, лінт і збірку**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: усі три без помилок.

- [ ] **Step 6: Перевірити руками**

Run: `npm run dev`

Пройти по списку:
1. Клацнути `‹` кілька разів — скелетон зʼявляється на кожне перемикання, картки не смикаються, коли приходять дані.
2. Швидко клацнути `‹` 5 разів поспіль — скелетон не «залипає» після останньої відповіді.
3. Вибрати дату через датапікер — те саме.
4. Ввести вагу, одразу клацнути `‹` — значення долітає в базу (поверніться назад і перевірте).
5. DevTools → Network → Offline, перемкнути день — зʼявляється `ErrorBanner`, скелетон зникає.
6. Перемкнути тему в профілі на кожну з чотирьох — колір скелетона змінюється разом із темою.
7. DevTools → Rendering → `prefers-reduced-motion: reduce` — плейсхолдери статичні, але видимі.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat(today): show skeleton while a day loads"
```

---

## Task 4: Ядро `csv.ts` — екранування й матриця

**Files:**
- Create: `src/lib/csv.ts`
- Test: `src/lib/csv.test.ts`

**Interfaces:**
- Consumes: нічого
- Produces:
  - `export type CsvValue = string | number | null | undefined`
  - `export function csvField(value: CsvValue): string`
  - `export function toCsv(rows: CsvValue[][]): string`

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

describe("csvField", () => {
  it("null і undefined дають порожнє поле", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("десяткові з комою, цілі без розділювача тисяч", () => {
    expect(csvField(62.4)).toBe("62,4");
    expect(csvField(8432)).toBe("8432");
  });

  it("нескінченність і NaN дають порожнє поле", () => {
    expect(csvField(NaN)).toBe("");
    expect(csvField(Infinity)).toBe("");
  });

  it("кома не вимагає лапок — роздільник полів ;", () => {
    expect(csvField("Скраб, Крем")).toBe("Скраб, Крем");
  });

  it("крапка з комою, лапки й переноси беруться в лапки", () => {
    expect(csvField("зал; басейн")).toBe('"зал; басейн"');
    expect(csvField('казав "ок"')).toBe('"казав ""ок"""');
    expect(csvField("два\nрядки")).toBe('"два\nрядки"');
    expect(csvField("два\r\nрядки")).toBe('"два\r\nрядки"');
  });

  it("порожній рядок лишається порожнім полем без лапок", () => {
    expect(csvField("")).toBe("");
  });
});

describe("toCsv", () => {
  it("поля через ;, рядки через CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, null],
      ]),
    ).toBe("a;b\r\n1;");
  });

  it("порожня матриця дає порожній рядок", () => {
    expect(toCsv([])).toBe("");
  });

  it("рядок з одного поля не отримує роздільника", () => {
    expect(toCsv([["# Щоденник"]])).toBe("# Щоденник");
  });
});
```

- [ ] **Step 2: Запустити тест — має впасти**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: FAIL — `Failed to resolve import "./csv"`.

- [ ] **Step 3: Реалізувати мінімум**

Створити `src/lib/csv.ts`:

```ts
/**
 * Збірка CSV для експорту даних. Чиста логіка: без React і без Supabase.
 *
 * Діалект підібраний під локалі з десятковою комою (uk-UA): роздільник полів
 * `;`, десятковий роздільник — кома. Тому кома всередині значення
 * ("Скраб, Крем") не потребує екранування.
 */

const DELIMITER = ";";
const EOL = "\r\n";

export type CsvValue = string | number | null | undefined;

/** Повне значення з комою: не fmt() — той округлює й ставить розділювач тисяч. */
function numToCsv(n: number): string {
  return String(n).replace(".", ",");
}

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "number" ? (Number.isFinite(value) ? numToCsv(value) : "") : value;
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvField).join(DELIMITER)).join(EOL);
}
```

- [ ] **Step 4: Запустити тест — має пройти**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: PASS, усі 9 тестів зелені.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat(export): csv field escaping and matrix serialisation"
```

---

## Task 5: Секції файлу, типи й імʼя файлу

**Files:**
- Modify: `src/lib/csv.ts`
- Modify: `src/lib/csv.test.ts`

**Interfaces:**
- Consumes: `csvField`, `toCsv`, `CsvValue` (Task 4)
- Produces:
  - `export type ExportRange = "week" | "month" | "all"`
  - `export interface DailyRow { date: string; weight: number | null; kcal: number | null; protein: number | null; fat: number | null; carbs: number | null; water: number | null; steps: number | null; sport: string | null; care: string | null; comment: string | null }`
  - `export interface MeasurementRow { date: string; waist: number | null; hips: number | null; chest: number | null; leg: number | null; arm: number | null }`
  - `export interface RawWorkout { date: string; name: string | null; workout_sets: { set_number: number; weight: number | null; reps: number; exercises: { name: string } | null }[] | null }`
  - `export interface WorkoutSetRow { date: string; workout: string | null; exercise: string | null; setNumber: number; weight: number | null; reps: number }`
  - `export interface ExportData { daily: DailyRow[]; measurements: MeasurementRow[]; workouts: WorkoutSetRow[] }`
  - `export function flattenWorkouts(workouts: RawWorkout[]): WorkoutSetRow[]`
  - `export function buildExportCsv(data: ExportData): string`
  - `export function exportFileName(range: ExportRange, todayIso: string): string`
  - `export function isExportEmpty(data: ExportData): boolean`

- [ ] **Step 1: Написати падаючі тести**

Дописати в кінець `src/lib/csv.test.ts`:

Спершу заміни наявний рядок імпорту нагорі файлу

```ts
import { csvField, toCsv } from "./csv";
```

на об'єднаний (двох імпортів з одного модуля в файлі бути не має):

```ts
import {
  buildExportCsv,
  csvField,
  exportFileName,
  flattenWorkouts,
  isExportEmpty,
  toCsv,
  type ExportData,
  type RawWorkout,
} from "./csv";
```

Далі дописати в кінець файлу:

```ts
const EMPTY: ExportData = { daily: [], measurements: [], workouts: [] };

describe("flattenWorkouts", () => {
  const raw: RawWorkout[] = [
    {
      date: "2026-07-30",
      name: "Ноги",
      workout_sets: [
        { set_number: 2, weight: 42.5, reps: 8, exercises: { name: "Присідання" } },
        { set_number: 1, weight: 40, reps: 10, exercises: { name: "Присідання" } },
      ],
    },
  ];

  it("сортує підходи за номером незалежно від порядку на вході", () => {
    expect(flattenWorkouts(raw).map((r) => r.setNumber)).toEqual([1, 2]);
  });

  it("дата й назва тренування повторюються в кожному рядку-підході", () => {
    const rows = flattenWorkouts(raw);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date === "2026-07-30" && r.workout === "Ноги")).toBe(true);
  });

  it("не мутує вхідний масив підходів", () => {
    flattenWorkouts(raw);
    expect(raw[0].workout_sets?.map((s) => s.set_number)).toEqual([2, 1]);
  });

  it("тренування без підходів не дає жодного рядка", () => {
    expect(flattenWorkouts([{ date: "2026-07-30", name: null, workout_sets: [] }])).toEqual([]);
    expect(flattenWorkouts([{ date: "2026-07-30", name: null, workout_sets: null }])).toEqual([]);
  });

  it("відсутня вправа дає null, а не падіння", () => {
    const rows = flattenWorkouts([
      {
        date: "2026-07-30",
        name: null,
        workout_sets: [{ set_number: 1, weight: null, reps: 12, exercises: null }],
      },
    ]);
    expect(rows[0].exercise).toBeNull();
  });
});

describe("buildExportCsv", () => {
  it("починається з BOM", () => {
    expect(buildExportCsv(EMPTY).startsWith("\uFEFF")).toBe(true);
  });

  it("три секції в правильному порядку, розділені порожнім рядком", () => {
    const lines = buildExportCsv(EMPTY).replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("# Щоденник");
    expect(lines[1]).toBe(
      "Дата;Вага;Ккал;Білки;Жири;Вуглеводи;Вода;Кроки;Спорт;Догляд;Коментар",
    );
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("# Заміри");
    expect(lines[4]).toBe("Дата;Талія;Стегна;Груди;Нога;Рука");
    expect(lines[5]).toBe("");
    expect(lines[6]).toBe("# Тренування");
    expect(lines[7]).toBe("Дата;Тренування;Вправа;Підхід;Вага;Повтори");
  });

  it("рядок щоденника йде в порядку колонок заголовка", () => {
    const csv = buildExportCsv({
      ...EMPTY,
      daily: [
        {
          date: "2026-07-29",
          weight: 62.4,
          kcal: 1840,
          protein: 110,
          fat: 60,
          carbs: 180,
          water: 6,
          steps: 8432,
          sport: "зал",
          care: "Скраб, Крем",
          comment: "гарний день",
        },
      ],
    });
    expect(csv).toContain(
      "2026-07-29;62,4;1840;110;60;180;6;8432;зал;Скраб, Крем;гарний день",
    );
  });

  it("порожні поля лишаються порожніми, не «—»", () => {
    const csv = buildExportCsv({
      ...EMPTY,
      measurements: [
        { date: "2026-07-01", waist: 68, hips: null, chest: null, leg: null, arm: 28 },
      ],
    });
    expect(csv).toContain("2026-07-01;68;;;;28");
  });
});

describe("exportFileName", () => {
  it("суфікс відповідає діапазону", () => {
    expect(exportFileName("week", "2026-07-31")).toBe("aura-week-2026-07-31.csv");
    expect(exportFileName("month", "2026-07-31")).toBe("aura-month-2026-07-31.csv");
    expect(exportFileName("all", "2026-07-31")).toBe("aura-all-2026-07-31.csv");
  });
});

describe("isExportEmpty", () => {
  it("true лише коли порожні всі три секції", () => {
    expect(isExportEmpty(EMPTY)).toBe(true);
    expect(
      isExportEmpty({
        ...EMPTY,
        measurements: [
          { date: "2026-07-01", waist: 68, hips: null, chest: null, leg: null, arm: null },
        ],
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Запустити тести — мають впасти**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: FAIL — `flattenWorkouts is not a function` (і решта нових експортів).

- [ ] **Step 3: Реалізувати**

Дописати в кінець `src/lib/csv.ts`:

```ts
/** Excel читає UTF-8 без BOM як кракозябри — префікс обовʼязковий. */
const BOM = "\uFEFF";

export type ExportRange = "week" | "month" | "all";

export interface DailyRow {
  date: string;
  weight: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  water: number | null;
  steps: number | null;
  sport: string | null;
  care: string | null;
  comment: string | null;
}

export interface MeasurementRow {
  date: string;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  leg: number | null;
  arm: number | null;
}

/** Тренування як його віддає PostgREST: вкладені підходи без гарантованого порядку. */
export interface RawWorkout {
  date: string;
  name: string | null;
  workout_sets:
    | {
        set_number: number;
        weight: number | null;
        reps: number;
        exercises: { name: string } | null;
      }[]
    | null;
}

/** Один рядок CSV = один підхід; дата й назва тренування денормалізовані. */
export interface WorkoutSetRow {
  date: string;
  workout: string | null;
  exercise: string | null;
  setNumber: number;
  weight: number | null;
  reps: number;
}

export interface ExportData {
  daily: DailyRow[];
  measurements: MeasurementRow[];
  workouts: WorkoutSetRow[];
}

const DAILY_HEADER = [
  "Дата", "Вага", "Ккал", "Білки", "Жири", "Вуглеводи",
  "Вода", "Кроки", "Спорт", "Догляд", "Коментар",
];
const MEASUREMENT_HEADER = ["Дата", "Талія", "Стегна", "Груди", "Нога", "Рука"];
const WORKOUT_HEADER = ["Дата", "Тренування", "Вправа", "Підхід", "Вага", "Повтори"];

export function flattenWorkouts(workouts: RawWorkout[]): WorkoutSetRow[] {
  return workouts.flatMap((w) =>
    // копія перед sort: мутувати вхідні дані не можна
    [...(w.workout_sets ?? [])]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({
        date: w.date,
        workout: w.name,
        exercise: s.exercises?.name ?? null,
        setNumber: s.set_number,
        weight: s.weight,
        reps: s.reps,
      })),
  );
}

/**
 * Повний файл: BOM + три секції через порожній рядок.
 * Заголовки колонок пишуться завжди — структура файлу не залежить від даних.
 */
export function buildExportCsv(data: ExportData): string {
  const sections = [
    toCsv([
      ["# Щоденник"],
      DAILY_HEADER,
      ...data.daily.map((r) => [
        r.date, r.weight, r.kcal, r.protein, r.fat, r.carbs,
        r.water, r.steps, r.sport, r.care, r.comment,
      ]),
    ]),
    toCsv([
      ["# Заміри"],
      MEASUREMENT_HEADER,
      ...data.measurements.map((r) => [r.date, r.waist, r.hips, r.chest, r.leg, r.arm]),
    ]),
    toCsv([
      ["# Тренування"],
      WORKOUT_HEADER,
      ...data.workouts.map((r) => [
        r.date, r.workout, r.exercise, r.setNumber, r.weight, r.reps,
      ]),
    ]),
  ];
  return BOM + sections.join(EOL + EOL) + EOL;
}

export function exportFileName(range: ExportRange, todayIso: string): string {
  return `aura-${range}-${todayIso}.csv`;
}

export function isExportEmpty(data: ExportData): boolean {
  return (
    data.daily.length === 0 && data.measurements.length === 0 && data.workouts.length === 0
  );
}
```

- [ ] **Step 4: Запустити всі тести**

Run: `npm run test`
Expected: PASS — і нові тести `csv.test.ts`, і всі наявні файли тестів.

- [ ] **Step 5: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 6: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat(export): sectioned csv builder, workout flattening, file naming"
```

---

## Task 6: Завантаження даних `export-db.ts`

**Files:**
- Create: `src/lib/export-db.ts`

**Interfaces:**
- Consumes: `flattenWorkouts`, типи `DailyRow`, `MeasurementRow`, `RawWorkout`, `ExportData`, `ExportRange` з `@/lib/csv` (Task 5); `periodRange` з `@/lib/utils`
- Produces: `export async function loadExportData(sb: SupabaseClient, uid: string, range: ExportRange): Promise<ExportData>`

**Контекст:** патерн повторює наявний `src/lib/daily-log-db.ts` — тонкий модуль запитів без React. Вкладений `select` для тренувань узятий із `loadWorkoutsWithSets` у `src/lib/workouts-db.ts:42`.

- [ ] **Step 1: Створити файл**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  flattenWorkouts,
  type DailyRow,
  type ExportData,
  type ExportRange,
  type MeasurementRow,
  type RawWorkout,
} from "@/lib/csv";
import { periodRange } from "@/lib/utils";

type SB = SupabaseClient;

/** Межі діапазону; null — «за весь час», без фільтра дат. */
function rangeBounds(range: ExportRange): { start: string; end: string } | null {
  if (range === "all") return null;
  const { start, end } = periodRange(range, 0);
  return { start, end };
}

/**
 * Три запити паралельно. Якщо падає будь-який — не віддаємо нічого:
 * файл, який мовчки не містить тренувань, гірший за відсутній.
 */
export async function loadExportData(
  sb: SB,
  uid: string,
  range: ExportRange,
): Promise<ExportData> {
  const bounds = rangeBounds(range);

  let dailyQ = sb
    .from("daily_logs")
    .select("date, weight, kcal, protein, fat, carbs, water, steps, sport, care, comment")
    .eq("user_id", uid);

  let measQ = sb
    .from("measurements")
    .select("date, waist, hips, chest, leg, arm")
    .eq("user_id", uid);

  let workQ = sb
    .from("workouts")
    .select("date, name, workout_sets(set_number, weight, reps, exercises(name))")
    .eq("user_id", uid);

  if (bounds) {
    dailyQ = dailyQ.gte("date", bounds.start).lte("date", bounds.end);
    measQ = measQ.gte("date", bounds.start).lte("date", bounds.end);
    workQ = workQ.gte("date", bounds.start).lte("date", bounds.end);
  }

  const [daily, meas, work] = await Promise.all([
    dailyQ.order("date", { ascending: true }),
    measQ.order("date", { ascending: true }),
    workQ.order("date", { ascending: true }),
  ]);

  if (daily.error) throw daily.error;
  if (meas.error) throw meas.error;
  if (work.error) throw work.error;

  return {
    daily: (daily.data ?? []) as DailyRow[],
    measurements: (meas.data ?? []) as MeasurementRow[],
    // PostgREST не гарантує порядок вкладених підходів — сортує flattenWorkouts
    workouts: flattenWorkouts((work.data ?? []) as unknown as RawWorkout[]),
  };
}
```

Модуль не тестується vitest: він складається із запитів, а конвенція проєкту — покривати тестами лише чисту логіку. Уся логіка, яку тут можна зламати мовчки (сортування підходів, склейка рядків), живе в `csv.ts` і вже покрита.

- [ ] **Step 2: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок. Якщо `let dailyQ = …` дає скаргу `prefer-const` — це означає, що гілка `if (bounds)` загубилась; перевір, що переприсвоєння на місці.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-db.ts
git commit -m "feat(export): load daily logs, measurements and workouts for a range"
```

---

## Task 7: Примітив `Sheet`

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui.tsx`

**Interfaces:**
- Consumes: `cn` з `@/lib/utils`
- Produces: `export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode })` — повертає `null`, коли `open === false`.

- [ ] **Step 1: Додати анімацію підйому в `globals.css`**

Дописати в кінець файлу (після блока скелетонів із Task 1):

```css
/* Ботом-шіт */
@keyframes aura-sheet-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
.aura-sheet {
  animation: aura-sheet-up 0.22s ease-out both;
}
```

І розширити наявний блок `prefers-reduced-motion` (доданий у Task 1), щоб він виглядав так:

```css
@media (prefers-reduced-motion: reduce) {
  .aura-pulse,
  .aura-sheet {
    animation: none;
  }
}
```

- [ ] **Step 2: Розширити імпорт React у `ui.tsx`**

Замінити наявний блок імпорту з `react` на:

```tsx
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
```

- [ ] **Step 3: Додати `Sheet` у `ui.tsx`**

Вставити в кінець файлу, після `Collapsible`:

```tsx
// ----------------------- Bottom sheet -----------------------
/**
 * Модальна панель знизу. Про свій вміст нічого не знає.
 * Закриття: Esc, тап по затемненню, хрестик. Свайп вниз не підтримується.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // onClose живе в ref, а не в залежностях: інлайнова стрілка від викликача
  // інакше перезапускала б ефект щорендера — з переїздом фокуса й
  // сіпанням overflow на body.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="aura-fade fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={() => closeRef.current()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "aura-sheet mx-auto w-full max-w-app rounded-t-[24px] bg-surface p-5 outline-none",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[17px] font-extrabold text-ink">{title}</div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Закрити"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[15px] font-bold text-primary active:scale-95"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

`z-50` вище за `z-40` таббару (`src/components/TabBar.tsx:76`) — шіт перекриває навігацію, як і має.

- [ ] **Step 4: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui.tsx
git commit -m "feat(ui): bottom sheet primitive"
```

---

## Task 8: `ExportSheet`

**Files:**
- Create: `src/components/ExportSheet.tsx`

**Interfaces:**
- Consumes: `Sheet`, `ErrorBanner`, `Spinner` з `@/components/ui` (Task 7); `buildExportCsv`, `exportFileName`, `isExportEmpty`, `ExportRange` з `@/lib/csv` (Task 5); `loadExportData` з `@/lib/export-db` (Task 6); `createClient` з `@/lib/supabase/client`; `todayISO` з `@/lib/utils`
- Produces: `export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void })`

- [ ] **Step 1: Створити файл**

```tsx
"use client";

import { ErrorBanner, Sheet, Spinner } from "@/components/ui";
import {
  buildExportCsv,
  exportFileName,
  isExportEmpty,
  type ExportRange,
} from "@/lib/csv";
import { loadExportData } from "@/lib/export-db";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/utils";
import { useMemo, useState } from "react";

const OPTIONS: { value: ExportRange; label: string }[] = [
  { value: "week", label: "За цей тиждень" },
  { value: "month", label: "За цей місяць" },
  { value: "all", label: "За весь час" },
];

function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari ще тримає url у момент кліку — знімаємо наступним тіком.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState<ExportRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function run(range: ExportRange) {
    setBusy(range);
    setError(null);
    setEmpty(false);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("no-user");

      const data = await loadExportData(supabase, uid, range);
      if (isExportEmpty(data)) {
        setEmpty(true);
        return; // порожній файл нічого не пояснює — краще сказати прямо
      }

      downloadCsv(buildExportCsv(data), exportFileName(range, todayISO()));
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "no-user"
          ? "Сесія завершилась. Онови сторінку."
          : "Не вдалося зібрати файл. Перевір зʼєднання.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Експорт даних в CSV">
      {error && (
        <div className="mb-3">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
      {empty && (
        <div className="mb-3 rounded-[14px] bg-primary-light px-4 py-3 text-[13px] font-bold text-primary">
          Немає даних за цей період.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={busy !== null}
            onClick={() => run(o.value)}
            className="flex items-center justify-between rounded-[15px] border-[1.5px] border-primary-light bg-surface px-4 py-[14px] text-left text-[15px] font-extrabold text-ink transition active:scale-[.99] disabled:opacity-60 disabled:active:scale-100"
          >
            {o.label}
            {busy === o.value ? (
              <Spinner className="h-4 w-4 text-primary" />
            ) : (
              <span className="text-[18px] font-bold text-muted" aria-hidden>
                ›
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
```

При успіху шіт закривається сам; повідомлення про порожній період і помилку лишають його відкритим, щоб можна було обрати інший діапазон.

- [ ] **Step 2: Перевірити типи й лінт**

Run: `npm run typecheck && npm run lint`
Expected: без помилок.

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportSheet.tsx
git commit -m "feat(export): csv export bottom sheet"
```

---

## Task 9: Кнопка експорту в профілі

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `ExportSheet` з `@/components/ExportSheet` (Task 8)
- Produces: нічого

- [ ] **Step 1: Додати імпорт**

Після наявного імпорту `ThemeProvider` (рядок 3):

```tsx
import { ExportSheet } from "@/components/ExportSheet";
```

- [ ] **Step 2: Додати стан**

Поруч із рештою `useState` (після `const [error, setError] = useState<string | null>(null);`, рядок ~34):

```tsx
  const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 3: Додати картку й шіт у JSX**

Вставити між карткою «Тема застосунку» (закривається `</Card>`, рядок ~254) і посиланням «Заміри тіла» (`<Link href="/measurements"`, рядок ~257):

```tsx
      {/* Експорт */}
      <Card>
        <SectionLabel>Експорт даних</SectionLabel>
        <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 3v11M6.5 9.5L11 14l4.5-4.5M4 18h14" />
          </svg>
          Завантажити CSV
        </Button>
        <p className="mt-2 text-center text-[12px] font-semibold text-muted">
          Щоденник, заміри й тренування одним файлом
        </p>
      </Card>
```

І перед закриттям кореневого `</div>` (після рядка з `aura · v1.0`, ~284):

```tsx
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
```

`ExportSheet` монтується в основному `return`, **не** у гілці `if (loading)` — під час завантаження профілю сторінка повертається раніше.

- [ ] **Step 4: Перевірити типи, лінт, тести й збірку**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: усі чотири без помилок.

- [ ] **Step 5: Перевірити руками**

Run: `npm run dev`

Пройти по списку:
1. Профіль → «Завантажити CSV» → шіт піднімається знизу, таббар перекритий.
2. Закрити всіма трьома способами: Esc, тап по затемненню, хрестик. Скрол сторінки під шітом заблокований, після закриття — відновлюється.
3. «За цей тиждень» → у рядку спінер, решта рядків неактивні, файл завантажується, шіт закривається.
4. Відкрити файл у Excel і в Google Sheets: кирилиця читається, три секції на місці, числа розпізнані як числа (`62,4` — число, не текст).
5. «За весь час» на акаунті з тренуваннями — секція «Тренування» містить рядок на кожен підхід, підходи в межах вправи йдуть за номером.
6. Перемкнутись на тиждень без жодного запису → «Немає даних за цей період», шіт лишається відкритим, файл не завантажується.
7. DevTools → Network → Offline → будь-який діапазон → `ErrorBanner`, рядки знову активні.
8. Перевірити на всіх чотирьох темах: шіт, кнопка й банери беруть кольори теми.
9. iOS Safari у режимі PWA (або емуляція): файл відкривається у share-sheet.
10. DevTools → Rendering → `prefers-reduced-motion: reduce` — шіт зʼявляється без підйому.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/settings/page.tsx"
git commit -m "feat(settings): csv export button"
```

---

## Фінальна перевірка

- [ ] `npm run typecheck` — без помилок
- [ ] `npm run lint` — без помилок
- [ ] `npm run test` — усі тести зелені
- [ ] `npm run build` — збірка проходить
- [ ] `git status` — чисто, нічого не забуто
