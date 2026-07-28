# Care Frequency Dot Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dot-plot card to the Analytics page showing how often each skincare action (tag in `daily_logs.care`) was performed across the selected period.

**Architecture:** Pure logic lives in `src/lib/care.ts` (tag parsing, a stable tag→colour map keyed on first-ever use, and the row matrix for a period) and is unit-tested with vitest. Rendering is a plain CSS grid in `src/components/CareDotChart.tsx` — not recharts, because this is a matrix rather than a curve. The Analytics page adds one lightweight full-history query used only to keep colours stable across period changes. No database changes.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind 3, Supabase JS, vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-care-frequency-chart-design.md`.
- No schema changes. `daily_logs.care` stays a comma-separated text column.
- Palette is fixed and theme-independent — exactly these eight slots, in this order:
  `#2E9155`, `#E4749F`, `#C9A84A`, `#7B4FB8`, `#50B7FE`, `#A9246E`, `#8B5A00`, `#1980E8`;
  fallback `#8A8A8A`. Do not substitute CSS theme variables for series colours.
- Colour is bound to the tag, never to its position in the sorted list.
- Every row carries a permanently visible text label — colour must never be the only
  carrier of identity (this is what discharges the palette's contrast warning).
- Testing convention: vitest covers pure logic only. UI is verified with
  `npm run typecheck`, `npm run lint`, `npm run build`, plus manual checks.
- All user-facing copy is Ukrainian.
- Tailwind arbitrary values follow the existing style in `src/components/` (e.g. `text-[11px]`, `font-bold`, `text-muted`).

---

### Task 1: Move `splitTags` into the lib layer

`src/lib/care.ts` needs to parse comma-separated tags, but `splitTags` currently lives in `src/components/inputs.tsx`, which is a `"use client"` module. Move it to `src/lib/utils.ts` so pure logic does not depend on a client component. It is only used inside `inputs.tsx` today, so the move is isolated.

**Files:**
- Modify: `src/lib/utils.ts` (append at end of file)
- Modify: `src/components/inputs.tsx:301-307` (delete the function), and its import block at the top
- Create: `src/lib/utils.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `splitTags(v: string | null | undefined): string[]` exported from `@/lib/utils`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitTags } from "./utils";

describe("splitTags", () => {
  it("розбиває рядок по комах і обрізає пробіли", () => {
    expect(splitTags(" Скраб , Крем ")).toEqual(["Скраб", "Крем"]);
  });

  it("порожні значення дають порожній масив", () => {
    expect(splitTags(null)).toEqual([]);
    expect(splitTags(undefined)).toEqual([]);
    expect(splitTags("")).toEqual([]);
    expect(splitTags(" , ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: FAIL — `splitTags` is not exported from `./utils`.

- [ ] **Step 3: Add the function to `src/lib/utils.ts`**

Append at the end of the file:

```ts
// ----------------------- Теги -----------------------

/** "Скраб, Крем" -> ["Скраб", "Крем"] */
export function splitTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/utils.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Remove the old copy from `inputs.tsx`**

Delete this block from `src/components/inputs.tsx` (currently at lines 301-307):

```ts
export function splitTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
```

Then add `splitTags` to the existing `@/lib/utils` import at the top of the file. The import currently reads:

```ts
import { cn } from "@/lib/utils";
```

Change it to:

```ts
import { cn, splitTags } from "@/lib/utils";
```

If `inputs.tsx` has no `@/lib/utils` import line, add `import { splitTags } from "@/lib/utils";` alongside the other imports.

- [ ] **Step 6: Verify nothing else referenced the old export**

Run: `npx tsc --noEmit`
Expected: no errors. (`splitTags` was only used inside `inputs.tsx`, at the two call sites in `PresetChips` and `TagInput`, which now resolve through the import.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts src/components/inputs.tsx
git commit -m "refactor(tags): move splitTags into lib/utils"
```

---

### Task 2: Tag colour map in `src/lib/care.ts`

Builds the stable tag→colour assignment. Presets are pinned to slots 1-4; custom tags take the next free slot in order of first-ever appearance; the ninth tag onward gets the neutral grey.

**Files:**
- Create: `src/lib/care.ts`
- Create: `src/lib/care.test.ts`

**Interfaces:**
- Consumes: `splitTags` from `@/lib/utils` (Task 1).
- Produces:
  - `CARE_PRESETS: string[]`
  - `CARE_COLORS: string[]` (8 entries)
  - `CARE_FALLBACK_COLOR: string`
  - `interface CareTag { key: string; label: string; color: string }`
  - `careKey(tag: string): string`
  - `buildCareColorMap(history: CareHistoryRow[]): Map<string, CareTag>`
  - `interface CareHistoryRow { date: string; care: string | null }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/care.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildCareColorMap,
  careKey,
  CARE_COLORS,
  CARE_FALLBACK_COLOR,
  CARE_PRESETS,
  type CareHistoryRow,
} from "./care";

const h = (date: string, care: string | null): CareHistoryRow => ({ date, care });

describe("careKey", () => {
  it("нормалізує регістр і пробіли", () => {
    expect(careKey(" Крем ")).toBe("крем");
    expect(careKey("КРЕМ")).toBe("крем");
  });
});

describe("buildCareColorMap", () => {
  it("пресети закріплені за слотами 1-4, навіть без жодного запису", () => {
    const map = buildCareColorMap([]);
    CARE_PRESETS.forEach((preset, i) => {
      expect(map.get(careKey(preset))?.color).toBe(CARE_COLORS[i]);
    });
  });

  it("власні теги отримують слоти за порядком першої появи", () => {
    const map = buildCareColorMap([h("2026-01-02", "Міуінг"), h("2026-01-03", "Масаж")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });

  it("порядок визначає дата, а не позиція в масиві", () => {
    const map = buildCareColorMap([h("2026-03-01", "Масаж"), h("2026-01-01", "Міуінг")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });

  it("тег той самий незалежно від регістру й пробілів", () => {
    const map = buildCareColorMap([h("2026-01-01", " міуінг "), h("2026-01-02", "МІУІНГ")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("міуінг")?.label).toBe("міуінг");
    expect([...map.keys()].filter((k) => k === "міуінг")).toHaveLength(1);
  });

  it("новий тег не перефарбовує наявні", () => {
    const before = buildCareColorMap([h("2026-01-01", "Міуінг")]);
    const after = buildCareColorMap([h("2026-01-01", "Міуінг"), h("2026-02-01", "Масаж")]);
    expect(after.get("міуінг")?.color).toBe(before.get("міуінг")?.color);
  });

  it("девʼятий тег отримує нейтральний сірий", () => {
    const history = ["a", "b", "c", "d", "e"].map((t, i) => h(`2026-01-0${i + 1}`, t));
    const map = buildCareColorMap(history);
    expect(map.get("d")?.color).toBe(CARE_COLORS[7]);
    expect(map.get("e")?.color).toBe(CARE_FALLBACK_COLOR);
  });

  it("null та порожній care ігноруються", () => {
    const map = buildCareColorMap([h("2026-01-01", null), h("2026-01-02", " , ")]);
    expect(map.size).toBe(CARE_PRESETS.length);
  });

  it("кілька тегів в одному дні беруться в порядку рядка", () => {
    const map = buildCareColorMap([h("2026-01-01", "Міуінг, Масаж")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/care.test.ts`
Expected: FAIL — cannot resolve `./care`.

- [ ] **Step 3: Write `src/lib/care.ts`**

```ts
import { splitTags } from "@/lib/utils";

/** Пресети догляду на головній. Порядок задає перші чотири кольори. */
export const CARE_PRESETS = ["Скраб", "Крем", "Гуаша", "Маска"];

/**
 * Вісім слотів категорійної палітри, однакові на всіх темах.
 * Перевірені валідатором на розділення при дальтонізмі — порядок міняти не можна.
 */
export const CARE_COLORS = [
  "#2E9155", // зелений
  "#E4749F", // рожевий
  "#C9A84A", // золотий
  "#7B4FB8", // лаванда
  "#50B7FE", // блакитний
  "#A9246E", // малиновий
  "#8B5A00", // бронза
  "#1980E8", // синій
];

/** Девʼятий і далі тег: більше кольорів надійно не розрізнити. */
export const CARE_FALLBACK_COLOR = "#8A8A8A";

export interface CareTag {
  key: string;
  label: string;
  color: string;
}

export interface CareHistoryRow {
  date: string; // YYYY-MM-DD
  care: string | null;
}

/** Теги порівнюються без урахування регістру й країв. */
export function careKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Мапа «ключ тега → колір» за порядком першої появи за всю історію.
 * Минуле не змінюється, тому новий тег ніколи не перефарбовує наявні.
 */
export function buildCareColorMap(history: CareHistoryRow[]): Map<string, CareTag> {
  const map = new Map<string, CareTag>();

  CARE_PRESETS.forEach((label, i) => {
    map.set(careKey(label), { key: careKey(label), label, color: CARE_COLORS[i] });
  });

  let slot = CARE_PRESETS.length;
  const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date));

  for (const row of chronological) {
    for (const tag of splitTags(row.care)) {
      const key = careKey(tag);
      if (!key || map.has(key)) continue;
      map.set(key, {
        key,
        label: tag.trim(),
        color: slot < CARE_COLORS.length ? CARE_COLORS[slot] : CARE_FALLBACK_COLOR,
      });
      slot++;
    }
  }

  return map;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/care.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/care.ts src/lib/care.test.ts
git commit -m "feat(care): stable tag colour map keyed on first use"
```

---

### Task 3: Period matrix in `src/lib/care.ts`

Turns the period's logs into sorted rows: one per tag that occurred at least once, with a per-day boolean array and a count.

**Files:**
- Modify: `src/lib/care.ts` (append)
- Modify: `src/lib/care.test.ts` (append a new `describe` block)

**Interfaces:**
- Consumes: `CareTag`, `CareHistoryRow`, `careKey`, `CARE_FALLBACK_COLOR` (Task 2); `addDays`, `splitTags` from `@/lib/utils`.
- Produces:
  - `interface CareRow extends CareTag { count: number; days: boolean[] }`
  - `buildCareMatrix(logs: CareHistoryRow[], startISO: string, days: number, colors: Map<string, CareTag>): CareRow[]`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/care.test.ts`, and extend the existing import from `./care` to include `buildCareMatrix` (shown after the test code below):

```ts
describe("buildCareMatrix", () => {
  const colors = buildCareColorMap([]);
  const week = (logs: CareHistoryRow[]) => buildCareMatrix(logs, "2026-07-27", 7, colors);

  it("позначає правильні дні й рахує кількість", () => {
    const rows = week([h("2026-07-27", "Крем"), h("2026-07-29", "Крем")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].days).toEqual([true, false, true, false, false, false, false]);
  });

  it("кілька доглядів в один день дають окремі рядки", () => {
    const rows = week([h("2026-07-27", "Крем, Скраб")]);
    expect(rows.map((r) => r.key).sort()).toEqual(["крем", "скраб"]);
    expect(rows.every((r) => r.days[0])).toBe(true);
  });

  it("сортує за кількістю спадання", () => {
    const rows = week([
      h("2026-07-27", "Скраб, Крем"),
      h("2026-07-28", "Крем"),
      h("2026-07-29", "Крем"),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["крем", "скраб"]);
    expect(rows.map((r) => r.count)).toEqual([3, 1]);
  });

  it("при рівній кількості порядок беруть з мапи кольорів", () => {
    const rows = week([h("2026-07-27", "Маска, Скраб")]);
    expect(rows.map((r) => r.key)).toEqual(["скраб", "маска"]);
  });

  it("теги, яких не було в періоді, у рядки не потрапляють", () => {
    const rows = week([h("2026-07-27", "Крем")]);
    expect(rows.map((r) => r.key)).toEqual(["крем"]);
  });

  it("дні поза періодом ігноруються", () => {
    const rows = week([h("2026-07-20", "Крем"), h("2026-08-10", "Крем")]);
    expect(rows).toHaveLength(0);
  });

  it("дубль тега в один день рахується один раз", () => {
    const rows = week([h("2026-07-27", "Крем, крем")]);
    expect(rows[0].count).toBe(1);
  });

  it("null і порожній care не ламають підрахунок", () => {
    const rows = week([h("2026-07-27", null), h("2026-07-28", " , "), h("2026-07-29", "Крем")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
  });

  it("тег, якого немає в мапі кольорів, отримує запасний сірий", () => {
    const rows = week([h("2026-07-27", "Невідомий")]);
    expect(rows[0].color).toBe(CARE_FALLBACK_COLOR);
    expect(rows[0].label).toBe("Невідомий");
  });

  it("бере колір і написання з мапи", () => {
    const rows = week([h("2026-07-27", "крем")]);
    expect(rows[0].color).toBe(CARE_COLORS[1]);
    expect(rows[0].label).toBe("Крем");
  });
});
```

Update the import at the top of `src/lib/care.test.ts` to:

```ts
import {
  buildCareColorMap,
  buildCareMatrix,
  careKey,
  CARE_COLORS,
  CARE_FALLBACK_COLOR,
  CARE_PRESETS,
  type CareHistoryRow,
} from "./care";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/care.test.ts`
Expected: FAIL — `buildCareMatrix` is not exported.

- [ ] **Step 3: Append the implementation to `src/lib/care.ts`**

Change the first import line to bring in `addDays`:

```ts
import { addDays, splitTags } from "@/lib/utils";
```

Then append:

```ts
export interface CareRow extends CareTag {
  /** Скільки днів у періоді цей догляд був. */
  count: number;
  /** Довжина = кількість днів періоду; true = того дня догляд був. */
  days: boolean[];
}

/**
 * Рядки графіка за період [startISO, startISO + days).
 * Сортування: за кількістю спадання, при рівності — за порядком у мапі кольорів.
 */
export function buildCareMatrix(
  logs: CareHistoryRow[],
  startISO: string,
  days: number,
  colors: Map<string, CareTag>,
): CareRow[] {
  const column = new Map<string, number>();
  for (let i = 0; i < days; i++) column.set(addDays(startISO, i), i);

  const rows = new Map<string, CareRow>();

  for (const log of logs) {
    const col = column.get(log.date);
    if (col === undefined) continue;
    for (const tag of splitTags(log.care)) {
      const key = careKey(tag);
      if (!key) continue;
      let row = rows.get(key);
      if (!row) {
        const known = colors.get(key);
        row = {
          key,
          label: known?.label ?? tag.trim(),
          color: known?.color ?? CARE_FALLBACK_COLOR,
          count: 0,
          days: Array<boolean>(days).fill(false),
        };
        rows.set(key, row);
      }
      if (!row.days[col]) {
        row.days[col] = true;
        row.count++;
      }
    }
  }

  const order = [...colors.keys()];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  return [...rows.values()].sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/care.test.ts`
Expected: PASS, 19 tests total.

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: all suites pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/care.ts src/lib/care.test.ts
git commit -m "feat(care): build per-period dot matrix rows"
```

---

### Task 4: `CareDotChart` component

The grid itself: legend, rows of dots, date axis, tap-to-inspect line. No recharts.

**Files:**
- Create: `src/components/CareDotChart.tsx`

**Interfaces:**
- Consumes: `CareRow` from `@/lib/care` (Task 3); `parseISODate`, `shortDate` from `@/lib/utils`.
- Produces: `CareDotChart({ rows, dates }: { rows: CareRow[]; dates: string[] })` — `dates` is every ISO day of the period in order, so `dates.length === rows[i].days.length`.

- [ ] **Step 1: Write the component**

Create `src/components/CareDotChart.tsx`:

```tsx
"use client";

import type { CareRow } from "@/lib/care";
import { parseISODate, shortDate } from "@/lib/utils";
import { Fragment, useState } from "react";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Підписуємо 1-ше число й кожне пʼяте — інакше на телефоні підписи злипаються. */
function axisLabel(iso: string, weekMode: boolean): string {
  const d = parseISODate(iso);
  if (weekMode) return WD[(d.getDay() + 6) % 7];
  const day = d.getDate();
  return day === 1 || day % 5 === 0 ? String(day) : "";
}

export function CareDotChart({ rows, dates }: { rows: CareRow[]; dates: string[] }) {
  const [active, setActive] = useState<{ key: string; iso: string } | null>(null);

  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] font-semibold text-muted">
        Ще немає доглядів за цей період
      </div>
    );
  }

  const weekMode = dates.length <= 7;
  const dot = weekMode ? 10 : 6;
  const activeRow = active ? rows.find((r) => r.key === active.key) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {rows.map((row) => (
          <span
            key={row.key}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            {row.label}
          </span>
        ))}
      </div>

      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `68px repeat(${dates.length}, minmax(0, 1fr)) 22px` }}
      >
        {rows.map((row) => (
          <Fragment key={row.key}>
            <div className="truncate pr-1.5 text-[11px] font-bold text-ink">{row.label}</div>
            {row.days.map((on, i) => (
              <button
                key={dates[i]}
                type="button"
                disabled={!on}
                onClick={() => setActive({ key: row.key, iso: dates[i] })}
                aria-label={on ? `${row.label}, ${shortDate(dates[i])}` : undefined}
                className="flex h-6 items-center justify-center"
              >
                <span
                  className="rounded-full transition-transform"
                  style={
                    on
                      ? {
                          width: dot,
                          height: dot,
                          background: row.color,
                          transform:
                            active?.key === row.key && active.iso === dates[i]
                              ? "scale(1.35)"
                              : undefined,
                        }
                      : { width: 3, height: 3, background: "var(--primary-light)" }
                  }
                />
              </button>
            ))}
            <div className="pl-1 text-right text-[10.5px] font-bold text-muted">{row.count}</div>
          </Fragment>
        ))}

        <div />
        {dates.map((iso) => (
          <div
            key={iso}
            className="pt-1 text-center text-[9.5px] font-bold leading-none text-muted"
          >
            {axisLabel(iso, weekMode)}
          </div>
        ))}
        <div />
      </div>

      <div className="mt-2 h-4 text-center text-[11px] font-bold text-muted">
        {active && activeRow ? `${shortDate(active.iso)} · ${activeRow.label}` : ""}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings for the new file.

(`text-ink` maps to `var(--text)` in `tailwind.config.ts:14`; `text-muted` and `--primary-light` are the same tokens the other charts use.)

- [ ] **Step 3: Commit**

```bash
git add src/components/CareDotChart.tsx
git commit -m "feat(care): dot chart grid component"
```

---

### Task 5: Wire the card into the Analytics page

Fetches the full care history once (for colour stability), builds the rows for the current period, and renders the card after the steps chart. Also switches the home page to the shared `CARE_PRESETS`.

**Files:**
- Modify: `src/app/(app)/analytics/page.tsx` (imports, new state + effect, new memo, new card after the steps `Card`)
- Modify: `src/app/(app)/page.tsx:27` (drop the local `CARE_PRESETS`, import it instead)

**Interfaces:**
- Consumes: `buildCareColorMap`, `buildCareMatrix`, `CARE_PRESETS`, `type CareHistoryRow` from `@/lib/care` (Tasks 2-3); `CareDotChart` from `@/components/CareDotChart` (Task 4).
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the imports to `src/app/(app)/analytics/page.tsx`**

Add below the existing `charts` import:

```tsx
import { CareDotChart } from "@/components/CareDotChart";
import { buildCareColorMap, buildCareMatrix, type CareHistoryRow } from "@/lib/care";
```

- [ ] **Step 2: Add the history state and its fetch**

Add next to the other `useState` calls in `AnalyticsPage`:

```tsx
const [careHistory, setCareHistory] = useState<CareHistoryRow[]>([]);
```

Add a new `useEffect` after the existing logs-loading effect. It runs once per mount and does **not** depend on the period:

```tsx
// Кольори доглядів мають бути стабільні між періодами, тому порядок першої появи
// беремо з усієї історії. Помилка тут не критична — нижче є запасний шлях.
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from("daily_logs")
        .select("date, care")
        .eq("user_id", uid)
        .not("care", "is", null)
        .order("date", { ascending: true });
      if (error) throw error;
      if (!cancelled) setCareHistory((data ?? []) as CareHistoryRow[]);
    } catch {
      if (!cancelled) setCareHistory([]);
    }
  })();
  return () => {
    cancelled = true;
  };
}, [supabase]);
```

- [ ] **Step 3: Build the rows**

Add after the existing `stepsData` memo. Note it filters `logs` inline rather than using `curLogs` — `curLogs` is a fresh array on every render, so it would defeat the memo:

```tsx
const careRows = useMemo(() => {
  const inPeriod = logs.filter((l) => l.date >= curStart && l.date <= curEnd);
  // Якщо історія не завантажилась, кольори будуємо з логів періоду.
  const colors = buildCareColorMap(careHistory.length ? careHistory : inPeriod);
  return buildCareMatrix(inPeriod, curStart, N, colors);
}, [logs, careHistory, curStart, curEnd, N]);

const careDates = useMemo(
  () => Array.from({ length: N }, (_, i) => addDays(curStart, i)),
  [curStart, N],
);
```

- [ ] **Step 4: Render the card**

Directly after the closing `</Card>` of the steps chart (the `Card` containing `<StepsBars ... />`), and still inside the same fragment:

```tsx
{/* Догляд за шкірою */}
<Card className="!p-[14px]">
  <div className="mb-2.5 text-[12px] font-bold text-muted">
    Догляд за шкірою, {period === "week" ? "тиж." : "міс."}
  </div>
  <CareDotChart rows={careRows} dates={careDates} />
</Card>
```

- [ ] **Step 5: Share `CARE_PRESETS` with the home page**

In `src/app/(app)/page.tsx`, delete line 27:

```tsx
const CARE_PRESETS = ["Скраб", "Крем", "Гуаша", "Маска"];
```

and add to the imports:

```tsx
import { CARE_PRESETS } from "@/lib/care";
```

The `<PresetChips presets={CARE_PRESETS} ... />` usage stays unchanged.

- [ ] **Step 6: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests pass, no type errors, no lint errors, build succeeds.

- [ ] **Step 7: Manual check**

Run: `npm run dev`, open the Analytics tab, and confirm:
- the card appears below the steps chart;
- switching Тиждень/Місяць keeps each tag's colour identical;
- gaps between the day columns are readable in Місяць (31 columns);
- tapping a dot shows `19 липня · Крем` under the grid;
- a period with no care shows «Ще немає доглядів за цей період»;
- the card looks right on all four themes (Settings → тема).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/analytics/page.tsx" "src/app/(app)/page.tsx"
git commit -m "feat(analytics): skincare frequency dot chart card"
```
