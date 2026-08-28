"use client";

import { phaseTint } from "@/components/cycle/tint";
import type { Prediction } from "@/lib/cycle/predict";
import { CONFIDENCE_LABELS, PHASE_COLORS, PHASE_LABELS, type Phase } from "@/lib/cycle/types";
import { daysBetween, plural, shortDate } from "@/lib/utils";

const SIZE = 78;
const R = 33;
const CIRC = 2 * Math.PI * R;
/** Розрив між дугами, щоб межа фаз читалась як межа, а не як зміна кольору. */
const GAP = 3;

function Ring({
  cycleDay,
  total,
  periodLength,
  phase,
}: {
  cycleDay: number;
  total: number;
  periodLength: number;
  phase: Phase;
}) {
  const span = Math.max(total, cycleDay, 1);
  const periodArc = (Math.min(periodLength, cycleDay) / span) * CIRC;
  const sinceArc = (Math.max(0, cycleDay - periodLength) / span) * CIRC;
  const c = SIZE / 2;

  return (
    <div className="relative h-[78px] w-[78px] shrink-0">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke={PHASE_COLORS.menstrual}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${periodArc.toFixed(1)} ${CIRC.toFixed(1)}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {sinceArc > 0 && (
          <circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            stroke={PHASE_COLORS[phase]}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${sinceArc.toFixed(1)} ${CIRC.toFixed(1)}`}
            strokeDashoffset={-(periodArc + GAP)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-semibold leading-none text-ink">
          {cycleDay}/{total}
        </span>
        <span className="mt-[3px] text-[9.5px] font-medium text-muted">днів</span>
      </div>
    </div>
  );
}

/**
 * Текст прогнозу.
 *
 * При великому розкиді одна дата була б вигадкою — тоді показуємо діапазон.
 * Затримка описується нейтрально: «довший за звичний», без причин і оцінок.
 */
function forecastText(p: Prediction, today: string): string {
  if (p.overdue) {
    const late = daysBetween(p.nextStart, today);
    return `Цикл довший за звичний — прогноз був ${shortDate(p.nextStart)}, уже ${late} ${plural(late, "день", "дні", "днів")} по тому`;
  }

  if (p.rangeOnly) {
    return `Менструація очікується ${shortDate(p.windowStart)} – ${shortDate(p.windowEnd)}`;
  }

  const left = daysBetween(today, p.nextStart);
  if (left <= 0) return `Менструація очікується сьогодні`;
  if (left === 1) return `Менструація очікується завтра · ${shortDate(p.nextStart)}`;
  return `Менструація очікується через ~${left} ${plural(left, "день", "дні", "днів")} · ${shortDate(p.nextStart)}`;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[12px] border border-line bg-field p-[10px] text-center">
      <div className="text-[14px] font-semibold leading-[1.25] text-ink">{value}</div>
      <div className="mt-[2px] text-[10px] font-medium uppercase tracking-[.05em] text-muted">
        {label}
      </div>
    </div>
  );
}

export function CycleStatusCard({
  cycleDay,
  phase,
  prediction,
  today,
}: {
  cycleDay: number | null;
  phase: Phase | null;
  prediction: Prediction | null;
  today: string;
}) {
  // Без фази картка тримає колір менструації: це стан «ще без даних», а
  // перший запис, який його змінить, — саме перший день менструації.
  const tint = phaseTint(phase ?? "menstrual");

  return (
    <div
      className="rounded-xl2 px-[18px] py-5"
      style={{ background: `linear-gradient(140deg, ${tint} 0%, var(--surface) 65%)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {phase && (
            <div className="flex items-center gap-[7px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PHASE_COLORS[phase] }}
              />
              <span
                className="truncate text-[11px] font-semibold uppercase tracking-[.09em]"
                style={{ color: PHASE_COLORS[phase] }}
              >
                {PHASE_LABELS[phase]}
              </span>
            </div>
          )}
          <div className="mt-2 text-[34px] font-normal leading-[1.1] tracking-[-.01em] text-ink">
            {cycleDay !== null ? `День ${cycleDay}` : "Ще без даних"}
          </div>
          <div className="mt-2 text-[12.5px] font-normal leading-[1.5] text-muted [text-wrap:pretty]">
            {prediction
              ? forecastText(prediction, today)
              : "Відміть перший день менструації — і зʼявиться прогноз"}
          </div>
        </div>

        {cycleDay !== null && phase && prediction && (
          <Ring
            cycleDay={cycleDay}
            total={Math.round(prediction.avgLength)}
            periodLength={Math.round(prediction.avgPeriodLength)}
            phase={phase}
          />
        )}
      </div>

      {prediction && (
        <div className="mt-4 flex gap-2">
          <Tile value={shortDate(prediction.ovulation)} label="овуляція" />
          <Tile value={`${Math.round(prediction.avgLength)} дн.`} label="сер. цикл" />
          <Tile value={CONFIDENCE_LABELS[prediction.confidence]} label="точність" />
        </div>
      )}
    </div>
  );
}
