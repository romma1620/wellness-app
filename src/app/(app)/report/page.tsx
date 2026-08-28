"use client";

import { usePhaseOverlay } from "@/components/cycle/analytics";
import { BackLink } from "@/components/BackLink";
import { Icon } from "@/components/icons";
import { Card, EmptyState, ErrorBanner, FullLoader, IconButton, PageTitle, SectionLabel } from "@/components/ui";
import { PHASE_TIPS } from "@/lib/cycle/tips";
import { PHASE_COLORS, PHASE_LABELS } from "@/lib/cycle/types";
import { buildRecordRows, recordsInRange, type RecordRow } from "@/lib/records";
import { sessionsSummary, weekStats, type ReportDay } from "@/lib/report";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  fmt,
  fmtInt,
  fmtThousands,
  periodLabel,
  periodRange,
  plural,
  shortDate,
} from "@/lib/utils";
import { useUid } from "@/components/UserProvider";
import { loadExerciseMaxes, loadUsedExercises } from "@/lib/workouts-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface WeekData {
  cur: ReportDay[];
  prev: ReportDay[];
  workouts: { sets: { weight: number | null; reps: number }[] }[];
}

export default function ReportPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const [offset, setOffset] = useState(0);

  const overlay = usePhaseOverlay();

  // Дані тижня — щоденник обох тижнів (цей + порівняльний) і сесії цього.
  const weekQ = useQuery({
    queryKey: ["diary", uid, "report", offset],
    queryFn: async (): Promise<WeekData> => {
      const cur = periodRange("week", offset);
      const prev = periodRange("week", offset + 1);
      const [daily, workouts] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("date, weight, kcal, water, steps, sport, care, comment")
          .eq("user_id", uid)
          .gte("date", prev.start)
          .lte("date", cur.end)
          .order("date", { ascending: true }),
        supabase
          .from("workouts")
          .select("date, workout_sets(weight, reps)")
          .eq("user_id", uid)
          .gte("date", cur.start)
          .lte("date", cur.end),
      ]);
      if (daily.error) throw daily.error;
      if (workouts.error) throw workouts.error;
      const rows = (daily.data ?? []) as ReportDay[];
      return {
        cur: rows.filter((d) => d.date >= cur.start),
        prev: rows.filter((d) => d.date < cur.start),
        workouts: (workouts.data ?? []).map((w: any) => ({ sets: w.workout_sets ?? [] })),
      };
    },
  });
  const error = weekQ.isError ? "Не вдалося завантажити звіт. Спробуй пізніше." : null;

  // Рекорди — окремим кешем: звіт живе й без них, тож помилка тиха.
  const recordsQ = useQuery({
    queryKey: ["workouts", uid, "records"],
    queryFn: async (): Promise<RecordRow[]> => {
      try {
        const [exercises, maxes] = await Promise.all([
          loadUsedExercises(supabase),
          loadExerciseMaxes(supabase, null),
        ]);
        return buildRecordRows(exercises, maxes);
      } catch {
        return [];
      }
    },
  });
  const records = useMemo(() => recordsQ.data ?? [], [recordsQ.data]);

  const ready = weekQ.data ?? null;
  const stats = useMemo(() => (ready ? weekStats(ready.cur, ready.prev) : null), [ready]);
  const gym = useMemo(() => (ready ? sessionsSummary(ready.workouts) : null), [ready]);
  const { start: curStart, end: curEnd } = periodRange("week", offset);
  const weekRecords = useMemo(
    () => recordsInRange(records, curStart, curEnd),
    [records, curStart, curEnd],
  );

  const tip = overlay.todayPhase ? PHASE_TIPS[overlay.todayPhase] : null;
  const emptyWeek = stats?.daysLogged === 0 && gym?.sessions === 0;

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle right={<BackLink href="/analytics" />}>Тижневий звіт</PageTitle>

      {/* Перемикач тижня */}
      <Card className="flex items-center justify-between !px-3 !py-[10px]">
        <IconButton
          icon="chevronLeft"
          label="Попередній тиждень"
          className="!bg-field"
          onClick={() => setOffset((o) => o + 1)}
        />
        <span className="text-[14px] font-bold">{periodLabel("week", offset)}</span>
        <IconButton
          icon="chevronRight"
          label="Наступний тиждень"
          className="!bg-field"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
        />
      </Card>

      {error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : !ready || !stats || !gym ? (
        <FullLoader />
      ) : emptyWeek ? (
        <EmptyState
          icon="calendar"
          title="Порожній тиждень"
          hint="За цей тиждень немає ні щоденника, ні тренувань."
        />
      ) : (
        <>
          {/* Вага */}
          <Card>
            <SectionLabel icon="scale">Вага</SectionLabel>
            <div className="flex items-end justify-between">
              <div className="flex items-baseline gap-[6px]">
                <span className="text-[34px] font-normal leading-[1.1] tracking-[-.01em]">
                  {fmt(stats.avgWeight, 1)}
                </span>
                {stats.avgWeight != null && (
                  <span className="text-[12.5px] font-medium text-muted">кг у середньому</span>
                )}
              </div>
              {stats.weightDiff != null && (
                <div className="flex flex-col items-end gap-[3px]">
                  <span
                    className={cn(
                      "flex items-center gap-[3px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold",
                      stats.weightDiff < 0
                        ? "bg-[color:color-mix(in_oklab,var(--pos)_13%,transparent)] text-pos"
                        : stats.weightDiff > 0
                          ? "bg-[color:color-mix(in_oklab,var(--warn)_13%,transparent)] text-warn"
                          : "bg-field text-muted",
                    )}
                  >
                    {stats.weightDiff !== 0 && (
                      <Icon
                        name={stats.weightDiff < 0 ? "arrowDown" : "arrowUp"}
                        size={10}
                        strokeWidth={2.2}
                      />
                    )}
                    {fmt(Math.abs(stats.weightDiff), 1)} кг
                  </span>
                  <span className="text-[11px] font-normal text-muted">за тиждень</span>
                </div>
              )}
            </div>
          </Card>

          {/* Звички */}
          <Card>
            <SectionLabel icon="bolt">Звички</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <HabitStat icon="droplet" value={fmt(stats.avgWater, 1)} label="скл. / день" />
              <HabitStat
                icon="activity"
                value={fmtThousands(stats.avgSteps)}
                label="тис. кроків / день"
              />
              <HabitStat icon="fork" value={fmtInt(stats.avgKcal)} label="ккал / день" />
            </div>
            <div className="mt-3 border-t border-line pt-3 text-center text-[11.5px] font-medium text-muted">
              Щоденник заповнено {stats.daysLogged} / 7 днів
            </div>
          </Card>

          {/* Тренування */}
          <Card>
            <SectionLabel icon="dumbbell">Тренування</SectionLabel>
            {gym.sessions === 0 ? (
              <div className="text-[13px] font-medium text-muted">Цього тижня сесій не було.</div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-normal leading-[1.1] tracking-[-.01em]">
                  {gym.sessions}
                </span>
                <span className="text-[12.5px] font-medium text-muted">
                  {plural(gym.sessions, "сесія", "сесії", "сесій")} · тоннаж {fmtInt(gym.tonnage)} кг
                </span>
              </div>
            )}
            {weekRecords.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                <div className="flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[.09em] text-accent">
                  <Icon name="arrowUp" size={12} strokeWidth={2} />
                  Нові рекорди тижня
                </div>
                {weekRecords.map((r) => (
                  <div key={r.exerciseId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{r.name}</span>
                    <span className="shrink-0 text-[13.5px] font-semibold">
                      {fmt(r.weight, 1)} кг × {r.reps}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Цикл — лише для поточного тижня: порада про «сьогодні» в минулому тижні брехала б */}
          {offset === 0 && overlay.available && overlay.todayPhase && tip && (
            <Card>
              <SectionLabel
                icon="cycle"
                right={
                  <span
                    className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold"
                    style={{
                      color: PHASE_COLORS[overlay.todayPhase],
                      background: `color-mix(in oklab, ${PHASE_COLORS[overlay.todayPhase]} 14%, transparent)`,
                    }}
                  >
                    {PHASE_LABELS[overlay.todayPhase]}
                  </span>
                }
              >
                Цикл
              </SectionLabel>
              <div className="text-[13.5px] font-semibold text-ink">{tip.title}</div>
              <p className="mt-1 text-[12.5px] font-normal leading-[1.6] text-muted">{tip.text}</p>
              {overlay.prediction && !overlay.prediction.rangeOnly && (
                <div className="mt-3 border-t border-line pt-3 text-[11.5px] font-medium text-muted">
                  Наступна менструація ~ {shortDate(overlay.prediction.nextStart)}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Одна звичка тижня: іконка в акцентній плитці, число й підпис. */
function HabitStat({
  icon,
  value,
  label,
}: {
  icon: "droplet" | "activity" | "fork";
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-[6px] rounded-[12px] border border-line bg-field px-2 py-3 text-center">
      <span className="flex text-accent">
        <Icon name={icon} size={15} strokeWidth={1.7} />
      </span>
      <span className="text-[20px] font-normal leading-[1.1] tracking-[-.01em]">{value}</span>
      <span className="text-[10.5px] font-medium leading-[1.3] text-muted">{label}</span>
    </div>
  );
}
