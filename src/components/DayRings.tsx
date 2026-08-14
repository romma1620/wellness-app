"use client";

import { Card } from "@/components/ui";
import { cn, fmt, plural } from "@/lib/utils";
import type { ReactNode } from "react";

export const WATER_GOAL = 8;
export const STEPS_GOAL = 10_000;

function Ring({
  progress,
  color,
  icon,
  value,
  caption,
}: {
  progress: number; // 0..1+, малюється з обрізанням до 1
  color: string; // CSS-колір дуги
  icon: ReactNode;
  value: string;
  caption: string;
}) {
  const R = 23;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(1, progress));
  const done = progress >= 1;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-[58px] w-[58px] shrink-0">
        <svg viewBox="0 0 58 58" className="h-full w-full -rotate-90">
          <circle cx="29" cy="29" r={R} fill="none" stroke="var(--primary-light)" strokeWidth="6" />
          <circle
            cx="29"
            cy="29"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - p)}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[17px]">
          {done ? "✓" : icon}
        </span>
      </div>
      <div>
        <div className={cn("text-[14px] font-extrabold leading-tight", done && "text-pos")}>
          {value}
        </div>
        <div className="text-[10.5px] font-bold text-muted">{caption}</div>
      </div>
    </div>
  );
}

/**
 * Кільця дня (вода, кроки) + стрік ведення щоденника.
 * Кільця живуть від форми, тож заповнюються під пальцями без збереження.
 */
export function DayRings({
  water,
  steps,
  streak,
}: {
  water: number | null;
  steps: number | null;
  streak: number;
}) {
  return (
    <Card className="flex items-center justify-between gap-2 !py-3">
      <Ring
        progress={(water ?? 0) / WATER_GOAL}
        color="var(--primary)"
        icon="💧"
        value={`${water ?? 0}/${WATER_GOAL}`}
        caption="вода, скл."
      />
      <Ring
        progress={(steps ?? 0) / STEPS_GOAL}
        color="var(--accent)"
        icon="👟"
        value={fmt((steps ?? 0) / 1000, 1)}
        caption={`з ${STEPS_GOAL / 1000} тис. кроків`}
      />
      {streak > 0 && (
        <div className="shrink-0 pr-1 text-right">
          <div className="text-[17px] font-extrabold leading-tight">🔥 {streak}</div>
          <div className="text-[10.5px] font-bold text-muted">
            {plural(streak, "день", "дні", "днів")} поспіль
          </div>
        </div>
      )}
    </Card>
  );
}
