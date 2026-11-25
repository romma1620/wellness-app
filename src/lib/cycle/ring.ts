import { phaseRangesFor, rangeDays } from "@/lib/cycle/phases";
import type { Phase } from "@/lib/cycle/types";
import { addDays, daysBetween } from "@/lib/utils";

export interface RingSegment {
  phase: Phase;
  /** Дні від старту циклу, [from, to). */
  from: number;
  to: number;
  /** Уже прожита частина циклу — малюється насиченою. */
  past: boolean;
}

/** Будь-яка дата: фази рахуються відносно старту, календар тут не важить. */
const ANCHOR = "2026-01-01";

/**
 * Дуги кільця циклу: усі фази середнього циклу, кожна розрізана по
 * сьогоднішньому дню на прожиту й майбутню частини. Якщо цикл затягнувся
 * понад середню довжину, зайві дні дописуються пізньою лютеїновою —
 * саме в ній людина зараз і є.
 */
export function ringSegments(
  cycleDay: number,
  total: number,
  periodLength: number,
): { span: number; segments: RingSegment[] } {
  const span = Math.max(total, cycleDay, 1);
  const phases = phaseRangesFor(ANCHOR, periodLength, addDays(ANCHOR, total)).map((r) => ({
    phase: r.phase,
    from: daysBetween(ANCHOR, r.start),
    to: daysBetween(ANCHOR, r.start) + rangeDays(r),
  }));
  if (cycleDay > total) phases.push({ phase: "late_luteal", from: total, to: cycleDay });

  const segments: RingSegment[] = [];
  for (const p of phases) {
    const cut = Math.min(Math.max(cycleDay, p.from), p.to);
    if (cut > p.from) segments.push({ ...p, to: cut, past: true });
    if (p.to > cut) segments.push({ ...p, from: cut, past: false });
  }
  return { span, segments };
}
