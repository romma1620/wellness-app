"use client";

import { Icon } from "@/components/icons";
import { mixOnSurface } from "@/components/cycle/tint";
import { WEEKDAY_HEADS, type CalendarDay } from "@/lib/cycle/calendar";
import { PHASE_COLORS, type Flow } from "@/lib/cycle/types";
import { cn, monthLabel } from "@/lib/utils";

/**
 * Заливка дня кровотечі. Насиченість = сила виділень, тож рядок днів
 * читається як спад інтенсивності без жодних підписів.
 */
const FLOW_FILL: Record<Flow, { bg: string; fg: string }> = {
  // spotting — тінт кольору менструації поверх поверхні; текст — токен,
  // бо на світлій пастелі рожевий з дизайну не читався б.
  spotting: { bg: mixOnSurface(PHASE_COLORS.menstrual, 22), fg: "var(--tint-spot-fg)" },
  light: { bg: "#E28FA0", fg: "#FFFFFF" },
  medium: { bg: "#D4677E", fg: "#FFFFFF" },
  heavy: { bg: "#B94A62", fg: "#FFFFFF" },
};

const FERTILE_BG = mixOnSurface(PHASE_COLORS.ovulation, 22);
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
      border: `1.8px solid ${PHASE_COLORS.ovulation}`,
    };
  }
  if (day.mark === "predicted") {
    return { border: `1.6px dashed ${PHASE_COLORS.menstrual}`, color: PREDICTED_FG };
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
  // заливку кровотечі, а обводить її подвійним кільцем поверх.
  if (day.today) {
    style.boxShadow = "0 0 0 2px var(--surface), 0 0 0 4px var(--accent)";
    if (plain) {
      style.background = "var(--accent)";
      style.color = "var(--on-accent)";
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
          "box-border flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] transition-none",
          day.today ? "font-bold" : plain ? "font-medium" : "font-semibold",
          day.outside && "opacity-30",
          day.outside && plain && "text-muted",
        )}
      >
        {day.dayOfMonth}
      </span>
      <span
        className={cn(
          "h-1 w-1 rounded-full",
          day.hasEntry ? (day.today ? "bg-accent" : "bg-muted") : "bg-transparent",
        )}
      />
    </button>
  );
}

function LegendDot({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="box-border h-[10px] w-[10px] shrink-0 rounded-full" style={style} />
      <span className="text-[11px] font-medium text-muted">{label}</span>
    </span>
  );
}

const NAV_BTN =
  "flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-line text-muted transition active:scale-90 disabled:opacity-30 disabled:active:scale-100";

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
  return (
    <div className="rounded-xl2 bg-surface px-[14px] pb-[14px] pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(-1)}
          aria-label="Попередній місяць"
          className={NAV_BTN}
        >
          <Icon name="chevronLeft" size={15} strokeWidth={1.8} />
        </button>
        <div className="text-[14px] font-bold text-ink">{monthLabel(monthStart)}</div>
        <button
          type="button"
          onClick={() => canGoForward && onMonth(1)}
          disabled={!canGoForward}
          aria-label="Наступний місяць"
          className={NAV_BTN}
        >
          <Icon name="chevronRight" size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7">
        {WEEKDAY_HEADS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-semibold uppercase tracking-[.05em] text-muted"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-[5px]">
        {days.map((d) => (
          <DayCell key={d.date} day={d} onPick={onPick} />
        ))}
      </div>

      <div className="mt-3.5 border-t border-line pt-3">
        <div className="flex flex-wrap gap-x-3.5 gap-y-2.5">
          <LegendDot style={{ background: PHASE_COLORS.menstrual }} label="менструація" />
          <LegendDot
            style={{ border: `1.6px dashed ${PHASE_COLORS.menstrual}` }}
            label="прогноз"
          />
          <LegendDot
            style={{ border: `1.6px solid ${PHASE_COLORS.ovulation}` }}
            label="овуляція"
          />
          <LegendDot
            style={{ background: mixOnSurface(PHASE_COLORS.ovulation, 30) }}
            label="фертильні дні"
          />
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted" />
            <span className="text-[11px] font-medium text-muted">є запис</span>
          </span>
        </div>
      </div>
    </div>
  );
}
