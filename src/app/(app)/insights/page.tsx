"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PairInsightCard, type PairCopy } from "@/components/insights/PairInsightCard";
import { Collapsible, EmptyState, ErrorBanner, FullLoader, PageTitle } from "@/components/ui";
import {
  ANALYSIS_WEEKS,
  analyzePair,
  buildWeekAggs,
  deltaWeightPoints,
  THRESHOLDS,
  tonnagePoints,
  type DayInput,
} from "@/lib/correlations";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { setTonnage } from "@/lib/workouts";
import { addDays, fmt, fmtInt, parseISODate, todayISO, weekBuckets } from "@/lib/utils";

/**
 * Тексти й вигляд трьох пар. Математика — у THRESHOLDS, тут лише подача.
 * Колір плитки — за метрикою-рушієм пари (харчування / кроки / тренування).
 */
const KCAL_COPY: PairCopy = {
  hex: "#D4849A",
  icon: "fork",
  xAxisLabel: "ккал/день",
  zeroLine: true,
  link: (a) =>
    a.diff > 0
      ? {
          title: "Калорії справді працюють",
          text: `У тижні з меншими калоріями (≈${fmtInt(a.lowX)} проти ≈${fmtInt(a.highX)}) вага падала в середньому на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з більшими калоріями (≈${fmtInt(a.highX)} проти ≈${fmtInt(a.lowX)}) вага падала на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше. Пояснень не вигадуємо — так виглядають твої дані.`,
        },
  noLinkText:
    "Різниця між тижнями з більшими й меншими калоріями — в межах звичного розкиду. Це теж відповідь: на твоїх даних цей важіль зараз не головний.",
  noContrastText:
    "Твої тижні надто схожі за калоріями, щоб порівняти. Так буває при стабільному режимі харчування.",
};

const STEPS_COPY: PairCopy = {
  hex: "#A28BC4",
  icon: "activity",
  xAxisLabel: "кроки, тис./день",
  xTickFormat: (v) => fmt(v / 1000, 1),
  zeroLine: true,
  link: (a) =>
    a.diff < 0
      ? {
          title: "Кроки прискорюють прогрес",
          text: `У тижні з більшою кількістю кроків (≈${fmtInt(a.highX)} проти ≈${fmtInt(a.lowX)}) вага падала в середньому на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з меншою кількістю кроків (≈${fmtInt(a.lowX)} проти ≈${fmtInt(a.highX)}) вага падала на ${fmt(Math.abs(a.diff), 1)} кг/тиж швидше. Пояснень не вигадуємо — так виглядають твої дані.`,
        },
  noLinkText:
    "Різниця між тижнями з більшою й меншою кількістю кроків — у межах звичного розкиду. На твоїх даних темп ваги вирішують інші чинники.",
  noContrastText:
    "Кількість кроків у твоїх тижнях надто стабільна, щоб порівняти. Так буває при усталеній рутині.",
};

const PROTEIN_COPY: PairCopy = {
  hex: "#7FAE95",
  icon: "dumbbell",
  xAxisLabel: "білок, г/день",
  zeroLine: false,
  link: (a) => {
    const pct = a.lowY > 0 ? fmtInt((Math.abs(a.diff) / a.lowY) * 100) : null;
    return a.diff > 0
      ? {
          title: "Білок підтримує обʼєм тренувань",
          text: `У тижні з більшим білком (≈${fmtInt(a.highX)} г проти ≈${fmtInt(a.lowX)} г) тоннаж тренувань був ${pct ? `на ${pct}% більший` : "істотно більший"}.`,
        }
      : {
          title: "Несподівано: звʼязок зворотний",
          text: `У тижні з більшим білком (≈${fmtInt(a.highX)} г проти ≈${fmtInt(a.lowX)} г) тоннаж був ${pct ? `на ${pct}% менший` : "меншим"}. Пояснень не вигадуємо — так виглядають твої дані.`,
        };
  },
  noLinkText:
    "Тоннаж у тижні з більшим і меншим білком відрізняється в межах звичного розкиду. Це теж відповідь — обʼєм тренувань у тебе тримається не на білку.",
  noContrastText:
    "Білок у твоїх тижнях надто стабільний, щоб порівняти. Так буває при усталеному раціоні.",
};

interface Loaded {
  days: DayInput[];
  tonnageByDate: Map<string, number>;
}

export default function InsightsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();

  // Вікно аналізу: останні ANALYSIS_WEEKS завершених тижнів Пн–Нд.
  const { firstMonday, lastSunday } = useMemo(() => {
    const today = todayISO();
    const fromMonday = (parseISODate(today).getDay() + 6) % 7; // 0 = понеділок
    const lastSunday = addDays(today, -fromMonday - 1);
    return { firstMonday: addDays(lastSunday, -(ANALYSIS_WEEKS * 7 - 1)), lastSunday };
  }, []);

  const dataQ = useQuery({
    queryKey: ["diary", uid, "insights", firstMonday, lastSunday],
    queryFn: async (): Promise<Loaded> => {
      const [logs, workouts] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("date, weight, kcal, steps, protein")
          .eq("user_id", uid)
          .gte("date", firstMonday)
          .lte("date", lastSunday)
          .order("date", { ascending: true }),
        supabase
          .from("workouts")
          .select("date, workout_sets(weight, reps)")
          .eq("user_id", uid)
          .gte("date", firstMonday)
          .lte("date", lastSunday)
          .order("date", { ascending: true }),
      ]);
      if (logs.error) throw logs.error;
      if (workouts.error) throw workouts.error;

      // Один день = сумарний тоннаж; кілька тренувань за день додаються.
      const tonnageByDate = new Map<string, number>();
      for (const w of (workouts.data ?? []) as {
        date: string;
        workout_sets: { weight: number | null; reps: number }[] | null;
      }[]) {
        const total = (w.workout_sets ?? []).reduce((s, set) => s + setTonnage(set), 0);
        if (total > 0) tonnageByDate.set(w.date, (tonnageByDate.get(w.date) ?? 0) + total);
      }

      return { days: (logs.data ?? []) as DayInput[], tonnageByDate };
    },
  });
  const data = dataQ.data ?? null;
  const loading = dataQ.isPending;
  const error = dataQ.isError ? "Не вдалося завантажити інсайти. Перевір зʼєднання." : null;

  const analyses = useMemo(() => {
    if (!data) return null;
    const weeks = weekBuckets(firstMonday, lastSunday);
    const aggs = buildWeekAggs(data.days, data.tonnageByDate, weeks);
    return {
      kcal: analyzePair(deltaWeightPoints(aggs, "kcal"), THRESHOLDS["kcal-weight"]),
      steps: analyzePair(deltaWeightPoints(aggs, "steps"), THRESHOLDS["steps-weight"]),
      protein: analyzePair(tonnagePoints(aggs), THRESHOLDS["protein-tonnage"]),
    };
  }, [data, firstMonday, lastSunday]);

  const isEmpty = data !== null && data.days.length === 0 && data.tonnageByDate.size === 0;

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        subtitle={
          <p className="text-[12.5px] font-normal text-muted">
            Що насправді впливає — по твоїх тижнях за останні 6 місяців
          </p>
        }
      >
        Інсайти
      </PageTitle>

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : isEmpty ? (
        <EmptyState
          icon="search"
          title="Ще немає даних"
          hint="Заповнюй щоденник на вкладці «Сьогодні» — і тут зʼявляться висновки про те, що працює саме для тебе."
        />
      ) : (
        analyses && (
          <>
            <PairInsightCard analysis={analyses.kcal} copy={KCAL_COPY} />
            <PairInsightCard analysis={analyses.steps} copy={STEPS_COPY} />
            <PairInsightCard analysis={analyses.protein} copy={PROTEIN_COPY} />
            <MethodologyCard />
          </>
        )
      )}
    </div>
  );
}

/** Згорнута примітка про методологію — чесність фічі має бути перевірною. */
function MethodologyCard() {
  return (
    <Collapsible icon="info" title="Як це порахувано">
      <div className="flex flex-col gap-2 text-[12.5px] font-normal leading-[1.55] text-muted">
        <p>
          Дані згортаються в тижні Пн–Нд за останні {ANALYSIS_WEEKS} завершених тижнів.
          Тиждень враховується, коли метрику заповнено щонайменше 4 дні
          (для ваги — 3 зважування).
        </p>
        <p>
          Зміна ваги береться зі зсувом на тиждень: зʼїдене цього тижня видно
          на терезах наступного.
        </p>
        <p>
          Тижні діляться навпіл — «менші» проти «більших» за метрикою — і
          порівнюються середні. Висновок зʼявляється лише коли різниця
          перевищує поріг шуму: 0,2 кг/тиж для ваги, 12% для тоннажу.
          «Звʼязку не видно» — теж чесний результат, а не помилка.
        </p>
        <p>
          Коливання циклу тижневе усереднення згладжує, але не виключає
          повністю — сприймай висновки як орієнтир, а не вирок.
        </p>
      </div>
    </Collapsible>
  );
}
