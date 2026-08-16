import { describe, expect, it } from "vitest";
import {
  analyzePair,
  buildWeekAggs,
  deltaWeightPoints,
  pearson,
  strengthOf,
  tonnagePoints,
  type DayInput,
  type PairPoint,
  type PairThresholds,
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

/** Точки з масиву [x, y]. */
function pts(pairs: [number, number][]): PairPoint[] {
  return pairs.map(([x, y], i) => ({ weekStart: `w${i}`, x, y }));
}

const ABS: PairThresholds = { minXContrast: 100, minYDiff: 0.2, yDiffMode: "absolute" };
const REL: PairThresholds = { minXContrast: 5, minYDiff: 0.12, yDiffMode: "relative" };

describe("analyzePair", () => {
  it("менше MIN_WEEKS точок — collecting із прогресом", () => {
    const a = analyzePair(
      pts(Array.from({ length: 7 }, (_, i): [number, number] => [1000 + i, 0])),
      ABS,
    );
    expect(a).toEqual({ state: "collecting", n: 7, needed: 8 });
  });

  it("однакові X — no-contrast", () => {
    const a = analyzePair(
      pts([[1500, -0.5], [1500, 0.1], [1500, -0.2], [1500, 0.3], [1500, -0.4], [1500, 0], [1500, 0.2], [1500, -0.1]]),
      ABS,
    );
    expect(a.state).toBe("no-contrast");
  });

  it("різниця Y нижче порога — no-link", () => {
    const a = analyzePair(
      pts([[1000, -0.1], [1100, -0.1], [1200, -0.1], [1300, -0.1], [1900, 0], [2000, 0], [2100, 0], [2200, 0]]),
      ABS,
    );
    expect(a.state).toBe("no-link");
    if (a.state === "no-link") expect(a.r).not.toBeNull();
  });

  it("значуща різниця — link із групами й медіаною", () => {
    const a = analyzePair(
      pts([[1000, -0.4], [1100, -0.4], [1200, -0.4], [1300, -0.4], [1900, 0.1], [2000, 0.1], [2100, 0.1], [2200, 0.1]]),
      ABS,
    );
    expect(a.state).toBe("link");
    if (a.state === "link") {
      expect(a.lowX).toBeCloseTo(1150);
      expect(a.highX).toBeCloseTo(2050);
      expect(a.lowY).toBeCloseTo(-0.4);
      expect(a.highY).toBeCloseTo(0.1);
      expect(a.diff).toBeCloseTo(0.5);
      expect(a.medianX).toBeCloseTo(1600); // між 1300 і 1900
      expect(a.n).toBe(8);
    }
  });

  it("поріг включно: різниця рівно 0.2 — link", () => {
    const a = analyzePair(
      pts([[1000, -0.2], [1100, -0.2], [1200, -0.2], [1300, -0.2], [1900, 0], [2000, 0], [2100, 0], [2200, 0]]),
      ABS,
    );
    expect(a.state).toBe("link");
  });

  it("непарна кількість: середня точка відкидається з обох груп", () => {
    const a = analyzePair(
      pts([[1, 0], [2, 0], [3, 0], [4, 0], [5, 100], [6, 1], [7, 1], [8, 1], [9, 1]]),
      { minXContrast: 1, minYDiff: 0.2, yDiffMode: "absolute" },
    );
    expect(a.state).toBe("link");
    if (a.state === "link") {
      expect(a.lowY).toBeCloseTo(0);
      expect(a.highY).toBeCloseTo(1);
      expect(a.medianX).toBeCloseTo(5); // між 4 і 6
    }
  });

  it("relative: симетрична різниця вище порога — link", () => {
    const a = analyzePair(
      pts([[70, 100], [72, 100], [74, 100], [76, 100], [90, 115], [92, 115], [94, 115], [96, 115]]),
      REL,
    ); // 15 / 107.5 ≈ 0.14
    expect(a.state).toBe("link");
  });

  it("relative: різниця нижче порога — no-link", () => {
    const a = analyzePair(
      pts([[70, 100], [72, 100], [74, 100], [76, 100], [90, 110], [92, 110], [94, 110], [96, 110]]),
      REL,
    ); // 10 / 105 ≈ 0.095
    expect(a.state).toBe("no-link");
  });

  it("relative: обидві групи нульові — no-link, а не ділення на нуль", () => {
    const a = analyzePair(
      pts([[70, 0], [72, 0], [74, 0], [76, 0], [90, 0], [92, 0], [94, 0], [96, 0]]),
      REL,
    );
    expect(a.state).toBe("no-link");
  });
});

describe("pearson", () => {
  it("ідеальна пряма — 1", () => {
    expect(pearson(pts([[1, 1], [2, 2], [3, 3]]))).toBeCloseTo(1);
  });

  it("ідеальна обернена — −1", () => {
    expect(pearson(pts([[1, 3], [2, 2], [3, 1]]))).toBeCloseTo(-1);
  });

  it("вироджена дисперсія — null", () => {
    expect(pearson(pts([[1, 5], [2, 5], [3, 5]]))).toBeNull(); // y стала
    expect(pearson(pts([[2, 1], [2, 2], [2, 3]]))).toBeNull(); // x стала
  });

  it("менше 3 точок — null", () => {
    expect(pearson(pts([[1, 1], [2, 2]]))).toBeNull();
  });
});

describe("strengthOf", () => {
  it("шкала |r|: <0.3 слабкий, до 0.6 помітний, вище — сильний", () => {
    expect(strengthOf(0.29)).toBe("weak");
    expect(strengthOf(-0.3)).toBe("notable");
    expect(strengthOf(0.6)).toBe("notable");
    expect(strengthOf(-0.7)).toBe("strong");
  });
});
