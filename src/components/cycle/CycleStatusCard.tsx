"use client";

import { phaseTint } from "@/components/cycle/tint";
import type { Prediction } from "@/lib/cycle/predict";
import { CONFIDENCE_LABELS, PHASE_COLORS, PHASE_LABELS, type Phase } from "@/lib/cycle/types";
import { ringSegments } from "@/lib/cycle/ring";
import { daysBetween, plural, shortDate } from "@/lib/utils";

const SIZE = 88;
const R = 37;
const STROKE = 7;
const CIRC = 2 * Math.PI * R;
/** Розрив між дугами, щоб межа фаз читалась як межа, а не як зміна кольору. */
const GAP = 2;

/**
 * Кільце всього циклу: кожна фаза — своя дуга у своєму кольорі, прожиті дні
 * насичені, майбутні — блідий слід, сьогодні — мітка на кільці. Видно і де
 * людина зараз, і що чекає далі.
 */
function Ring({
  cycleDay,
  total,
  periodLength,
}: {
  cycleDay: number;
  total: number;
  periodLength: number;
}) {
  const { span, segments } = ringSegments(cycleDay, total, periodLength);
  const c = SIZE / 2;
  const dayLen = CIRC / span;
  const angle = ((cycleDay - 0.5) / span) * 2 * Math.PI - Math.PI / 2;

  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <g transform={`rotate(-90 ${c} ${c})`}>
          {segments.map((s) => {
            // Розрив лише там, де змінюється фаза, а не на межі «сьогодні».
            const len = Math.max(
              0.5,
              (s.to - s.from) * dayLen - (s.past && s.to === cycleDay && s.to < span ? 0 : GAP),
            );
            return (
              <circle
                key={`${s.phase}-${s.from}`}
                cx={c}
                cy={c}
                r={R}
                fill="none"
                stroke={PHASE_COLORS[s.phase]}
                strokeOpacity={s.past ? 1 : 0.28}
                strokeWidth={STROKE}
                strokeDasharray={`${len.toFixed(2)} ${CIRC.toFixed(2)}`}
                strokeDashoffset={-(s.from * dayLen)}
              />
            );
          })}
        </g>
        <circle
          cx={c + R * Math.cos(angle)}
          cy={c + R * Math.sin(angle)}
          r={5}
          fill="var(--text)"
          stroke="var(--surface)"
          strokeWidth={2.5}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-medium leading-none text-ink">
          {cycleDay}/{total}
        </span>
        <span className="mt-1 text-[11px] text-muted">днів</span>
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
    <div className="flex-1 rounded-[12px] bg-field p-[12px] text-center">
      <div className="text-[14px] font-medium leading-[1.25] text-ink">{value}</div>
      <div className="mt-[2px] text-[11px] font-medium text-muted">{label}</div>
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
      className="rounded-xl2 px-[20px] py-5"
      style={{
        background: `linear-gradient(140deg, ${tint} 0%, var(--surface) 65%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {phase && (
            <div className="flex items-center gap-[8px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PHASE_COLORS[phase] }}
              />
              <span
                className="truncate text-[13px] font-medium"
                style={{ color: PHASE_COLORS[phase] }}
              >
                {PHASE_LABELS[phase]}
              </span>
            </div>
          )}
          <div className="mt-2 text-[34px] font-normal leading-[1.1] tracking-[-.01em] text-ink">
            {cycleDay !== null ? `День ${cycleDay}` : "Ще без даних"}
          </div>
          <div className="mt-2 text-[13px] font-normal leading-[1.5] text-muted [text-wrap:pretty]">
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
          />
        )}
      </div>

      {prediction && (
        <div className="mt-4 flex gap-2">
          <Tile value={shortDate(prediction.ovulation)} label="Овуляція" />
          <Tile value={`${Math.round(prediction.avgLength)} дн.`} label="Сер. цикл" />
          <Tile value={CONFIDENCE_LABELS[prediction.confidence]} label="Точність" />
        </div>
      )}
    </div>
  );
}
