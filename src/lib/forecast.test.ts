import { describe, expect, it } from "vitest";
import { addDays } from "./utils";
import { etaTo, weightTrend, type WeightRow } from "./forecast";

const TODAY = "2026-08-15";

/** n щоденних записів, що закінчуються вчора; вага падає на lossPerDay щодня. */
function dailyRows(n: number, startWeight: number, lossPerDay: number): WeightRow[] {
  return Array.from({ length: n }, (_, i) => {
    const daysAgo = n - i; // найстаріший перший, останній — учора
    return {
      date: addDays(TODAY, -daysAgo),
      weight: startWeight - lossPerDay * (n - daysAgo),
    };
  });
}

describe("weightTrend", () => {
  it("рівномірне схуднення дає нахил у кг/день і рівень на сьогодні", () => {
    const rows = dailyRows(21, 70, 0.1);
    const trend = weightTrend(rows, TODAY);
    expect(trend).not.toBeNull();
    expect(trend!.slope).toBeCloseTo(-0.1, 5);
    // регресія екстраполює на сьогодні: вчора було 68,0 → сьогодні 67,9
    expect(trend!.level).toBeCloseTo(67.9, 5);
    expect(trend!.n).toBe(21);
  });

  it("замало точок → null", () => {
    expect(weightTrend(dailyRows(7, 70, 0.1), TODAY)).toBeNull();
  });

  it("точки з вагою null не рахуються", () => {
    const rows = dailyRows(7, 70, 0.1);
    rows.push({ date: addDays(TODAY, -30), weight: null });
    expect(weightTrend(rows, TODAY)).toBeNull();
  });

  it("закороткий діапазон дат → null, навіть якщо точок достатньо", () => {
    // 10 точок за 10 днів — менше за мінімальні 14 днів охоплення
    expect(weightTrend(dailyRows(10, 70, 0.1), TODAY)).toBeNull();
  });

  it("пропуски днів не заважають: точки раз на 3 дні", () => {
    const rows: WeightRow[] = Array.from({ length: 8 }, (_, i) => ({
      date: addDays(TODAY, -(8 - i) * 3),
      weight: 70 - 0.3 * i,
    }));
    const trend = weightTrend(rows, TODAY);
    expect(trend).not.toBeNull();
    expect(trend!.slope).toBeCloseTo(-0.1, 5);
  });

  it("записи, старші за вікно, ігноруються", () => {
    // усередині вікна — лише 5 точок, решта далеко в минулому
    const recent = dailyRows(5, 70, 0.1);
    const old = Array.from({ length: 20 }, (_, i) => ({
      date: addDays(TODAY, -100 - i),
      weight: 80,
    }));
    expect(weightTrend([...old, ...recent], TODAY)).toBeNull();
  });
});

describe("etaTo", () => {
  const trend = { slope: -0.1, level: 70, n: 21 };

  it("рахує дні та дату досягнення цілі", () => {
    const eta = etaTo(trend, 68, TODAY);
    expect(eta).not.toBeNull();
    expect(eta!.days).toBe(20);
    expect(eta!.date).toBe(addDays(TODAY, 20));
  });

  it("дробові дні округлюються вгору", () => {
    const eta = etaTo({ ...trend, slope: -0.3 }, 69, TODAY);
    expect(eta!.days).toBe(4); // 1 / 0.3 = 3.33 → 4
  });

  it("ціль уже досягнута → 0 днів", () => {
    const eta = etaTo(trend, 70.5, TODAY);
    expect(eta).toEqual({ days: 0, date: TODAY });
  });

  it("плоский або висхідний тренд → null", () => {
    expect(etaTo({ ...trend, slope: 0 }, 68, TODAY)).toBeNull();
    expect(etaTo({ ...trend, slope: 0.05 }, 68, TODAY)).toBeNull();
    // мінус 5 г/день — надто повільно, щоб обіцяти дату
    expect(etaTo({ ...trend, slope: -0.005 }, 68, TODAY)).toBeNull();
  });

  it("понад рік до цілі → null", () => {
    expect(etaTo({ ...trend, slope: -0.01 }, 60, TODAY)).toBeNull();
  });
});
