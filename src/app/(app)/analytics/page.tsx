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
  periodLabel,
  periodRange,
  type PeriodType,
} from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

const WD = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type MetricKey = "weight" | "kcal" | "protein" | "fat" | "carbs" | "steps" | "water";
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
  { key: "fat", label: "Жири", goodDown: false, render: (v) => fmtInt(v), unit: "г" },
  { key: "carbs", label: "Вуглеводи", goodDown: false, render: (v) => fmtInt(v), unit: "г" },
  { key: "water", label: "Вода", goodDown: false, render: (v) => fmt(v, 1), unit: "скл." },
  { key: "steps", label: "Кроки", goodDown: false, render: (v) => fmtThousands(v), unit: "тис." },
];

export default function AnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [curOffset, setCurOffset] = useState(0); // 0 = поточний період
  const [cmpOffset, setCmpOffset] = useState(1); // 1 = попередній період
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start: curStart, end: curEnd, days: N } = periodRange(period, curOffset);
  const { start: cmpStart, end: cmpEnd } = periodRange(period, cmpOffset);

  // Діапазон завантаження покриває обидва періоди + буфер 7 днів для ковзного середнього.
  const earliest = curStart < cmpStart ? curStart : cmpStart;
  const latest = curEnd > cmpEnd ? curEnd : cmpEnd;
  const fetchStart = addDays(earliest, -7);

  const changePeriod = (p: PeriodType) => {
    setPeriod(p);
    setCurOffset(0);
    setCmpOffset(1);
  };

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
          .gte("date", fetchStart)
          .lte("date", latest)
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
  }, [supabase, fetchStart, latest]);

  const byDate = useMemo(() => {
    const m = new Map<string, DailyLog>();
    logs.forEach((l) => m.set(l.date, l));
    return m;
  }, [logs]);

  const curLogs = logs.filter((l) => l.date >= curStart && l.date <= curEnd);
  const cmpLogs = logs.filter((l) => l.date >= cmpStart && l.date <= cmpEnd);

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

  const hasAnyWeight = weightData.some((d) => d.weight != null);
  const hasAnyData = curLogs.length > 0;

  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Аналітика</h1>

      <Segmented<PeriodType>
        value={period}
        onChange={changePeriod}
        options={[
          { value: "week", label: "Тиждень" },
          { value: "month", label: "Місяць" },
        ]}
      />

      <Card className="!p-0">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-[14px] py-3 text-left"
        >
          <span className="flex flex-col">
            <span className="text-[11px] font-bold text-muted">Період · порівняння</span>
            <span className="text-[13px] font-extrabold">
              {periodLabel(period, curOffset)}
              <span className="text-muted"> · vs </span>
              {periodLabel(period, cmpOffset)}
            </span>
          </span>
          <ChevronDown
            size={20}
            className={cn(
              "shrink-0 text-primary transition-transform",
              pickerOpen && "rotate-180",
            )}
          />
        </button>
        {pickerOpen && (
          <div className="flex flex-col gap-1 border-t border-bg px-[14px] pb-[14px] pt-2.5">
            <PeriodStepper
              label="Період"
              value={periodLabel(period, curOffset)}
              onOlder={() => setCurOffset((o) => o + 1)}
              onNewer={() => setCurOffset((o) => Math.max(0, o - 1))}
              canNewer={curOffset > 0}
            />
            <div className="my-1 h-px bg-bg" />
            <PeriodStepper
              label="Порівняти з"
              value={periodLabel(period, cmpOffset)}
              onOlder={() => setCmpOffset((o) => o + 1)}
              onNewer={() => setCmpOffset((o) => Math.max(0, o - 1))}
              canNewer={cmpOffset > 0}
            />
          </div>
        )}
      </Card>

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
            {periodLabel(period, curOffset)} · порівняно з {periodLabel(period, cmpOffset)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m, idx) => {
              const cur = metricAvg(curLogs, m.key);
              const prev = metricAvg(cmpLogs, m.key);
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

          {/* Графік кроків */}
          <Card className="!p-[14px]">
            <div className="mb-2.5 text-[12px] font-bold text-muted">
              Кроки, {period === "week" ? "тиж." : "міс."}
            </div>
            <StepsBars data={stepsData} />
          </Card>
        </>
      )}
    </div>
  );
}

function PeriodStepper({
  label,
  value,
  onOlder,
  onNewer,
  canNewer,
}: {
  label: string;
  value: string;
  onOlder: () => void;
  onNewer: () => void;
  canNewer: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <div className="flex items-center gap-0.5">
        <StepBtn onClick={onOlder} label="Раніше">
          <ChevronLeft size={18} />
        </StepBtn>
        <span className="min-w-[112px] text-center text-[13px] font-extrabold">{value}</span>
        <StepBtn onClick={onNewer} disabled={!canNewer} label="Пізніше">
          <ChevronRight size={18} />
        </StepBtn>
      </div>
    </div>
  );
}

function StepBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full text-[20px] font-extrabold leading-none text-primary transition",
        disabled ? "opacity-25" : "hover:bg-primary-light active:scale-90",
      )}
    >
      {children}
    </button>
  );
}
