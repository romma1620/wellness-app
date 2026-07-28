/**
 * Розрахунок «круглої» осі Y для графіків.
 *
 * Recharts на явному домені [min, max] розкидає тіки рівномірно, тому
 * при вузькому діапазоні (напр. 66.3…68.65) виходять дробові значення,
 * які після округлення підпису дублюються: 66, 67, 67, 68, 69.
 * Тут ми самі підбираємо крок 1/2/5 × 10^k, вирівнюємо межі по кроку
 * і повертаємо готові тіки + потрібну кількість десяткових знаків.
 */

export interface NiceAxis {
  domain: [number, number];
  ticks: number[];
  /** Скільки знаків після коми потрібно, щоб підписи не збігались. */
  decimals: number;
}

/** Скільки тіків дасть крок step на діапазоні [lo, hi]. */
function tickCount(lo: number, hi: number, step: number): number {
  return Math.round((Math.ceil(hi / step) * step - Math.floor(lo / step) * step) / step) + 1;
}

/**
 * «Круглий» крок (1, 2, 5 × 10^k), що дає кількість тіків найближчу до targetTicks.
 * Просто «перший крок ≥ raw» іноді лишає 3 тіки там, де 6 читаються краще.
 */
function bestStep(lo: number, hi: number, targetTicks: number): number {
  const raw = (hi - lo) / Math.max(1, targetTicks - 1);
  const exp = Math.floor(Math.log10(raw));
  const candidates: number[] = [];
  for (const e of [exp - 1, exp, exp + 1]) for (const m of [1, 2, 5]) candidates.push(m * 10 ** e);

  // Крок у межах 3..8 тіків; за рівної відстані до цілі — менший крок,
  // бо він щільніше обгортає дані (більший роздув домен, напр. 70 -> 65..75).
  let best = 0;
  let bestScore = Infinity;
  for (const step of candidates) {
    const n = tickCount(lo, hi, step);
    const inRange = n >= 3 && n <= 8;
    const score = Math.abs(n - targetTicks) + (inRange ? 0 : 100);
    if (score < bestScore) {
      best = step;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Точки спарклайна в координатах SVG (y росте вниз).
 * Плоский ряд малюється по центру: тягнути його на нижній край — брехня,
 * бо низ полотна читається як мінімум, а не як «без змін».
 */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
  pad: number,
): { x: number; y: number }[] {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return [];

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const stepX = width / (vals.length - 1);
  const usable = height - pad * 2;

  return vals.map((v, i) => ({
    x: i * stepX,
    y: height - pad - (span < 1e-9 ? 0.5 : (v - min) / span) * usable,
  }));
}

export function niceAxis(min: number, max: number, targetTicks = 5): NiceAxis {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 1;
  if (hi < lo) [lo, hi] = [hi, lo];

  const nonNegative = lo >= 0;

  if (hi - lo < 1e-9) {
    // Плоский ряд: розсуваємо на ±0.5, щоб лінія не лягла на вісь.
    lo -= 0.5;
    hi += 0.5;
  } else {
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  // Невід'ємні дані (кроки, калорії) не мають тягнути вісь у мінус.
  if (nonNegative) lo = Math.max(lo, 0);

  const step = bestStep(lo, hi, targetTicks);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (v: number) => Number(v.toFixed(decimals));

  const start = round(Math.floor(lo / step) * step);
  const end = round(Math.ceil(hi / step) * step);

  const ticks: number[] = [];
  const count = Math.round((end - start) / step);
  for (let i = 0; i <= count; i++) ticks.push(round(start + i * step));

  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, decimals };
}
