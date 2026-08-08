import { describe, expect, it } from "vitest";
import {
  averageByPhase,
  comparePhases,
  MIN_MEANINGFUL_DIFF,
  relDiff,
  statFor,
  symptomStats,
  waterRetention,
} from "@/lib/cycle/insights";
import { phaseRangesFor } from "@/lib/cycle/phases";
import type { Cycle, CycleEntry } from "@/lib/cycle/types";
import { addDays } from "@/lib/utils";

// Один цикл 1–28 серпня, менструація 5 днів:
// менстр. 01–05, фолікул. 06–13, овуляція 14–16, лютеїн. 17–23, ПМС 24–28.
const RANGES = phaseRangesFor("2026-08-01", 5, "2026-08-29");

function days(from: string, count: number, value: number) {
  return Array.from({ length: count }, (_, i) => ({ date: addDays(from, i), value }));
}

describe("averageByPhase", () => {
  it("розкладає значення по фазах", () => {
    const stats = averageByPhase(
      [...days("2026-08-01", 5, 8000), ...days("2026-08-06", 8, 10000)],
      RANGES,
    );
    expect(statFor(stats, "menstrual")!.avg).toBe(8000);
    expect(statFor(stats, "follicular")!.avg).toBe(10000);
    expect(statFor(stats, "menstrual")!.n).toBe(5);
  });

  it("фаза з менш ніж 3 днями даних не отримує середнього", () => {
    const stats = averageByPhase(days("2026-08-01", 2, 8000), RANGES);
    expect(statFor(stats, "menstrual")!.avg).toBeNull();
    expect(statFor(stats, "menstrual")!.n).toBe(2);
  });

  it("порожні значення й дати поза циклами ігноруються", () => {
    const stats = averageByPhase(
      [
        ...days("2026-08-01", 3, 8000),
        { date: "2026-08-04", value: null },
        { date: "2027-01-01", value: 99999 },
      ],
      RANGES,
    );
    expect(statFor(stats, "menstrual")!.avg).toBe(8000);
    expect(statFor(stats, "menstrual")!.n).toBe(3);
  });

  it("повертає всі фази, навіть порожні", () => {
    const stats = averageByPhase([], RANGES);
    expect(stats).toHaveLength(5);
    expect(stats.every((s) => s.avg === null && s.n === 0)).toBe(true);
  });
});

describe("relDiff / comparePhases", () => {
  it("relDiff у відсотках від бази", () => {
    expect(relDiff(82, 100)).toBe(-18);
    expect(relDiff(110, 100)).toBeCloseTo(10);
    expect(relDiff(1, null)).toBeNull();
    expect(relDiff(1, 0)).toBeNull();
  });

  it("різниця в межах шуму не показується", () => {
    const stats = averageByPhase(
      [...days("2026-08-01", 5, 100), ...days("2026-08-06", 8, 105)],
      RANGES,
    );
    // −4.8% — менше порогу
    expect(comparePhases(stats, "menstrual", "follicular")).toBeNull();
  });

  it("помітна різниця повертається з відсотком і базою", () => {
    const stats = averageByPhase(
      [...days("2026-08-01", 5, 8200), ...days("2026-08-06", 8, 10000)],
      RANGES,
    );
    const cmp = comparePhases(stats, "menstrual", "follicular")!;
    expect(cmp.diffPct).toBeCloseTo(-18);
    expect(Math.abs(cmp.diffPct)).toBeGreaterThanOrEqual(MIN_MEANINGFUL_DIFF);
    expect(cmp.base).toBe(10000);
  });

  it("без даних в одній із фаз порівняння немає", () => {
    const stats = averageByPhase(days("2026-08-01", 5, 8200), RANGES);
    expect(comparePhases(stats, "menstrual", "follicular")).toBeNull();
  });
});

describe("symptomStats", () => {
  const cycles: Cycle[] = [{ start: "2026-08-01", end: "2026-08-28", periodLength: 5, length: 28 }];

  function entry(date: string, symptoms: string[]): CycleEntry {
    return { date, symptoms } as CycleEntry;
  }

  it("рангує за частотою і нормує смужки до найчастішого", () => {
    const stats = symptomStats(
      [
        entry("2026-08-01", ["cramps", "fatigue"]),
        entry("2026-08-02", ["cramps"]),
        entry("2026-08-03", ["cramps"]),
        entry("2026-08-25", ["bloating"]),
        entry("2026-08-26", ["bloating"]),
      ],
      cycles,
    );
    expect(stats.map((s) => s.key)).toEqual(["cramps", "bloating", "fatigue"]);
    expect(stats[0].share).toBe(1);
    expect(stats[1].share).toBeCloseTo(2 / 3);
  });

  it("вікно днів — міжквартильне, поодинокий випадок його не розтягує", () => {
    const stats = symptomStats(
      [
        entry("2026-08-01", ["cramps"]),
        entry("2026-08-02", ["cramps"]),
        entry("2026-08-03", ["cramps"]),
        entry("2026-08-04", ["cramps"]),
        entry("2026-08-19", ["cramps"]), // випадковий день 19
      ],
      cycles,
    );
    expect(stats[0].dayFrom).toBe(2);
    expect(stats[0].dayTo).toBe(4);
  });

  it("обмежує кількість рядків", () => {
    const stats = symptomStats(
      [entry("2026-08-01", ["a", "b", "c", "d", "e"])],
      cycles,
      3,
    );
    expect(stats).toHaveLength(3);
  });

  it("симптом за межами відомих циклів рахується, але без вікна днів", () => {
    const stats = symptomStats([entry("2025-01-01", ["cramps"])], cycles);
    expect(stats[0].days).toBe(1);
    expect(stats[0].dayFrom).toBeNull();
  });

  it("без симптомів — порожній результат", () => {
    expect(symptomStats([], cycles)).toEqual([]);
  });
});

describe("waterRetention", () => {
  const weights = [...days("2026-08-06", 8, 63.8), ...days("2026-08-24", 5, 64.6)];

  it("у ПМС показує приріст проти фолікулярної", () => {
    const hint = waterRetention(weights, RANGES, "late_luteal")!;
    expect(hint.deltaKg).toBeCloseTo(0.8);
    expect(hint.phase).toBe("late_luteal");
  });

  it("у фолікулярній фазі підказки немає", () => {
    expect(waterRetention(weights, RANGES, "follicular")).toBeNull();
    expect(waterRetention(weights, RANGES, null)).toBeNull();
  });

  it("падіння ваги не подається як затримка води", () => {
    const down = [...days("2026-08-06", 8, 64.6), ...days("2026-08-24", 5, 63.8)];
    expect(waterRetention(down, RANGES, "late_luteal")).toBeNull();
  });

  it("приріст понад 2 кг на фазу вже не списується", () => {
    const big = [...days("2026-08-06", 8, 60), ...days("2026-08-24", 5, 65)];
    expect(waterRetention(big, RANGES, "late_luteal")).toBeNull();
  });
});
