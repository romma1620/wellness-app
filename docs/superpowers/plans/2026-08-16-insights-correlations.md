# Інсайти «Що насправді працює» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сторінка `/insights` із трьома чесними висновками «що впливає на вагу/тоннаж» на тижневих агрегатах; вкладка «Інсайти» в таб-барі замість «Циклу», «Цикл» — у профілі.

**Architecture:** Чиста логіка (тижнева агрегація → точки пар → медіанний спліт із порогами + Пірсон) у `src/lib/correlations.ts` під vitest; сторінка-клієнт вантажить `daily_logs` і `workouts` двома запитами (патерн `/cycle/insights`) і мапить три `PairAnalysis` на гібридні картки з розгортуваним scatter.

**Tech Stack:** Next.js 16 (app router, client pages), Supabase JS, TanStack Charts ^0.13, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-insights-correlations-design.md`

## Global Constraints

- Усі тексти UI — українською; числа через `fmt`/`fmtInt` з `@/lib/utils` (десяткова кома).
- Vitest тільки для чистої логіки; UI перевіряється `npm run typecheck` + `npm run lint` + `npm run build` і вручну (конвенція проєкту).
- Без міграцій БД і без нових RPC.
- Команди: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` (з кореня репо).
- Документація TanStack Charts лежить у `node_modules/@tanstack/charts/docs/` і `llms.txt` — при сумнівах щодо API дивитися туди, не вгадувати.
- Пороги методології — точно зі спеки: `MIN_WEEKS = 8`; валідність тижня ≥ 4 днів (вага — ≥ 3 зважування); контраст X: ккал ≥ 120, кроки ≥ 1000, білок ≥ 10; різниця Y: 0.2 кг/тиж (абсолютна) або 0.12 (симетрична відносна, тоннаж). Пороги включні (`>=`).

---

### Task 1: Тижнева агрегація і точки пар (`buildWeekAggs`, `deltaWeightPoints`, `tonnagePoints`)

**Files:**
- Create: `src/lib/correlations.ts`
- Create: `src/lib/correlations.test.ts`

**Interfaces:**
- Consumes: `WeekBucket`, `weekBuckets` з `@/lib/utils` (`{ start: string; end: string; dates: string[] }`).
- Produces (Task 2 і Task 5 залежать від цих типів та імен):
  - `ANALYSIS_WEEKS = 26`, `MIN_WEEKS = 8`
  - `interface DayInput { date: string; weight: number | null; kcal: number | null; steps: number | null; protein: number | null }`
  - `interface WeekAgg { start: string; kcal: number | null; steps: number | null; protein: number | null; weight: number | null; tonnage: number }`
  - `buildWeekAggs(days: DayInput[], tonnageByDate: Map<string, number>, weeks: WeekBucket[]): WeekAgg[]`
  - `interface PairPoint { weekStart: string; x: number; y: number }`
  - `deltaWeightPoints(aggs: WeekAgg[], xKey: "kcal" | "steps"): PairPoint[]`
  - `tonnagePoints(aggs: WeekAgg[]): PairPoint[]`

- [ ] **Step 1: Написати падаючі тести**

Створити `src/lib/correlations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildWeekAggs,
  deltaWeightPoints,
  tonnagePoints,
  type DayInput,
  type WeekAgg,
} from "@/lib/correlations";
import { weekBuckets } from "@/lib/utils";

/** Порожній день щоденника з перекриттям потрібних полів. */
function day(date: string, over: Partial<DayInput> = {}): DayInput {
  return { date, weight: null, kcal: null, steps: null, protein: null, ...over };
}

/** Порожній тиждень-агрегат з перекриттям. */
function agg(start: string, over: Partial<WeekAgg> = {}): WeekAgg {
  return { start, kcal: null, steps: null, protein: null, weight: null, tonnage: 0, ...over };
}

describe("buildWeekAggs", () => {
  // 2026-08-03 — понеділок; два повні тижні: 03–09 і 10–16.
  const weeks = weekBuckets("2026-08-03", "2026-08-16");

  const days = [
    day("2026-08-03", { kcal: 2000, weight: 62, steps: 8000 }),
    day("2026-08-04", { kcal: 1800, steps: 6000 }),
    day("2026-08-05", { kcal: 1900, weight: 61, steps: 7000 }),
    day("2026-08-06", { kcal: 1700 }),
    day("2026-08-07", { weight: 60 }),
  ];

  it("середнє метрики при ≥4 заповнених днях", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.kcal).toBeCloseTo(1850);
  });

  it("метрика з <4 днями — null", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.steps).toBeNull(); // лише 3 дні з кроками
    expect(w1.protein).toBeNull(); // жодного дня
  });

  it("вага валідна вже з 3 зважувань", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.weight).toBeCloseTo(61);
  });

  it("вага з 2 зважувань — null", () => {
    const two = [day("2026-08-03", { weight: 62 }), day("2026-08-05", { weight: 61 })];
    const [w1] = buildWeekAggs(two, new Map(), weeks);
    expect(w1.weight).toBeNull();
  });

  it("тоннаж — сума по днях тижня, 0 без тренувань", () => {
    const tonnage = new Map([
      ["2026-08-03", 1000],
      ["2026-08-05", 500],
    ]);
    const [w1, w2] = buildWeekAggs(days, tonnage, weeks);
    expect(w1.tonnage).toBe(1500);
    expect(w2.tonnage).toBe(0);
  });

  it("тиждень без жодного запису — всі метрики null, тоннаж 0", () => {
    const [, w2] = buildWeekAggs(days, new Map(), weeks);
    expect(w2).toEqual(agg("2026-08-10"));
  });
});

describe("deltaWeightPoints", () => {
  it("y = вага наступного тижня мінус поточного; x — драйвер поточного", () => {
    const aggs = [
      agg("w1", { kcal: 2000, weight: 62 }),
      agg("w2", { kcal: 1800, weight: 61.5 }),
      agg("w3", { kcal: 1700, weight: 61 }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([
      { weekStart: "w1", x: 2000, y: -0.5 },
      { weekStart: "w2", x: 1800, y: -0.5 },
    ]);
  });

  it("пара випадає, якщо драйвер невалідний", () => {
    const aggs = [
      agg("w1", { kcal: null, weight: 62 }),
      agg("w2", { kcal: 1800, weight: 61 }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([]);
  });

  it("пара випадає, якщо вага невалідна в будь-якому з двох тижнів", () => {
    const aggs = [
      agg("w1", { kcal: 2000, weight: null }),
      agg("w2", { kcal: 1800, weight: 61 }),
      agg("w3", { kcal: 1700, weight: null }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([]);
  });

  it("працює для кроків тим самим шляхом", () => {
    const aggs = [
      agg("w1", { steps: 8000, weight: 62 }),
      agg("w2", { steps: 5000, weight: 61.4 }),
    ];
    expect(deltaWeightPoints(aggs, "steps")).toEqual([
      { weekStart: "w1", x: 8000, y: expect.closeTo(-0.6) },
    ]);
  });
});

describe("tonnagePoints", () => {
  it("той самий тиждень, без зсуву; нульовий тоннаж — справжня точка", () => {
    const aggs = [
      agg("w1", { protein: 90, tonnage: 1200 }),
      agg("w2", { protein: null, tonnage: 800 }),
      agg("w3", { protein: 70, tonnage: 0 }),
    ];
    expect(tonnagePoints(aggs)).toEqual([
      { weekStart: "w1", x: 90, y: 1200 },
      { weekStart: "w3", x: 70, y: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Переконатися, що тести падають**

Run: `npm run test -- correlations`
Expected: FAIL — модуль `@/lib/correlations` не існує.

- [ ] **Step 3: Мінімальна реалізація**

Створити `src/lib/correlations.ts`:

```ts
import type { WeekBucket } from "@/lib/utils";

/** Скільки завершених тижнів Пн–Нд іде в аналіз (~6 місяців). */
export const ANALYSIS_WEEKS = 26;
/** Мінімум парних тижнів, щоб порівняння груп щось значило. */
export const MIN_WEEKS = 8;
/** Мінімум заповнених днів, щоб середнє тижня по метриці щось значило. */
const MIN_DAYS_PER_WEEK = 4;
/** Для ваги досить трьох зважувань: терези беруть не щодня, але 3 точки вже дають середнє. */
const MIN_WEIGHINGS_PER_WEEK = 3;

export interface DayInput {
  date: string; // YYYY-MM-DD
  weight: number | null;
  kcal: number | null;
  steps: number | null;
  protein: number | null;
}

export interface WeekAgg {
  start: string; // ISO-понеділок
  kcal: number | null;
  steps: number | null;
  protein: number | null;
  weight: number | null;
  /** 0 = тиждень без тренувань: це справжній нуль, а не пропуск даних. */
  tonnage: number;
}

/** Середнє, якщо заповнених значень не менше minN; інакше null. */
function validAvg(vals: (number | null | undefined)[], minN: number): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length < minN) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Згортає дні в тижні-агрегати. Кошики мають бути повними тижнями Пн–Нд —
 * інакше пороги валідності (4 із 7 днів) втрачають сенс.
 */
export function buildWeekAggs(
  days: DayInput[],
  tonnageByDate: Map<string, number>,
  weeks: WeekBucket[],
): WeekAgg[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return weeks.map((w) => {
    const rows = w.dates.map((d) => byDate.get(d));
    return {
      start: w.start,
      kcal: validAvg(rows.map((r) => r?.kcal), MIN_DAYS_PER_WEEK),
      steps: validAvg(rows.map((r) => r?.steps), MIN_DAYS_PER_WEEK),
      protein: validAvg(rows.map((r) => r?.protein), MIN_DAYS_PER_WEEK),
      weight: validAvg(rows.map((r) => r?.weight), MIN_WEIGHINGS_PER_WEEK),
      tonnage: w.dates.reduce((s, d) => s + (tonnageByDate.get(d) ?? 0), 0),
    };
  });
}

export interface PairPoint {
  weekStart: string;
  x: number;
  y: number;
}

/**
 * Точки вагових пар: x = драйвер тижня i, y = вага(i+1) − вага(i).
 * Зсув на тиждень уперед — зʼїдене цього тижня видно на терезах наступного;
 * порівняння з минулим тижнем змішувало б причину з наслідком.
 */
export function deltaWeightPoints(aggs: WeekAgg[], xKey: "kcal" | "steps"): PairPoint[] {
  const pts: PairPoint[] = [];
  for (let i = 0; i + 1 < aggs.length; i++) {
    const x = aggs[i][xKey];
    const w0 = aggs[i].weight;
    const w1 = aggs[i + 1].weight;
    if (x === null || w0 === null || w1 === null) continue;
    pts.push({ weekStart: aggs[i].start, x, y: w1 - w0 });
  }
  return pts;
}

/** Точки «білок ↔ тоннаж»: обидві метрики того самого тижня, без зсуву. */
export function tonnagePoints(aggs: WeekAgg[]): PairPoint[] {
  return aggs.flatMap((a) =>
    a.protein === null ? [] : [{ weekStart: a.start, x: a.protein, y: a.tonnage }],
  );
}
```

- [ ] **Step 4: Тести зелені**

Run: `npm run test -- correlations`
Expected: PASS (усі тести Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/correlations.ts src/lib/correlations.test.ts
git commit -m "feat(insights): тижнева агрегація і точки пар для взаємозвʼязків"
```

---

### Task 2: Аналіз пари (`analyzePair`, `pearson`, пороги, сила звʼязку)

**Files:**
- Modify: `src/lib/correlations.ts` (дописати в кінець)
- Modify: `src/lib/correlations.test.ts` (дописати describe-блоки)

**Interfaces:**
- Consumes: `PairPoint`, `MIN_WEEKS` з Task 1.
- Produces (Task 4 і Task 5 залежать):
  - `type PairKey = "kcal-weight" | "steps-weight" | "protein-tonnage"`
  - `interface PairThresholds { minXContrast: number; minYDiff: number; yDiffMode: "absolute" | "relative" }`
  - `THRESHOLDS: Record<PairKey, PairThresholds>`
  - `type PairAnalysis = { state: "collecting"; n; needed } | { state: "no-contrast"; n; points } | { state: "no-link"; n; r; points } | { state: "link"; n; r; points; lowX; highX; lowY; highY; diff; medianX }` (точні поля — у коді нижче)
  - `analyzePair(points: PairPoint[], t: PairThresholds): PairAnalysis`
  - `pearson(points: PairPoint[]): number | null`
  - `strengthOf(r: number): "weak" | "notable" | "strong"`

- [ ] **Step 1: Дописати падаючі тести**

Додати в кінець `src/lib/correlations.test.ts` (імпорти доповнити: `analyzePair, pearson, strengthOf, type PairPoint, type PairThresholds`):

```ts
/** Точки з масиву [x, y]. */
function pts(pairs: [number, number][]): PairPoint[] {
  return pairs.map(([x, y], i) => ({ weekStart: `w${i}`, x, y }));
}

const ABS: PairThresholds = { minXContrast: 100, minYDiff: 0.2, yDiffMode: "absolute" };
const REL: PairThresholds = { minXContrast: 5, minYDiff: 0.12, yDiffMode: "relative" };

describe("analyzePair", () => {
  it("менше MIN_WEEKS точок — collecting із прогресом", () => {
    const a = analyzePair(
      pts(Array.from({ length: 7 }, (_, i): [number, number] => [1000 + i, 0])),
      ABS,
    );
    expect(a).toEqual({ state: "collecting", n: 7, needed: 8 });
  });

  it("однакові X — no-contrast", () => {
    const a = analyzePair(
      pts([[1500, -0.5], [1500, 0.1], [1500, -0.2], [1500, 0.3], [1500, -0.4], [1500, 0], [1500, 0.2], [1500, -0.1]]),
      ABS,
    );
    expect(a.state).toBe("no-contrast");
  });

  it("різниця Y нижче порога — no-link", () => {
    const a = analyzePair(
      pts([[1000, -0.1], [1100, -0.1], [1200, -0.1], [1300, -0.1], [1900, 0], [2000, 0], [2100, 0], [2200, 0]]),
      ABS,
    );
    expect(a.state).toBe("no-link");
    if (a.state === "no-link") expect(a.r).not.toBeNull();
  });

  it("значуща різниця — link із групами й медіаною", () => {
    const a = analyzePair(
      pts([[1000, -0.4], [1100, -0.4], [1200, -0.4], [1300, -0.4], [1900, 0.1], [2000, 0.1], [2100, 0.1], [2200, 0.1]]),
      ABS,
    );
    expect(a.state).toBe("link");
    if (a.state === "link") {
      expect(a.lowX).toBeCloseTo(1150);
      expect(a.highX).toBeCloseTo(2050);
      expect(a.lowY).toBeCloseTo(-0.4);
      expect(a.highY).toBeCloseTo(0.1);
      expect(a.diff).toBeCloseTo(0.5);
      expect(a.medianX).toBeCloseTo(1600); // між 1300 і 1900
      expect(a.n).toBe(8);
    }
  });

  it("поріг включно: різниця рівно 0.2 — link", () => {
    const a = analyzePair(
      pts([[1000, -0.2], [1100, -0.2], [1200, -0.2], [1300, -0.2], [1900, 0], [2000, 0], [2100, 0], [2200, 0]]),
      ABS,
    );
    expect(a.state).toBe("link");
  });

  it("непарна кількість: середня точка відкидається з обох груп", () => {
    const a = analyzePair(
      pts([[1, 0], [2, 0], [3, 0], [4, 0], [5, 100], [6, 1], [7, 1], [8, 1], [9, 1]]),
      { minXContrast: 1, minYDiff: 0.2, yDiffMode: "absolute" },
    );
    expect(a.state).toBe("link");
    if (a.state === "link") {
      expect(a.lowY).toBeCloseTo(0);
      expect(a.highY).toBeCloseTo(1);
      expect(a.medianX).toBeCloseTo(5); // між 4 і 6
    }
  });

  it("relative: симетрична різниця вище порога — link", () => {
    const a = analyzePair(
      pts([[70, 100], [72, 100], [74, 100], [76, 100], [90, 115], [92, 115], [94, 115], [96, 115]]),
      REL,
    ); // 15 / 107.5 ≈ 0.14
    expect(a.state).toBe("link");
  });

  it("relative: різниця нижче порога — no-link", () => {
    const a = analyzePair(
      pts([[70, 100], [72, 100], [74, 100], [76, 100], [90, 110], [92, 110], [94, 110], [96, 110]]),
      REL,
    ); // 10 / 105 ≈ 0.095
    expect(a.state).toBe("no-link");
  });

  it("relative: обидві групи нульові — no-link, а не ділення на нуль", () => {
    const a = analyzePair(
      pts([[70, 0], [72, 0], [74, 0], [76, 0], [90, 0], [92, 0], [94, 0], [96, 0]]),
      REL,
    );
    expect(a.state).toBe("no-link");
  });
});

describe("pearson", () => {
  it("ідеальна пряма — 1", () => {
    expect(pearson(pts([[1, 1], [2, 2], [3, 3]]))).toBeCloseTo(1);
  });

  it("ідеальна обернена — −1", () => {
    expect(pearson(pts([[1, 3], [2, 2], [3, 1]]))).toBeCloseTo(-1);
  });

  it("вироджена дисперсія — null", () => {
    expect(pearson(pts([[1, 5], [2, 5], [3, 5]]))).toBeNull(); // y стала
    expect(pearson(pts([[2, 1], [2, 2], [2, 3]]))).toBeNull(); // x стала
  });

  it("менше 3 точок — null", () => {
    expect(pearson(pts([[1, 1], [2, 2]]))).toBeNull();
  });
});

describe("strengthOf", () => {
  it("шкала |r|: <0.3 слабкий, до 0.6 помітний, вище — сильний", () => {
    expect(strengthOf(0.29)).toBe("weak");
    expect(strengthOf(-0.3)).toBe("notable");
    expect(strengthOf(0.6)).toBe("notable");
    expect(strengthOf(-0.7)).toBe("strong");
  });
});
```

- [ ] **Step 2: Переконатися, що нові тести падають**

Run: `npm run test -- correlations`
Expected: FAIL — `analyzePair`, `pearson`, `strengthOf` не експортуються.

- [ ] **Step 3: Реалізація**

Дописати в кінець `src/lib/correlations.ts`:

```ts
// ----------------------- Аналіз пари -----------------------

export type PairKey = "kcal-weight" | "steps-weight" | "protein-tonnage";

export interface PairThresholds {
  /** Мінімальна різниця середніх X між групами — без контрасту нема що порівнювати. */
  minXContrast: number;
  /** Поріг значущості різниці Y: кг/тиж (absolute) або частка (relative). */
  minYDiff: number;
  yDiffMode: "absolute" | "relative";
}

/**
 * Пороги — зі спеки. Контраст ккал 120 — нижче точності підрахунку калорій;
 * 0.2 кг/тиж — типовий шум води навіть після тижневого усереднення;
 * 0.12 — той самий дух, що MIN_MEANINGFUL_DIFF у інсайтах циклу.
 */
export const THRESHOLDS: Record<PairKey, PairThresholds> = {
  "kcal-weight": { minXContrast: 120, minYDiff: 0.2, yDiffMode: "absolute" },
  "steps-weight": { minXContrast: 1000, minYDiff: 0.2, yDiffMode: "absolute" },
  "protein-tonnage": { minXContrast: 10, minYDiff: 0.12, yDiffMode: "relative" },
};

export type PairAnalysis =
  | { state: "collecting"; n: number; needed: number }
  | { state: "no-contrast"; n: number; points: PairPoint[] }
  | { state: "no-link"; n: number; r: number | null; points: PairPoint[] }
  | {
      state: "link";
      n: number;
      r: number | null;
      points: PairPoint[];
      /** Середні X груп — для тексту «≈1650 проти ≈2100». */
      lowX: number;
      highX: number;
      lowY: number;
      highY: number;
      /** highY − lowY; знак — напрям звʼязку. */
      diff: number;
      /** Межа груп — вертикальна лінія на scatter. */
      medianX: number;
    };

/** Пірсонів r; null, якщо точок < 3 або дисперсія X чи Y нульова. */
export function pearson(points: PairPoint[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type LinkStrength = "weak" | "notable" | "strong";

/** Словесна шкала |r| для підпису під scatter; вердикт картки від неї не залежить. */
export function strengthOf(r: number): LinkStrength {
  const a = Math.abs(r);
  if (a < 0.3) return "weak";
  if (a <= 0.6) return "notable";
  return "strong";
}

function mean(arr: PairPoint[], key: "x" | "y"): number {
  return arr.reduce((s, p) => s + p[key], 0) / arr.length;
}

/**
 * Медіанний спліт із трьома чесними порогами (мінімум тижнів, контраст X,
 * значуща різниця Y). При непарній кількості точок середня відкидається з
 * обох груп — контраст між ними стає різкішим, а не розмитим.
 */
export function analyzePair(points: PairPoint[], t: PairThresholds): PairAnalysis {
  const n = points.length;
  if (n < MIN_WEEKS) return { state: "collecting", n, needed: MIN_WEEKS };

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const half = Math.floor(n / 2);
  const low = sorted.slice(0, half);
  const high = sorted.slice(n - half);

  const lowX = mean(low, "x");
  const highX = mean(high, "x");
  if (highX - lowX < t.minXContrast) return { state: "no-contrast", n, points };

  const r = pearson(points);
  const lowY = mean(low, "y");
  const highY = mean(high, "y");
  const diff = highY - lowY;

  // Симетрична відносна різниця не ламається, коли нижня група близька до нуля.
  const denom = Math.abs((lowY + highY) / 2);
  const significant =
    t.yDiffMode === "absolute"
      ? Math.abs(diff) >= t.minYDiff
      : denom > 0 && Math.abs(diff) / denom >= t.minYDiff;
  if (!significant) return { state: "no-link", n, r, points };

  const medianX = (sorted[half - 1].x + sorted[n - half].x) / 2;
  return { state: "link", n, r, points, lowX, highX, lowY, highY, diff, medianX };
}
```

- [ ] **Step 4: Тести зелені**

Run: `npm run test`
Expected: PASS — увесь пакет тестів, не лише correlations (регресій немає).

- [ ] **Step 5: Commit**

```bash
git add src/lib/correlations.ts src/lib/correlations.test.ts
git commit -m "feat(insights): медіанний спліт із порогами, Пірсон і шкала сили звʼязку"
```

---

### Task 3: `ScatterChart`

**Files:**
- Create: `src/components/insights/ScatterChart.tsx`

**Interfaces:**
- Consumes: `PairPoint` з `@/lib/correlations`; `axisFor` з `@/lib/chart-scale`; TanStack Charts (`defineChart`, `dot`, `ruleX`, `ruleY`, `decorative`, `Chart` з `@tanstack/charts/react` — чистий entry без тултипа, `scaleLinear`).
- Produces (Task 4 залежить): `ScatterChart({ points, xLabel, zeroLine, medianX, xTickFormat }: { points: PairPoint[]; xLabel: string; zeroLine: boolean; medianX?: number; xTickFormat?: (v: number) => string })`.

- [ ] **Step 1: Реалізація**

Створити `src/components/insights/ScatterChart.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { axisFor } from "@/lib/chart-scale";
import type { PairPoint } from "@/lib/correlations";
import { fmtFixed } from "@/lib/utils";
import { defineChart, dot, ruleX, ruleY } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";

/** Ті самі токени тем, що в charts.tsx — графік живе в усіх темах. */
const CHART_THEME = {
  foreground: "var(--muted)",
  muted: "var(--muted)",
  grid: "var(--primary-light)",
};

/**
 * Scatter тижнів для карток інсайтів. Без тултипів (v1): точки —
 * ілюстрація висновку, а не інтерфейс дослідження.
 */
export function ScatterChart({
  points,
  xLabel,
  zeroLine,
  medianX,
  xTickFormat,
}: {
  points: PairPoint[];
  /** Підпис осі X під графіком, напр. «ккал/день». */
  xLabel: string;
  /** Нульова лінія Y — для вагових пар (вище нуля вага росла). */
  zeroLine: boolean;
  /** Межа «менших» і «більших» тижнів; лише у стані link. */
  medianX?: number;
  xTickFormat?: (v: number) => string;
}) {
  const definition = useMemo(() => {
    if (points.length === 0) return null;
    const xAxis = axisFor(points.map((p) => p.x));
    // Нуль завжди у домені вагових пар, інакше нульова лінія може випасти.
    const yAxis = axisFor([...points.map((p) => p.y), ...(zeroLine ? [0] : [])]);
    return defineChart({
      marks: [
        ...(zeroLine
          ? [
              decorative(
                ruleY([0], {
                  stroke: "var(--muted)",
                  strokeOpacity: 0.5,
                  strokeWidth: 1,
                }),
              ),
            ]
          : []),
        ...(medianX != null
          ? [
              decorative(
                ruleX([medianX], {
                  stroke: "var(--accent)",
                  strokeWidth: 1.4,
                  strokeDasharray: "4 4",
                }),
              ),
            ]
          : []),
        decorative(
          dot(points, { x: "x", y: "y", r: 3.5, fill: "var(--primary)", fillOpacity: 0.75 }),
        ),
      ],
      x: {
        scale: scaleLinear().domain(xAxis.domain),
        axis: {
          line: false,
          ticks: {
            size: 0,
            values: xAxis.ticks,
            format: (v) => (xTickFormat ?? ((n: number) => fmtFixed(n, xAxis.decimals)))(v),
          },
          tickLabels: { fontSize: 10, fontWeight: 700, opacity: 1 },
        },
      },
      y: {
        scale: scaleLinear().domain(yAxis.domain),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            values: yAxis.ticks,
            format: (v) => fmtFixed(v, yAxis.decimals),
          },
          tickLabels: { fontSize: 10, opacity: 1 },
        },
      },
      theme: CHART_THEME,
    });
  }, [points, zeroLine, medianX, xTickFormat]);

  if (!definition) return null;
  return (
    <div>
      <Chart
        definition={definition}
        height={160}
        className="wellness-chart"
        ariaLabel={`Тижні за метрикою ${xLabel}`}
      />
      <div className="mt-1 pr-1 text-right text-[10.5px] font-bold text-muted">{xLabel} →</div>
    </div>
  );
}
```

Якщо typecheck спіткнеться об опції марок чи `Chart` із `@tanstack/charts/react` — звіритися з `node_modules/@tanstack/charts/docs/` (нотатки по бібліотеці також у `charts.tsx`), не підганяти типи `as any`.

- [ ] **Step 2: Верифікація**

Run: `npm run typecheck && npm run lint`
Expected: обидва чисті.

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/ScatterChart.tsx
git commit -m "feat(insights): scatter-графік тижневих точок"
```

---

### Task 4: `PairInsightCard`

**Files:**
- Create: `src/components/insights/PairInsightCard.tsx`

**Interfaces:**
- Consumes: `PairAnalysis`, `strengthOf` з `@/lib/correlations`; `ScatterChart` з Task 3; `Card` з `@/components/ui`; `cn`, `fmt`, `plural` з `@/lib/utils`; `ChevronDown` з `lucide-react`.
- Produces (Task 5 залежить):
  - `interface PairCopy { icon: ReactNode; tint: string; xAxisLabel: string; xTickFormat?: (v: number) => string; zeroLine: boolean; link: (a: Extract<PairAnalysis, { state: "link" }>) => { title: string; text: string }; noLinkText: string; noContrastText: string }`
  - `PairInsightCard({ analysis, copy }: { analysis: PairAnalysis; copy: PairCopy })`

- [ ] **Step 1: Реалізація**

Створити `src/components/insights/PairInsightCard.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { ScatterChart } from "@/components/insights/ScatterChart";
import { Card } from "@/components/ui";
import { strengthOf, type PairAnalysis } from "@/lib/correlations";
import { cn, fmt, plural } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface PairCopy {
  icon: ReactNode;
  /** Фон квадрата іконки. */
  tint: string;
  xAxisLabel: string;
  xTickFormat?: (v: number) => string;
  zeroLine: boolean;
  /** Заголовок і речення для стану link — текст залежить від напряму diff. */
  link: (a: Extract<PairAnalysis, { state: "link" }>) => { title: string; text: string };
  noLinkText: string;
  noContrastText: string;
}

const STRENGTH_LABELS = {
  weak: "слабкий",
  notable: "помітний",
  strong: "сильний",
} as const;

/**
 * Гібридна картка інсайту: людський висновок завжди видно, scatter —
 * під «Деталями». Всі чотири стани — повноцінні відповіді, зокрема
 * «звʼязку не видно».
 */
export function PairInsightCard({
  analysis,
  copy,
}: {
  analysis: PairAnalysis;
  copy: PairCopy;
}) {
  const [open, setOpen] = useState(false);

  const { title, text } =
    analysis.state === "link"
      ? copy.link(analysis)
      : analysis.state === "no-link"
        ? { title: "Звʼязку не видно", text: copy.noLinkText }
        : analysis.state === "no-contrast"
          ? { title: "Тижні надто схожі", text: copy.noContrastText }
          : {
              title: "Ще збираємо дані",
              text: "Висновок зʼявиться, коли назбирається достатньо тижнів із заповненими даними.",
            };

  const expandable = analysis.state === "link" || analysis.state === "no-link";
  const weeksLabel = `${analysis.n} ${plural(analysis.n, "тиждень", "тижні", "тижнів")}`;

  return (
    <Card className="!p-4">
      <div className="flex items-start gap-[13px]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: copy.tint }}
        >
          {copy.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold [text-wrap:pretty]">{title}</div>
          <div className="mt-0.5 text-[12.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
            {text}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted">
              {analysis.state === "collecting"
                ? `${weeksLabel} з ${analysis.needed}`
                : `${weeksLabel} · останні 6 міс`}
            </span>
            {expandable && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-0.5 text-[12px] font-extrabold text-primary"
              >
                Деталі
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", open && "rotate-180")}
                />
              </button>
            )}
          </div>
        </div>
      </div>
      {expandable && open && (
        <div className="mt-3 border-t border-bg pt-3">
          <ScatterChart
            points={analysis.points}
            xLabel={copy.xAxisLabel}
            xTickFormat={copy.xTickFormat}
            zeroLine={copy.zeroLine}
            medianX={analysis.state === "link" ? analysis.medianX : undefined}
          />
          {analysis.r != null && (
            <div className="mt-1.5 text-center text-[11px] font-bold text-muted">
              Звʼязок {STRENGTH_LABELS[strengthOf(analysis.r)]} (r {fmt(analysis.r, 2)})
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Верифікація**

Run: `npm run typecheck && npm run lint`
Expected: обидва чисті.

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/PairInsightCard.tsx
git commit -m "feat(insights): гібридна картка інсайту з чотирма станами"
```

---

### Task 5: Сторінка `/insights`

**Files:**
- Create: `src/app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1/2: `ANALYSIS_WEEKS`, `buildWeekAggs`, `deltaWeightPoints`, `tonnagePoints`, `analyzePair`, `THRESHOLDS`, `type DayInput`
  - Task 4: `PairInsightCard`, `type PairCopy`
  - `setTonnage` з `@/lib/workouts` (сигнатура: `setTonnage(set: { weight: number | null; reps: number }): number`)
  - `Card, EmptyState, ErrorBanner, FullLoader` з `@/components/ui`; `createClient` з `@/lib/supabase/client`
  - `addDays, cn, fmt, fmtFixed, fmtInt, parseISODate, todayISO, weekBuckets` з `@/lib/utils`
- Produces: маршрут `/insights` (Task 6 ставить на нього вкладку).

- [ ] **Step 1: Реалізація**

Створити `src/app/(app)/insights/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { PairInsightCard, type PairCopy } from "@/components/insights/PairInsightCard";
import { Card, EmptyState, ErrorBanner, FullLoader } from "@/components/ui";
import {
  ANALYSIS_WEEKS,
  analyzePair,
  buildWeekAggs,
  deltaWeightPoints,
  THRESHOLDS,
  tonnagePoints,
  type DayInput,
} from "@/lib/correlations";
import { createClient } from "@/lib/supabase/client";
import { setTonnage } from "@/lib/workouts";
import {
  addDays,
  cn,
  fmt,
  fmtFixed,
  fmtInt,
  parseISODate,
  todayISO,
  weekBuckets,
} from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 22 22",
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Тексти й вигляд трьох пар. Математика — у THRESHOLDS, тут лише подача. */
const KCAL_COPY: PairCopy = {
  tint: "#FBE9EE",
  icon: (
    <svg {...ICON} stroke="#C05B71">
      <path d="M6.5 3v5.5M4 3v3a2.5 2.5 0 0 0 5 0V3M6.5 8.5V19" />
      <path d="M15 3c-1.6 1.2-2.5 3.1-2.5 5.5 0 1.6 1 2.5 2.5 2.5V19" />
    </svg>
  ),
  xAxisLabel: "ккал/день",
  zeroLine: true,
  link: (a) =>
    a.diff > 0
      ? {
          title: "Калорії справді працюють",
          text: `У тижні з меншими калоріями (≈${fmtInt(a.lowX)} проти ≈${fmtInt(a.highX)}) вага падала в середньому на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з більшими калоріями (≈${fmtInt(a.highX)} проти ≈${fmtInt(a.lowX)}) вага падала на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше. Пояснень не вигадуємо — так виглядають твої дані.`,
        },
  noLinkText:
    "Різниця між тижнями з більшими й меншими калоріями — в межах звичного розкиду. Це теж відповідь: на твоїх даних цей важіль зараз не головний.",
  noContrastText:
    "Твої тижні надто схожі за калоріями, щоб порівняти. Так буває при стабільному режимі харчування.",
};

const STEPS_COPY: PairCopy = {
  tint: "#F1EAF8",
  icon: (
    <svg {...ICON} stroke="#8D79AD">
      <path d="M3 11.5h3l2.5-6 4 11.5 2.5-5.5h4" />
    </svg>
  ),
  xAxisLabel: "кроки, тис./день",
  xTickFormat: (v) => fmtFixed(v / 1000, 0),
  zeroLine: true,
  link: (a) =>
    a.diff < 0
      ? {
          title: "Кроки прискорюють прогрес",
          text: `У тижні з більшою кількістю кроків (≈${fmtInt(a.highX)} проти ≈${fmtInt(a.lowX)}) вага падала в середньому на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з меншою кількістю кроків (≈${fmtInt(a.lowX)} проти ≈${fmtInt(a.highX)}) вага падала на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше. Пояснень не вигадуємо — так виглядають твої дані.`,
        },
  noLinkText:
    "Різниця між тижнями з більшою й меншою кількістю кроків — у межах звичного розкиду. На твоїх даних темп ваги вирішують інші чинники.",
  noContrastText:
    "Кількість кроків у твоїх тижнях надто стабільна, щоб порівняти. Так буває при усталеній рутині.",
};

const PROTEIN_COPY: PairCopy = {
  tint: "#EAF4EF",
  icon: (
    <svg {...ICON} stroke="#6E9C88">
      <path d="M4 8.5v5M18 8.5v5M6.5 7v8M15.5 7v8M6.5 11h9" />
    </svg>
  ),
  xAxisLabel: "білок, г/день",
  zeroLine: false,
  link: (a) => {
    const pct = a.lowY > 0 ? fmtInt((Math.abs(a.diff) / a.lowY) * 100) : null;
    return a.diff > 0
      ? {
          title: "Білок підтримує обʼєм тренувань",
          text: `У тижні з більшим білком (≈${fmtInt(a.highX)} г проти ≈${fmtInt(a.lowX)} г) тоннаж тренувань був ${pct ? `на ${pct}% більший` : "істотно більший"}.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з більшим білком (≈${fmtInt(a.highX)} г проти ≈${fmtInt(a.lowX)} г) тоннаж був ${pct ? `на ${pct}% менший` : "меншим"}. Пояснень не вигадуємо — так виглядають твої дані.`,
        };
  },
  noLinkText:
    "Тоннаж у тижні з більшим і меншим білком відрізняється в межах звичного розкиду. Це теж відповідь — обʼєм тренувань у тебе тримається не на білку.",
  noContrastText:
    "Білок у твоїх тижнях надто стабільний, щоб порівняти. Так буває при усталеному раціоні.",
};

interface Loaded {
  days: DayInput[];
  tonnageByDate: Map<string, number>;
}

export default function InsightsPage() {
  const supabase = useMemo(() => createClient(), []);

  // Вікно аналізу: останні ANALYSIS_WEEKS завершених тижнів Пн–Нд.
  const { firstMonday, lastSunday } = useMemo(() => {
    const today = todayISO();
    const fromMonday = (parseISODate(today).getDay() + 6) % 7; // 0 = понеділок
    const lastSunday = addDays(today, -fromMonday - 1);
    return { firstMonday: addDays(lastSunday, -(ANALYSIS_WEEKS * 7 - 1)), lastSunday };
  }, []);

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");

        const [logs, workouts] = await Promise.all([
          supabase
            .from("daily_logs")
            .select("date, weight, kcal, steps, protein")
            .eq("user_id", uid)
            .gte("date", firstMonday)
            .lte("date", lastSunday)
            .order("date", { ascending: true }),
          supabase
            .from("workouts")
            .select("date, workout_sets(weight, reps)")
            .eq("user_id", uid)
            .gte("date", firstMonday)
            .lte("date", lastSunday)
            .order("date", { ascending: true }),
        ]);
        if (logs.error) throw logs.error;
        if (workouts.error) throw workouts.error;
        if (cancelled) return;

        // Один день = сумарний тоннаж; кілька тренувань за день додаються.
        const tonnageByDate = new Map<string, number>();
        for (const w of (workouts.data ?? []) as {
          date: string;
          workout_sets: { weight: number | null; reps: number }[] | null;
        }[]) {
          const total = (w.workout_sets ?? []).reduce((s, set) => s + setTonnage(set), 0);
          if (total > 0) tonnageByDate.set(w.date, (tonnageByDate.get(w.date) ?? 0) + total);
        }

        setData({ days: (logs.data ?? []) as DayInput[], tonnageByDate });
      } catch {
        if (!cancelled) setError("Не вдалося завантажити інсайти. Перевір зʼєднання.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, firstMonday, lastSunday]);

  const analyses = useMemo(() => {
    if (!data) return null;
    const weeks = weekBuckets(firstMonday, lastSunday);
    const aggs = buildWeekAggs(data.days, data.tonnageByDate, weeks);
    return {
      kcal: analyzePair(deltaWeightPoints(aggs, "kcal"), THRESHOLDS["kcal-weight"]),
      steps: analyzePair(deltaWeightPoints(aggs, "steps"), THRESHOLDS["steps-weight"]),
      protein: analyzePair(tonnagePoints(aggs), THRESHOLDS["protein-tonnage"]),
    };
  }, [data, firstMonday, lastSunday]);

  const isEmpty = data !== null && data.days.length === 0 && data.tonnageByDate.size === 0;

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Інсайти</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-muted">
          Що насправді впливає — по твоїх тижнях за останні 6 місяців
        </p>
      </div>

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : isEmpty ? (
        <EmptyState
          emoji="🔍"
          title="Ще немає даних"
          hint="Заповнюй щоденник на вкладці «Сьогодні» — і тут зʼявляться висновки про те, що працює саме для тебе."
        />
      ) : (
        analyses && (
          <>
            <PairInsightCard analysis={analyses.kcal} copy={KCAL_COPY} />
            <PairInsightCard analysis={analyses.steps} copy={STEPS_COPY} />
            <PairInsightCard analysis={analyses.protein} copy={PROTEIN_COPY} />
            <MethodologyCard />
          </>
        )
      )}
    </div>
  );
}

/** Згорнута примітка про методологію — чесність фічі має бути перевірною. */
function MethodologyCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="!p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[13px] font-extrabold">Як це порахувано</span>
        <ChevronDown
          size={18}
          className={cn("text-primary transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-bg px-4 pb-4 pt-3 text-[12.5px] font-semibold leading-[1.55] text-muted">
          <p>
            Дані згортаються в тижні Пн–Нд за останні {ANALYSIS_WEEKS} завершених тижнів.
            Тиждень враховується, коли метрику заповнено щонайменше 4 дні
            (для ваги — 3 зважування).
          </p>
          <p>
            Зміна ваги береться зі зсувом на тиждень: зʼїдене цього тижня видно
            на терезах наступного.
          </p>
          <p>
            Тижні діляться навпіл — «менші» проти «більших» за метрикою — і
            порівнюються середні. Висновок зʼявляється лише коли різниця
            перевищує поріг шуму: 0,2 кг/тиж для ваги, 12% для тоннажу.
            «Звʼязку не видно» — теж чесний результат, а не помилка.
          </p>
          <p>
            Коливання циклу тижневе усереднення згладжує, але не виключає
            повністю — сприймай висновки як орієнтир, а не вирок.
          </p>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Верифікація**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: усе чисте/зелене.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/insights/page.tsx"
git commit -m "feat(insights): сторінка /insights — три взаємозвʼязки з чесними порогами"
```

---

### Task 6: Навігація («Інсайти» в таб-бар, «Цикл» у профіль) + фінальна верифікація

**Files:**
- Modify: `src/components/TabBar.tsx:51-60` (елемент «Цикл» у масиві `TABS`)
- Modify: `src/app/(app)/settings/page.tsx:299-309` (`SettingsLink` «Цикл»)

**Interfaces:**
- Consumes: маршрут `/insights` з Task 5.
- Produces: —

- [ ] **Step 1: Замінити вкладку «Цикл» на «Інсайти»**

У `src/components/TabBar.tsx` елемент масиву `TABS` із `href: "/cycle"` замінити на:

```tsx
  {
    href: "/insights",
    label: "Інсайти",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M11 3a5.6 5.6 0 0 1 3.2 10.2c-.7.5-1.2 1.2-1.2 2v.3H9v-.3c0-.8-.5-1.5-1.2-2A5.6 5.6 0 0 1 11 3z" />
        <path d="M9.2 19h3.6" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Лінк «Цикл» у профілі — на головну сторінку циклу**

У `src/app/(app)/settings/page.tsx` наявний `SettingsLink` «Цикл» змінити: `href="/settings/cycle"` → `href="/cycle"`, `subtitle="Трекінг, прогнози, фази в аналітиці"` → `subtitle="Календар, симптоми та прогнози"`. Іконка та title лишаються. (Налаштування циклу доступні зі сторінки `/cycle` — лінк там уже є.)

- [ ] **Step 3: Повна верифікація**

Run: `npm run test && npm run typecheck && npm run lint && npm run build`
Expected: усе зелене; build проходить, у виводі маршрутів є `/insights`.

- [ ] **Step 4: Ручна перевірка (dev)**

Run: `npm run dev`, відкрити застосунок:
- таб-бар: пʼята позиція — «Профіль», четверта — «Інсайти» з лампочкою; вкладка підсвічується на `/insights`;
- `/insights`: три картки (у акаунті з даними — стани відповідають даним; у порожньому — EmptyState), «Деталі» розгортають scatter, «Як це порахувано» розгортається;
- профіль → «Цикл» веде на `/cycle`; зі сторінки циклу досяжні його налаштування;
- сторінки `/cycle/**` не підсвічують жодну вкладку (як `/measurements`).

- [ ] **Step 5: Commit**

```bash
git add src/components/TabBar.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat(nav): вкладка «Інсайти» замість «Циклу», цикл — у профілі"
```
