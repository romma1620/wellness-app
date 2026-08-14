"use client";

import { Card } from "@/components/ui";
import { etaTo, weightTrend, TREND_WINDOW_DAYS, type Eta } from "@/lib/forecast";
import { createClient } from "@/lib/supabase/client";
import type { Reward } from "@/lib/types";
import { addDays, cn, fmt, plural, shortDate, todayISO } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface Loaded {
  weights: { date: string; weight: number | null }[];
  targetWeight: number | null;
  rewards: Pick<Reward, "weight" | "gift">[];
}

/**
 * Прогноз досягнення цілі за поточним трендом ваги.
 *
 * Дані тягне сам: картка живе на двох сторінках («Цілі», «Аналітика»), і
 * жодна з них не завантажує потрібне вікно ваг цілком. Поки прогнозу немає
 * (мало даних, тренд не вниз) — не рендерить нічого: обіцянка без підстав
 * гірша за відсутність картки.
 */
export function ForecastCard() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayISO(), []);
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) return;
        const [logs, profile, rewards] = await Promise.all([
          supabase
            .from("daily_logs")
            .select("date, weight")
            .eq("user_id", uid)
            .gte("date", addDays(today, -TREND_WINDOW_DAYS))
            .not("weight", "is", null)
            .order("date", { ascending: true }),
          supabase.from("profiles").select("target_weight").eq("id", uid).maybeSingle(),
          supabase.from("rewards").select("weight, gift").eq("user_id", uid),
        ]);
        if (logs.error || rewards.error) throw logs.error ?? rewards.error;
        if (!cancelled) {
          setData({
            weights: (logs.data ?? []) as Loaded["weights"],
            targetWeight: (profile.data?.target_weight ?? null) as number | null,
            rewards: (rewards.data ?? []) as Loaded["rewards"],
          });
        }
      } catch {
        // тихо: прогноз — бонус поверх сторінки, а не її зміст
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, today]);

  const view = useMemo(() => {
    if (!data) return null;
    const trend = weightTrend(data.weights, today);
    if (!trend) return null;

    // «наступна сходинка» — як на «Цілях»: найбільша вага серед недосягнутих,
    // досягнутість — за мінімумом останніх 7 днів
    const last7 = data.weights.filter((r) => r.date >= addDays(today, -6) && r.weight != null);
    const min7 = last7.length ? Math.min(...last7.map((r) => r.weight!)) : null;
    const unachieved = data.rewards.filter((r) => min7 == null || min7 > r.weight);
    const nextStep = unachieved.length
      ? unachieved.reduce((a, b) => (a.weight > b.weight ? a : b))
      : null;

    const stepEta = nextStep ? etaTo(trend, nextStep.weight, today) : null;
    const targetEta =
      data.targetWeight != null ? etaTo(trend, data.targetWeight, today) : null;
    if (!stepEta && !targetEta) return null;

    return {
      perWeek: trend.slope * 7,
      nextStep,
      stepEta,
      targetWeight: data.targetWeight,
      targetEta,
    };
  }, [data, today]);

  if (!view) return null;

  const rows: { label: string; sub: string | null; eta: Eta }[] = [];
  if (view.nextStep && view.stepEta) {
    rows.push({
      label: `Сходинка ${fmt(view.nextStep.weight, 1)} кг`,
      sub: view.nextStep.gift,
      eta: view.stepEta,
    });
  }
  if (view.targetWeight != null && view.targetEta) {
    // не дублюємо рядок, коли цільова вага і є наступною сходинкою
    if (!(view.nextStep && view.nextStep.weight === view.targetWeight)) {
      rows.push({ label: `Цільова вага ${fmt(view.targetWeight, 1)} кг`, sub: null, eta: view.targetEta });
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-extrabold">Прогноз</div>
        <div
          className={cn(
            "text-[11.5px] font-extrabold",
            view.perWeek < 0 ? "text-pos" : "text-muted",
          )}
        >
          {view.perWeek < 0 ? "↓" : "→"} {fmt(Math.abs(view.perWeek), 2)} кг/тиж
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 border-b border-bg py-2.5 last:border-b-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold">{r.label}</div>
              {r.sub && (
                <div className="truncate text-[12px] font-semibold text-muted">{r.sub}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              {r.eta.days === 0 ? (
                <div className="text-[13px] font-extrabold text-pos">вже досягнуто 🎉</div>
              ) : (
                <>
                  <div className="text-[14px] font-extrabold text-primary">
                    ~ {shortDate(r.eta.date)}
                  </div>
                  <div className="text-[11px] font-bold text-muted">
                    через {r.eta.days} {plural(r.eta.days, "день", "дні", "днів")}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] font-semibold leading-snug text-muted">
        За темпом останніх {Math.round(TREND_WINDOW_DAYS / 7)} тижнів. Це оцінка, а не
        обіцянка — тіло має право на власний графік.
      </p>
    </Card>
  );
}
