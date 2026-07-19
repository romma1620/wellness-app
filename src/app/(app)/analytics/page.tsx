"use client";

import { StepsBars, WeightChart, type WeightPoint } from "@/components/charts";
import { Card, EmptyState, ErrorBanner, FullLoader, Segmented } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { DailyLog } from "@/lib/types";
import {
  addDays,
  avg,
  cn,
  computeDelta,
  fmt,
  fmtInt,
  fmtThousands,
  parseISODate,
  todayISO,
} from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Period = "week" | "month";
const WD = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type MetricKey = "weight" | "kcal" | "protein" | "steps" | "water";
const METRICS: {
  key: MetricKey;
  label: string;
  goodDown: boolean;
  render: (v: number | null) => string;
  unit?: string;
}[] = [
  { key: "weight", label: "Середня вага", goodDown: true, render: (v) => fmt(v, 1), unit: "кг" },
  { key: "kcal", label: "Ккал / день", goodDown: true, render: (v) => fmtInt(v) },
  { key: "protein", label: "Білок", goodDown: false, render: (v) => fmtInt(v), unit: "г" },
  { key: "steps", label: "Кроки", goodDown: false, render: (v) => fmtThousands(v), unit: "тис." },
  { key: "water", label: "Вода", goodDown: false, render: (v) => fmt(v, 1), unit: "скл." },
];

export default function AnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<Period>("week");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const N = period === "week" ? 7 : 30;
  const today = todayISO();
  const curStart = addDays(today, -(N - 1));
  const prevStart = addDays(today, -(2 * N - 1));
  const prevEnd = addDays(today, -N);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const { data, error } = await supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", uid)
          .gte("date", prevStart)
          .lte("date", today)
          .order("date", { ascending: true });
        if (error) throw error;
        if (!cancelled) setLogs((data ?? []) as DailyLog[]);
      } catch {
        if (!cancelled) setError("Не вдалося завантажити дані. Спробуй пізніше.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, period, prevStart, today]);

  const byDate = useMemo(() => {
    const m = new Map<string, DailyLog>();
    logs.forEach((l) => m.set(l.date, l));
    return m;
  }, [logs]);

  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const curLogs = logs.filter((l) => inRange(l.date, curStart, today));
  const prevLogs = logs.filter((l) => inRange(l.date, prevStart, prevEnd));

  const metricAvg = (rows: DailyLog[], key: keyof DailyLog) =>
    avg(rows.map((r) => r[key] as number | null));

  // Дані для графіка ваги + ковзне середнє 7 днів.
  const weightData: WeightPoint[] = useMemo(() => {
    const out: WeightPoint[] = [];
    for (let i = 0; i < N; i++) {
      const d = addDays(curStart, i);
      const dt = parseISODate(d);
      const weight = byDate.get(d)?.weight ?? null;
      // ковзне середнє за останні 7 календарних днів
      const win: number[] = [];
      for (let k = 6; k >= 0; k--) {
        const w = byDate.get(addDays(d, -k))?.weight;
        if (w != null) win.push(w);
      }
      out.push({
        label: period === "week" ? WD[dt.getDay()] : String(dt.getDate()),
        weight,
        ma: win.length >= 2 ? win.reduce((s, v) => s + v, 0) / win.length : null,
      });
    }
    return out;
  }, [byDate, curStart, N, period]);

  const stepsData = useMemo(
    () =>
      Array.from({ length: N }).map((_, i) => {
        const d = addDays(curStart, i);
        return {
          label: period === "week" ? WD[parseISODate(d).getDay()] : String(parseISODate(d).getDate()),
          steps: byDate.get(d)?.steps ?? null,
        };
      }),
    [byDate, curStart, N, period],
  );

  const bju = {
    protein: metricAvg(curLogs, "protein"),
    fat: metricAvg(curLogs, "fat"),
    carbs: metricAvg(curLogs, "carbs"),
  };
  const bjuMax = Math.max(bju.protein ?? 0, bju.fat ?? 0, bju.carbs ?? 0, 1);

  const hasAnyWeight = weightData.some((d) => d.weight != null);
  const hasAnyData = curLogs.length > 0;

  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Аналітика</h1>

      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week", label: "Тиждень" },
          { value: "month", label: "Місяць" },
        ]}
      />

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : !hasAnyData ? (
        <EmptyState
          emoji="📊"
          title="Ще немає даних"
          hint="Заповнюй щоденник на вкладці «Сьогодні» — і тут зʼявиться твоя динаміка."
        />
      ) : (
        <>
          {/* Графік ваги */}
          <Card>
            <div className="mb-1.5 flex items-baseline justify-between">
              <div className="text-[13px] font-extrabold">Вага</div>
              <div className="flex gap-3 text-[11px] font-bold">
                <span className="text-primary">— вага</span>
                <span className="text-accent">–&nbsp;–&nbsp;тренд</span>
              </div>
            </div>
            {hasAnyWeight ? (
              <WeightChart data={weightData} />
            ) : (
              <div className="py-8 text-center text-[12px] font-semibold text-muted">
                Додай вагу у щоденнику, щоб побачити графік
              </div>
            )}
          </Card>

          {/* Порівняння */}
          <div className="mx-1 -mb-1 text-[12.5px] font-bold text-muted">
            Порівняно з минулим {period === "week" ? "тижнем" : "місяцем"}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m, idx) => {
              const cur = metricAvg(curLogs, m.key);
              const prev = metricAvg(prevLogs, m.key);
              const { pct, dir } = computeDelta(cur, prev);
              const good =
                dir === "flat" ? null : m.goodDown ? dir === "down" : dir === "up";
              const color =
                pct === null ? "text-muted" : good ? "text-pos" : "text-neg";
              const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
              return (
                <Card
                  key={m.key}
                  className={cn("!p-[14px]", idx === METRICS.length - 1 && "col-span-2")}
                >
                  <div className="text-[12px] font-bold text-muted">{m.label}</div>
                  <div className="mt-1 text-[22px] font-extrabold">
                    {m.render(cur)}
                    {m.unit && cur != null && (
                      <span className="ml-1 text-[12px] font-bold text-muted">{m.unit}</span>
                    )}
                  </div>
                  <div className={cn("mt-0.5 text-[11.5px] font-extrabold", color)}>
                    {pct === null ? "немає з чим порівняти" : `${arrow} ${fmt(Math.abs(pct), 1)}%`}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* БЖВ + кроки */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="!p-[14px]">
              <div className="mb-2.5 text-[12px] font-bold text-muted">БЖВ, сер.</div>
              <div className="flex flex-col gap-2">
                {[
                  { l: "Б", v: bju.protein, c: "bg-primary" },
                  { l: "Ж", v: bju.fat, c: "bg-accent" },
                  { l: "В", v: bju.carbs, c: "bg-primary-light" },
                ].map((r) => (
                  <div key={r.l}>
                    <div className="mb-0.5 flex justify-between text-[11px] font-bold">
                      <span>{r.l}</span>
                      <span className="text-muted">{r.v == null ? "—" : `${fmtInt(r.v)} г`}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                      <div
                        className={cn("h-full rounded-full", r.c)}
                        style={{ width: `${((r.v ?? 0) / bjuMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="!p-[14px]">
              <div className="mb-2.5 text-[12px] font-bold text-muted">
                Кроки, {period === "week" ? "тиж." : "міс."}
              </div>
              <StepsBars data={stepsData} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
