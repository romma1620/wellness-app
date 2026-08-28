"use client";

import { useMemo, useState } from "react";
import { axisFor, niceAxis, sparklinePoints } from "@/lib/chart-scale";
import { PHASE_COLORS, PHASE_LABELS, type Phase } from "@/lib/cycle/types";
import { fmt, fmtFixed, fmtInt } from "@/lib/utils";
import { bandX, barY, defineChart, dot, lineY, rect, ruleX, whenFocused } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { scaleBand } from "@tanstack/charts/scales/band";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";
import { bandDays, type PhaseBand } from "@/lib/chart-bands";

/**
 * Повертає попереднє значення, поки key не зміниться: мемо по вмісту, а не по
 * ідентичності. useRef із мутацією під час рендеру тут не годиться —
 * react-hooks/refs забороняє читати чи писати ref.current у тілі рендеру, а
 * useMemo(() => value, [key]) ловить попередження exhaustive-deps на
 * навмисно пропущеному value. Тому — офіційний патерн "adjusting state
 * during render" (react.dev/reference/react/useState, розділ "Storing
 * information from previous renders"): setState під час рендеру, поки умова
 * не стане хибною, безпечний і не породжує зайвого кадру.
 */
function useStableByKey<T>(value: T, key: string): T {
  const [state, setState] = useState(() => ({ key, value }));
  if (state.key !== key) {
    setState({ key, value });
    return value;
  }
  return state.value;
}

/**
 * Підписи тіків TanStack фарбує токеном theme.muted, сітку — theme.grid.
 * Передаємо CSS-змінні застосунку, щоб графіки жили в усіх темах.
 */
const CHART_THEME = {
  foreground: "var(--muted)",
  muted: "var(--muted)",
  grid: "var(--line)",
};

/** Підписи осей редизайну: 10px, вага 500, приглушені. */
const TICK_LABELS = { fontSize: 10, fontWeight: 500, opacity: 1 } as const;

/** Той самий вигін, що recharts type="monotone". */
const monotone = d3Curve(curveMonotoneX);

export interface WeightPoint {
  label: string;
  weight: number | null;
  ma: number | null;
  /** Фаза циклу цього дня — читається лише тултипом. */
  phase?: Phase | null;
  cycleDay?: number | null;
}

export type { PhaseBand } from "@/lib/chart-bands";

/**
 * Прозорість смуг підібрана так, щоб короткі фази (овуляція, ПМС) читались
 * не слабше за довгі: однакова альфа робила б вузьку смугу майже невидимою.
 */
const BAND_OPACITY: Record<Phase, number> = {
  menstrual: 0.09,
  follicular: 0.09,
  ovulation: 0.14,
  luteal: 0.09,
  late_luteal: 0.13,
};

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
        // Смуги фаз — rect-клітинки по днях: на band-шкалі rect з рівними
        // кінцями розтягується рівно на клітинку дня, тож смуги безшовні,
        // одноденні видимі, а день без фази лишається чистим.
        ...(bands ?? []).map((b) =>
          decorative(
            rect(bandDays(b, labels), {
              id: `band-${b.phase}-${b.x1}`,
              x: (label) => label,
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
          stroke: "var(--muted)",
          strokeWidth: 1.8,
          strokeOpacity: 0.7,
          strokeDasharray: "5 6",
          curve: monotone,
        }),
        lineY(weightPoints, {
          id: "weight",
          x: "label",
          y: "weight",
          stroke: "var(--accent)",
          strokeWidth: 2.4,
          curve: monotone,
        }),
        decorative(
          dot(weightPoints, { x: "label", y: "weight", r: 3, fill: "var(--accent)" }),
        ),
        whenFocused(
          dot(weightPoints, {
            x: "label",
            y: "weight",
            r: 5,
            fill: "var(--surface)",
            stroke: "var(--accent)",
            strokeWidth: 2.4,
          }),
          { match: "x" },
        ),
      ],
      x: {
        // band замість point: rect-смуги фаз потребують реальної bandwidth
        // (point-шкала її не має). paddingInner типово 0, тож крок і центри
        // категорій ті самі, що й у point-шкали з padding(0.5) — геометрія
        // ліній/точок не змінюється.
        scale: scaleBand<string>().domain(labels),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: { ...TICK_LABELS, thin: { minGap: 12, priority: "ends" } },
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
          tickLabels: TICK_LABELS,
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
            {d.weight != null && <div className="text-accent">Вага {fmt(d.weight, 1)} кг</div>}
            {d.ma != null && <div className="text-muted">Тренд {fmt(d.ma, 1)} кг</div>}
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
          fill: "var(--accent)",
          radius: 5,
        }),
      ],
      x: {
        scale: scaleBand<string>().domain(data.map((d) => d.label)).padding(0.22),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: { ...TICK_LABELS, thin: { minGap: 12, priority: "ends" } },
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
          tickLabels: TICK_LABELS,
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
  // Легенду («тис. кроків») малює шапка картки, що викликає графік.
  return (
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
          <span className="text-accent">
            {d.label}: {fmtInt(d.steps)} кроків
          </span>
        );
      }}
    />
  );
}

/** Легкий SVG-спарклайн (без recharts) для карток. */
export function Sparkline({ values }: { values: number[] }) {
  const w = 100;
  const h = 28;
  const points = sparklinePoints(values, w, h, 4);
  if (points.length === 0) {
    return <div className="h-7" />;
  }
  const pts = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="mt-1.5">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  // Виклики (MeasurementsSection, WorkoutProgress) будують масив data заново
  // щоразу — у MeasurementsSection навіть на кожне натискання клавіші. Мемо
  // нижче по ідентичності data тому ніколи не спрацював би: стабілізуємо
  // спершу за вмістом, і лише тоді визначення графіка мемоізується насправді.
  const signature = data.map((d) => `${d.label}:${d.value ?? ""}`).join("|");
  const stableData = useStableByKey(data, signature);
  const definition = useMemo(() => {
    // Замість recharts connectNulls: марки отримують лише заповнені дні,
    // а повний список міток фіксує вісь X явним доменом.
    const points = stableData.filter(
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
          stroke: "var(--accent)",
          strokeWidth: 2.4,
          curve: monotone,
        }),
        // Статичні точки — декоративні, щоб не дублювати точки взаємодії лінії.
        decorative(
          dot(points, { x: "label", y: "value", r: 3, fill: "var(--accent)" }),
        ),
        // Аналог recharts activeDot: кільце над точкою під курсором.
        whenFocused(
          dot(points, {
            x: "label",
            y: "value",
            r: 5,
            fill: "var(--surface)",
            stroke: "var(--accent)",
            strokeWidth: 2.4,
          }),
          { match: "x" },
        ),
      ],
      x: {
        scale: scalePoint<string>().domain(stableData.map((d) => d.label)).padding(0.5),
        axis: {
          line: false,
          ticks: { size: 0 },
          tickLabels: { ...TICK_LABELS, thin: { minGap: 16, priority: "ends" } },
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
          tickLabels: TICK_LABELS,
        },
      },
      focus: "group-x",
      focusRing: false,
      theme: CHART_THEME,
      tooltip,
    });
  }, [stableData]);

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
          <span className="text-accent">
            {d.label}: {fmt(d.value, 1)} {unit}
          </span>
        );
      }}
    />
  );
}
