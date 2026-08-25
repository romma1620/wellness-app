"use client";

import { WEEKDAY_HEADS, type CalendarDay } from "@/lib/cycle/calendar";
import { PHASE_COLORS, type Flow } from "@/lib/cycle/types";
import { cn, monthLabel } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * Заливка дня кровотечі. Насиченість = сила виділень, тож рядок днів
 * читається як спад інтенсивності без жодних підписів.
 */
const FLOW_FILL: Record<Flow, { bg: string; fg: string }> = {
  // spotting — єдина пастельна пара, тож лише вона ходить через тінт-токени;
  // light/medium/heavy — насичені середні тони, які читаються в обох режимах.
  spotting: { bg: "var(--tint-spot)", fg: "var(--tint-spot-fg)" },
  light: { bg: "#E28FA0", fg: "#FFFFFF" },
  medium: { bg: "#D4677E", fg: "#FFFFFF" },
  heavy: { bg: "#B94A62", fg: "#FFFFFF" },
};

const FERTILE_BG = "var(--tint-teal)";
const FERTILE_FG = "var(--tint-teal-fg)";
const OVULATION_FG = "var(--tint-teal-strong-fg)";
const PREDICTED_FG = "var(--tint-rose-fg)";

function dayStyle(day: CalendarDay): React.CSSProperties {
  if (day.mark === "flow" && day.flow) {
    const { bg, fg } = FLOW_FILL[day.flow];
    return { background: bg, color: fg };
  }
  if (day.mark === "ovulation") {
    return {
      background: FERTILE_BG,
      color: OVULATION_FG,
      border: `2.2px solid ${PHASE_COLORS.ovulation}`,
    };
  }
  if (day.mark === "predicted") {
    return { border: `2px dashed ${PHASE_COLORS.menstrual}`, color: PREDICTED_FG };
  }
  if (day.mark === "fertile") {
    return { background: FERTILE_BG, color: FERTILE_FG };
  }
  return {};
}

function DayCell({ day, onPick }: { day: CalendarDay; onPick: (iso: string) => void }) {
  const plain = day.mark === "none";
  const style = dayStyle(day);

  // «Сьогодні» — не стан дня, а місце на календарі, тож воно не заміщає
  // заливку кровотечі, а обводить її кільцем поверх.
  if (day.today) {
    style.boxShadow = "0 0 0 2.5px var(--surface), 0 0 0 5px var(--primary)";
    if (plain) {
      style.background = "var(--primary)";
      style.color = "#fff";
    }
  }

  return (
    <button
      type="button"
      onClick={() => onPick(day.date)}
      // Майбутнє відкриваємо теж: логувати там нічого, але подивитись, що
      // застосунок прогнозує на цей день, — законне бажання.
      className="flex flex-col items-center gap-[3px] py-px active:scale-95"
      aria-label={day.date}
    >
      <span
        style={style}
        className={cn(
          "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13.5px] transition-none",
          plain && !day.today ? "font-bold" : "font-extrabold",
          day.outside && "opacity-35",
          day.outside && plain && "text-muted",
        )}
      >
        {day.dayOfMonth}
      </span>
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          day.hasEntry ? (day.today ? "bg-primary" : "bg-muted") : "bg-transparent",
        )}
      />
    </button>
  );
}

function LegendDot({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 shrink-0 rounded-full" style={style} />
      <span className="text-[11px] font-bold text-muted">{label}</span>
    </span>
  );
}

export function CycleCalendar({
  monthStart,
  days,
  onMonth,
  onPick,
  canGoForward,
}: {
  monthStart: string;
  days: CalendarDay[];
  onMonth: (delta: number) => void;
  onPick: (iso: string) => void;
  canGoForward: boolean;
}) {
  const [legendOpen, setLegendOpen] = useState(true);

  return (
    <div className="rounded-xl2 bg-surface px-[14px] pb-[14px] pt-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(-1)}
          aria-label="Попередній місяць"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[11px] bg-bg text-muted active:scale-90"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-[15px] font-extrabold">{monthLabel(monthStart)}</div>
        <button
          type="button"
          onClick={() => canGoForward && onMonth(1)}
          disabled={!canGoForward}
          aria-label="Наступний місяць"
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center rounded-[11px] bg-bg text-muted",
            canGoForward ? "active:scale-90" : "opacity-30",
          )}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7">
        {WEEKDAY_HEADS.map((w) => (
          <div key={w} className="text-center text-[10.5px] font-extrabold text-muted">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-[5px]">
        {days.map((d) => (
          <DayCell key={d.date} day={d} onPick={onPick} />
        ))}
      </div>

      <div className="mt-3.5 border-t-[1.5px] border-bg pt-3">
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          className="text-[11px] font-extrabold text-primary"
        >
          {legendOpen ? "Згорнути легенду" : "Що означають кольори"}
        </button>
        {legendOpen && (
          <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-2.5">
            <LegendDot style={{ background: PHASE_COLORS.menstrual }} label="менструація" />
            <LegendDot
              style={{ border: `2px dashed ${PHASE_COLORS.menstrual}` }}
              label="прогноз"
            />
            <LegendDot
              style={{ border: `2px solid ${PHASE_COLORS.ovulation}` }}
              label="овуляція"
            />
            <LegendDot style={{ background: FERTILE_BG }} label="фертильні дні" />
            <span className="flex items-center gap-1.5">
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-muted" />
              <span className="text-[11px] font-bold text-muted">є запис</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
