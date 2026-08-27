"use client";

import type { SaveState } from "@/components/inputs";
import { CycleCalendar } from "@/components/cycle/CycleCalendar";
import { CycleDisabled } from "@/components/cycle/CycleDisabled";
import { CycleOnboarding } from "@/components/cycle/CycleOnboarding";
import { CycleSkeleton } from "@/components/cycle/CycleSkeleton";
import { CycleStatusCard } from "@/components/cycle/CycleStatusCard";
import { CycleDisclaimer, PhaseTipCard } from "@/components/cycle/PhaseTipCard";
import { DaySheet } from "@/components/cycle/DaySheet";
import { Button, ErrorBanner } from "@/components/ui";
import {
  loadCycleEntries,
  loadCycleSettings,
  saveCycleEntry,
  saveCycleSettings,
} from "@/lib/cycle-db";
import { buildMonth, cycleMarks } from "@/lib/cycle/calendar";
import { cycleDayFor, deriveCycles } from "@/lib/cycle/derive";
import { buildPhaseRanges, phaseAt } from "@/lib/cycle/phases";
import { predict } from "@/lib/cycle/predict";
import {
  draftFromEntry,
  isEmptyDraft,
  type CycleEntry,
  type CycleSettings,
  type EntryDraft,
} from "@/lib/cycle/types";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, addMonths, monthEnd, monthStartOf, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 450;
/** Наскільки вперед можна листати календар: далі за наступний місяць дивитись нема на що. */
const MAX_MONTHS_AHEAD = 2;

/**
 * Синтетичний рядок для оптимістичного оновлення. Календар читає з запису
 * лише те, що є в чернетці, тож службові поля можна не вигадувати правдиво —
 * перше ж перезавантаження замінить рядок на серверний.
 */
function localEntry(date: string, draft: EntryDraft, prev: CycleEntry | undefined): CycleEntry {
  return {
    id: prev?.id ?? `local:${date}`,
    user_id: prev?.user_id ?? "",
    date,
    updated_at: new Date().toISOString(),
    ...draft,
  };
}

interface CycleData {
  settings: CycleSettings;
  onboarded: boolean;
  entries: CycleEntry[];
}

export default function CyclePage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const today = useMemo(() => todayISO(), []);

  const [viewMonth, setViewMonth] = useState(() => monthStartOf(todayISO()));
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Вікно завантаження навмисно ширше за показаний місяць: прогноз рахується
  // з останніх шести циклів, тож пів року історії потрібні завжди, а не лише
  // коли юзерка долистала до них.
  const fetchFrom = useMemo(() => {
    const byHistory = addDays(today, -730);
    const byView = addDays(viewMonth, -40);
    return byView < byHistory ? byView : byHistory;
  }, [today, viewMonth]);

  const fetchTo = useMemo(() => {
    const byToday = addDays(today, 90);
    const byView = addDays(monthEnd(viewMonth), 40);
    return byView > byToday ? byView : byToday;
  }, [today, viewMonth]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ date: string; draft: EntryDraft } | null>(null);

  const cycleKey = useMemo(
    () => ["cycle", uid, "data", fetchFrom, fetchTo],
    [uid, fetchFrom, fetchTo],
  );
  const dataQ = useQuery({
    queryKey: cycleKey,
    queryFn: async (): Promise<CycleData> => {
      const [s, e] = await Promise.all([
        loadCycleSettings(supabase, uid),
        loadCycleEntries(supabase, uid, fetchFrom, fetchTo),
      ]);
      return { settings: s.settings, onboarded: s.onboarded, entries: e };
    },
  });
  const settings = dataQ.data?.settings ?? null;
  const onboarded = dataQ.data?.onboarded ?? false;
  const entries = useMemo(() => dataQ.data?.entries ?? [], [dataQ.data]);
  const loading = dataQ.isPending;
  const error = dataQ.isError ? "Не вдалося завантажити дані циклу. Перевір зʼєднання." : null;

  const commit = useCallback(
    async (date: string, next: EntryDraft) => {
      try {
        await saveCycleEntry(supabase, uid, date, next);
        setSaveState("saved");
        // Активний запит не рефетчимо (обганяв би наступні тапи), лише
        // позначаємо застарілим — наступний маунт підтягне серверні рядки
        // замість синтетичних local:*. Похідні екрани — звичайна інвалідація.
        void queryClient.invalidateQueries({ queryKey: ["cycle", uid], refetchType: "none" });
        void queryClient.invalidateQueries({ queryKey: ["diary", uid] });
      } catch {
        setSaveState("error");
      }
    },
    [supabase, uid, queryClient],
  );

  /** Негайно відправити відкладене: закриття панелі, згортання, unmount. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    void commit(p.date, p.draft);
  }, [commit]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const entriesByDate = useMemo(() => {
    const m = new Map<string, CycleEntry>();
    entries.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries]);

  const cycles = useMemo(
    () => deriveCycles(entries.map((e) => ({ date: e.date, flow: e.flow }))),
    [entries],
  );

  const prediction = useMemo(
    () => (settings ? predict(cycles, settings, today) : null),
    [cycles, settings, today],
  );

  const phaseRanges = useMemo(
    () => buildPhaseRanges(cycles, prediction, today),
    [cycles, prediction, today],
  );

  const marks = useMemo(() => cycleMarks(cycles, prediction), [cycles, prediction]);

  const days = useMemo(
    () =>
      buildMonth(
        viewMonth,
        entriesByDate,
        marks,
        today,
        settings?.show_fertile_window ?? true,
      ),
    [viewMonth, entriesByDate, marks, today, settings],
  );

  const todayPhase = phaseAt(today, phaseRanges);
  const todayCycleDay = cycleDayFor(today, cycles);
  const lastBrowsableMonth = useMemo(
    () => addMonths(monthStartOf(today), MAX_MONTHS_AHEAD),
    [today],
  );

  /** Тап по дню відкриває панель уже із серверним станом цього дня. */
  const openDay = (date: string) => {
    flush();
    setSheetDate(date);
    setDraft(draftFromEntry(entriesByDate.get(date) ?? null));
    setSaveState("idle");
  };

  const closeDay = () => {
    flush();
    setSheetDate(null);
    setDraft(null);
  };

  /**
   * Кожен тап одразу видно: чернетка й список записів оновлюються локально,
   * запис у базу йде з невеликою затримкою. Кнопки «Зберегти» немає — вона
   * ставила б між рухом і результатом крок, якого сенс не вимагає.
   */
  const change = (patch: Partial<EntryDraft>) => {
    if (!sheetDate || !draft) return;
    const next: EntryDraft = { ...draft, ...patch };
    setDraft(next);

    // Оптимістично просто в кеш: календар і статуси читають звідти ж.
    queryClient.setQueryData<CycleData>(cycleKey, (prev) => {
      if (!prev) return prev;
      const rest = prev.entries.filter((e) => e.date !== sheetDate);
      if (isEmptyDraft(next)) return { ...prev, entries: rest };
      const row = localEntry(sheetDate, next, prev.entries.find((e) => e.date === sheetDate));
      return { ...prev, entries: [...rest, row].sort((a, b) => a.date.localeCompare(b.date)) };
    });

    setSaveState("saving");
    pending.current = { date: sheetDate, draft: next };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
  };

  /** Перший запуск: створює рядок налаштувань і перший день менструації. */
  async function finishOnboarding(v: {
    lastPeriodStart: string;
    typicalCycleLength: number;
  }) {
    await saveCycleSettings(supabase, uid, {
      enabled: true,
      typical_cycle_length: v.typicalCycleLength,
    });
    // Один день кровотечі, а не вся типова менструація: домальовувати дні,
    // яких юзерка не вводила, означало б вигадати їй дані.
    await saveCycleEntry(supabase, uid, v.lastPeriodStart, {
      flow: "medium",
      symptoms: [],
      mood: null,
      energy: null,
      notes: null,
    });
    setViewMonth(monthStartOf(v.lastPeriodStart));
    await queryClient.invalidateQueries({ queryKey: ["cycle", uid] });
  }

  /**
   * Повторне ввімкнення — тільки прапорець. Жодних записів: вони вже лежать
   * у базі, а зайвий «перший день менструації» тут зсунув би всі цикли.
   */
  async function reEnable() {
    await saveCycleSettings(supabase, uid, { enabled: true });
    await queryClient.invalidateQueries({ queryKey: ["cycle", uid] });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[15px]">
        <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цикл</h1>
        <CycleSkeleton />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col gap-[15px]">
        <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цикл</h1>
        <ErrorBanner>{error}</ErrorBanner>
      </div>
    );
  }

  if (!onboarded) {
    return <CycleOnboarding onEnable={finishOnboarding} />;
  }

  if (!settings?.enabled) {
    return <CycleDisabled entryCount={entries.length} onEnable={reEnable} />;
  }

  return (
    <>
      <div className="flex flex-col gap-[15px]">
        <div className="flex items-center justify-between px-1 pt-1">
          <h1 className="text-[22px] font-extrabold">Цикл</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/cycle/insights"
              className="rounded-[13px] bg-surface px-3 py-2 text-[12.5px] font-extrabold text-primary shadow-soft active:scale-95"
            >
              Інсайти
            </Link>
            <Link
              href="/settings/cycle"
              aria-label="Налаштування циклу"
              className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-surface text-muted shadow-soft active:scale-95"
            >
              <Settings2 size={18} />
            </Link>
          </div>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <CycleStatusCard
          cycleDay={todayCycleDay}
          phase={todayPhase}
          prediction={prediction}
          today={today}
        />

        <CycleCalendar
          monthStart={viewMonth}
          days={days}
          onMonth={(delta) => setViewMonth((m) => addMonths(m, delta))}
          onPick={openDay}
          canGoForward={viewMonth < lastBrowsableMonth}
        />

        {todayPhase && <PhaseTipCard phase={todayPhase} />}

        <CycleDisclaimer />
      </div>

      {/* Кнопка живе поверх контенту, над таб-баром: відмітити день — те,
          по що на цей екран заходять, і воно не має вимагати скролу. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
        <div className="w-full max-w-app px-[18px] pb-[calc(env(safe-area-inset-bottom)+88px)]">
          <Button
            type="button"
            className="pointer-events-auto"
            onClick={() => openDay(today)}
          >
            Відмітити сьогодні
          </Button>
        </div>
      </div>

      {sheetDate && draft && (
        <DaySheet
          open
          date={sheetDate}
          cycleDay={cycleDayFor(sheetDate, cycles)}
          phase={phaseAt(sheetDate, phaseRanges)}
          draft={draft}
          saveState={saveState}
          onChange={change}
          onClose={closeDay}
        />
      )}
    </>
  );
}
