import { addDays, daysBetween } from "@/lib/utils";
import { LUTEAL_DAYS, type Prediction } from "@/lib/cycle/predict";
import type { Cycle, Phase } from "@/lib/cycle/types";

export interface PhaseRange {
  phase: Phase;
  /** Включно. */
  start: string;
  /** Включно. */
  end: string;
}

/** Останні N днів циклу читаються як ПМС — підмножина лютеїнової. */
const PMS_DAYS = 5;

function push(out: PhaseRange[], phase: Phase, start: string, end: string): void {
  if (start <= end) out.push({ phase, start, end });
}

const maxISO = (a: string, b: string) => (a > b ? a : b);
const minISO = (a: string, b: string) => (a < b ? a : b);

/**
 * Фази одного циклу [start, nextStart).
 *
 * Межі затискаються одна об одну, тому короткий цикл просто зʼїдає
 * середні фази, а не породжує діапазони, що йдуть назад.
 */
export function phaseRangesFor(
  start: string,
  periodLength: number,
  nextStart: string,
): PhaseRange[] {
  const cycleEnd = addDays(nextStart, -1);
  if (cycleEnd < start) return [];

  const out: PhaseRange[] = [];

  const menstrualEnd = minISO(addDays(start, Math.max(1, periodLength) - 1), cycleEnd);
  push(out, "menstrual", start, menstrualEnd);

  const ovulationDay = addDays(nextStart, -LUTEAL_DAYS);
  const ovuStart = maxISO(addDays(ovulationDay, -1), addDays(menstrualEnd, 1));
  const ovuEnd = minISO(addDays(ovulationDay, 1), cycleEnd);

  push(out, "follicular", addDays(menstrualEnd, 1), addDays(ovuStart, -1));
  push(out, "ovulation", ovuStart, ovuEnd);

  const pmsStart = maxISO(addDays(nextStart, -PMS_DAYS), addDays(ovuEnd, 1));
  push(out, "luteal", addDays(ovuEnd, 1), addDays(pmsStart, -1));
  push(out, "late_luteal", pmsStart, cycleEnd);

  return out;
}

/**
 * Фази по всій історії. Завершені цикли знають свій кінець; для поточного
 * кінцем служить прогноз.
 *
 * Якщо цикл затримується, прогнозований старт уже в минулому — тоді
 * останню фазу тягнемо мінімум до сьогодні, інакше «сьогодні» лишилось би
 * без фази саме тоді, коли підказка про затримку найпотрібніша.
 */
export function buildPhaseRanges(
  cycles: Cycle[],
  prediction: Prediction | null,
  today: string,
): PhaseRange[] {
  const out: PhaseRange[] = [];

  for (const c of cycles) {
    const nextStart =
      c.end !== null
        ? addDays(c.end, 1)
        : prediction
          ? maxISO(prediction.nextStart, addDays(today, 1))
          : null;
    if (!nextStart) continue;
    out.push(...phaseRangesFor(c.start, c.periodLength, nextStart));
  }

  return out;
}

/**
 * Діапазон, якому належить дата.
 *
 * Пізня лютеїнова лежить усередині лютеїнової за смислом, але діапазони
 * не перетинаються — тож перший збіг і є відповіддю.
 */
export function rangeAt(iso: string, ranges: PhaseRange[]): PhaseRange | null {
  for (const r of ranges) {
    if (iso >= r.start && iso <= r.end) return r;
  }
  return null;
}

export function phaseAt(iso: string, ranges: PhaseRange[]): Phase | null {
  return rangeAt(iso, ranges)?.phase ?? null;
}

/** Смуга фази, обрізана по вікну графіка. Порожній перетин відкидається. */
export function clampRanges(ranges: PhaseRange[], from: string, to: string): PhaseRange[] {
  const out: PhaseRange[] = [];
  for (const r of ranges) {
    const start = maxISO(r.start, from);
    const end = minISO(r.end, to);
    if (start <= end) out.push({ phase: r.phase, start, end });
  }
  return out;
}

/** Довжина діапазону в днях, включно з обома краями. */
export function rangeDays(r: PhaseRange): number {
  return daysBetween(r.start, r.end) + 1;
}

/**
 * Смуги фаз у категоріях осі X графіка.
 *
 * Вісь у recharts категорійна (мітки точок), тому смугу не можна задати
 * датами — її межі мусять бути мітками наявних точок.
 *
 * Смуга продовжується, лише поки точки лежать у ТОМУ САМОМУ діапазоні фази,
 * а не просто в однаковій фазі: менструації двох сусідніх циклів — це одна
 * фаза, але дві смуги, і зливати їх означало б замалювати цикл між ними.
 * День без фази теж рве смугу.
 */
export function bandsForSeries(
  points: { date: string; label: string }[],
  ranges: PhaseRange[],
): { phase: Phase; x1: string; x2: string }[] {
  const out: { phase: Phase; x1: string; x2: string }[] = [];
  let prev: PhaseRange | null = null;

  for (const p of points) {
    const r = rangeAt(p.date, ranges);
    if (!r) {
      prev = null;
      continue;
    }
    if (prev === r) out[out.length - 1].x2 = p.label;
    else out.push({ phase: r.phase, x1: p.label, x2: p.label });
    prev = r;
  }

  return out;
}
