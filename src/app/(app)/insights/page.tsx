"use client";

import { useEffect, useMemo, useState } from "react";
import { PairInsightCard, type PairCopy } from "@/components/insights/PairInsightCard";
import { Card, EmptyState, ErrorBanner, FullLoader } from "@/components/ui";
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
import { setTonnage } from "@/lib/workouts";
import {
  addDays,
  cn,
  fmt,
  fmtInt,
  parseISODate,
  todayISO,
  weekBuckets,
} from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 22 22",
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Тексти й вигляд трьох пар. Математика — у THRESHOLDS, тут лише подача. */
const KCAL_COPY: PairCopy = {
  tint: "#FBE9EE",
  icon: (
    <svg {...ICON} stroke="#C05B71">
      <path d="M6.5 3v5.5M4 3v3a2.5 2.5 0 0 0 5 0V3M6.5 8.5V19" />
      <path d="M15 3c-1.6 1.2-2.5 3.1-2.5 5.5 0 1.6 1 2.5 2.5 2.5V19" />
    </svg>
  ),
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
  tint: "#F1EAF8",
  icon: (
    <svg {...ICON} stroke="#8D79AD">
      <path d="M3 11.5h3l2.5-6 4 11.5 2.5-5.5h4" />
    </svg>
  ),
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
  tint: "#EAF4EF",
  icon: (
    <svg {...ICON} stroke="#6E9C88">
      <path d="M4 8.5v5M18 8.5v5M6.5 7v8M15.5 7v8M6.5 11h9" />
    </svg>
  ),
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

  // Вікно аналізу: останні ANALYSIS_WEEKS завершених тижнів Пн–Нд.
  const { firstMonday, lastSunday } = useMemo(() => {
    const today = todayISO();
    const fromMonday = (parseISODate(today).getDay() + 6) % 7; // 0 = понеділок
    const lastSunday = addDays(today, -fromMonday - 1);
    return { firstMonday: addDays(lastSunday, -(ANALYSIS_WEEKS * 7 - 1)), lastSunday };
  }, []);

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
        if (cancelled) return;

        // Один день = сумарний тоннаж; кілька тренувань за день додаються.
        const tonnageByDate = new Map<string, number>();
        for (const w of (workouts.data ?? []) as {
          date: string;
          workout_sets: { weight: number | null; reps: number }[] | null;
        }[]) {
          const total = (w.workout_sets ?? []).reduce((s, set) => s + setTonnage(set), 0);
          if (total > 0) tonnageByDate.set(w.date, (tonnageByDate.get(w.date) ?? 0) + total);
        }

        setData({ days: (logs.data ?? []) as DayInput[], tonnageByDate });
      } catch {
        if (!cancelled) setError("Не вдалося завантажити інсайти. Перевір зʼєднання.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, firstMonday, lastSunday]);

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
    <div className="flex flex-col gap-[15px]">
      <div className="px-1 pt-1">
        <h1 className="text-[22px] font-extrabold">Інсайти</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-muted">
          Що насправді впливає — по твоїх тижнях за останні 6 місяців
        </p>
      </div>

      {loading ? (
        <FullLoader />
      ) : error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : isEmpty ? (
        <EmptyState
          emoji="🔍"
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
  const [open, setOpen] = useState(false);
  return (
    <Card className="!p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[13px] font-extrabold">Як це порахувано</span>
        <ChevronDown
          size={18}
          className={cn("text-primary transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-bg px-4 pb-4 pt-3 text-[12.5px] font-semibold leading-[1.55] text-muted">
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
      )}
    </Card>
  );
}
