"use client";

import { BackLink } from "@/components/BackLink";
import { CycleDisclaimer } from "@/components/cycle/PhaseTipCard";
import { mixOnSurface } from "@/components/cycle/tint";
import { Icon, type IconName } from "@/components/icons";
import { Card, EmptyState, ErrorBanner, FullLoader, PageTitle, SectionLabel } from "@/components/ui";
import { loadCycleEntries, loadCycleSettings } from "@/lib/cycle-db";
import { completedCycles, deriveCycles } from "@/lib/cycle/derive";
import {
  averageByPhase,
  comparePhases,
  symptomStats,
  type DatedValue,
} from "@/lib/cycle/insights";
import { buildPhaseRanges, type PhaseRange } from "@/lib/cycle/phases";
import { predict, type Prediction } from "@/lib/cycle/predict";
import {
  PHASE_COLORS,
  symptomLabel,
  type Cycle,
  type CycleEntry,
} from "@/lib/cycle/types";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, cn, fmt, fmtInt, plural, todayISO } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/** Інсайти показуємо лише коли завершених циклів достатньо, щоб щось порівнювати. */
const MIN_CYCLES = 3;
/** Скільки циклів іде в графік довжин. */
const LENGTH_BARS = 6;

interface Loaded {
  entries: CycleEntry[];
  weights: DatedValue[];
  steps: DatedValue[];
  tonnage: DatedValue[];
  typicalCycleLength: number;
  typicalPeriodLength: number;
}

/** Тоннаж підходу дзеркалить set_tonnage() зі схеми: порожня вага = власна вага. */
function setTonnage(weight: number | null, reps: number): number {
  return weight == null ? reps : weight * reps;
}

export default function CycleInsightsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const today = useMemo(() => todayISO(), []);

  const dataQ = useQuery({
    queryKey: ["diary", uid, "cycle-insights", today],
    queryFn: async (): Promise<Loaded> => {
      const from = addDays(today, -730);

      const { settings } = await loadCycleSettings(supabase, uid);
      const [entries, logs, workouts] = await Promise.all([
        loadCycleEntries(supabase, uid, from, addDays(today, 90)),
        supabase
          .from("daily_logs")
          .select("date, weight, steps")
          .eq("user_id", uid)
          .gte("date", from)
          .order("date", { ascending: true }),
        supabase
          .from("workouts")
          .select("date, workout_sets(weight, reps)")
          .eq("user_id", uid)
          .gte("date", from)
          .order("date", { ascending: true }),
      ]);
      if (logs.error) throw logs.error;
      if (workouts.error) throw workouts.error;

      const logRows = (logs.data ?? []) as {
        date: string;
        weight: number | null;
        steps: number | null;
      }[];

      // Один день = один сеанс тоннажу; кілька тренувань за день сумуються.
      const perDay = new Map<string, number>();
      for (const w of (workouts.data ?? []) as {
        date: string;
        workout_sets: { weight: number | null; reps: number }[] | null;
      }[]) {
        const total = (w.workout_sets ?? []).reduce(
          (s, set) => s + setTonnage(set.weight, set.reps),
          0,
        );
        if (total > 0) perDay.set(w.date, (perDay.get(w.date) ?? 0) + total);
      }

      return {
        entries,
        weights: logRows.map((r) => ({ date: r.date, value: r.weight })),
        steps: logRows.map((r) => ({ date: r.date, value: r.steps })),
        tonnage: [...perDay.entries()].map(([date, value]) => ({ date, value })),
        typicalCycleLength: settings.typical_cycle_length,
        typicalPeriodLength: settings.typical_period_length,
      };
    },
  });
  const data = dataQ.data ?? null;
  const loading = dataQ.isPending;
  const error = dataQ.isError ? "Не вдалося завантажити інсайти. Перевір зʼєднання." : null;

  const cycles = useMemo(
    () =>
      data
        ? deriveCycles(data.entries.map((e) => ({ date: e.date, flow: e.flow })))
        : [],
    [data],
  );

  const prediction = useMemo(
    () =>
      data
        ? predict(
            cycles,
            {
              typical_cycle_length: data.typicalCycleLength,
              typical_period_length: data.typicalPeriodLength,
            },
            today,
          )
        : null,
    [cycles, data, today],
  );

  const ranges = useMemo(
    () => buildPhaseRanges(cycles, prediction, today),
    [cycles, prediction, today],
  );

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-3">
        <BackLink href="/cycle" label="Назад до циклу" />
        <PageTitle className="flex-1">Інсайти</PageTitle>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <FullLoader />
      ) : completedCycles(cycles).length < MIN_CYCLES ? (
        <EmptyState
          icon="leaf"
          title="Ще збираємо дані"
          hint={`Інсайти зʼявляться після ${MIN_CYCLES} завершених циклів — тоді різницю між фазами вже можна відрізнити від випадковості. Завершених зараз: ${completedCycles(cycles).length}.`}
        />
      ) : (
        data &&
        prediction && (
          <>
            <StatsCard prediction={prediction} />
            <LengthsCard cycles={cycles} />
            <div>
              <SectionLabel icon="bulb">Що помітно в даних</SectionLabel>
              <div className="flex flex-col gap-[14px]">
                <Correlations data={data} ranges={ranges} />
              </div>
            </div>
            <SymptomsCard entries={data.entries} cycles={cycles} />
            <CycleDisclaimer />
          </>
        )
      )}
    </div>
  );
}

function StatsCard({ prediction }: { prediction: Prediction }) {
  const regular = prediction.sd <= 2;
  return (
    <Card>
      <SectionLabel
        icon="cycle"
        right={
          <span
            className={cn(
              "rounded-full px-[10px] py-[4px] text-[11px] font-semibold",
              regular
                ? "bg-[color:color-mix(in_oklab,var(--pos)_13%,transparent)] text-pos"
                : "bg-[color:color-mix(in_oklab,var(--warn)_13%,transparent)] text-warn",
            )}
          >
            {regular ? "Регулярний" : "Нерівномірний"}
          </span>
        }
      >
        Твій цикл
      </SectionLabel>
      <div className="flex">
        <Stat value={String(Math.round(prediction.avgLength))} label="сер. цикл, дн." />
        <div className="w-px bg-line" />
        <Stat
          value={String(Math.round(prediction.avgPeriodLength))}
          label="менструація, дн."
        />
        <div className="w-px bg-line" />
        <Stat value={`±${fmt(prediction.sd, 1)}`} label="розкид, дн." />
      </div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-[26px] font-normal leading-none tracking-[-.01em] text-ink">{value}</div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[.05em] text-muted">
        {label}
      </div>
    </div>
  );
}

/**
 * Довжини останніх циклів. Смужки нормовані до max, а не до нуля: різниця
 * між 27 і 30 днями на шкалі від нуля була б непомітною.
 */
function LengthsCard({ cycles }: { cycles: Cycle[] }) {
  const done = completedCycles(cycles).slice(-LENGTH_BARS);
  const lengths = done.map((c) => c.length as number);
  const max = Math.max(...lengths);
  const min = Math.min(...lengths);
  const height = (v: number) => (max - min < 1 ? 70 : 40 + ((v - min) / (max - min)) * 44);

  return (
    <Card>
      <SectionLabel icon="bars">Довжина циклів, днів</SectionLabel>
      <div className="flex items-end gap-2">
        {lengths.map((len, i) => {
          const last = i === lengths.length - 1;
          return (
            <div key={done[i].start} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-[6px]"
                style={{
                  height: `${height(len)}px`,
                  background: PHASE_COLORS.menstrual,
                  opacity: last ? 1 : 0.28,
                }}
              />
              <span
                className={cn("text-[10px]", last ? "font-semibold text-ink" : "font-medium text-muted")}
              >
                {len}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InsightCard({
  hex,
  icon,
  title,
  text,
}: {
  /** Колір даних для плитки іконки — тінт 16% на поверхні, як у дизайні. */
  hex: string;
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <Card className="flex items-start gap-[13px]">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: mixOnSurface(hex, 16), color: hex }}
      >
        <Icon name={icon} size={17} strokeWidth={1.7} />
      </div>
      <div>
        <div className="text-[13.5px] font-bold text-ink [text-wrap:pretty]">{title}</div>
        <div className="mt-1 text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          {text}
        </div>
      </div>
    </Card>
  );
}

/**
 * Кореляції з рештою метрик.
 *
 * Кожна картка зʼявляється лише коли різниця перевищує порог помітності —
 * список, що завжди має три пункти, привчав би читати шум як закономірність.
 */
function Correlations({ data, ranges }: { data: Loaded; ranges: PhaseRange[] }) {
  const stepStats = averageByPhase(data.steps, ranges);
  const tonnageStats = averageByPhase(data.tonnage, ranges);
  const weightStats = averageByPhase(data.weights, ranges);

  const steps = comparePhases(stepStats, "menstrual", "follicular");
  const tonnage = comparePhases(tonnageStats, "follicular", "late_luteal");
  const weight = comparePhases(weightStats, "late_luteal", "follicular");

  const cards: React.ReactNode[] = [];

  if (steps) {
    cards.push(
      <InsightCard
        key="steps"
        hex={PHASE_COLORS.luteal}
        icon="activity"
        title={
          steps.diffPct < 0
            ? "Кроки падають у менструальні дні"
            : "Кроків у менструальні дні більше"
        }
        text={`У середньому на ${fmt(Math.abs(steps.diffPct), 0)}% ${steps.diffPct < 0 ? "менше" : "більше"}, ніж у фолікулярній фазі (${fmtInt(steps.value)} проти ${fmtInt(steps.base)}).`}
      />,
    );
  }

  if (tonnage) {
    cards.push(
      <InsightCard
        key="tonnage"
        hex={PHASE_COLORS.follicular}
        icon="dumbbell"
        title={
          tonnage.diffPct > 0
            ? "Найсильніші тренування — у фолікулярній фазі"
            : "Обʼєм у залі вищий у другій половині циклу"
        }
        text={`Тоннаж у залі відрізняється на ${fmt(Math.abs(tonnage.diffPct), 0)}% порівняно з днями ПМС.`}
      />,
    );
  }

  if (weight) {
    const delta = weight.value - weight.base;
    cards.push(
      <InsightCard
        key="weight"
        hex={PHASE_COLORS.menstrual}
        icon="droplet"
        title={`Вага у ПМС ${delta > 0 ? "вища" : "нижча"} на ${fmt(Math.abs(delta), 1)} кг`}
        text="Це вода, а не жир: порівнювати вагу варто з тим самим днем минулого циклу."
      />,
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <div className="text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          Помітних відмінностей між фазами поки немає — різниця в кроках, вазі й
          тренуваннях у межах звичного розкиду. Це нормальний результат, а не брак даних.
        </div>
      </Card>
    );
  }

  return <>{cards}</>;
}

function SymptomsCard({ entries, cycles }: { entries: CycleEntry[]; cycles: Cycle[] }) {
  const stats = symptomStats(entries, cycles);
  if (stats.length === 0) return null;

  return (
    <Card>
      <SectionLabel icon="activity">Найчастіші симптоми</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {stats.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 truncate text-[12.5px] font-medium text-ink">
              {symptomLabel(s.key)}
            </span>
            <div className="h-[8px] flex-1 rounded-[4px] bg-field">
              <div
                className="h-full rounded-[4px]"
                style={{
                  width: `${Math.max(8, s.share * 100)}%`,
                  background: PHASE_COLORS.menstrual,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="w-[54px] shrink-0 text-right text-[11px] font-medium text-muted">
              {s.dayFrom !== null
                ? s.dayFrom === s.dayTo
                  ? `день ${s.dayFrom}`
                  : `дні ${s.dayFrom}–${s.dayTo}`
                : `${s.days} ${plural(s.days, "день", "дні", "днів")}`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
