"use client";

import { Icon } from "@/components/icons";
import { BackLink } from "@/components/BackLink";
import { ProgressLine } from "@/components/workouts/ProgressLine";
import { Card, EmptyState, ErrorBanner, FullLoader, SectionLabel } from "@/components/ui";
import { useUid } from "@/components/UserProvider";
import {
  avgSessionTonnage,
  durationLabel,
  exerciseProgress,
  isActiveRoutine,
  periodEnd,
  progressDelta,
  routineTonnageSeries,
  sessionsPerWeek,
  statFromWorkouts,
  type ExerciseProgress,
  type ProgressPoint,
} from "@/lib/routine-stats";
import { createClient } from "@/lib/supabase/client";
import { cn, fmt, fmtThousands, plural, shortDate, todayISO } from "@/lib/utils";
import { loadExercises, loadRoutine, loadRoutineWorkouts } from "@/lib/workouts-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Статистика одного шаблону від першої сесії за ним: скільки й як часто
 * займаєшся, тоннаж по сесіях і прогрес кожної вправи з першої сесії.
 */
export function RoutineStatsView({ routineId }: { routineId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();

  const q = useQuery({
    queryKey: ["workouts", uid, "routine", routineId],
    queryFn: async () => {
      const [routine, workouts, exercises] = await Promise.all([
        loadRoutine(supabase, uid, routineId),
        loadRoutineWorkouts(supabase, uid, routineId),
        loadExercises(supabase, uid),
      ]);
      return { routine, workouts, names: new Map(exercises.map((e) => [e.id, e.name])) };
    },
  });

  const header = (title: string) => (
    <div className="flex min-w-0 items-center gap-3 px-[2px]">
      <BackLink href="/workouts" />
      <h1 className="truncate text-[24px] font-bold tracking-[-.01em]">{title}</h1>
    </div>
  );

  if (q.isPending) {
    return (
      <div className="flex flex-col gap-[14px]">
        {header("Шаблон")}
        <FullLoader />
      </div>
    );
  }

  if (q.isError || !q.data.routine) {
    return (
      <div className="flex flex-col gap-[14px]">
        {header("Шаблон")}
        <ErrorBanner>
          {q.isError ? "Не вдалося завантажити статистику." : "Шаблон не знайдено."}
        </ErrorBanner>
      </div>
    );
  }

  const { routine, workouts, names } = q.data;
  const today = todayISO();
  const stat = statFromWorkouts(routine, workouts);

  if (!stat) {
    return (
      <div className="flex flex-col gap-[14px]">
        {header(routine.name)}
        <EmptyState
          icon="dumbbell"
          title="Ще немає сесій"
          hint="Обери цей шаблон у новому тренуванні — і тут зʼявиться статистика від першої сесії."
        />
      </div>
    );
  }

  const active = isActiveRoutine(stat, today);
  const end = periodEnd(stat, today);
  const perWeek = sessionsPerWeek(stat.sessions, stat.firstDate, end);
  const avgTonnage = avgSessionTonnage(workouts);
  const series = routineTonnageSeries(workouts).map((p) => ({
    ...p,
    value: p.value == null ? null : p.value / 1000,
  }));
  const progress = exerciseProgress(workouts);

  return (
    <div className="flex flex-col gap-[14px]">
      {header(routine.name)}

      <Card>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-[10px] py-[3px] text-[11px] font-semibold",
              active ? "bg-primary-light text-accent" : "bg-field text-muted",
            )}
          >
            {stat.archived ? "В архіві" : active ? "Активний" : "Завершений"}
          </span>
        </div>
        <div className="mt-3 text-[15px] font-semibold text-ink">
          {active
            ? `Займаєшся з ${shortDate(stat.firstDate)}`
            : stat.firstDate === stat.lastDate
              ? `Одна сесія ${shortDate(stat.firstDate)}`
              : `З ${shortDate(stat.firstDate)} по ${shortDate(stat.lastDate)}`}
        </div>
        <div className="mt-[3px] text-[12px] font-medium text-muted">
          {durationLabel(stat.firstDate, end)}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Tile label={plural(stat.sessions, "сесія", "сесії", "сесій")} value={String(stat.sessions)} />
          <Tile label="на тиждень" value={fmt(perWeek, 1)} />
          <Tile label="за сесію" value={fmtThousands(avgTonnage)} unit="т" />
        </div>
      </Card>

      <Card>
        <SectionLabel icon="activity">Тоннаж за сесію</SectionLabel>
        <ProgressLine data={series} unit="т" />
      </Card>

      {progress.length > 0 && (
        // не Card: рядки йдуть впритул до країв, як у WorkoutList
        <div className="overflow-hidden rounded-xl2 bg-surface">
          <div className="px-[18px] pb-[10px] pt-4">
            <SectionLabel icon="bars" className="mb-0">
              Прогрес з першої сесії
            </SectionLabel>
          </div>
          {progress.map((p) => (
            <ProgressRow key={p.exerciseId} p={p} name={names.get(p.exerciseId) ?? "—"} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Число зверху, підпис під ним: капітель у третині ширини переносилась би. */
function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-[13px] bg-field p-[11px]">
      <div className="flex items-baseline gap-[4px]">
        <span className="text-[19px] font-normal">{value}</span>
        {unit && <span className="text-[11px] font-medium text-muted">{unit}</span>}
      </div>
      <div className="mt-[2px] text-[11px] font-medium text-muted">{label}</div>
    </div>
  );
}

/** «80 кг × 5» або «12 повт» для власної ваги. */
function pointLabel(p: ProgressPoint): string {
  return p.weight == null ? `${p.reps} повт` : `${fmt(p.weight, 1)} кг × ${p.reps}`;
}

function ProgressRow({ p, name }: { p: ExerciseProgress; name: string }) {
  const delta = progressDelta(p);
  return (
    <div className="flex items-center gap-3 border-t border-line px-[18px] py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{name}</div>
        <div className="mt-[2px] truncate text-[11.5px] font-normal text-muted">
          {p.sessions > 1
            ? `${pointLabel(p.first)} → ${pointLabel(p.last)}`
            : pointLabel(p.first)}{" "}
          · {p.sessions} {plural(p.sessions, "сесія", "сесії", "сесій")}
        </div>
      </div>
      {delta && Math.abs(delta.value) >= 0.05 ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-[3px] text-[12px] font-semibold",
            delta.value > 0 ? "text-pos" : "text-neg",
          )}
        >
          <Icon name={delta.value > 0 ? "arrowUp" : "arrowDown"} size={11} strokeWidth={2} />
          {fmt(Math.abs(delta.value), 1)} {delta.unit}
        </span>
      ) : (
        <span className="shrink-0 text-[12px] font-semibold text-muted">—</span>
      )}
    </div>
  );
}
