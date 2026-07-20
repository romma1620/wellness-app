"use client";

import { Button, EmptyState, ErrorBanner, FullLoader } from "@/components/ui";
import { WorkoutProgress } from "@/components/workouts/WorkoutProgress";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, Routine } from "@/lib/types";
import { exerciseCount, workoutTonnage, type LoadedWorkout } from "@/lib/workouts";
import { loadExercises, loadRoutines, loadWorkoutsWithSets } from "@/lib/workouts-db";
import { fmtInt, humanDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function WorkoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [workouts, setWorkouts] = useState<LoadedWorkout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
        const [ws, ex, rt] = await Promise.all([
          loadWorkoutsWithSets(supabase, uid),
          loadExercises(supabase, uid),
          loadRoutines(supabase, uid),
        ]);
        setWorkouts(ws);
        setExercises(ex);
        setRoutines(rt);
      } catch {
        setError("Не вдалося завантажити тренування.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Тренування</h1>
        <Link href="/workouts/routines" className="text-[13px] font-extrabold text-primary">
          Шаблони
        </Link>
      </div>

      <Button type="button" onClick={() => router.push("/workouts/new")}>
        + Нове тренування
      </Button>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <FullLoader />
      ) : workouts.length === 0 ? (
        <EmptyState
          emoji="🏋️"
          title="Ще немає тренувань"
          hint="Додай першу сесію — вправи, вагу і підходи. Далі бачитимеш прогрес на графіках."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {workouts.map((w) => (
            <Link
              key={w.id}
              href={`/workouts/${w.id}`}
              className="rounded-2xl bg-surface p-4 shadow-card transition active:scale-[.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-ink">{w.name ?? "Тренування"}</span>
                <span className="text-[12px] font-semibold text-muted">{humanDate(w.date)}</span>
              </div>
              <div className="mt-1.5 flex gap-4 text-[12.5px] font-semibold text-muted">
                <span>{exerciseCount(w)} вправ</span>
                <span>тоннаж {fmtInt(workoutTonnage(w))} кг</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && workouts.length > 0 && (
        <WorkoutProgress workouts={workouts} exercises={exercises} routines={routines} />
      )}
    </div>
  );
}
