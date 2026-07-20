"use client";

import { MetricLine } from "@/components/charts";
import { Card, SectionLabel, Segmented } from "@/components/ui";
import type { Exercise, Routine } from "@/lib/types";
import {
  compareLastTwo,
  exerciseSeries,
  routineSeries,
  type LoadedWorkout,
  type ProgressMetric,
} from "@/lib/workouts";
import { cn, fmt, fmtInt, shortDate } from "@/lib/utils";
import { useMemo, useState } from "react";

const METRIC_OPTS: { value: ProgressMetric; label: string }[] = [
  { value: "weight", label: "Вага" },
  { value: "tonnage", label: "Тоннаж" },
  { value: "orm", label: "1ПМ" },
];

export function WorkoutProgress({
  workouts,
  exercises,
  routines,
}: {
  workouts: LoadedWorkout[];
  exercises: Exercise[];
  routines: Routine[];
}) {
  // лише вправи, що реально трапляються в сесіях
  const usedExercises = useMemo(() => {
    const ids = new Set(workouts.flatMap((w) => w.sets.map((s) => s.exercise_id)));
    return exercises.filter((e) => ids.has(e.id));
  }, [workouts, exercises]);

  const usedRoutines = useMemo(() => {
    const ids = new Set(workouts.map((w) => w.routine_id).filter(Boolean));
    return routines.filter((r) => ids.has(r.id));
  }, [workouts, routines]);

  const [exId, setExId] = useState<string | null>(usedExercises[0]?.id ?? null);
  const [metric, setMetric] = useState<ProgressMetric>("weight");
  const [rtId, setRtId] = useState<string | null>(usedRoutines[0]?.id ?? null);

  if (workouts.length === 0) return null;

  const series = exId ? exerciseSeries(workouts, exId, metric) : [];
  const compare = exId ? compareLastTwo(workouts, exId) : null;
  const rtSeries = rtId ? routineSeries(workouts, rtId) : [];
  const unit = "кг";

  return (
    <div className="flex flex-col gap-[15px]">
      <h2 className="px-1 pt-2 text-[17px] font-extrabold">Прогрес</h2>

      {/* A. Прогрес по вправі */}
      {usedExercises.length > 0 && exId && (
        <Card>
          <SectionLabel>Прогрес по вправі</SectionLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {usedExercises.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setExId(e.id)}
                className={cn(
                  "rounded-full px-[13px] py-[7px] text-[12.5px] transition",
                  exId === e.id
                    ? "bg-primary font-bold text-white"
                    : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
                )}
              >
                {e.name}
              </button>
            ))}
          </div>
          <div className="mb-3">
            <Segmented options={METRIC_OPTS} value={metric} onChange={setMetric} />
          </div>
          <MetricLine data={series.map((p) => ({ label: p.label, value: p.value }))} unit="кг" />

          {/* C. Порівняння з минулим */}
          {compare && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CompareCard
                title="Макс. вага"
                current={compare.current.maxWeight}
                previous={compare.previous?.maxWeight ?? null}
                unit="кг"
                better="up"
              />
              <CompareCard
                title="Тоннаж"
                current={compare.current.tonnage}
                previous={compare.previous?.tonnage ?? null}
                unit="кг"
                better="up"
                integer
              />
            </div>
          )}
          {compare && (
            <div className="mt-2 text-center text-[11px] font-semibold text-muted">
              {shortDate(compare.current.date)}
              {compare.previous ? ` vs ${shortDate(compare.previous.date)}` : " · перша сесія"}
            </div>
          )}
        </Card>
      )}

      {/* B. Прогрес по тренуванню */}
      {usedRoutines.length > 0 && rtId && (
        <Card>
          <SectionLabel>Прогрес по тренуванню</SectionLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {usedRoutines.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRtId(r.id)}
                className={cn(
                  "rounded-full px-[13px] py-[7px] text-[12.5px] transition",
                  rtId === r.id
                    ? "bg-primary font-bold text-white"
                    : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
                )}
              >
                {r.name}
              </button>
            ))}
          </div>
          <MetricLine data={rtSeries} unit="кг" />
          <div className="mt-2 text-center text-[11px] font-semibold text-muted">
            загальний тоннаж сесії, {unit}
          </div>
        </Card>
      )}
    </div>
  );
}

function CompareCard({
  title,
  current,
  previous,
  unit,
  better,
  integer,
}: {
  title: string;
  current: number | null;
  previous: number | null;
  unit: string;
  better: "up" | "down";
  integer?: boolean;
}) {
  const f = (v: number | null) => (v == null ? "—" : integer ? fmtInt(v) : fmt(v, 1));
  const diff = current != null && previous != null ? current - previous : null;
  const good = diff == null ? null : better === "up" ? diff >= 0 : diff <= 0;
  return (
    <div className="rounded-[14px] bg-bg p-[13px]">
      <div className="text-[12px] font-bold text-muted">{title}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[20px] font-extrabold">{f(current)}</span>
        <span className="text-[11px] font-bold text-muted">{unit}</span>
        {diff != null && Math.abs(diff) >= 0.05 ? (
          <span className={cn("ml-auto text-[11px] font-extrabold", good ? "text-pos" : "text-neg")}>
            {diff > 0 ? "↑" : "↓"}
            {integer ? fmtInt(Math.abs(diff)) : fmt(Math.abs(diff), 1)}
          </span>
        ) : (
          <span className="ml-auto text-[11px] font-extrabold text-muted">—</span>
        )}
      </div>
    </div>
  );
}
