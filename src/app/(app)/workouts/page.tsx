"use client";

import { Icon } from "@/components/icons";
import { Button, EmptyState, ErrorBanner, PageTitle, Pill } from "@/components/ui";
import { UnfinishedWorkoutCard } from "@/components/workouts/UnfinishedWorkoutCard";
import { WorkoutList } from "@/components/workouts/WorkoutList";
import { WorkoutProgress } from "@/components/workouts/WorkoutProgress";
import { WorkoutsSkeleton } from "@/components/workouts/WorkoutsSkeleton";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { clearDraft, readDraft, type StoredDraft } from "@/lib/workout-draft";
import { pickMonthPage, remainingSessions, type WorkoutListItem } from "@/lib/workouts";
import {
  loadExerciseSets,
  loadMonthTotals,
  loadUsedExercises,
  loadWorkoutList,
} from "@/lib/workouts-db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function WorkoutsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Довантажені сторінки старіших місяців живуть окремо від першої і
  // привʼязані до знімка bundle, з якого їх рахували: свіжий знімок (після
  // збереження тренування) робить хвости недійсними без скидання в ефекті.
  const [extra, setExtra] = useState<{
    base: unknown;
    items: WorkoutListItem[];
    months: number;
  }>({ base: null, items: [], months: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const [draft, setDraft] = useState<StoredDraft | null>(null);

  const bundleQ = useQuery({
    queryKey: ["workouts", uid, "bundle"],
    queryFn: async () => {
      const [ts, ex] = await Promise.all([
        loadMonthTotals(supabase),
        loadUsedExercises(supabase),
      ]);
      const page = pickMonthPage(ts, 0);
      const first = page ? await loadWorkoutList(supabase, uid, page.from, page.to) : [];
      return { totals: ts, exercises: ex, first, months: page?.months ?? 0 };
    },
  });

  const loading = bundleQ.isPending;
  const error = bundleQ.isError ? "Не вдалося завантажити тренування." : null;
  const totals = bundleQ.data?.totals ?? [];
  const exercises = bundleQ.data?.exercises ?? [];
  const extraValid = extra.base !== null && extra.base === bundleQ.data;
  const items = [...(bundleQ.data?.first ?? []), ...(extraValid ? extra.items : [])];
  const loadedMonths = (bundleQ.data?.months ?? 0) + (extraValid ? extra.months : 0);

  // читаємо в ефекті, а не в тілі рендера: localStorage недоступний на
  // сервері, і читання під час рендера дало б розбіжність гідрації
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сховище зовнішнє, читати можна лише після гідратації
    setDraft(readDraft(uid));
  }, [uid]);

  const loadSets = useCallback(
    (exerciseId: string) =>
      // через кеш: графік прогресу вправи не перезавантажується на кожне
      // повернення на вкладку
      queryClient.fetchQuery({
        queryKey: ["workouts", uid, "sets", exerciseId],
        queryFn: () => loadExerciseSets(supabase, uid, exerciseId),
      }),
    [supabase, uid, queryClient],
  );

  const loadMore = async () => {
    const page = pickMonthPage(totals, loadedMonths);
    const base = bundleQ.data;
    if (!page || !base) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await loadWorkoutList(supabase, uid, page.from, page.to);
      setExtra((prev) => {
        const keep = prev.base === base ? prev : { base, items: [], months: 0 };
        return { base, items: [...keep.items, ...next], months: keep.months + page.months };
      });
    } catch {
      // вже показане лишається на місці — банер тільки про невдале довантаження
      setMoreError("Не вдалося довантажити. Спробуй ще раз.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        right={
          <Pill href="/workouts/routines" icon="grid">
            Шаблони
          </Pill>
        }
      >
        Тренування
      </PageTitle>

      <Button type="button" onClick={() => router.push("/workouts/new")}>
        <Icon name="plus" size={16} strokeWidth={2.2} />
        Нове тренування
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
          icon="dumbbell"
          title="Ще немає тренувань"
          hint="Додай першу сесію — вправи, вагу і підходи. Далі бачитимеш прогрес на графіках."
        />
      ) : (
        <>
          <WorkoutProgress exercises={exercises} loadSets={loadSets} />

          <div className="px-[2px] pt-1 text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            Історія
          </div>

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
