"use client";

import { Icon } from "@/components/icons";
import { activeRoutines, durationLabel, spanLabel, type RoutineStat } from "@/lib/routine-stats";
import { plural } from "@/lib/utils";
import Link from "next/link";

/**
 * Шаблони, за якими юзер зараз займається, — кожен окремим рядком, бо
 * паралельно може йти кілька («Ноги 2», «Руки 2»). «З якого дня» — дата
 * першої сесії за шаблоном; сам рядок веде на статистику шаблону.
 */
export function ActiveRoutines({ stats, today }: { stats: RoutineStat[]; today: string }) {
  const active = activeRoutines(stats, today);
  if (active.length === 0) return null;

  return (
    // не Card: рядки йдуть впритул до країв, як у WorkoutList
    <div className="overflow-hidden rounded-xl2 bg-surface">
      <div className="px-[18px] pb-[10px] pt-4 text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
        Активні шаблони
      </div>
      {active.map((s) => (
        <Link
          key={s.routineId}
          href={`/workouts/routines/${s.routineId}`}
          className="flex items-center gap-3 border-t border-line px-[18px] py-3 text-ink transition active:bg-field"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
            <Icon name="dumbbell" size={17} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
            <span className="mt-[2px] block truncate text-[11.5px] font-normal text-muted">
              {spanLabel(s, today)} · {durationLabel(s.firstDate, today)} · {s.sessions}{" "}
              {plural(s.sessions, "сесія", "сесії", "сесій")}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-muted">
            <Icon name="chevronRight" size={16} strokeWidth={1.8} />
          </span>
        </Link>
      ))}
    </div>
  );
}
