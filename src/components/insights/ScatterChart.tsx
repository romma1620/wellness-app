"use client";

import { useMemo } from "react";
import { axisFor } from "@/lib/chart-scale";
import type { PairPoint } from "@/lib/correlations";
import { fmtFixed } from "@/lib/utils";
import { defineChart, dot, ruleX, ruleY } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";

/** Токени тем: підписи приглушені, сітка й осі — волосяна лінія. */
const CHART_THEME = {
  foreground: "var(--muted)",
  muted: "var(--muted)",
  grid: "var(--line)",
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
                // Нульова лінія помітніша за сітку — це змістовий орієнтир.
                ruleY([0], {
                  stroke: "var(--muted)",
                  strokeOpacity: 0.55,
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
          dot(points, { x: "x", y: "y", r: 3.5, fill: "var(--accent)", fillOpacity: 0.8 }),
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
          tickLabels: { fontSize: 10, fontWeight: 500, opacity: 1 },
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
          tickLabels: { fontSize: 10, fontWeight: 500, opacity: 1 },
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
      <div className="mt-1 pr-1 text-right text-[10px] font-medium text-muted">{xLabel} →</div>
    </div>
  );
}
