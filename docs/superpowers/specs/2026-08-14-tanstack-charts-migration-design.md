# Міграція графіків на TanStack Charts

Дата: 2026-08-14

## Мета

Замінити recharts на `@tanstack/charts` (0.13.0) у `src/components/charts.tsx`.
Зовнішні пропси компонентів `WeightChart`, `StepsBars`, `MetricLine` не
змінюються — сторінки-споживачі не чіпаємо. Візуальний вигляд графіків
зберігається. `Sparkline` не змінюється (чистий SVG без бібліотек).

## Контекст і обмеження

- TanStack Charts — нова бібліотека (реліз липень 2026), стабільної 1.0 ще
  немає. Свідомо мігруємо на 0.13.0; діапазон `^0.13.0` не пустить ламаючий
  мінор (semver для 0.x).
- Старий пакет `react-charts` (beta, покинутий з 2023) не використовуємо;
  сучасний пакет — `@tanstack/charts` з React-адаптером
  `@tanstack/charts/react`.
- Пакет шипить власну документацію (`docs/`, `llms.txt`) і skill
  `migrate-to-tanstack-charts` — під час імплементації звірятися з ними, а не
  з памʼяттю.

## Залежності

- `@tanstack/charts@^0.13.0` — dependencies.
- `d3-shape` (+ `@types/d3-shape` у dev) — TanStack не бандлить інтерполяції;
  наші лінії згладжені (`monotone`), потрібен `curveMonotoneX` через адаптер
  `d3Curve` з `@tanstack/charts/d3/shape`.
- `recharts` видаляється останнім комітом.

## Архітектура

Кожен компонент будує `defineChart(...)` у `useMemo` від пропсів і рендерить
`<Chart definition={...} height={...} ariaLabel={...}>`. Ширина адаптивна за
замовчуванням — `ResponsiveContainer` зникає.

`chart-scale.ts` (`axisFor`/`niceAxis`/`sparklinePoints`) залишається без
змін: домен Y передаємо через `scaleLinear().domain(...)`, наші «гарні» тіки —
через `axis.ticks.values`, формат підписів — через `axis.ticks.format`.

Кастомні тултипи: імпорт `Chart` з `@tanstack/charts/react/tooltip`, вміст —
через проп `renderTooltipBody` (дані рядка доступні як `point.datum`);
поведінка тултипа (`tooltip` з `@tanstack/charts/tooltip`) лишається в
дефініції.

### MetricLine

- `lineY` (крива monotone, `var(--primary)`, ширина 3) + окремий `dot` для
  точок r 3.5.
- Recharts мав `connectNulls`; TanStack розриває лінію на null. Тому
  null-рядки фільтруємо перед маркою, а повний список міток днів фіксуємо
  явним доменом `scalePoint().domain(labels)`, щоб вісь X не стискалась.
- Тултип: `label: value unit`, стилі як зараз.

### StepsBars

- `barY` з `radius: 4`, `fill: var(--primary)`, сітка `grid: true`.
- Тіки Y у тисячах через `axis.ticks.format` (логіка з `niceAxis` у тисячах —
  як зараз).
- Легенда «кроки, тис.» — звичайний JSX-рядок над графіком (вона й зараз
  повністю кастомна), chart-легенда не потрібна.

### WeightChart

Порядок марок (знизу вгору):

1. Смуги фаз — `decorative(rect(...))`: `x1`/`x2` — мітки країв смуги,
   `y1`/`y2` — межі домену з `axisFor`, `fill` з `PHASE_COLORS`,
   `fillOpacity` з `BAND_OPACITY`, `inset: 0`. Обгортка `decorative` прибирає
   фальшиві точки взаємодії, щоб смуги не потрапляли у тултип.
2. Старти циклу — `ruleX` з пунктиром `3 3`, колір `PHASE_COLORS.menstrual`.
3. Тренд — `lineY` (`ma`), `strokeDasharray: "6 6"`, `var(--accent)`.
4. Вага — `lineY` (`weight`) + `dot` r 3.5.

Обидві серії фільтруються від null окремо (замість `connectNulls`), домен X —
явний `scalePoint().domain(labels)`.

Спільний тултип по X: фокус-режим `group-x`; вміст поточного `WeightTooltip`
(вага, тренд, фаза, день циклу) переноситься в `renderTooltipBody`, фаза
читається з `point.datum`.

## Відомий компроміс

«Активна точка» (збільшене кільце під курсором) робиться через `states`
(focus-оверрайди марок). Поведінка збережеться; піксельної ідентичності з
recharts (`activeDot` r 5 з обводкою) може не бути.

## Обробка помилок і порожні стани

Поточні порожні стани («Немає даних») лишаються без змін — вони рахуються до
рендера графіка. Нових станів помилок міграція не додає.

## Тестування

За конвенцією проєкту: vitest лише для чистої логіки — якщо фільтрація
null-рядків/підготовка рядів виділиться в чисту функцію, покрити тестом.
UI: `npm run typecheck`, `npm run lint`, `npm run build` + ручна перевірка
трьох графіків у застосунку (включно з тултипами, смугами фаз, стартами
циклу).

## План комітів

Гілка `feat/tanstack-charts` від `main`:

1. залежності + міграція `MetricLine`;
2. міграція `StepsBars`;
3. міграція `WeightChart`;
4. видалення `recharts`.
