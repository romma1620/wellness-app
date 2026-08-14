"use client";

import { StepsBars, WeightChart, type WeightPoint } from "@/components/charts";
import { CareDotChart } from "@/components/CareDotChart";
import { ForecastCard } from "@/components/ForecastCard";
import {
  PhaseBandsToggle,
  PhaseLegend,
  PhaseWeightCard,
  usePhaseOverlay,
  WaterRetentionCard,
} from "@/components/cycle/analytics";
import { Card, EmptyState, ErrorBanner, FullLoader, Segmented } from "@/components/ui";
import { buildCareColorMap, buildCareMatrix, type CareHistoryRow } from "@/lib/care";
import { cycleDayFor } from "@/lib/cycle/derive";
import type { DatedValue } from "@/lib/cycle/insights";
import { bandsForSeries, phaseAt } from "@/lib/cycle/phases";
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
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

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
  // null = історія ще не завантажилась; [] = завантажилась, але порожня (справжній запасний шлях).
  const [careHistory, setCareHistory] = useState<CareHistoryRow[] | null>(null);
  /** Вага за останні цикли — окремо від періоду, бо цикли в нього не вміщаються. */
  const [phaseWeights, setPhaseWeights] = useState<DatedValue[]>([]);

  const overlay = usePhaseOverlay();
  const bandsOn = overlay.available && overlay.showBands;
  const { ranges: cycleRanges, cycles: cycleList, cycleStarts, phaseWindowStart } = overlay;

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

  // Кольори доглядів мають бути стабільні між періодами, тому порядок першої появи
  // беремо з усієї історії. Помилка тут не критична — нижче є запасний шлях.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) return;
        // Запит навмисно без ліміту: навіть якщо PostgREST обріже max-rows,
        // order("date", ascending: true) лишає найстаріші рядки — порядок першої
        // появи, а отже й колір кожного тега, збережеться.
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

  // Вага по фазах рахується за останні цикли, а не за вибраний період:
  // порівнювати фази всередині одного тижня нема сенсу.
  useEffect(() => {
    // Поки смуги вимкнені, ці ваги ніхто не читає — не тягнемо їх і не
    // скидаємо: скидання тут було б зайвим рендером на кожен рух тумблера.
    if (!bandsOn || !phaseWindowStart) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) return;
        const { data, error } = await supabase
          .from("daily_logs")
          .select("date, weight")
          .eq("user_id", uid)
          .gte("date", phaseWindowStart)
          .not("weight", "is", null)
          .order("date", { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setPhaseWeights(
            (data ?? []).map((r) => ({ date: r.date as string, value: r.weight as number })),
          );
        }
      } catch {
        if (!cancelled) setPhaseWeights([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, bandsOn, phaseWindowStart]);

  const byDate = useMemo(() => {
    const m = new Map<string, DailyLog>();
    logs.forEach((l) => m.set(l.date, l));
    return m;
  }, [logs]);

  const curLogs = logs.filter((l) => l.date >= curStart && l.date <= curEnd);
  const cmpLogs = logs.filter((l) => l.date >= cmpStart && l.date <= cmpEnd);

  const metricAvg = (rows: DailyLog[], key: keyof DailyLog) =>
    avg(rows.map((r) => r[key] as number | null));

  const periodDates = useMemo(
    () => Array.from({ length: N }, (_, i) => addDays(curStart, i)),
    [curStart, N],
  );

  const labelFor = useCallback(
    (iso: string) => {
      const dt = parseISODate(iso);
      return period === "week" ? WD[dt.getDay()] : String(dt.getDate());
    },
    [period],
  );

  // Дані для графіка ваги + ковзне середнє 7 днів.
  const weightData: WeightPoint[] = useMemo(
    () =>
      periodDates.map((d) => {
        // ковзне середнє за останні 7 календарних днів
        const win: number[] = [];
        for (let k = 6; k >= 0; k--) {
          const w = byDate.get(addDays(d, -k))?.weight;
          if (w != null) win.push(w);
        }
        return {
          label: labelFor(d),
          weight: byDate.get(d)?.weight ?? null,
          ma: win.length >= 2 ? win.reduce((s, v) => s + v, 0) / win.length : null,
          // Фаза їде в точці лише коли смуги ввімкнені: інакше тултип
          // розповідав би про цикл на графіку, де його не видно.
          phase: bandsOn ? phaseAt(d, cycleRanges) : null,
          cycleDay: bandsOn ? cycleDayFor(d, cycleList) : null,
        };
      }),
    [periodDates, byDate, labelFor, bandsOn, cycleRanges, cycleList],
  );

  const phaseBands = useMemo(
    () =>
      bandsOn
        ? bandsForSeries(
            periodDates.map((d) => ({ date: d, label: labelFor(d) })),
            cycleRanges,
          )
        : undefined,
    [bandsOn, periodDates, labelFor, cycleRanges],
  );

  const cycleStartLabels = useMemo(
    () =>
      bandsOn
        ? cycleStarts.filter((s) => s >= curStart && s <= curEnd).map(labelFor)
        : undefined,
    [bandsOn, cycleStarts, curStart, curEnd, labelFor],
  );

  const stepsData = useMemo(
    () =>
      periodDates.map((d) => ({
        label: labelFor(d),
        steps: byDate.get(d)?.steps ?? null,
      })),
    [periodDates, byDate, labelFor],
  );

  const careRows = useMemo(() => {
    // Фільтруємо logs напряму, а не curLogs: curLogs — новий масив щоразу,
    // це зламало б мемоізацію.
    const inPeriod = logs.filter((l) => l.date >= curStart && l.date <= curEnd);
    // Якщо історія завантажилась, але порожня — кольори будуємо з логів періоду.
    const colors = buildCareColorMap(
      careHistory !== null && careHistory.length ? careHistory : inPeriod,
    );
    return buildCareMatrix(inPeriod, curStart, N, colors);
  }, [logs, careHistory, curStart, curEnd, N]);

  const hasAnyWeight = weightData.some((d) => d.weight != null);
  const hasAnyData = curLogs.length > 0;

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Аналітика</h1>
        <Link href="/report" className="text-[13px] font-extrabold text-primary">
          Тижневий звіт
        </Link>
      </div>

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
          {overlay.available && (
            <PhaseBandsToggle checked={overlay.showBands} onChange={overlay.setShowBands} />
          )}

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
              <>
                <WeightChart
                  data={weightData}
                  bands={phaseBands}
                  cycleStarts={cycleStartLabels}
                />
                {bandsOn && <PhaseLegend />}
              </>
            ) : (
              <div className="py-8 text-center text-[12px] font-semibold text-muted">
                Додай вагу у щоденнику, щоб побачити графік
              </div>
            )}
          </Card>

          <ForecastCard />

          {bandsOn && (
            <>
              <WaterRetentionCard
                weights={phaseWeights}
                ranges={cycleRanges}
                todayPhase={overlay.todayPhase}
              />
              <PhaseWeightCard weights={phaseWeights} ranges={cycleRanges} />
            </>
          )}

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

          {/* Догляд за шкірою: картку показуємо лише коли історія доладів
              вже завантажена, інакше графік на мить мигне тимчасовими кольорами. */}
          {careHistory !== null && (
            <Card className="!p-[14px]">
              <div className="mb-2.5 text-[12px] font-bold text-muted">
                Догляд за шкірою, {period === "week" ? "тиж." : "міс."}
              </div>
              <CareDotChart key={curStart} rows={careRows} dates={periodDates} />
            </Card>
          )}
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
