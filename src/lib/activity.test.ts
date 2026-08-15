import { describe, expect, it } from "vitest";
import { dayCompleteness, heatLevel, weekRows } from "./activity";

describe("dayCompleteness", () => {
  it("порожній день — 0", () => {
    expect(dayCompleteness({})).toBe(0);
  });

  it("повністю заповнений день — 1", () => {
    expect(
      dayCompleteness({
        weight: 65, kcal: 1800, protein: 100, fat: 60, carbs: 180, water: 6, steps: 9000,
      }),
    ).toBe(1);
  });

  it("частково заповнений — частка від 7 полів", () => {
    expect(dayCompleteness({ weight: 65, kcal: 1800, water: 6 })).toBeCloseTo(3 / 7, 5);
  });

  it("нулі рахуються як заповнені (0 склянок — теж запис)", () => {
    expect(dayCompleteness({ water: 0 })).toBeCloseTo(1 / 7, 5);
  });
});

describe("heatLevel", () => {
  it("без значення або без максимуму — 0", () => {
    expect(heatLevel(null, 100)).toBe(0);
    expect(heatLevel(0, 100)).toBe(0);
    expect(heatLevel(50, 0)).toBe(0);
  });

  it("максимум — рівень 4", () => {
    expect(heatLevel(100, 100)).toBe(4);
  });

  it("мале додатне значення — щонайменше 1", () => {
    expect(heatLevel(1, 100)).toBe(1);
  });

  it("половина — рівень 2", () => {
    expect(heatLevel(50, 100)).toBe(2);
  });
});

describe("weekRows", () => {
  it("рядки Пн–Нд, краї доповнені null", () => {
    // 2026-08-05 — середа, 2026-08-18 — вівторок
    const rows = weekRows("2026-08-05", "2026-08-18");
    expect(rows).toHaveLength(3);
    expect(rows[0].days).toEqual([
      null, null, "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09",
    ]);
    expect(rows[1].days).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13",
      "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
    expect(rows[2].days).toEqual([
      "2026-08-17", "2026-08-18", null, null, null, null, null,
    ]);
  });

  it("перший рядок підписаний своїм місяцем, наступні — лише там, де перше число", () => {
    const rows = weekRows("2026-08-25", "2026-09-10");
    expect(rows[0].monthLabel).toBe("сер");
    expect(rows[1].monthLabel).toBe("вер"); // тиждень 31 сер – 6 вер містить 1 вересня
    expect(rows[2].monthLabel).toBeNull();
  });
});
