"use client";

import { niceAxis } from "@/lib/chart-scale";
import { fmt, fmtFixed, shortDateAbbr } from "@/lib/utils";
import type { ExercisePoint } from "@/lib/workouts";
import { curveMonotoneX, line as d3Line } from "d3-shape";
import { useMemo } from "react";

const W = 372;
const H = 150;
const LEFT = 30;
const RIGHT = 6;
const TOP = 14;
const BOTTOM = 28;
/** Скільки підписів дат вміщається під графіком без накладання. */
const MAX_X_LABELS = 5;

/**
 * Індекси точок, під якими підписуємо дату: перша й остання завжди, решта —
 * рівномірно між ними. Так само чинить TanStack (`thin: priority "ends"`),
 * але тут це три рядки замість зайвого визначення графіка.
 */
function labelIndices(n: number): number[] {
  if (n <= MAX_X_LABELS) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < MAX_X_LABELS; k++) out.add(Math.round((k * (n - 1)) / (MAX_X_LABELS - 1)));
  return [...out].sort((a, b) => a - b);
}

/**
 * Лінійний графік прогресу по вправі — інлайновий SVG як у макеті: сітка
 * на `--line`, акцентна лінія 2.4px і точки 3px, підписи 10px `--muted`.
 * Точок тут десятки, не сотні, тож окрема бібліотека не потрібна; доступність —
 * через aria-label і `<title>` на кожній точці.
 */
export function ProgressLine({ data, unit }: { data: ExercisePoint[]; unit: string }) {
  const chart = useMemo(() => {
    const points = data.filter((d): d is ExercisePoint & { value: number } => d.value != null);
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    const axis = niceAxis(Math.min(...vals), Math.max(...vals), 4);
    const [lo, hi] = axis.domain;
    const innerW = W - LEFT - RIGHT;
    const innerH = H - TOP - BOTTOM;
    // одна точка — по центру, інакше край у край, як point-шкала з padding .5
    const x = (i: number) =>
      points.length === 1 ? LEFT + innerW / 2 : LEFT + (i * innerW) / (points.length - 1);
    const y = (v: number) => (hi === lo ? TOP + innerH / 2 : TOP + ((hi - v) * innerH) / (hi - lo));
    const coords = points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }));
    const path =
      d3Line<(typeof coords)[number]>()
        .x((d) => d.cx)
        .y((d) => d.cy)
        .curve(curveMonotoneX)(coords) ?? "";
    const labels = new Set(labelIndices(points.length));
    return { axis, coords, path, y, labels };
  }, [data]);

  if (!chart) {
    return <div className="py-6 text-center text-[12px] font-medium text-muted">Немає даних</div>;
  }

  const { axis, coords, path, y, labels } = chart;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      className="block"
      role="img"
      aria-label={`Графік прогресу, ${unit}`}
    >
      <g stroke="var(--line)" strokeWidth={1}>
        {axis.ticks.map((t) => (
          <line key={t} x1={LEFT} x2={W - RIGHT} y1={y(t)} y2={y(t)} />
        ))}
      </g>
      <g fill="var(--muted)" fontSize={10} fontFamily="inherit">
        {axis.ticks.map((t) => (
          <text key={t} x={LEFT - 4} y={y(t) + 3} textAnchor="end">
            {fmtFixed(t, axis.decimals)}
          </text>
        ))}
      </g>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" />
      <g fill="var(--accent)">
        {coords.map((p) => (
          <circle key={p.date} cx={p.cx} cy={p.cy} r={3}>
            <title>{`${p.label}: ${fmt(p.value, 1)} ${unit}`}</title>
          </circle>
        ))}
      </g>
      <g fill="var(--muted)" fontSize={10} fontWeight={500} fontFamily="inherit" textAnchor="middle">
        {coords.map((p, i) =>
          labels.has(i) ? (
            <text key={p.date} x={p.cx} y={H - 6}>
              {shortDateAbbr(p.date)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}
