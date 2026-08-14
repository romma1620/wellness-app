"use client";

import { Button, EmptyState, ErrorBanner } from "@/components/ui";
import { MuscleBalanceCard } from "@/components/workouts/MuscleBalanceCard";
import { UnfinishedWorkoutCard } from "@/components/workouts/UnfinishedWorkoutCard";
import { WorkoutList } from "@/components/workouts/WorkoutList";
import { WorkoutProgress } from "@/components/workouts/WorkoutProgress";
import { WorkoutsSkeleton } from "@/components/workouts/WorkoutsSkeleton";
import { createClient } from "@/lib/supabase/client";
import { clearDraft, readDraft, type StoredDraft } from "@/lib/workout-draft";
import {
  pickMonthPage,
  remainingSessions,
  type MonthTotal,
  type UsedExercise,
  type WorkoutListItem,
} from "@/lib/workouts";
import {
  loadExerciseSets,
  loadMonthTotals,
  loadMuscleSets,
  loadUsedExercises,
  loadWorkoutList,
} from "@/lib/workouts-db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function WorkoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [totals, setTotals] = useState<MonthTotal[]>([]);
  const [exercises, setExercises] = useState<UsedExercise[]>([]);
  const [items, setItems] = useState<WorkoutListItem[]>([]);
  const [loadedMonths, setLoadedMonths] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  const [draft, setDraft] = useState<StoredDraft | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        const id = u.user?.id;
        if (!id) throw new Error("no-user");
        const [ts, ex] = await Promise.all([
          loadMonthTotals(supabase),
          loadUsedExercises(supabase),
        ]);
        const page = pickMonthPage(ts, 0);
        const first = page ? await loadWorkoutList(supabase, id, page.from, page.to) : [];
        setUid(id);
        // читаємо тут, а не в тілі рендера: localStorage недоступний на
        // сервері, і читання під час рендера дало б розбіжність гідрації
        setDraft(readDraft(id));
        setTotals(ts);
        setExercises(ex);
        setItems(first);
        setLoadedMonths(page?.months ?? 0);
      } catch {
        setError("Не вдалося завантажити тренування.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const loadSets = useCallback(
    async (exerciseId: string) => (uid ? loadExerciseSets(supabase, uid, exerciseId) : []),
    [supabase, uid],
  );

  const loadBalanceRows = useCallback(
    async (from: string, to: string) => (uid ? loadMuscleSets(supabase, uid, from, to) : []),
    [supabase, uid],
  );

  const loadMore = async () => {
    const page = pickMonthPage(totals, loadedMonths);
    if (!uid || !page) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await loadWorkoutList(supabase, uid, page.from, page.to);
      setItems((prev) => [...prev, ...next]);
      setLoadedMonths((n) => n + page.months);
    } catch {
      // вже показане лишається на місці — банер тільки про невдале довантаження
      setMoreError("Не вдалося довантажити. Спробуй ще раз.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Тренування</h1>
        <div className="flex items-center gap-3.5">
          <Link href="/workouts/records" className="text-[13px] font-extrabold text-primary">
            Рекорди
          </Link>
          <Link href="/workouts/routines" className="text-[13px] font-extrabold text-primary">
            Шаблони
          </Link>
        </div>
      </div>

      <Button type="button" onClick={() => router.push("/workouts/new")}>
        + Нове тренування
      </Button>

      {/* поза гілкою `items.length === 0`: незакінчене показуємо й тоді,
          коли архів іще порожній */}
      {draft && (
        <UnfinishedWorkoutCard
          stored={draft}
          onDiscard={() => {
            clearDraft();
            setDraft(null);
          }}
        />
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <WorkoutsSkeleton />
      ) : items.length === 0 && !error ? (
        <EmptyState
          emoji="🏋️"
          title="Ще немає тренувань"
          hint="Додай першу сесію — вправи, вагу і підходи. Далі бачитимеш прогрес на графіках."
        />
      ) : (
        <>
          <WorkoutProgress exercises={exercises} loadSets={loadSets} />

          <MuscleBalanceCard exercises={exercises} loadRows={loadBalanceRows} />

          <h2 className="px-1 pt-2 text-[17px] font-extrabold">Історія</h2>

          <WorkoutList
            items={items}
            totals={totals}
            remaining={remainingSessions(totals, loadedMonths)}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />

          {moreError && <ErrorBanner>{moreError}</ErrorBanner>}
        </>
      )}
    </div>
  );
}
