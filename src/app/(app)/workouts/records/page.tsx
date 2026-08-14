"use client";

import { Card, EmptyState, ErrorBanner, FullLoader, SectionLabel } from "@/components/ui";
import { buildRecordRows, recentRecords, type RecordRow } from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import type { MuscleGroup } from "@/lib/types";
import { fmt, shortDate, todayISO } from "@/lib/utils";
import { loadExerciseMaxes, loadUsedExercises } from "@/lib/workouts-db";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function RecordsPage() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayISO(), []);
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exercises, maxes] = await Promise.all([
          loadUsedExercises(supabase),
          loadExerciseMaxes(supabase, null),
        ]);
        if (!cancelled) setRows(buildRecordRows(exercises, maxes));
      } catch {
        if (!cancelled) setError("Не вдалося завантажити рекорди.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const recent = useMemo(() => (rows ? recentRecords(rows, today) : []), [rows, today]);

  // групи в порядку появи у відсортованому списку — порядок MUSCLE_GROUPS
  const grouped = useMemo(() => {
    if (!rows) return [];
    const out: { group: MuscleGroup | null; items: RecordRow[] }[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.group === r.muscleGroup) last.items.push(r);
      else out.push({ group: r.muscleGroup, items: [r] });
    }
    return out;
  }, [rows]);

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-2 px-1 pt-1">
        <Link href="/workouts" aria-label="Назад" className="text-muted">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l-6 6 6 6" /></svg>
        </Link>
        <h1 className="text-[22px] font-extrabold">Рекорди</h1>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!rows && !error ? (
        <FullLoader />
      ) : rows && rows.length === 0 ? (
        <EmptyState
          emoji="🏆"
          title="Ще немає рекордів"
          hint="Рекорди зʼявляться, щойно збережеш тренування з вагою у підходах."
        />
      ) : (
        <>
          {recent.length > 0 && (
            <Card>
              <SectionLabel>Нові за 30 днів 🎉</SectionLabel>
              <div className="flex flex-col gap-2.5">
                {recent.map((r) => (
                  <div key={r.exerciseId} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-extrabold">{r.name}</div>
                      <div className="text-[11.5px] font-bold text-muted">{shortDate(r.date)}</div>
                    </div>
                    <div className="shrink-0 text-[14px] font-extrabold text-primary">
                      {fmt(r.weight, 1)} кг × {r.reps}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {grouped.map(({ group, items }) => (
            <div key={group ?? "інші"}>
              <SectionLabel className="mb-2 px-1 capitalize">{group ?? "без групи"}</SectionLabel>
              <Card className="!p-0">
                {items.map((r, i) => (
                  <div
                    key={r.exerciseId}
                    className={
                      "flex items-center justify-between gap-3 px-4 py-3 " +
                      (i > 0 ? "border-t border-bg" : "")
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold">{r.name}</div>
                      <div className="text-[11.5px] font-semibold text-muted">
                        {shortDate(r.date)}
                      </div>
                    </div>
                    <div className="shrink-0 text-[14.5px] font-extrabold">
                      {fmt(r.weight, 1)} <span className="text-[11.5px] font-bold text-muted">кг</span>{" "}
                      × {r.reps}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}

          <p className="px-2 text-center text-[11.5px] font-semibold text-muted">
            Рекорд — найбільша вага підходу; при рівній вазі — більше повторів.
            Вправи без ваги (власна вага) сюди не потрапляють.
          </p>
        </>
      )}
    </div>
  );
}
