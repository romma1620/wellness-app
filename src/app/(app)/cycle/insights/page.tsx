"use client";

import { CycleDisclaimer } from "@/components/cycle/PhaseTipCard";
import { Card, EmptyState, ErrorBanner, FullLoader } from "@/components/ui";
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
import { addDays, fmt, fmtInt, plural, todayISO } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const today = useMemo(() => todayISO(), []);

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("no-user");
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
        if (cancelled) return;

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

        setData({
          entries,
          weights: logRows.map((r) => ({ date: r.date, value: r.weight })),
          steps: logRows.map((r) => ({ date: r.date, value: r.steps })),
          tonnage: [...perDay.entries()].map(([date, value]) => ({ date, value })),
          typicalCycleLength: settings.typical_cycle_length,
          typicalPeriodLength: settings.typical_period_length,
        });
      } catch {
        if (!cancelled) setError("Не вдалося завантажити інсайти. Перевір зʼєднання.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, today]);

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
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-3 pt-1">
        <Link
          href="/cycle"
          aria-label="Назад до циклу"
          className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-surface text-muted shadow-soft active:scale-95"
        >
          <ChevronLeft size={19} />
        </Link>
        <h1 className="text-[22px] font-extrabold">Інсайти</h1>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <FullLoader />
      ) : completedCycles(cycles).length < MIN_CYCLES ? (
        <EmptyState
          emoji="🌱"
          title="Ще збираємо дані"
          hint={`Інсайти зʼявляться після ${MIN_CYCLES} завершених циклів — тоді різницю між фазами вже можна відрізнити від випадковості. Завершених зараз: ${completedCycles(cycles).length}.`}
        />
      ) : (
        data &&
        prediction && (
          <>
            <StatsCard prediction={prediction} />
            <LengthsCard cycles={cycles} />
            <div className="mx-1 -mb-1 text-[12.5px] font-bold text-muted">
              Що помітно в даних
            </div>
            <Correlations data={data} ranges={ranges} />
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
    <Card className="!px-4 !py-[18px]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-muted">Твій цикл</span>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11px] font-extrabold"
          style={{
            background: regular ? "var(--tint-green-badge)" : "var(--tint-amber)",
            color: regular ? "var(--tint-green-badge-fg)" : "var(--tint-amber-badge-fg)",
          }}
        >
          {regular ? "Регулярний" : "Нерівномірний"}
        </span>
      </div>
      <div className="flex">
        <Stat value={String(Math.round(prediction.avgLength))} label="сер. цикл, дн." />
        <div className="w-[1.5px] bg-bg" />
        <Stat
          value={String(Math.round(prediction.avgPeriodLength))}
          label="менструація, дн."
        />
        <div className="w-[1.5px] bg-bg" />
        <Stat value={`±${fmt(prediction.sd, 1)}`} label="розкид, дн." />
      </div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-[26px] font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-muted">{label}</div>
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
    <Card className="!p-4">
      <div className="mb-3 text-[12.5px] font-bold text-muted">Довжина циклів, днів</div>
      <div className="flex items-end gap-2">
        {lengths.map((len, i) => {
          const last = i === lengths.length - 1;
          return (
            <div key={done[i].start} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-[7px]"
                style={{
                  height: `${height(len)}px`,
                  background: PHASE_COLORS.menstrual,
                  opacity: last ? 1 : 0.28,
                }}
              />
              <span
                className="text-[9.5px] font-bold"
                style={{ color: last ? "var(--tint-rose-fg)" : "var(--muted)" }}
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
  tint,
  icon,
  title,
  text,
}: {
  tint: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="flex items-start gap-[13px] !p-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: tint }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[14px] font-extrabold [text-wrap:pretty]">{title}</div>
        <div className="mt-0.5 text-[12.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
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
        tint="var(--tint-lavender)"
        title={
          steps.diffPct < 0
            ? "Кроки падають у менструальні дні"
            : "Кроків у менструальні дні більше"
        }
        text={`У середньому на ${fmt(Math.abs(steps.diffPct), 0)}% ${steps.diffPct < 0 ? "менше" : "більше"}, ніж у фолікулярній фазі (${fmtInt(steps.value)} проти ${fmtInt(steps.base)}).`}
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            style={{ color: "var(--tint-lavender-fg)" }}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 18.5h15M6 15v-3M11 15V7M16 15v-5" />
          </svg>
        }
      />,
    );
  }

  if (tonnage) {
    cards.push(
      <InsightCard
        key="tonnage"
        tint="var(--tint-green)"
        title={
          tonnage.diffPct > 0
            ? "Найсильніші тренування — у фолікулярній фазі"
            : "Обʼєм у залі вищий у другій половині циклу"
        }
        text={`Тоннаж у залі відрізняється на ${fmt(Math.abs(tonnage.diffPct), 0)}% порівняно з днями ПМС.`}
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            style={{ color: "var(--tint-green-fg)" }}
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M4 8.5v5M18 8.5v5M6.5 7v8M15.5 7v8M6.5 11h9" />
          </svg>
        }
      />,
    );
  }

  if (weight) {
    const delta = weight.value - weight.base;
    cards.push(
      <InsightCard
        key="weight"
        tint="var(--tint-rose)"
        title={`Вага у ПМС ${delta > 0 ? "вища" : "нижча"} на ${fmt(Math.abs(delta), 1)} кг`}
        text="Це вода, а не жир: порівнювати вагу варто з тим самим днем минулого циклу."
        icon={<span className="text-[17px]">💧</span>}
      />,
    );
  }

  if (cards.length === 0) {
    return (
      <Card className="!p-4">
        <div className="text-[13px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
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
    <Card className="!p-4">
      <div className="mb-3 text-[12.5px] font-bold text-muted">Найчастіші симптоми</div>
      <div className="flex flex-col gap-2.5">
        {stats.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 truncate text-[12.5px] font-bold">
              {symptomLabel(s.key)}
            </span>
            <div className="h-2 flex-1 rounded-[4px] bg-bg">
              <div
                className="h-full rounded-[4px]"
                style={{
                  width: `${Math.max(8, s.share * 100)}%`,
                  background: PHASE_COLORS.menstrual,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="w-[54px] shrink-0 text-right text-[11px] font-bold text-muted">
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
