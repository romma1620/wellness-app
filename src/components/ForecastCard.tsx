"use client";

import { Icon } from "@/components/icons";
import { Card, SectionLabel } from "@/components/ui";
import { etaTo, weightTrend, TREND_WINDOW_DAYS, type Eta } from "@/lib/forecast";
import { useProfile, useRecentWeights, useRewards } from "@/lib/queries";
import { addDays, cn, fmt, plural, shortDate, todayISO } from "@/lib/utils";
import { useMemo } from "react";

/**
 * Прогноз досягнення цілі за поточним трендом ваги.
 *
 * Дані — зі спільних запитів (queries.ts): ті самі ваги, профіль і
 * винагороди читають «Цілі» й «Профіль», тож картка не додає жодного
 * власного запиту. Поки прогнозу немає (дані не приїхали, мало даних,
 * тренд не вниз) — не рендерить нічого: помилка тут теж тиха, бо
 * прогноз — бонус поверх сторінки, а не її зміст.
 */
export function ForecastCard() {
  const today = useMemo(() => todayISO(), []);

  const profileQ = useProfile();
  const rewardsQ = useRewards();
  const weightsQ = useRecentWeights();
  const ready = profileQ.isSuccess && rewardsQ.isSuccess && weightsQ.isSuccess;

  const view = useMemo(() => {
    if (!ready) return null;
    const weights = weightsQ.data;
    const rewards = rewardsQ.data;
    const targetWeight = profileQ.data?.target_weight ?? null;

    const trend = weightTrend(weights, today);
    if (!trend) return null;

    // «наступна сходинка» — як на «Цілях»: найбільша вага серед недосягнутих,
    // досягнутість — за мінімумом останніх 7 днів
    const last7 = weights.filter((r) => r.date >= addDays(today, -6));
    const min7 = last7.length ? Math.min(...last7.map((r) => r.weight)) : null;
    const unachieved = rewards.filter((r) => min7 == null || min7 > r.weight);
    const nextStep = unachieved.length
      ? unachieved.reduce((a, b) => (a.weight > b.weight ? a : b))
      : null;

    const stepEta = nextStep ? etaTo(trend, nextStep.weight, today) : null;
    const targetEta = targetWeight != null ? etaTo(trend, targetWeight, today) : null;
    if (!stepEta && !targetEta) return null;

    return {
      perWeek: trend.slope * 7,
      nextStep,
      stepEta,
      targetWeight,
      targetEta,
    };
  }, [ready, weightsQ.data, rewardsQ.data, profileQ.data, today]);

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

  const losing = view.perWeek < 0;

  return (
    <Card>
      <SectionLabel
        icon="target"
        className="mb-[6px]"
        right={
          <span
            className={cn(
              "flex items-center gap-1 text-[11.5px] font-semibold",
              losing ? "text-pos" : "text-muted",
            )}
          >
            <Icon name={losing ? "arrowDown" : "arrowUp"} size={11} strokeWidth={2} />
            {fmt(Math.abs(view.perWeek), 2)} кг/тиж
          </span>
        }
      >
        Прогноз
      </SectionLabel>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 border-b border-line py-[11px] last:border-b-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">{r.label}</div>
              {r.sub && (
                <div className="mt-[2px] truncate text-[12px] font-normal text-muted">{r.sub}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              {r.eta.days === 0 ? (
                <div className="flex items-center gap-1 text-[13.5px] font-semibold text-pos">
                  <Icon name="check" size={12} strokeWidth={2} />
                  вже досягнуто
                </div>
              ) : (
                <>
                  <div className="text-[13.5px] font-semibold text-accent">
                    ~ {shortDate(r.eta.date)}
                  </div>
                  <div className="mt-[2px] text-[11px] font-normal text-muted">
                    через {r.eta.days} {plural(r.eta.days, "день", "дні", "днів")}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-normal leading-[1.5] text-muted">
        За темпом останніх {Math.round(TREND_WINDOW_DAYS / 7)} тижнів. Це оцінка, а не
        обіцянка — тіло має право на власний графік.
      </p>
    </Card>
  );
}
