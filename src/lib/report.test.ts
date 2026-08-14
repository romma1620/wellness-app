import { describe, expect, it } from "vitest";
import { sessionsSummary, weekStats, type ReportDay } from "./report";

const day = (date: string, partial: Partial<Omit<ReportDay, "date">> = {}): ReportDay => ({
  date,
  weight: null,
  kcal: null,
  water: null,
  steps: null,
  sport: null,
  care: null,
  comment: null,
  ...partial,
});

describe("weekStats", () => {
  it("порожній тиждень → нулі та відсутні середні", () => {
    const s = weekStats([], []);
    expect(s).toEqual({
      avgWeight: null,
      weightDiff: null,
      avgKcal: null,
      avgWater: null,
      avgSteps: null,
      daysLogged: 0,
    });
  });

  it("середні рахуються лише по заповнених днях", () => {
    const s = weekStats(
      [day("2026-08-10", { weight: 68, water: 6 }), day("2026-08-11", { weight: 67, steps: 8000 })],
      [],
    );
    expect(s.avgWeight).toBeCloseTo(67.5, 5);
    expect(s.avgWater).toBe(6);
    expect(s.avgSteps).toBe(8000);
    expect(s.avgKcal).toBeNull();
  });

  it("різниця ваги — у кг проти минулого тижня", () => {
    const s = weekStats(
      [day("2026-08-10", { weight: 67 })],
      [day("2026-08-03", { weight: 68 })],
    );
    expect(s.weightDiff).toBeCloseTo(-1, 5);
  });

  it("без ваги на одному з тижнів різниці немає", () => {
    const s = weekStats([day("2026-08-10", { weight: 67 })], [day("2026-08-03")]);
    expect(s.weightDiff).toBeNull();
  });

  it("день рахується заповненим, якщо в ньому є хоч щось", () => {
    const s = weekStats(
      [day("2026-08-10", { comment: "втомилась" }), day("2026-08-11"), day("2026-08-12", { sport: "зал" })],
      [],
    );
    expect(s.daysLogged).toBe(2);
  });
});

describe("sessionsSummary", () => {
  it("порожньо → нульова статистика", () => {
    expect(sessionsSummary([])).toEqual({ sessions: 0, tonnage: 0 });
  });

  it("рахує сесії і сумарний тоннаж; власна вага = повтори", () => {
    const s = sessionsSummary([
      { sets: [{ weight: 40, reps: 10 }, { weight: null, reps: 12 }] }, // 412
      { sets: [{ weight: 60, reps: 5 }] }, // 300
    ]);
    expect(s).toEqual({ sessions: 2, tonnage: 712 });
  });
});
