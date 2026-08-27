"use client";

import { Card, ErrorBanner, FullLoader, Segmented } from "@/components/ui";
import { dayCompleteness, heatLevel, weekRows } from "@/lib/activity";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import type { DailyLog } from "@/lib/types";
import {
  addDays,
  cn,
  fmtInt,
  humanDate,
  plural,
  todayISO,
  weekdayHead,
} from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type MetricKey = "steps" | "workouts" | "diary";

/** Прозорість клітинки за рівнем 1..4; рівень 0 малюється фоновим класом. */
const LEVEL_OPACITY = [0, 0.3, 0.55, 0.78, 1];

/** Дні тижня в колонках сітки: Пн..Нд (JS-індекси 1..6, 0). */
const COL_DAYS = [1, 2, 3, 4, 5, 6, 0];

type DayRow = Pick<
  DailyLog,
  "date" | "weight" | "kcal" | "protein" | "fat" | "carbs" | "water" | "steps"
>;

export default function ActivityPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const [metric, setMetric] = useState<MetricKey>("steps");
  const [selected, setSelected] = useState<string | null>(null);

  const end = todayISO();
  const start = addDays(end, -364);

  const dataQ = useQuery({
    queryKey: ["diary", uid, "activity", start, end],
    queryFn: async () => {
      const [daily, workouts] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("date, weight, kcal, protein, fat, carbs, water, steps")
          .eq("user_id", uid)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("workouts")
          .select("date")
          .eq("user_id", uid)
          .gte("date", start)
          .lte("date", end),
      ]);
      if (daily.error) throw daily.error;
      if (workouts.error) throw workouts.error;
      return {
        logs: (daily.data ?? []) as DayRow[],
        workoutDates: (workouts.data ?? []).map((w) => w.date as string),
      };
    },
  });
  const logs = useMemo(() => dataQ.data?.logs ?? [], [dataQ.data]);
  const workoutDates = useMemo(() => dataQ.data?.workoutDates ?? [], [dataQ.data]);
  const loading = dataQ.isPending;
  const error = dataQ.isError ? "Не вдалося завантажити дані. Спробуй пізніше." : null;

  /** Значення метрики за датою. Відсутність запису = немає значення. */
  const values = useMemo(() => {
    const m = new Map<string, number>();
    if (metric === "workouts") {
      for (const d of workoutDates) m.set(d, (m.get(d) ?? 0) + 1);
      return m;
    }
    for (const l of logs) {
      if (metric === "steps") {
        if (l.steps != null) m.set(l.date, l.steps);
      } else {
        const c = dayCompleteness(l);
        if (c > 0) m.set(l.date, c);
      }
    }
    return m;
  }, [metric, logs, workoutDates]);

  const max = useMemo(
    () => Math.max(0, ...values.values()),
    [values],
  );

  const rows = useMemo(() => weekRows(start, end), [start, end]);

  const activeDays = values.size;

  const detailText = (date: string): string => {
    const v = values.get(date);
    if (metric === "steps") {
      return v != null ? `${fmtInt(v)} ${plural(Math.round(v), "крок", "кроки", "кроків")}` : "кроки не записані";
    }
    if (metric === "workouts") {
      return v != null
        ? `${v} ${plural(v, "тренування", "тренування", "тренувань")}`
        : "без тренувань";
    }
    return v != null
      ? `щоденник: заповнено ${Math.round(v * 7)} з 7 полів`
      : "щоденник порожній";
  };

  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Активність за рік</h1>

      <Segmented<MetricKey>
        value={metric}
        onChange={setMetric}
        options={[
          { value: "steps", label: "Кроки" },
          { value: "workouts", label: "Тренування" },
          { value: "diary", label: "Щоденник" },
        ]}
      />

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-muted">
              {activeDays} {plural(activeDays, "день", "дні", "днів")} з даними за рік
            </span>
            <span className="flex items-center gap-[3px] text-[10.5px] font-bold text-muted">
              менше
              {LEVEL_OPACITY.map((o, lvl) => (
                <span
                  key={lvl}
                  className={cn(
                    "inline-block h-[10px] w-[10px] rounded-[3px]",
                    lvl === 0 ? "bg-primary-light" : "bg-primary",
                  )}
                  style={{ opacity: lvl === 0 ? 0.35 : o }}
                />
              ))}
              більше
            </span>
          </div>

          <div className="mx-auto grid w-full max-w-[340px] grid-cols-[32px_repeat(7,1fr)] gap-[3px]">
            <span />
            {COL_DAYS.map((jsDay) => (
              <span
                key={jsDay}
                className="pb-0.5 text-center text-[10px] font-bold text-muted"
              >
                {weekdayHead(jsDay)}
              </span>
            ))}
            {rows.map((row, ri) => (
              <FragmentRow
                key={row.days.find((d) => d != null) ?? ri}
                row={row}
                values={values}
                max={max}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>

          {selected && (
            <div className="mt-3 rounded-[12px] bg-bg px-3 py-2 text-[12.5px] font-bold">
              {humanDate(selected)}
              <span className="ml-1.5 font-semibold text-muted">{detailText(selected)}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  values,
  max,
  selected,
  onSelect,
}: {
  row: { days: (string | null)[]; monthLabel: string | null };
  values: Map<string, number>;
  max: number;
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  return (
    <>
      <span className="flex items-center text-[10px] font-bold text-muted">
        {row.monthLabel}
      </span>
      {row.days.map((d, i) => {
        if (d == null) return <span key={i} />;
        const lvl = heatLevel(values.get(d) ?? null, max);
        return (
          <button
            key={d}
            type="button"
            aria-label={humanDate(d)}
            onClick={() => onSelect(d)}
            className={cn(
              "h-[18px] rounded-[5px] transition",
              selected === d && "ring-2 ring-accent",
            )}
          >
            <span
              className={cn(
                "block h-full w-full rounded-[5px]",
                lvl === 0 ? "bg-primary-light" : "bg-primary",
              )}
              style={{ opacity: lvl === 0 ? 0.35 : LEVEL_OPACITY[lvl] }}
            />
          </button>
        );
      })}
    </>
  );
}
