"use client";

import { Card } from "@/components/ui";
import { macroSplit, proteinPerKg, proteinZone, weekdayPattern } from "@/lib/nutrition";
import type { DailyLog } from "@/lib/types";
import { avg, cn, fmt, fmtInt } from "@/lib/utils";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

const MACROS = [
  { key: "protein", label: "Білок", color: "var(--primary)" },
  { key: "fat", label: "Жири", color: "var(--accent)" },
  { key: "carbs", label: "Вуглеводи", color: "var(--pos)" },
] as const;

const ZONE_HINTS = {
  low: "мало — при силових тренуваннях ціль 1,6–2,2 г/кг",
  mid: "непогано — до цілі силових (1,6 г/кг) трохи не вистачає",
  high: "у цільовій зоні для силових тренувань",
} as const;

/** Картки аналітики харчування. Рахується з уже завантажених логів періоду. */
export function NutritionCards({
  logs,
}: {
  logs: Pick<DailyLog, "date" | "weight" | "kcal" | "protein" | "fat" | "carbs">[];
}) {
  const split = macroSplit(logs);
  const gPerKg = proteinPerKg(
    avg(logs.map((l) => l.protein)),
    avg(logs.map((l) => l.weight)),
  );
  const pattern = weekdayPattern(logs);
  const hasWeekdays = pattern.byWeekday.some((v) => v != null);
  if (!split && gPerKg == null && !hasWeekdays) return null;

  const maxKcal = Math.max(...pattern.byWeekday.map((v) => v ?? 0));

  return (
    <>
      {split && (
        <Card className="!p-[14px]">
          <div className="mb-2.5 text-[12px] font-bold text-muted">
            Розподіл калорій Б/Ж/В
          </div>
          <div className="flex h-[14px] overflow-hidden rounded-full">
            {MACROS.map((m) => (
              <div
                key={m.key}
                style={{
                  width: `${split[`${m.key}Pct`]}%`,
                  background: m.color,
                }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex justify-between gap-2">
            {MACROS.map((m) => (
              <div key={m.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: m.color }}
                />
                <span className="text-[11.5px] font-bold">
                  {m.label} {fmtInt(split[`${m.key}Pct`])}%
                  <span className="ml-1 font-semibold text-muted">
                    {fmtInt(split[m.key])} г
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {gPerKg != null && (
        <Card className="!p-[14px]">
          <div className="text-[12px] font-bold text-muted">Білок на кг ваги</div>
          <div className="mt-1 text-[22px] font-extrabold">
            {fmt(gPerKg, 2)}
            <span className="ml-1 text-[12px] font-bold text-muted">г/кг</span>
          </div>
          <div className="mt-0.5 text-[11.5px] font-semibold text-muted">
            {ZONE_HINTS[proteinZone(gPerKg)]}
          </div>
        </Card>
      )}

      {hasWeekdays && (
        <Card className="!p-[14px]">
          <div className="mb-2.5 text-[12px] font-bold text-muted">Ккал по днях тижня</div>
          <div className="flex h-[72px] items-end gap-1.5">
            {pattern.byWeekday.map((v, i) => (
              <div key={WD[i]} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={v != null ? `${WD[i]}: ${fmtInt(v)} ккал` : undefined}
                  className={cn(
                    "w-full rounded-t-[5px]",
                    i >= 5 ? "bg-accent" : "bg-primary",
                    v == null && "opacity-0",
                  )}
                  style={{
                    height: v != null && maxKcal > 0 ? `${Math.max(8, (v / maxKcal) * 60)}px` : 0,
                  }}
                />
                <span className="text-[10px] font-bold text-muted">{WD[i]}</span>
              </div>
            ))}
          </div>
          {pattern.weekendDeltaPct != null && (
            <div className="mt-2 text-[11.5px] font-semibold text-muted">
              У вихідні{" "}
              <span className="font-extrabold text-ink">
                {pattern.weekendDeltaPct >= 0 ? "+" : "−"}
                {fmt(Math.abs(pattern.weekendDeltaPct), 0)}%
              </span>{" "}
              ккал проти буднів
            </div>
          )}
        </Card>
      )}
    </>
  );
}
