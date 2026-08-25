"use client";

import type { Prediction } from "@/lib/cycle/predict";
import {
  CONFIDENCE_LABELS,
  PHASE_COLORS,
  PHASE_LABELS,
  PHASE_TINTS,
  type Phase,
} from "@/lib/cycle/types";
import { daysBetween, plural, shortDate } from "@/lib/utils";

const R = 31;
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

  return (
    <div className="relative h-[74px] w-[74px] shrink-0">
      <svg width="74" height="74" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r={R} fill="none" stroke="#fff" strokeWidth="7" opacity=".65" />
        <circle
          cx="37"
          cy="37"
          r={R}
          fill="none"
          stroke={PHASE_COLORS.menstrual}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${periodArc.toFixed(1)} ${CIRC.toFixed(1)}`}
          transform="rotate(-90 37 37)"
        />
        {sinceArc > 0 && (
          <circle
            cx="37"
            cy="37"
            r={R}
            fill="none"
            stroke={PHASE_COLORS[phase]}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${sinceArc.toFixed(1)} ${CIRC.toFixed(1)}`}
            strokeDashoffset={-(periodArc + GAP)}
            transform="rotate(-90 37 37)"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[15px] font-extrabold leading-none"
          style={{ color: PHASE_COLORS[phase] }}
        >
          {cycleDay}/{total}
        </span>
        <span className="mt-[3px] text-[9.5px] font-bold text-muted">днів</span>
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
    <div className="flex-1 rounded-[13px] bg-[var(--tint-tile)] px-2.5 py-[9px] text-center">
      <div className="text-[15px] font-extrabold leading-tight">{value}</div>
      <div className="mt-px text-[10.5px] font-bold text-muted">{label}</div>
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
  const tint = phase ? PHASE_TINTS[phase] : "var(--tint-rose-soft)";

  return (
    <div
      className="rounded-xl2 px-[18px] py-5 shadow-card"
      // Другий стоп — акцент теми: картка мусить лишатись частиною
      // застосунку, а не окремим «медичним» островом.
      style={{ background: `linear-gradient(135deg, ${tint} 0%, var(--primary-light) 100%)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {phase && (
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PHASE_COLORS[phase] }}
              />
              <span
                className="truncate text-[12.5px] font-extrabold uppercase tracking-[.02em]"
                style={{ color: PHASE_COLORS[phase] }}
              >
                {PHASE_LABELS[phase]}
              </span>
            </div>
          )}
          <div className="mt-1.5 text-[32px] font-extrabold leading-[1.15]">
            {cycleDay !== null ? `День ${cycleDay}` : "Ще без даних"}
          </div>
          <div className="mt-1.5 text-[13.5px] font-semibold leading-[1.45] text-muted [text-wrap:pretty]">
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
        <div className="mt-[15px] flex gap-2">
          <Tile value={shortDate(prediction.ovulation)} label="овуляція" />
          <Tile value={`${Math.round(prediction.avgLength)} дн.`} label="сер. цикл" />
          <Tile value={CONFIDENCE_LABELS[prediction.confidence]} label="точність" />
        </div>
      )}
    </div>
  );
}
