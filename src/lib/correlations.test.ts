import { describe, expect, it } from "vitest";
import {
  buildWeekAggs,
  deltaWeightPoints,
  tonnagePoints,
  type DayInput,
  type WeekAgg,
} from "@/lib/correlations";
import { weekBuckets } from "@/lib/utils";

/** Порожній день щоденника з перекриттям потрібних полів. */
function day(date: string, over: Partial<DayInput> = {}): DayInput {
  return { date, weight: null, kcal: null, steps: null, protein: null, ...over };
}

/** Порожній тиждень-агрегат з перекриттям. */
function agg(start: string, over: Partial<WeekAgg> = {}): WeekAgg {
  return { start, kcal: null, steps: null, protein: null, weight: null, tonnage: 0, ...over };
}

describe("buildWeekAggs", () => {
  // 2026-08-03 — понеділок; два повні тижні: 03–09 і 10–16.
  const weeks = weekBuckets("2026-08-03", "2026-08-16");

  const days = [
    day("2026-08-03", { kcal: 2000, weight: 62, steps: 8000 }),
    day("2026-08-04", { kcal: 1800, steps: 6000 }),
    day("2026-08-05", { kcal: 1900, weight: 61, steps: 7000 }),
    day("2026-08-06", { kcal: 1700 }),
    day("2026-08-07", { weight: 60 }),
  ];

  it("середнє метрики при ≥4 заповнених днях", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.kcal).toBeCloseTo(1850);
  });

  it("метрика з <4 днями — null", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.steps).toBeNull(); // лише 3 дні з кроками
    expect(w1.protein).toBeNull(); // жодного дня
  });

  it("вага валідна вже з 3 зважувань", () => {
    const [w1] = buildWeekAggs(days, new Map(), weeks);
    expect(w1.weight).toBeCloseTo(61);
  });

  it("вага з 2 зважувань — null", () => {
    const two = [day("2026-08-03", { weight: 62 }), day("2026-08-05", { weight: 61 })];
    const [w1] = buildWeekAggs(two, new Map(), weeks);
    expect(w1.weight).toBeNull();
  });

  it("тоннаж — сума по днях тижня, 0 без тренувань", () => {
    const tonnage = new Map([
      ["2026-08-03", 1000],
      ["2026-08-05", 500],
    ]);
    const [w1, w2] = buildWeekAggs(days, tonnage, weeks);
    expect(w1.tonnage).toBe(1500);
    expect(w2.tonnage).toBe(0);
  });

  it("тиждень без жодного запису — всі метрики null, тоннаж 0", () => {
    const [, w2] = buildWeekAggs(days, new Map(), weeks);
    expect(w2).toEqual(agg("2026-08-10"));
  });
});

describe("deltaWeightPoints", () => {
  it("y = вага наступного тижня мінус поточного; x — драйвер поточного", () => {
    const aggs = [
      agg("w1", { kcal: 2000, weight: 62 }),
      agg("w2", { kcal: 1800, weight: 61.5 }),
      agg("w3", { kcal: 1700, weight: 61 }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([
      { weekStart: "w1", x: 2000, y: -0.5 },
      { weekStart: "w2", x: 1800, y: -0.5 },
    ]);
  });

  it("пара випадає, якщо драйвер невалідний", () => {
    const aggs = [
      agg("w1", { kcal: null, weight: 62 }),
      agg("w2", { kcal: 1800, weight: 61 }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([]);
  });

  it("пара випадає, якщо вага невалідна в будь-якому з двох тижнів", () => {
    const aggs = [
      agg("w1", { kcal: 2000, weight: null }),
      agg("w2", { kcal: 1800, weight: 61 }),
      agg("w3", { kcal: 1700, weight: null }),
    ];
    expect(deltaWeightPoints(aggs, "kcal")).toEqual([]);
  });

  it("працює для кроків тим самим шляхом", () => {
    const aggs = [
      agg("w1", { steps: 8000, weight: 62 }),
      agg("w2", { steps: 5000, weight: 61.4 }),
    ];
    expect(deltaWeightPoints(aggs, "steps")).toEqual([
      { weekStart: "w1", x: 8000, y: expect.closeTo(-0.6) },
    ]);
  });
});

describe("tonnagePoints", () => {
  it("той самий тиждень, без зсуву; нульовий тоннаж — справжня точка", () => {
    const aggs = [
      agg("w1", { protein: 90, tonnage: 1200 }),
      agg("w2", { protein: null, tonnage: 800 }),
      agg("w3", { protein: 70, tonnage: 0 }),
    ];
    expect(tonnagePoints(aggs)).toEqual([
      { weekStart: "w1", x: 90, y: 1200 },
      { weekStart: "w3", x: 70, y: 0 },
    ]);
  });
});
