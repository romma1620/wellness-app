"use client";

import { phaseTint } from "@/components/cycle/tint";
import { Icon } from "@/components/icons";
import { Card, SectionLabel, Toggle } from "@/components/ui";
import { loadCycleEntries, loadCycleSettings, saveCycleSettings } from "@/lib/cycle-db";
import { completedCycles, cycleDayFor, deriveCycles } from "@/lib/cycle/derive";
import { averageByPhase, waterRetention, type DatedValue } from "@/lib/cycle/insights";
import { buildPhaseRanges, phaseAt, type PhaseRange } from "@/lib/cycle/phases";
import { predict, type Prediction } from "@/lib/cycle/predict";
import {
  PHASES,
  PHASE_COLORS,
  PHASE_SHORT,
  type Cycle,
  type CycleEntry,
  type CycleSettings,
  type Phase,
} from "@/lib/cycle/types";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, fmt, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

/** Скільки останніх циклів іде в «середню вагу по фазах». */
export const PHASE_WEIGHT_CYCLES = 3;

export interface PhaseOverlay {
  /** Фіча ввімкнена і в історії є хоч один цикл. */
  available: boolean;
  showBands: boolean;
  setShowBands: (v: boolean) => void;
  cycles: Cycle[];
  prediction: Prediction | null;
  ranges: PhaseRange[];
  todayPhase: Phase | null;
  /** Дати стартів циклів — вертикальні пунктири на графіку. */
  cycleStarts: string[];
  /** Найраніша дата, що входить у вікно «останні N циклів». */
  phaseWindowStart: string | null;
  cycleDayFor: (iso: string) => number | null;
  phaseFor: (iso: string) => Phase | null;
}

/**
 * Дані циклу для чужих екранів (аналітика).
 *
 * Помилка завантаження тут навмисно тиха: цикл — накладка на графік ваги,
 * і якщо вона не приїхала, аналітика мусить показати себе без неї, а не
 * банер про зламаний цикл.
 */
interface OverlayData {
  settings: CycleSettings;
  entries: CycleEntry[];
}

export function usePhaseOverlay(): PhaseOverlay {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const today = useMemo(() => todayISO(), []);

  const overlayKey = useMemo(() => ["cycle", uid, "overlay", today], [uid, today]);
  const { data } = useQuery({
    queryKey: overlayKey,
    // Помилка тиха: цикл — накладка на графік ваги, аналітика мусить
    // показати себе й без неї, тож queryFn віддає null замість кидання.
    queryFn: async (): Promise<OverlayData | null> => {
      try {
        const { settings } = await loadCycleSettings(supabase, uid);
        if (!settings.enabled) return { settings, entries: [] };
        const entries = await loadCycleEntries(
          supabase,
          uid,
          addDays(today, -730),
          addDays(today, 90),
        );
        return { settings, entries };
      } catch {
        return null;
      }
    },
  });
  const settings = data?.settings ?? null;
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const showBands = settings?.phase_bands_in_charts ?? false;

  const setShowBands = useCallback(
    (v: boolean) => {
      // Оптимістично в кеш: тумблер відповідає на тап одразу й однаково
      // для всіх споживачів кешу.
      queryClient.setQueryData<OverlayData | null>(overlayKey, (old) =>
        old
          ? { ...old, settings: { ...old.settings, phase_bands_in_charts: v } }
          : old,
      );
      void (async () => {
        try {
          await saveCycleSettings(supabase, uid, { phase_bands_in_charts: v });
        } catch {
          // тумблер лишається там, куди його поставили: перезбереження
          // при наступному перемиканні дешевше за відкат під пальцем
        }
      })();
    },
    [supabase, uid, queryClient, overlayKey],
  );

  const cycles = useMemo(
    () => deriveCycles(entries.map((e) => ({ date: e.date, flow: e.flow }))),
    [entries],
  );

  const prediction = useMemo(
    () => (settings ? predict(cycles, settings, today) : null),
    [cycles, settings, today],
  );

  const ranges = useMemo(
    () => buildPhaseRanges(cycles, prediction, today),
    [cycles, prediction, today],
  );

  const recent = useMemo(() => cycles.slice(-(PHASE_WEIGHT_CYCLES + 1)), [cycles]);

  // Мемоїзуємо, бо цей масив іде в залежності мемо на боці аналітики:
  // новий екземпляр щорендера перераховував би там усю серію графіка.
  const cycleStarts = useMemo(() => cycles.map((c) => c.start), [cycles]);

  return {
    available: (settings?.enabled ?? false) && cycles.length > 0,
    showBands,
    setShowBands,
    cycles,
    prediction,
    ranges,
    todayPhase: phaseAt(today, ranges),
    cycleStarts,
    phaseWindowStart: recent[0]?.start ?? null,
    cycleDayFor: (iso) => cycleDayFor(iso, cycles),
    phaseFor: (iso) => phaseAt(iso, ranges),
  };
}

// ----------------------- Картки -----------------------

export function PhaseBandsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 !py-[15px]">
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: PHASE_COLORS.luteal }}
        />
        <span className="text-[13.5px] font-semibold text-ink">Показувати фази циклу</span>
      </div>
      <Toggle label="Показувати фази циклу" checked={checked} onChange={onChange} />
    </Card>
  );
}

export function PhaseLegend() {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {PHASES.map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[3px]"
            style={{ background: PHASE_COLORS[p], opacity: 0.55 }}
          />
          <span className="text-[10px] font-medium" style={{ color: PHASE_COLORS[p] }}>
            {PHASE_SHORT[p]}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Плашка про затримку води. Найважливіший текст фічі: сходинка на терезах
 * у цій фазі — фізіологія, і читатись вона мусить саме так.
 */
export function WaterRetentionCard({
  weights,
  ranges,
  todayPhase,
}: {
  weights: DatedValue[];
  ranges: PhaseRange[];
  todayPhase: Phase | null;
}) {
  const hint = waterRetention(weights, ranges, todayPhase);
  if (!hint) return null;

  const where = hint.phase === "menstrual" ? "у менструальній фазі" : "у пізній лютеїновій фазі";

  return (
    <Card className="flex gap-[13px]">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: phaseTint("late_luteal"), color: PHASE_COLORS.late_luteal }}
      >
        <Icon name="droplet" size={17} strokeWidth={1.6} />
      </div>
      <div>
        <div className="text-[13.5px] font-bold text-ink">
          +{fmt(hint.deltaKg, 1)} кг проти фолікулярної фази
        </div>
        <div className="mt-1 text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          Ти {where}. Ймовірна затримка води, типово для цих днів. Порівнюй із тим самим
          днем минулого циклу.
        </div>
      </div>
    </Card>
  );
}

/** Середня вага по фазах: смужки, довжина яких — місце ваги в діапазоні фаз. */
export function PhaseWeightCard({
  weights,
  ranges,
}: {
  weights: DatedValue[];
  ranges: PhaseRange[];
}) {
  const stats = averageByPhase(weights, ranges).filter((s) => s.avg !== null);
  if (stats.length < 2) return null;

  const values = stats.map((s) => s.avg as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Смужки показують різницю між фазами, а не абсолютну вагу: 64,4 і 65,1
  // на шкалі від нуля були б однаковими смугами. Мінімум лишаємо видимим.
  const width = (v: number) => (max - min < 1e-9 ? 100 : 35 + ((v - min) / (max - min)) * 65);

  return (
    <Card>
      <SectionLabel
        icon="scale"
        right={
          <span className="text-[11px] font-medium text-muted">
            останні {PHASE_WEIGHT_CYCLES} цикли
          </span>
        }
      >
        Середня вага по фазах
      </SectionLabel>
      <div className="flex flex-col gap-[11px]">
        {stats.map((s) => (
          <div key={s.phase} className="flex items-center gap-2.5">
            <span className="w-[66px] shrink-0 text-[11.5px] font-medium text-muted">
              {PHASE_SHORT[s.phase]}
            </span>
            <div className="h-[8px] flex-1 rounded-[4px] bg-field">
              <div
                className="h-full rounded-[4px]"
                style={{
                  width: `${width(s.avg as number)}%`,
                  background: PHASE_COLORS[s.phase],
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="w-11 shrink-0 text-right text-[12px] font-semibold text-ink">
              {fmt(s.avg, 1)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Скільком завершеним циклам можна довіряти на екрані інсайтів. */
export function hasEnoughCycles(cycles: Cycle[], min = 3): boolean {
  return completedCycles(cycles).length >= min;
}
