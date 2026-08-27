"use client";

import { usePhaseOverlay } from "@/components/cycle/analytics";
import { Card, EmptyState, ErrorBanner, FullLoader, SectionLabel } from "@/components/ui";
import { PHASE_TIPS } from "@/lib/cycle/tips";
import { PHASE_COLORS, PHASE_LABELS, PHASE_TINTS } from "@/lib/cycle/types";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
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
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-2 px-1 pt-1">
        <Link href="/analytics" aria-label="Назад" className="text-muted">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l-6 6 6 6" /></svg>
        </Link>
        <h1 className="text-[22px] font-extrabold">Тижневий звіт</h1>
      </div>

      {/* Перемикач тижня */}
      <Card className="flex items-center justify-between !py-2.5">
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Попередній тиждень"
          className="flex h-8 w-8 items-center justify-center rounded-full text-primary active:scale-90"
        >
          <ChevronLeft size={19} />
        </button>
        <span className="text-[14px] font-extrabold">{periodLabel("week", offset)}</span>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          aria-label="Наступний тиждень"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-primary active:scale-90",
            offset === 0 && "opacity-25",
          )}
        >
          <ChevronRight size={19} />
        </button>
      </Card>

      {error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : !ready || !stats || !gym ? (
        <FullLoader />
      ) : emptyWeek ? (
        <EmptyState
          emoji="🗓️"
          title="Порожній тиждень"
          hint="За цей тиждень немає ні щоденника, ні тренувань."
        />
      ) : (
        <>
          {/* Вага */}
          <Card>
            <SectionLabel>Вага</SectionLabel>
            <div className="flex items-end justify-between">
              <div className="text-[32px] font-extrabold leading-none">
                {fmt(stats.avgWeight, 1)}
                {stats.avgWeight != null && (
                  <span className="ml-1 text-[13px] font-bold text-muted">кг у середньому</span>
                )}
              </div>
              {stats.weightDiff != null && (
                <div
                  className={cn(
                    "text-[14px] font-extrabold",
                    stats.weightDiff < 0 ? "text-pos" : stats.weightDiff > 0 ? "text-warn" : "text-muted",
                  )}
                >
                  {stats.weightDiff < 0 ? "↓" : stats.weightDiff > 0 ? "↑" : "→"}{" "}
                  {fmt(Math.abs(stats.weightDiff), 1)} кг
                  <div className="text-right text-[11px] font-bold text-muted">за тиждень</div>
                </div>
              )}
            </div>
          </Card>

          {/* Звички */}
          <Card>
            <SectionLabel>Звички</SectionLabel>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[20px] font-extrabold">💧 {fmt(stats.avgWater, 1)}</div>
                <div className="text-[11px] font-bold text-muted">скл. / день</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold">👟 {fmtThousands(stats.avgSteps)}</div>
                <div className="text-[11px] font-bold text-muted">тис. кроків / день</div>
              </div>
              <div>
                <div className="text-[20px] font-extrabold">🍽 {fmtInt(stats.avgKcal)}</div>
                <div className="text-[11px] font-bold text-muted">ккал / день</div>
              </div>
            </div>
            <div className="mt-3 border-t border-bg pt-2.5 text-center text-[12px] font-bold text-muted">
              Щоденник заповнено {stats.daysLogged} / 7 днів
            </div>
          </Card>

          {/* Тренування */}
          <Card>
            <SectionLabel>Тренування</SectionLabel>
            {gym.sessions === 0 ? (
              <div className="text-[13px] font-semibold text-muted">
                Цього тижня сесій не було.
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-extrabold">{gym.sessions}</span>
                <span className="text-[13px] font-bold text-muted">
                  {plural(gym.sessions, "сесія", "сесії", "сесій")} · тоннаж {fmtInt(gym.tonnage)} кг
                </span>
              </div>
            )}
            {weekRecords.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-t border-bg pt-3">
                <div className="text-[12px] font-extrabold text-primary">
                  🏆 Нові рекорди тижня
                </div>
                {weekRecords.map((r) => (
                  <div key={r.exerciseId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13.5px] font-bold">{r.name}</span>
                    <span className="shrink-0 text-[13.5px] font-extrabold">
                      {fmt(r.weight, 1)} кг × {r.reps}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Цикл — лише для поточного тижня: порада про «сьогодні» в минулому тижні брехала б */}
          {offset === 0 && overlay.available && overlay.todayPhase && tip && (
            <div
              className="rounded-xl2 p-4"
              style={{ background: PHASE_TINTS[overlay.todayPhase] }}
            >
              <div
                className="mb-1 text-[12.5px] font-extrabold"
                style={{ color: PHASE_COLORS[overlay.todayPhase] }}
              >
                {PHASE_LABELS[overlay.todayPhase]}
                {overlay.prediction && !overlay.prediction.rangeOnly && (
                  <> · наступна менструація ~ {shortDate(overlay.prediction.nextStart)}</>
                )}
              </div>
              <div className="text-[13.5px] font-extrabold text-ink">
                {tip.emoji} {tip.title}
              </div>
              <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-ink/80">
                {tip.text}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
