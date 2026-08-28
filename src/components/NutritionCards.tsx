"use client";

import { Card, SectionLabel } from "@/components/ui";
import { macroSplit, proteinPerKg, proteinZone, weekdayPattern } from "@/lib/nutrition";
import type { DailyLog } from "@/lib/types";
import { avg, cn, fmt, fmtInt } from "@/lib/utils";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Кольори сегментів макросів — дані, тож hex як у дизайні (акцент — білок). */
const MACROS = [
  { key: "protein", label: "Білок", color: "var(--accent)" },
  { key: "fat", label: "Жири", color: "#B98A93" },
  { key: "carbs", label: "Вугл.", color: "#7FAE95" },
] as const;

const ZONE_HINTS = {
  low: "мало — при силових тренуваннях ціль 1,6–2,2 г/кг",
  mid: "непогано — до цілі силових (1,6 г/кг) трохи не вистачає",
  high: "у цільовій зоні для силових тренувань",
} as const;

/** Вихідні стовпчики — акцент, приглушений до muted, як у дизайні. */
const WEEKEND_BAR = "color-mix(in oklab, var(--accent) 45%, var(--muted))";

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
        <Card>
          <SectionLabel>Розподіл калорій Б/Ж/В</SectionLabel>
          <div className="flex h-[10px] gap-[2px] overflow-hidden rounded-full">
            {MACROS.map((m) => (
              <div
                key={m.key}
                className="rounded-full"
                style={{
                  width: `${split[`${m.key}Pct`]}%`,
                  background: m.color,
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between gap-2">
            {MACROS.map((m) => (
              <div key={m.key} className="flex items-center gap-[6px]">
                <span
                  className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: m.color }}
                />
                <span className="text-[11.5px] font-semibold">
                  {m.label} {fmtInt(split[`${m.key}Pct`])}%
                  <span className="ml-1 font-normal text-muted">{fmtInt(split[m.key])} г</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {gPerKg != null && (
        <Card>
          <SectionLabel className="mb-0">Білок на кг ваги</SectionLabel>
          <div className="mt-2 text-[23px] font-normal tracking-[-.01em]">
            {fmt(gPerKg, 2)}
            <span className="ml-[5px] text-[11.5px] font-medium text-muted">г/кг</span>
          </div>
          <div className="mt-1 text-[11.5px] font-normal text-muted">
            {ZONE_HINTS[proteinZone(gPerKg)]}
          </div>
        </Card>
      )}

      {hasWeekdays && (
        <Card>
          <SectionLabel className="mb-[14px]">Ккал по днях тижня</SectionLabel>
          <div className="flex h-[72px] items-end gap-[6px]">
            {pattern.byWeekday.map((v, i) => (
              <div key={WD[i]} className="flex flex-1 flex-col items-center gap-[5px]">
                <div
                  title={v != null ? `${WD[i]}: ${fmtInt(v)} ккал` : undefined}
                  className={cn("w-full rounded-[5px]", v == null && "opacity-0")}
                  style={{
                    background: i >= 5 ? WEEKEND_BAR : "var(--accent)",
                    height: v != null && maxKcal > 0 ? `${Math.max(8, (v / maxKcal) * 60)}px` : 0,
                  }}
                />
                <span className="text-[10px] font-medium text-muted">{WD[i]}</span>
              </div>
            ))}
          </div>
          {pattern.weekendDeltaPct != null && (
            <div className="mt-[10px] text-[11.5px] font-normal text-muted">
              У вихідні{" "}
              <span className="font-bold text-ink">
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
