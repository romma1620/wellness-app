"use client";

import { useMemo } from "react";
import { axisFor, niceAxis, sparklinePoints } from "@/lib/chart-scale";
import { PHASE_COLORS, PHASE_LABELS, type Phase } from "@/lib/cycle/types";
import { fmt, fmtFixed, fmtInt } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bandX, barY, defineChart, dot, lineY, whenFocused } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { scaleBand } from "@tanstack/charts/scales/band";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";

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

export interface WeightPoint {
  label: string;
  weight: number | null;
  ma: number | null;
  /** Фаза циклу цього дня — читається лише тултипом. */
  phase?: Phase | null;
  cycleDay?: number | null;
}

/** Смуга фази у категоріях осі X (мітки точок), включно з обома краями. */
export interface PhaseBand {
  phase: Phase;
  x1: string;
  x2: string;
}

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
  // Обидві серії, а не лише вага: тренд тягнеться з попереднього періоду і
  // може виходити далеко за межі ваг цього тижня.
  const axis = axisFor(data.flatMap((d) => [d.weight, d.ma]));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
        {/* Смуги й лінії стартів оголошені до серій, щоб лягти під них. */}
        {bands?.map((b) => (
          <ReferenceArea
            key={`${b.phase}-${b.x1}`}
            x1={b.x1}
            x2={b.x2}
            fill={PHASE_COLORS[b.phase]}
            fillOpacity={BAND_OPACITY[b.phase]}
            stroke="none"
            ifOverflow="hidden"
          />
        ))}
        {cycleStarts?.map((x) => (
          <ReferenceLine
            key={x}
            x={x}
            stroke={PHASE_COLORS.menstrual}
            strokeWidth={1.6}
            strokeDasharray="3 3"
            ifOverflow="hidden"
          />
        ))}
        <CartesianGrid stroke="var(--primary-light)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10.5, fontWeight: 700, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={12}
        />
        <YAxis
          domain={axis.domain}
          ticks={axis.ticks}
          interval={0}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={axis.decimals > 0 ? 40 : 34}
          tickFormatter={(v: number) => fmtFixed(v, axis.decimals)}
        />
        <Tooltip content={<WeightTooltip />} />
        <Line
          type="monotone"
          dataKey="ma"
          stroke="var(--accent)"
          strokeWidth={2.2}
          strokeDasharray="6 6"
          dot={false}
          connectNulls
          name="Тренд 7д"
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--primary)"
          strokeWidth={3.2}
          dot={{ r: 3.5, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--surface)", stroke: "var(--primary)", strokeWidth: 3 }}
          connectNulls
          name="Вага"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const w = payload.find((p: any) => p.dataKey === "weight")?.value;
  const ma = payload.find((p: any) => p.dataKey === "ma")?.value;
  // Фаза лежить у самій точці, а не в серії, тому дістаємо її з payload.
  const point = payload[0]?.payload as WeightPoint | undefined;
  const phase = point?.phase ?? null;

  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-[11px] font-bold shadow-card">
      <div className="text-muted">{label}</div>
      {w != null && <div className="text-primary">Вага {fmt(w, 1)} кг</div>}
      {ma != null && <div className="text-accent">Тренд {fmt(ma, 1)} кг</div>}
      {phase && (
        <div className="mt-0.5" style={{ color: PHASE_COLORS[phase] }}>
          {point?.cycleDay != null && `День циклу ${point.cycleDay} · `}
          {PHASE_LABELS[phase]}
        </div>
      )}
    </div>
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
        stroke="var(--primary)"
        strokeWidth={2.5}
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
