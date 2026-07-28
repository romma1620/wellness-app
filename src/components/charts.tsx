"use client";

import { axisFor, niceAxis, sparklinePoints } from "@/lib/chart-scale";
import { fmt, fmtFixed, fmtInt } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface WeightPoint {
  label: string;
  weight: number | null;
  ma: number | null;
}

export function WeightChart({ data }: { data: WeightPoint[] }) {
  // Обидві серії, а не лише вага: тренд тягнеться з попереднього періоду і
  // може виходити далеко за межі ваг цього тижня.
  const axis = axisFor(data.flatMap((d) => [d.weight, d.ma]));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
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
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-[11px] font-bold shadow-card">
      <div className="text-muted">{label}</div>
      {w != null && <div className="text-primary">Вага {fmt(w, 1)} кг</div>}
      {ma != null && <div className="text-accent">Тренд {fmt(ma, 1)} кг</div>}
    </div>
  );
}

export function StepsBars({ data }: { data: { label: string; steps: number | null }[] }) {
  const has = data.some((d) => d.steps != null);
  if (!has) {
    return <div className="py-6 text-center text-[12px] font-semibold text-muted">Немає даних</div>;
  }
  // Вісь рахуємо в тисячах — саме в них підписані тіки, тож і округлення має бути там.
  const maxK = Math.max(...data.map((d) => d.steps ?? 0)) / 1000;
  const axis = niceAxis(0, maxK);
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -14, bottom: 0 }} barCategoryGap="22%">
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
          domain={[axis.domain[0] * 1000, axis.domain[1] * 1000]}
          ticks={axis.ticks.map((t) => t * 1000)}
          interval={0}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v: number) => (v === 0 ? "0" : fmtFixed(v / 1000, axis.decimals))}
        />
        <Tooltip
          cursor={{ fill: "var(--primary-light)", opacity: 0.4 }}
          content={({ active, payload, label }: any) =>
            active && payload?.length ? (
              <div className="rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-primary shadow-card">
                {label}: {fmtInt(payload[0].value)} кроків
              </div>
            ) : null
          }
        />
        <Legend
          verticalAlign="top"
          height={22}
          content={() => (
            <div className="flex justify-end pr-1 text-[11px] font-bold text-primary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
                кроки, тис.
              </span>
            </div>
          )}
        />
        <Bar dataKey="steps" radius={[4, 4, 4, 4]} fill="var(--primary)" />
      </BarChart>
    </ResponsiveContainer>
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
  const vals = data.map((d) => d.value).filter((v): v is number => v != null);
  if (vals.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] font-semibold text-muted">Немає даних</div>
    );
  }
  const axis = niceAxis(Math.min(...vals), Math.max(...vals));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--primary-light)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontWeight: 700, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          domain={axis.domain}
          ticks={axis.ticks}
          interval={0}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={axis.decimals > 0 ? 40 : 32}
          tickFormatter={(v: number) => fmtFixed(v, axis.decimals)}
        />
        <Tooltip
          content={({ active, payload, label }: any) =>
            active && payload?.length ? (
              <div className="rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-primary shadow-card">
                {label}: {fmt(payload[0].value, 1)} {unit}
              </div>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={3}
          dot={{ r: 3.5, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--surface)", stroke: "var(--primary)", strokeWidth: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
