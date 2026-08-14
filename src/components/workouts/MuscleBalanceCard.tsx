"use client";

import { Card, SectionLabel, Segmented, Spinner } from "@/components/ui";
import {
  muscleBalance,
  staleGroups,
  type MuscleSetRow,
} from "@/lib/muscle-balance";
import { addDays, fmtInt, plural, todayISO } from "@/lib/utils";
import type { UsedExercise } from "@/lib/workouts";
import { useEffect, useMemo, useState } from "react";

type BalancePeriod = "7d" | "30d";
const PERIOD_DAYS: Record<BalancePeriod, number> = { "7d": 7, "30d": 30 };

/** Результат завантаження, привʼязаний до періоду — як LoadState у WorkoutProgress. */
type LoadState =
  | { period: BalancePeriod; status: "ok"; rows: MuscleSetRow[] }
  | { period: BalancePeriod; status: "error" };

/**
 * Баланс м'язових груп за останні 7/30 днів.
 * Підказка про занедбані групи живе від усієї історії (`exercises`),
 * а не від періоду: «не потрапила в тиждень» — ще не «занедбана».
 */
export function MuscleBalanceCard({
  exercises,
  loadRows,
}: {
  exercises: UsedExercise[];
  loadRows: (from: string, to: string) => Promise<MuscleSetRow[]>;
}) {
  const today = useMemo(() => todayISO(), []);
  const [period, setPeriod] = useState<BalancePeriod>("30d");
  const [loaded, setLoaded] = useState<LoadState | null>(null);

  const current = loaded?.period === period ? loaded : null;

  useEffect(() => {
    let cancelled = false;
    loadRows(addDays(today, -(PERIOD_DAYS[period] - 1)), today)
      .then((rows) => {
        if (!cancelled) setLoaded({ period, status: "ok", rows });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ period, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [loadRows, period, today]);

  const stats = useMemo(
    () => (current?.status === "ok" ? muscleBalance(current.rows) : []),
    [current],
  );
  const maxSets = stats.length ? Math.max(...stats.map((s) => s.sets)) : 0;
  const stale = useMemo(() => staleGroups(exercises, today), [exercises, today]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel className="mb-0">Баланс мʼязових груп</SectionLabel>
      </div>
      <Segmented<BalancePeriod>
        value={period}
        onChange={setPeriod}
        options={[
          { value: "7d", label: "7 днів" },
          { value: "30d", label: "30 днів" },
        ]}
      />
      <div className="mt-3.5">
        {!current ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 text-primary" />
          </div>
        ) : current.status === "error" ? (
          <div className="py-4 text-center text-[12px] font-semibold text-muted">
            Не вдалося завантажити баланс.
          </div>
        ) : stats.length === 0 ? (
          <div className="py-4 text-center text-[12px] font-semibold text-muted">
            За цей період тренувань не було.
          </div>
        ) : (
          <div className="flex flex-col gap-[11px]">
            {stats.map((s) => (
              <div key={s.group} className="flex items-center gap-2.5">
                <span className="w-[52px] shrink-0 text-[11.5px] font-bold capitalize text-muted">
                  {s.group}
                </span>
                <div className="h-[9px] flex-1 rounded-[5px] bg-bg">
                  <div
                    className="h-full rounded-[5px] bg-primary"
                    style={{ width: `${Math.max((s.sets / maxSets) * 100, 6)}%`, opacity: 0.85 }}
                  />
                </div>
                <span className="w-[104px] shrink-0 text-right text-[11.5px] font-extrabold">
                  {s.sets} підх.{" "}
                  <span className="font-bold text-muted">· {fmtInt(s.tonnage)} кг</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {stale.length > 0 && (
        <p className="mt-3 rounded-[12px] bg-bg px-3 py-2.5 text-[12px] font-bold leading-snug text-muted">
          💡 «{stale[0].group}» не тренувались {stale[0].daysAgo}{" "}
          {plural(stale[0].daysAgo, "день", "дні", "днів")}
          {stale[1] && `, «${stale[1].group}» — ${stale[1].daysAgo}`}. Може, час повернути їх у
          план?
        </p>
      )}
    </Card>
  );
}
