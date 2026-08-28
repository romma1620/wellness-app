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
import { Icon } from "@/components/icons";
import {
  Card,
  EmptyState,
  ErrorBanner,
  FieldLabel,
  FullLoader,
  IconButton,
  Input,
  PageTitle,
  Pill,
  SectionLabel,
  Segmented,
} from "@/components/ui";
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
import { useCallback, useMemo, useState } from "react";

const WD = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** Колонки, які реально читає ця сторінка: sport і comment сюди не потрібні. */
type AnalyticsLog = Pick<
  DailyLog,
  "date" | "weight" | "kcal" | "protein" | "fat" | "carbs" | "water" | "steps" | "care"
>;
const ANALYTICS_COLUMNS = "date, weight, kcal, protein, fat, carbs, water, steps, care";

// Стабільні порожні значення: `data ?? []` новим масивом щорендера ламав би мемоїзацію.
const EMPTY_LOGS: AnalyticsLog[] = [];
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

/**
 * Людські назви періодів для типового порівняння «цей проти минулого».
 * Коли зсуви нетипові (або «Свій») — падаємо на конкретні дати.
 */
const PERIOD_WORDS: Record<PeriodType, { current: string; against: string }> = {
  week: { current: "Цей тиждень", against: "Проти минулого тижня" },
  month: { current: "Цей місяць", against: "Проти минулого місяця" },
  year: { current: "Цей рік", against: "Проти минулого року" },
};

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
        .select(ANALYTICS_COLUMNS)
        .eq("user_id", uid)
        .gte("date", fetchStart)
        .lte("date", latest)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AnalyticsLog[];
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
      // Спершу RPC care_first_seen: по рядку на тег замість усієї історії —
      // саме цей запит ріс разом із даними юзера. Результат синтезуємо у
      // формат історії, який уже вміє buildCareColorMap.
      try {
        const { data, error } = await supabase.rpc("care_first_seen");
        if (error) throw error;
        return ((data ?? []) as { tag: string; first_date: string }[])
          .map((r) => ({ date: r.first_date, care: r.tag }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch {
        // RPC ще не розкочена — старий повний запит як запасний шлях.
      }
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
    const m = new Map<string, AnalyticsLog>();
    logs.forEach((l) => m.set(l.date, l));
    return m;
  }, [logs]);

  const curLogs = useMemo(
    () => logs.filter((l) => l.date >= curStart && l.date <= curEnd),
    [logs, curStart, curEnd],
  );
  const cmpLogs = useMemo(
    () => logs.filter((l) => l.date >= cmpStart && l.date <= cmpEnd),
    [logs, cmpStart, cmpEnd],
  );

  const metricAvg = (rows: AnalyticsLog[], key: keyof AnalyticsLog) =>
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

  // Типовий випадок «поточний проти попереднього» підписуємо словами, як у
  // дизайні; будь-який інший зсув — датами, щоб не брехати про «минулий».
  const typical = !isCustom && curOffset === 0 && cmpOffset === 1;
  const words = isCustom ? null : PERIOD_WORDS[period];
  const againstLabel = typical && words ? words.against : `Проти ${cmpLabel}`;

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        right={
          <>
            <Pill href="/activity" icon="activity">
              Активність
            </Pill>
            <Pill href="/report" icon="file">
              Звіт
            </Pill>
          </>
        }
      >
        Аналітика
      </PageTitle>

      <Segmented<Mode>
        value={period}
        onChange={changePeriod}
        variant="surface"
        options={[
          { value: "week", label: "Тиждень" },
          { value: "month", label: "Місяць" },
          { value: "year", label: "Рік" },
          { value: "custom", label: "Свій" },
        ]}
      />

      <div className="rounded-[16px] bg-surface">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex flex-col gap-[2px]">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-muted">
              Період · порівняння
            </span>
            <span className="text-[13px] font-semibold">
              {typical && words ? words.current : curLabel}
              <span className="font-normal text-muted"> проти </span>
              {typical ? "минулого" : cmpLabel}
            </span>
          </span>
          <span
            className={cn(
              "flex shrink-0 text-muted transition-transform",
              pickerOpen && "rotate-180",
            )}
          >
            <Icon name="chevronDown" size={18} strokeWidth={1.8} />
          </span>
        </button>
        {pickerOpen && (
          <div className="flex flex-col gap-1 border-t border-line px-4 pb-4 pt-3">
            {isCustom ? (
              <>
                <div className="flex items-start gap-2">
                  <label className="flex-1">
                    <FieldLabel>Від</FieldLabel>
                    <Input
                      type="date"
                      value={customStart}
                      max={todayISO()}
                      onChange={(e) => e.target.value && setCustomStart(e.target.value)}
                    />
                  </label>
                  <label className="flex-1">
                    <FieldLabel>До</FieldLabel>
                    <Input
                      type="date"
                      value={customEnd}
                      max={todayISO()}
                      onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-1 text-[11.5px] font-normal text-muted">
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
                <div className="my-1 border-t border-line" />
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
      </div>

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : !hasAnyData ? (
        <EmptyState
          icon="bars"
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
            <SectionLabel
              className="mb-[10px]"
              right={
                <div className="flex gap-3 text-[11px] font-medium text-muted">
                  <span className="text-accent">— вага</span>
                  <span>–&nbsp;–&nbsp;тренд</span>
                </div>
              }
            >
              Вага
            </SectionLabel>
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
              <div className="py-8 text-center text-[12px] font-medium text-muted">
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
          <div className="px-[2px] text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            {againstLabel}
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {METRICS.map((m, idx) => {
              const cur = metricAvg(curLogs, m.key);
              const prev = metricAvg(cmpLogs, m.key);
              const { pct, dir } = computeDelta(cur, prev);
              const good =
                dir === "flat" ? null : m.goodDown ? dir === "down" : dir === "up";
              const color =
                pct === null || good === null ? "text-muted" : good ? "text-pos" : "text-neg";
              return (
                <div
                  key={m.key}
                  className={cn(
                    "rounded-[18px] bg-surface p-[15px]",
                    idx === METRICS.length - 1 && "col-span-2",
                  )}
                >
                  <div className="text-[11.5px] font-medium text-muted">{m.label}</div>
                  <div className="mt-[6px] text-[23px] font-normal tracking-[-.01em]">
                    {m.render(cur)}
                    {m.unit && cur != null && (
                      <span className="ml-[5px] text-[11.5px] font-medium text-muted">
                        {m.unit}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-[3px] text-[11.5px] font-semibold",
                      color,
                    )}
                  >
                    {pct === null ? (
                      "немає з чим порівняти"
                    ) : (
                      <>
                        {dir !== "flat" && (
                          <span className="flex">
                            <Icon
                              name={dir === "up" ? "arrowUp" : "arrowDown"}
                              size={11}
                              strokeWidth={2.2}
                            />
                          </span>
                        )}
                        {fmt(Math.abs(pct), 1)}%
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Харчування */}
          <NutritionCards logs={curLogs} />

          {/* Графік кроків */}
          <Card>
            <SectionLabel
              className="mb-[10px]"
              right={
                <span className="flex items-center gap-[6px] text-[11px] font-medium text-muted">
                  <span className="inline-block h-[7px] w-[7px] rounded-[2px] bg-accent" />
                  тис. кроків
                </span>
              }
            >
              {weeklyAgg
                ? "Кроки, середнє за тиждень"
                : `Кроки, ${period === "week" ? "тиж." : "міс."}`}
            </SectionLabel>
            <StepsBars data={stepsData} />
          </Card>

          {/* Догляд за шкірою: картку показуємо лише коли історія доладів
              вже завантажена, інакше графік на мить мигне тимчасовими кольорами.
              На тижневій агрегації точки днів не мають куди лягти — ховаємо. */}
          {!weeklyAgg && careHistory !== null && (
            <Card>
              <SectionLabel>
                Догляд за шкірою, {period === "week" ? "тиж." : "міс."}
              </SectionLabel>
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
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <IconButton icon="chevronLeft" label="Раніше" onClick={onOlder} />
        <span className="min-w-[112px] text-center text-[13px] font-semibold">{value}</span>
        <IconButton icon="chevronRight" label="Пізніше" onClick={onNewer} disabled={!canNewer} />
      </div>
    </div>
  );
}
