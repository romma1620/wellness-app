import { describe, expect, it } from "vitest";
import { macroSplit, proteinPerKg, proteinZone, weekdayPattern } from "./nutrition";

describe("macroSplit", () => {
  it("відсотки калорій за коефіцієнтами 4/9/4", () => {
    const s = macroSplit([{ protein: 100, fat: 50, carbs: 150 }]);
    // 400 / 450 / 600 ккал, разом 1450
    expect(s).not.toBeNull();
    expect(s!.proteinPct).toBeCloseTo(27.6, 1);
    expect(s!.fatPct).toBeCloseTo(31.0, 1);
    expect(s!.carbsPct).toBeCloseTo(41.4, 1);
  });

  it("грами — середні за днями, пропуски ігноруються", () => {
    const s = macroSplit([
      { protein: 100, fat: 50, carbs: 150 },
      { protein: 120, fat: null, carbs: 130 },
    ]);
    expect(s!.protein).toBeCloseTo(110, 5);
    expect(s!.fat).toBeCloseTo(50, 5);
    expect(s!.carbs).toBeCloseTo(140, 5);
  });

  it("без жодного макроса — null", () => {
    expect(macroSplit([])).toBeNull();
    expect(macroSplit([{ protein: null, fat: null, carbs: null }])).toBeNull();
  });
});

describe("proteinPerKg", () => {
  it("грами білка на кг ваги", () => {
    expect(proteinPerKg(100, 65)).toBeCloseTo(1.54, 2);
  });

  it("null без білка або ваги", () => {
    expect(proteinPerKg(null, 65)).toBeNull();
    expect(proteinPerKg(100, null)).toBeNull();
    expect(proteinPerKg(100, 0)).toBeNull();
  });
});

describe("proteinZone", () => {
  it("зони за порогами 1.2 і 1.6", () => {
    expect(proteinZone(0.8)).toBe("low");
    expect(proteinZone(1.2)).toBe("mid");
    expect(proteinZone(1.59)).toBe("mid");
    expect(proteinZone(1.6)).toBe("high");
  });
});

describe("weekdayPattern", () => {
  it("середні ккал за днями тижня, індекс 0 = понеділок", () => {
    const p = weekdayPattern([
      { date: "2026-08-10", kcal: 2000 }, // пн
      { date: "2026-08-17", kcal: 2200 }, // пн наступного тижня
      { date: "2026-08-12", kcal: 1800 }, // ср
    ]);
    expect(p.byWeekday[0]).toBeCloseTo(2100, 5);
    expect(p.byWeekday[2]).toBeCloseTo(1800, 5);
    expect(p.byWeekday[1]).toBeNull();
  });

  it("дельта вихідних проти буднів у відсотках", () => {
    const p = weekdayPattern([
      { date: "2026-08-10", kcal: 2000 }, // пн
      { date: "2026-08-15", kcal: 2400 }, // сб
      { date: "2026-08-16", kcal: 2200 }, // нд
    ]);
    // будні 2000, вихідні 2300 → +15%
    expect(p.weekendDeltaPct).toBeCloseTo(15, 5);
  });

  it("дельта null, коли немає буднів або вихідних", () => {
    expect(weekdayPattern([{ date: "2026-08-10", kcal: 2000 }]).weekendDeltaPct).toBeNull();
    expect(weekdayPattern([{ date: "2026-08-15", kcal: 2400 }]).weekendDeltaPct).toBeNull();
    expect(weekdayPattern([]).weekendDeltaPct).toBeNull();
  });

  it("дні без ккал не враховуються", () => {
    const p = weekdayPattern([
      { date: "2026-08-10", kcal: null },
      { date: "2026-08-15", kcal: 2400 },
    ]);
    expect(p.byWeekday[0]).toBeNull();
    expect(p.weekendDeltaPct).toBeNull();
  });
});
