"use client";

import { StepsBars, WeightChart, type WeightPoint } from "@/components/charts";
import { CareDotChart } from "@/components/CareDotChart";
import { NutritionCards } from "@/components/NutritionCards";
import { ForecastCard } from "@/components/ForecastCard";
import {
  PhaseBandsToggle,
  PhaseLegend,
  PhaseWeightCard,
  usePhaseOverlay,
  WaterRetentionCard,
} from "@/components/cycle/analytics";
import { Card, EmptyState, ErrorBanner, FullLoader, Input, Segmented } from "@/components/ui";
import { buildCareColorMap, buildCareMatrix, type CareHistoryRow } from "@/lib/care";
import { cycleDayFor } from "@/lib/cycle/derive";
import type { DatedValue } from "@/lib/cycle/insights";
import { bandsForSeries, phaseAt } from "@/lib/cycle/phases";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import type { DailyLog } from "@/lib/types";
import {
  addDays,
  avg,
  cn,
  computeDelta,
  daysBetween,
  fmt,
  fmtInt,
  fmtThousands,
  parseISODate,
  periodLabel,
  periodRange,
  type PeriodType,
  precedingRange,
  rangeLabel,
  shortDateAbbr,
  todayISO,
  weekBuckets,
} from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo, useState } from "react";

const WD = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Стабільні порожні значення: `data ?? []` новим масивом щорендера ламав би мемоїзацію.
const EMPTY_LOGS: DailyLog[] = [];
const EMPTY_WEIGHTS: DatedValue[] = [];

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

/** «Свій» — довільний діапазон дат, не описується offset-ами periodRange. */
type Mode = PeriodType | "custom";

export default function AnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const [period, setPeriod] = useState<Mode>("week");
  const [curOffset, setCurOffset] = useState(0); // 0 = поточний період
  const [cmpOffset, setCmpOffset] = useState(1); // 1 = попередній період
  const [customStart, setCustomStart] = useState(() => addDays(todayISO(), -29));
  const [customEnd, setCustomEnd] = useState(() => todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);

  const overlay = usePhaseOverlay();
  const { ranges: cycleRanges, cycles: cycleList, cycleStarts, phaseWindowStart } = overlay;

  const isCustom = period === "custom";
  // Інпути дат вільні, тож перевернутий діапазон просто нормалізуємо.
  const [cs, ce] =
    customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
  const curRange = isCustom
    ? { start: cs, end: ce, days: daysBetween(cs, ce) + 1 }
    : periodRange(period, curOffset);
  // Порівняння для «Свого» — автоматично попередній відрізок тієї ж довжини.
  const cmpRange = isCustom ? precedingRange(cs, ce) : periodRange(period, cmpOffset);
  const { start: curStart, end: curEnd, days: N } = curRange;
  const { start: cmpStart, end: cmpEnd } = cmpRange;

  const curLabel = isCustom ? rangeLabel(cs, ce) : periodLabel(period, curOffset);
  const cmpLabel = isCustom ? rangeLabel(cmpStart, cmpEnd) : periodLabel(period, cmpOffset);

  // Довгий період (рік або широкий «Свій») агрегуємо по тижнях: 365 денних
  // точок нечитабельні, а смуги фаз і графік догляду в цьому масштабі губляться.
  const weeklyAgg = N > 62;
  const bandsOn = !weeklyAgg && overlay.available && overlay.showBands;

  // Діапазон завантаження покриває обидва періоди + буфер 7 днів для ковзного середнього.
  const earliest = curStart < cmpStart ? curStart : cmpStart;
  const latest = curEnd > cmpEnd ? curEnd : cmpEnd;
  const fetchStart = addDays(earliest, -7);

  const changePeriod = (p: Mode) => {
    setPeriod(p);
    setCurOffset(0);
    setCmpOffset(1);
    if (p === "custom") setPickerOpen(true);
  };

  const logsQ = useQuery({
    queryKey: ["diary", uid, "analytics", fetchStart, latest],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("date", fetchStart)
        .lte("date", latest)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyLog[];
    },
  });
  const logs = logsQ.data ?? EMPTY_LOGS;
  const loading = logsQ.isPending;
  const error = logsQ.isError ? "Не вдалося завантажити дані. Спробуй пізніше." : null;

  // Кольори доглядів мають бути стабільні між періодами, тому порядок першої появи
  // беремо з усієї історії. Помилка тут не критична (запасний шлях нижче), тож
  // queryFn не кидає, а віддає порожню історію.
  const careQ = useQuery({
    queryKey: ["diary", uid, "care-history"],
    // Порядок першої появи тега незмінний — кеш живе довго, а після
    // редагування дня його все одно інвалідовує збереження щоденника.
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<CareHistoryRow[]> => {
      try {
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
        return (data ?? []) as CareHistoryRow[];
      } catch {
        return [];
      }
    },
  });
  // undefined = історія ще не завантажилась; [] = завантажилась, але порожня.
  const careHistory = careQ.data ?? null;

  // Вага по фазах рахується за останні цикли, а не за вибраний період:
  // порівнювати фази всередині одного тижня нема сенсу. Поки смуги вимкнені,
  // запит не йде (enabled), а вже завантажене живе в кеші.
  const phaseQ = useQuery({
    queryKey: ["diary", uid, "phase-weights", phaseWindowStart],
    enabled: bandsOn && phaseWindowStart !== null,
    queryFn: async (): Promise<DatedValue[]> => {
      try {
        const { data, error } = await supabase
          .from("daily_logs")
          .select("date, weight")
          .eq("user_id", uid)
          .gte("date", phaseWindowStart!)
          .not("weight", "is", null)
          .order("date", { ascending: true });
        if (error) throw error;
        return (data ?? []).map((r) => ({ date: r.date as string, value: r.weight as number }));
      } catch {
        return [];
      }
    },
  });
  const phaseWeights = phaseQ.data ?? EMPTY_WEIGHTS;

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
      if (period === "week") return WD[dt.getDay()];
      // «Свій» може накрити два місяці — самий день числа дав би дублікати
      // міток, а band-шкала графіків вимагає унікального домену.
      if (period === "custom") return shortDateAbbr(iso);
      return String(dt.getDate());
    },
    [period],
  );

  /** Кошики тижнів для довгих періодів; порожньо в денному режимі. */
  const buckets = useMemo(
    () => (weeklyAgg ? weekBuckets(curStart, curEnd) : []),
    [weeklyAgg, curStart, curEnd],
  );

  // Дані для графіка ваги + ковзне середнє 7 днів (у тижневому режимі —
  // середнє тижня + тренд по 4 кошиках).
  const weightData: WeightPoint[] = useMemo(() => {
    if (weeklyAgg) {
      const avgs = buckets.map((b) => avg(b.dates.map((d) => byDate.get(d)?.weight)));
      return buckets.map((b, i) => {
        const win = avgs
          .slice(Math.max(0, i - 3), i + 1)
          .filter((v): v is number => v != null);
        return {
          label: shortDateAbbr(b.start),
          weight: avgs[i],
          ma: win.length >= 2 ? win.reduce((s, v) => s + v, 0) / win.length : null,
          phase: null,
          cycleDay: null,
        };
      });
    }
    return periodDates.map((d) => {
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
    });
  }, [weeklyAgg, buckets, periodDates, byDate, labelFor, bandsOn, cycleRanges, cycleList]);

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

  const stepsData = useMemo(() => {
    if (weeklyAgg) {
      return buckets.map((b) => ({
        label: shortDateAbbr(b.start),
        steps: avg(b.dates.map((d) => byDate.get(d)?.steps)),
      }));
    }
    return periodDates.map((d) => ({
      label: labelFor(d),
      steps: byDate.get(d)?.steps ?? null,
    }));
  }, [weeklyAgg, buckets, periodDates, byDate, labelFor]);

  const careRows = useMemo(() => {
    // На тижневій агрегації картка догляду схована — не рахуємо матрицю на 365 днів.
    if (weeklyAgg) return [];
    // Фільтруємо logs напряму, а не curLogs: curLogs — новий масив щоразу,
    // це зламало б мемоізацію.
    const inPeriod = logs.filter((l) => l.date >= curStart && l.date <= curEnd);
    // Якщо історія завантажилась, але порожня — кольори будуємо з логів періоду.
    const colors = buildCareColorMap(
      careHistory !== null && careHistory.length ? careHistory : inPeriod,
    );
    return buildCareMatrix(inPeriod, curStart, N, colors);
  }, [weeklyAgg, logs, careHistory, curStart, curEnd, N]);

  const hasAnyWeight = weightData.some((d) => d.weight != null);
  const hasAnyData = curLogs.length > 0;

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Аналітика</h1>
        <div className="flex items-center gap-3">
          <Link href="/activity" className="text-[13px] font-extrabold text-primary">
            Активність
          </Link>
          <Link href="/report" className="text-[13px] font-extrabold text-primary">
            Звіт
          </Link>
        </div>
      </div>

      <Segmented<Mode>
        value={period}
        onChange={changePeriod}
        options={[
          { value: "week", label: "Тиждень" },
          { value: "month", label: "Місяць" },
          { value: "year", label: "Рік" },
          { value: "custom", label: "Свій" },
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
              {curLabel}
              <span className="text-muted"> · vs </span>
              {cmpLabel}
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
            {isCustom ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-[12px] font-bold text-muted">Від</span>
                    <Input
                      type="date"
                      value={customStart}
                      max={todayISO()}
                      onChange={(e) => e.target.value && setCustomStart(e.target.value)}
                    />
                  </label>
                  <label className="flex-1">
                    <span className="mb-1 block text-[12px] font-bold text-muted">До</span>
                    <Input
                      type="date"
                      value={customEnd}
                      max={todayISO()}
                      onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-1 text-[12px] font-semibold text-muted">
                  Порівнюється з попереднім відрізком тієї ж довжини: {cmpLabel}
                </div>
              </>
            ) : (
              <>
                <PeriodStepper
                  label="Період"
                  value={curLabel}
                  onOlder={() => setCurOffset((o) => o + 1)}
                  onNewer={() => setCurOffset((o) => Math.max(0, o - 1))}
                  canNewer={curOffset > 0}
                />
                <div className="my-1 h-px bg-bg" />
                <PeriodStepper
                  label="Порівняти з"
                  value={cmpLabel}
                  onOlder={() => setCmpOffset((o) => o + 1)}
                  onNewer={() => setCmpOffset((o) => Math.max(0, o - 1))}
                  canNewer={cmpOffset > 0}
                />
              </>
            )}
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
          {!weeklyAgg && overlay.available && (
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
            {curLabel} · порівняно з {cmpLabel}
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

          {/* Харчування */}
          <NutritionCards logs={curLogs} />

          {/* Графік кроків */}
          <Card className="!p-[14px]">
            <div className="mb-2.5 text-[12px] font-bold text-muted">
              {weeklyAgg
                ? "Кроки, середнє за тиждень"
                : `Кроки, ${period === "week" ? "тиж." : "міс."}`}
            </div>
            <StepsBars data={stepsData} />
          </Card>

          {/* Догляд за шкірою: картку показуємо лише коли історія доладів
              вже завантажена, інакше графік на мить мигне тимчасовими кольорами.
              На тижневій агрегації точки днів не мають куди лягти — ховаємо. */}
          {!weeklyAgg && careHistory !== null && (
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
