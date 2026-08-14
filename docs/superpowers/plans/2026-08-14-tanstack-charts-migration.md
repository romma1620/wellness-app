# План: міграція графіків на TanStack Charts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замінити recharts на `@tanstack/charts@^0.13.0` у `src/components/charts.tsx`, зберігши зовнішні пропси компонентів і візуальний вигляд.

**Architecture:** Кожен компонент будує framework-незалежну дефініцію через `defineChart(...)` у `useMemo` і рендерить `<Chart>` з `@tanstack/charts/react/tooltip` (потрібен `renderTooltipBody`). Осі рахує наш `chart-scale.ts` (домен через інстанс `scaleLinear().domain(...)`, тіки через `axis.ticks.values`). Смуги фаз — по одному `decorative(rect(...))` на смугу; стики смуг готує нова чиста функція `tileBands`.

**Tech Stack:** Next 16 (App Router, client components), React 19, `@tanstack/charts` 0.13.x, `d3-shape` (крива monotone), Tailwind 3, vitest (лише чиста логіка).

## Global Constraints

- Залежність: `@tanstack/charts@^0.13.0` (semver 0.x — `^0.13.0` не пустить 0.14).
- Пропси `WeightChart`, `StepsBars`, `MetricLine`, `Sparkline` НЕ змінюються; файли-споживачі (`analytics/page.tsx`, `MeasurementsSection.tsx`, `WorkoutProgress.tsx`, `__probe/page.tsx`) не редагуються.
- `Sparkline` не чіпати (чистий SVG).
- Тести: vitest ТІЛЬКИ для чистої логіки (`src/lib/**`); UI перевіряється `npm run typecheck && npm run lint && npm run build` + вручну.
- Коміти: conventional commits українською, як в історії репо (`feat(charts): ...`).
- Довідка по API лежить у самому пакеті: `node_modules/@tanstack/charts/docs/**` і `node_modules/@tanstack/charts/llms.txt`. При сумніві щодо API спершу читати їх, не вгадувати.
- Кольори — тільки через CSS-змінні застосунку (`var(--primary)` тощо), без хардкоду хексів.

## Файлова структура

- Modify: `package.json` (+`@tanstack/charts`, +`d3-shape`, +`@types/d3-shape`; recharts видаляється в Task 4)
- Modify: `src/components/charts.tsx` (переписуються 3 компоненти; `Sparkline` без змін)
- Create: `src/lib/chart-bands.ts` (+ тип `PhaseBand`, функція `tileBands`)
- Create: `src/lib/chart-bands.test.ts`
- Modify: `src/app/globals.css` (CSS-змінні тултип-хрому)

---

### Task 1: Залежності, спільні константи, міграція MetricLine

**Files:**
- Modify: `package.json`
- Modify: `src/components/charts.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `niceAxis(min, max)` з `@/lib/chart-scale` → `{ domain: [number, number]; ticks: number[]; decimals: number }`.
- Produces: константа `CHART_THEME` і константа `monotone` (ChartCurve) у `charts.tsx` — Task 2 і Task 3 використовують їх у своїх дефініціях; CSS-клас `wellness-chart` для пропа `className` компонента `Chart`.

- [ ] **Step 1: Встановити залежності**

```bash
npm install @tanstack/charts@^0.13.0 d3-shape
npm install -D @types/d3-shape
```

Перевірити: `npm ls @tanstack/charts d3-shape` показує обидва пакети без помилок; у `package.json` recharts ПОКИ залишається (WeightChart/StepsBars ще на ньому).

- [ ] **Step 2: Стилі тултип-хрому в globals.css**

Вбудований тултип TanStack малює власну «коробку», стилізовану через CSS-змінні `--ts-chart-tooltip-*` (див. `node_modules/@tanstack/charts/docs/guides/themes-and-styling.md`). Додати в кінець `src/app/globals.css`:

```css
/* Тултипи TanStack Charts у стилі карток застосунку (shadow-card з tailwind.config). */
.wellness-chart {
  --ts-chart-tooltip-background: var(--surface);
  --ts-chart-tooltip-border: none;
  --ts-chart-tooltip-border-radius: 12px;
  --ts-chart-tooltip-shadow: 0 8px 24px -12px rgba(80, 55, 45, 0.16);
  --ts-chart-tooltip-font: 700 11px/1.45 var(--font-nunito), system-ui, sans-serif;
}
```

- [ ] **Step 3: Спільні імпорти й константи в charts.tsx**

Додати до наявних імпортів (recharts-імпорти поки не чіпати — WeightChart/StepsBars ще на них):

```tsx
import { useMemo } from "react";
import { defineChart, dot, lineY, whenFocused } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";
```

Після блоку імпортів додати:

```tsx
/**
 * Підписи тіків TanStack фарбує токеном theme.muted, сітку — theme.grid.
 * Передаємо CSS-змінні застосунку, щоб графіки жили в усіх темах.
 */
const CHART_THEME = {
  foreground: "var(--muted)",
  muted: "var(--muted)",
  grid: "var(--primary-light)",
};

/** Той самий вигін, що recharts type="monotone". */
const monotone = d3Curve(curveMonotoneX);
```

- [ ] **Step 4: Переписати MetricLine**

Замінити тіло `MetricLine` повністю (пропси лишаються `{ data, height = 150, unit = "см" }`):

```tsx
/** Універсальний лінійний міні-графік для замірів. */
export function MetricLine({
  data,
  height = 150,
  unit = "см",
}: {
  data: { label: string; value: number | null }[];
  height?: number;
  unit?: string;
}) {
  const definition = useMemo(() => {
    // Замість recharts connectNulls: марки отримують лише заповнені дні,
    // а повний список міток фіксує вісь X явним доменом.
    const points = data.filter(
      (d): d is { label: string; value: number } => d.value != null,
    );
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    const axis = niceAxis(Math.min(...vals), Math.max(...vals));
    return defineChart({
      marks: [
        lineY(points, {
          x: "label",
          y: "value",
          stroke: "var(--primary)",
          strokeWidth: 3,
          curve: monotone,
        }),
        // Статичні точки — декоративні, щоб не дублювати точки взаємодії лінії.
        decorative(
          dot(points, { x: "label", y: "value", r: 3.5, fill: "var(--primary)" }),
        ),
        // Аналог recharts activeDot: кільце над точкою під курсором.
        whenFocused(
          dot(points, {
            x: "label",
            y: "value",
            r: 5,
            fill: "var(--surface)",
            stroke: "var(--primary)",
            strokeWidth: 3,
          }),
          { match: "x" },
        ),
      ],
      x: {
        scale: scalePoint<string>().domain(data.map((d) => d.label)).padding(0.5),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: {
            fontSize: 10,
            fontWeight: 700,
            opacity: 1,
            thin: { minGap: 16, priority: "ends" },
          },
        },
      },
      y: {
        scale: scaleLinear().domain(axis.domain),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            values: axis.ticks,
            format: (v) => fmtFixed(v, axis.decimals),
          },
          tickLabels: { fontSize: 10, opacity: 1 },
        },
      },
      focus: "group-x",
      focusRing: false,
      theme: CHART_THEME,
      tooltip,
    });
  }, [data]);

  if (!definition) {
    return (
      <div className="py-6 text-center text-[12px] font-semibold text-muted">Немає даних</div>
    );
  }
  return (
    <Chart
      definition={definition}
      height={height}
      className="wellness-chart"
      ariaLabel={`Графік замірів, ${unit}`}
      renderTooltipBody={({ points }) => {
        const p = points[0];
        if (!p) return null;
        const d = p.datum as { label: string; value: number };
        return (
          <span className="text-primary">
            {d.label}: {fmt(d.value, 1)} {unit}
          </span>
        );
      }}
    />
  );
}
```

Нюанси:
- Порожній стан «Немає даних» тепер рахується від `points.length === 0` (та сама умова, що була).
- Якщо typecheck скаржиться на тип `v` у `format` — тип тіка виводиться зі шкали як `number`; звіритись із `ChartAxisOptions` у `node_modules/@tanstack/charts/docs/reference/scales-guides-and-color.md`.
- `focusRing: false` — бо авторська фокус-точка (`whenFocused`-dot) замінює рідний індикатор.

- [ ] **Step 5: Перевірка**

```bash
npm run typecheck && npm run lint && npm run build
```

Очікування: без помилок. Попередження про невикористані recharts-імпорти бути не може — вони ще використовуються рештою компонентів.

- [ ] **Step 6: Коміт**

```bash
git add package.json package-lock.json src/components/charts.tsx src/app/globals.css
git commit -m "feat(charts): TanStack Charts і міграція MetricLine"
```

---

### Task 2: Міграція StepsBars

**Files:**
- Modify: `src/components/charts.tsx`

**Interfaces:**
- Consumes: `CHART_THEME`, клас `wellness-chart` (Task 1); `niceAxis` з `@/lib/chart-scale`; `bandX`, `barY`, `scaleBand` з `@tanstack/charts`.
- Produces: нічого нового для наступних тасків.

- [ ] **Step 1: Додати імпорти**

До імпорту з `@tanstack/charts` додати `bandX` і `barY`; додати рядок:

```tsx
import { scaleBand } from "@tanstack/charts/scales/band";
```

- [ ] **Step 2: Переписати StepsBars**

Замінити тіло `StepsBars` повністю (пропси лишаються):

```tsx
export function StepsBars({ data }: { data: { label: string; steps: number | null }[] }) {
  const definition = useMemo(() => {
    const points = data.filter(
      (d): d is { label: string; steps: number } => d.steps != null,
    );
    if (points.length === 0) return null;
    // Вісь рахуємо в тисячах — саме в них підписані тіки, тож і округлення має бути там.
    const maxK = Math.max(...points.map((d) => d.steps)) / 1000;
    const axis = niceAxis(0, maxK);
    return defineChart({
      marks: [
        // Аналог recharts Tooltip cursor: підсвітка колонки під курсором.
        whenFocused(
          bandX(points, {
            x: "label",
            fill: "var(--primary-light)",
            fillOpacity: 0.4,
          }),
          { match: "x" },
        ),
        barY(points, {
          x: "label",
          y: "steps",
          fill: "var(--primary)",
          radius: 4,
        }),
      ],
      x: {
        scale: scaleBand<string>().domain(data.map((d) => d.label)).padding(0.22),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: {
            fontSize: 10.5,
            fontWeight: 700,
            opacity: 1,
            thin: { minGap: 12, priority: "ends" },
          },
        },
      },
      y: {
        scale: scaleLinear().domain([axis.domain[0] * 1000, axis.domain[1] * 1000]),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            values: axis.ticks.map((t) => t * 1000),
            format: (v) => (v === 0 ? "0" : fmtFixed(v / 1000, axis.decimals)),
          },
          tickLabels: { fontSize: 10, opacity: 1 },
        },
      },
      focus: "group-x",
      focusRing: false,
      theme: CHART_THEME,
      tooltip,
    });
  }, [data]);

  if (!definition) {
    return <div className="py-6 text-center text-[12px] font-semibold text-muted">Немає даних</div>;
  }
  return (
    <div>
      {/* Легенда й раніше була повністю кастомною — лишаємо її звичайним JSX. */}
      <div className="flex h-[22px] items-center justify-end pr-1 text-[11px] font-bold text-primary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
          кроки, тис.
        </span>
      </div>
      <Chart
        definition={definition}
        height={148}
        className="wellness-chart"
        ariaLabel="Кроки за днями"
        renderTooltipBody={({ points }) => {
          const p = points[0];
          if (!p) return null;
          const d = p.datum as { label: string; steps: number };
          return (
            <span className="text-primary">
              {d.label}: {fmtInt(d.steps)} кроків
            </span>
          );
        }}
      />
    </div>
  );
}
```

Нюанси:
- Висота 22px легенди + 148px графіка = 170px, як у recharts-версії (там легенда жила всередині контейнера 170).
- Порожній стан — та сама умова, що була (`data.some(...)` еквівалентно `points.length > 0`).

- [ ] **Step 3: Перевірка**

```bash
npm run typecheck && npm run lint && npm run build
```

- [ ] **Step 4: Коміт**

```bash
git add src/components/charts.tsx
git commit -m "feat(charts): міграція StepsBars на TanStack Charts"
```

---

### Task 3: tileBands і міграція WeightChart

**Files:**
- Create: `src/lib/chart-bands.ts`
- Create: `src/lib/chart-bands.test.ts`
- Modify: `src/components/charts.tsx`

**Interfaces:**
- Consumes: `CHART_THEME`, `monotone`, клас `wellness-chart` (Task 1); `axisFor` з `@/lib/chart-scale`; `PHASE_COLORS`, `PHASE_LABELS`, `Phase` з `@/lib/cycle/types`; `rect`, `ruleX` з `@tanstack/charts`.
- Produces: `tileBands(bands: PhaseBand[], labels: string[]): PhaseBand[]` та тип `PhaseBand { phase: Phase; x1: string; x2: string }` у `@/lib/chart-bands`; `charts.tsx` ре-експортує `PhaseBand` (зворотна сумісність публічного API модуля).

Чому tileBands: recharts `ReferenceArea` на категорійній осі накривав категорії x1..x2 разом із «шириною» краю, тож суміжні смуги фаз стикувались без щілин. Точкова шкала TanStack мапить мітку в точку-центр, тому rect x1..x2 — це «центр—центр»: між суміжними смугами лишалась би щілина в один день. `tileBands` розтягує x2 кожної смуги до x1 наступної, але ТІЛЬКИ якщо наступна починається рівно наступного дня (день без фази має лишатись розривом — див. коментар до `bandsForSeries` у `src/lib/cycle/phases.ts`).

- [ ] **Step 1: Написати падаючий тест**

Створити `src/lib/chart-bands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tileBands, type PhaseBand } from "./chart-bands";

const labels = ["01", "02", "03", "04", "05", "06", "07"];

describe("tileBands", () => {
  it("розтягує суміжні смуги до спільної межі", () => {
    const bands: PhaseBand[] = [
      { phase: "menstrual", x1: "01", x2: "02" },
      { phase: "follicular", x1: "03", x2: "05" },
    ];
    expect(tileBands(bands, labels)).toEqual([
      { phase: "menstrual", x1: "01", x2: "03" },
      { phase: "follicular", x1: "03", x2: "05" },
    ]);
  });

  it("не тягне смугу через день без фази", () => {
    const bands: PhaseBand[] = [
      { phase: "luteal", x1: "01", x2: "02" },
      // День "03" без фази: наступна смуга починається з "04".
      { phase: "menstrual", x1: "04", x2: "06" },
    ];
    expect(tileBands(bands, labels)).toEqual(bands);
  });

  it("остання смуга і порожній список лишаються як є", () => {
    expect(tileBands([], labels)).toEqual([]);
    const single: PhaseBand[] = [{ phase: "ovulation", x1: "02", x2: "02" }];
    expect(tileBands(single, labels)).toEqual(single);
  });

  it("не мутує вхідні смуги", () => {
    const bands: PhaseBand[] = [
      { phase: "menstrual", x1: "01", x2: "02" },
      { phase: "follicular", x1: "03", x2: "04" },
    ];
    tileBands(bands, labels);
    expect(bands[0].x2).toBe("02");
  });
});
```

- [ ] **Step 2: Переконатися, що тест падає**

Run: `npx vitest run src/lib/chart-bands.test.ts`
Очікування: FAIL — модуль `./chart-bands` не існує.

- [ ] **Step 3: Реалізувати chart-bands.ts**

Створити `src/lib/chart-bands.ts`:

```ts
import type { Phase } from "@/lib/cycle/types";

/** Смуга фази у категоріях осі X (мітки точок), включно з обома краями. */
export interface PhaseBand {
  phase: Phase;
  x1: string;
  x2: string;
}

/**
 * Готує смуги до точкової шкали: rect «центр—центр» лишав би щілину в один
 * день між суміжними фазами, тому x2 кожної смуги розтягується до x1
 * наступної. Розтяжки нема, якщо наступна смуга починається НЕ наступного
 * дня — день без фази мусить лишитись видимим розривом.
 */
export function tileBands(bands: PhaseBand[], labels: string[]): PhaseBand[] {
  const index = new Map(labels.map((label, i) => [label, i]));
  return bands.map((band, i) => {
    const next = bands[i + 1];
    if (!next) return band;
    const end = index.get(band.x2);
    const nextStart = index.get(next.x1);
    return end != null && nextStart === end + 1 ? { ...band, x2: next.x1 } : band;
  });
}
```

- [ ] **Step 4: Переконатися, що тести проходять**

Run: `npx vitest run src/lib/chart-bands.test.ts`
Очікування: 4 passed.

- [ ] **Step 5: Переписати WeightChart**

В `charts.tsx`: до імпорту з `@tanstack/charts` додати `rect` і `ruleX`; додати:

```tsx
import { tileBands, type PhaseBand } from "@/lib/chart-bands";
```

Видалити локальне оголошення `interface PhaseBand {...}` разом з його коментарем і замість нього ре-експортувати тип:

```tsx
export type { PhaseBand } from "@/lib/chart-bands";
```

`WeightPoint` і `BAND_OPACITY` лишаються як є. Замінити `WeightChart` і видалити компонент `WeightTooltip` (його вміст переїжджає в `renderTooltipBody`):

```tsx
export function WeightChart({
  data,
  bands,
  cycleStarts,
}: {
  data: WeightPoint[];
  /** Фонові смуги фаз. Порожньо або undefined = графік без циклу. */
  bands?: PhaseBand[];
  /** Мітки осі X, на яких починався цикл. */
  cycleStarts?: string[];
}) {
  const definition = useMemo(() => {
    // Обидві серії, а не лише вага: тренд тягнеться з попереднього періоду і
    // може виходити далеко за межі ваг цього тижня.
    const axis = axisFor(data.flatMap((d) => [d.weight, d.ma]));
    const labels = data.map((d) => d.label);
    const weightPoints = data.filter((d) => d.weight != null);
    const maPoints = data.filter((d) => d.ma != null);
    const [yLo, yHi] = axis.domain;
    return defineChart({
      marks: [
        // Смуги й лінії стартів оголошені до серій, щоб лягти під них.
        // rect має константний fill, тому кожна смуга — окрема марка.
        ...tileBands(bands ?? [], labels).map((b) =>
          decorative(
            rect([b], {
              id: `band-${b.phase}-${b.x1}`,
              x1: "x1",
              x2: "x2",
              y1: () => yLo,
              y2: () => yHi,
              fill: PHASE_COLORS[b.phase],
              fillOpacity: BAND_OPACITY[b.phase],
              inset: 0,
            }),
          ),
        ),
        ...(cycleStarts?.length
          ? [
              ruleX(cycleStarts, {
                stroke: PHASE_COLORS.menstrual,
                strokeWidth: 1.6,
                strokeOpacity: 1,
                strokeDasharray: "3 3",
              }),
            ]
          : []),
        lineY(maPoints, {
          id: "ma",
          x: "label",
          y: "ma",
          stroke: "var(--accent)",
          strokeWidth: 2.2,
          strokeDasharray: "6 6",
          curve: monotone,
        }),
        lineY(weightPoints, {
          id: "weight",
          x: "label",
          y: "weight",
          stroke: "var(--primary)",
          strokeWidth: 3.2,
          curve: monotone,
        }),
        decorative(
          dot(weightPoints, { x: "label", y: "weight", r: 3.5, fill: "var(--primary)" }),
        ),
        whenFocused(
          dot(weightPoints, {
            x: "label",
            y: "weight",
            r: 5,
            fill: "var(--surface)",
            stroke: "var(--primary)",
            strokeWidth: 3,
          }),
          { match: "x" },
        ),
      ],
      x: {
        scale: scalePoint<string>().domain(labels).padding(0.5),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: {
            fontSize: 10.5,
            fontWeight: 700,
            opacity: 1,
            thin: { minGap: 12, priority: "ends" },
          },
        },
      },
      y: {
        scale: scaleLinear().domain(axis.domain),
        grid: true,
        axis: {
          line: false,
          ticks: {
            size: 0,
            values: axis.ticks,
            format: (v) => fmtFixed(v, axis.decimals),
          },
          tickLabels: { fontSize: 10, opacity: 1 },
        },
      },
      focus: "group-x",
      focusRing: false,
      theme: CHART_THEME,
      tooltip,
    });
  }, [data, bands, cycleStarts]);

  return (
    <Chart
      definition={definition}
      height={160}
      className="wellness-chart"
      ariaLabel="Динаміка ваги"
      renderTooltipBody={({ points }) => {
        // Фаза лежить у самій точці даних, тому досить першої точки групи.
        const p = points[0];
        if (!p) return null;
        const d = p.datum as WeightPoint;
        const phase = d.phase ?? null;
        return (
          <div>
            <div className="text-muted">{d.label}</div>
            {d.weight != null && <div className="text-primary">Вага {fmt(d.weight, 1)} кг</div>}
            {d.ma != null && <div className="text-accent">Тренд {fmt(d.ma, 1)} кг</div>}
            {phase && (
              <div className="mt-0.5" style={{ color: PHASE_COLORS[phase] }}>
                {d.cycleDay != null && `День циклу ${d.cycleDay} · `}
                {PHASE_LABELS[phase]}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
```

Нюанси:
- `WeightChart` і в recharts-версії не мав порожнього стану — дефініція завжди створюється (у `axisFor` є фолбек на порожні дані), тому тут `useMemo` без `null`.
- `rect([b], ...)` — одна смуга на марку; `id` стабільний між оновленнями (той самий ключ, що був у recharts `key`).
- `y1`/`y2` — аксесори-константи на межі домену: аналог recharts `ifOverflow="hidden"` не потрібен, бо межі й так у домені.
- У `ruleX` датумом є сама мітка (рядок) — окремий канал `x` не потрібен; `strokeOpacity: 1` обовʼязково, бо дефолт правил — 0.5.

- [ ] **Step 6: Повна перевірка**

```bash
npm run test && npm run typecheck && npm run lint && npm run build
```

- [ ] **Step 7: Коміт**

```bash
git add src/lib/chart-bands.ts src/lib/chart-bands.test.ts src/components/charts.tsx
git commit -m "feat(charts): міграція WeightChart на TanStack Charts і tileBands"
```

---

### Task 4: Видалення recharts і фінальна перевірка

**Files:**
- Modify: `src/components/charts.tsx` (видалити мертві recharts-імпорти, якщо лишились)
- Modify: `package.json`

**Interfaces:**
- Consumes: результати Tasks 1–3 (жоден компонент більше не імпортує recharts).
- Produces: фінальний стан гілки без recharts.

- [ ] **Step 1: Переконатися, що recharts ніде не використовується**

```bash
grep -rn "recharts" src
```

Очікування: порожньо. Якщо в `charts.tsx` лишився блок `import { ... } from "recharts"` — видалити його.

- [ ] **Step 2: Видалити залежність**

```bash
npm uninstall recharts
```

Перевірити: у `package.json` і `package-lock.json` recharts відсутній.

- [ ] **Step 3: Повна перевірка**

```bash
npm run test && npm run typecheck && npm run lint && npm run build
```

- [ ] **Step 4: Ручна перевірка**

Запустити `npm run dev` і перевірити (є службова сторінка `/__probe` зі `StepsBars` і `WeightChart`, заміри — на екрані замірів, повна аналітика — на `/analytics`):

- WeightChart: лінія ваги з точками, пунктирний тренд, смуги фаз стикуються без щілин (день без фази — видимий розрив), пунктирні лінії стартів циклу, тултип з вагою/трендом/фазою/днем циклу, збільшене кільце на точці під курсором.
- StepsBars: заокруглені бари, тіки в тисячах, «0» внизу, легенда «кроки, тис.», підсвітка колонки і тултип «N кроків».
- MetricLine: згладжена лінія з точками, тултип «мітка: значення од.», пропущені дні не рвуть лінію.
- Порожні стани «Немає даних» на екранах без записів.
- Теми: перемкнути кольорову тему застосунку і перевірити, що осі/сітка/тултипи підхопили нові CSS-змінні.

Якщо щось візуально розʼїхалось — правити дефініції (падінги шкал, товщини, opacity), звіряючись із `node_modules/@tanstack/charts/docs/**`; пропси компонентів не чіпати.

- [ ] **Step 5: Коміт**

```bash
git add package.json package-lock.json src/components/charts.tsx
git commit -m "feat(charts): прибрати recharts"
```
