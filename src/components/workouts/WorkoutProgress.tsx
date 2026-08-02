"use client";

import { MetricLine } from "@/components/charts";
import { Card, SectionLabel, Segmented, Spinner } from "@/components/ui";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { cn, fmt, shortDate } from "@/lib/utils";
import {
  compareLastTwo,
  exerciseSeries,
  type ExerciseSet,
  type ProgressMetric,
  type UsedExercise,
} from "@/lib/workouts";
import { useEffect, useMemo, useState } from "react";

const METRIC_OPTS: { value: ProgressMetric; label: string }[] = [
  { value: "weight", label: "Вага" },
  { value: "orm", label: "1ПМ" },
];

/**
 * Прогрес по одній вправі.
 *
 * Сети підвантажуються лише для обраної вправи, а не для всього архіву —
 * тому компонент отримує завантажувач, а не готові дані. Монтувати його
 * можна лише коли `exercises` уже завантажені: початковий вибір береться
 * з першого рендера.
 */
export function WorkoutProgress({
  exercises,
  loadSets,
}: {
  exercises: UsedExercise[];
  loadSets: (exerciseId: string) => Promise<ExerciseSet[]>;
}) {
  // за замовчуванням — вправа з найсвіжішою сесією, а не перша за алфавітом
  const initialId = useMemo(
    () => [...exercises].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))[0]?.id ?? null,
    [exercises],
  );

  const [exId, setExId] = useState<string | null>(initialId);
  const [metric, setMetric] = useState<ProgressMetric>("weight");
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!exId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadSets(exId)
      .then((next) => {
        if (!cancelled) setSets(next);
      })
      .catch(() => {
        if (!cancelled) {
          setSets([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exId, loadSets]);

  if (exercises.length === 0 || !exId) return null;

  const series = exerciseSeries(sets, metric);
  const compare = compareLastTwo(sets);

  return (
    <Card>
      <SectionLabel>Прогрес по вправі</SectionLabel>

      <ExercisePicker exercises={exercises} value={exId} onChange={setExId} />

      <div className="mt-3">
        <Segmented options={METRIC_OPTS} value={metric} onChange={setMetric} />
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex h-[150px] items-center justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : failed ? (
          <div className="py-6 text-center text-[12px] font-semibold text-muted">
            Не вдалося завантажити прогрес
          </div>
        ) : (
          <MetricLine data={series.map((p) => ({ label: p.label, value: p.value }))} unit="кг" />
        )}
      </div>

      {!loading && !failed && compare && (
        <>
          <div className="mt-3">
            <CompareCard
              title="Макс. вага"
              current={compare.current.maxWeight}
              previous={compare.previous?.maxWeight ?? null}
              unit="кг"
              better="up"
            />
          </div>
          <div className="mt-2 text-center text-[11px] font-semibold text-muted">
            {shortDate(compare.current.date)}
            {compare.previous ? ` vs ${shortDate(compare.previous.date)}` : " · перша сесія"}
          </div>
        </>
      )}
    </Card>
  );
}

function CompareCard({
  title,
  current,
  previous,
  unit,
  better,
}: {
  title: string;
  current: number | null;
  previous: number | null;
  unit: string;
  better: "up" | "down";
}) {
  const f = (v: number | null) => (v == null ? "—" : fmt(v, 1));
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
            {fmt(Math.abs(diff), 1)}
          </span>
        ) : (
          <span className="ml-auto text-[11px] font-extrabold text-muted">—</span>
        )}
      </div>
    </div>
  );
}
