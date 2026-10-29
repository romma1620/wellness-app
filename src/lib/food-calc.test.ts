import { describe, expect, it } from "vitest";
import { calcFood, type FoodCalcInput } from "./food-calc";

function input(patch: Partial<FoodCalcInput>): FoodCalcInput {
  return { raw: null, cookedTotal: null, tare: null, portions: [], presetRatio: null, ...patch };
}

describe("calcFood", () => {
  it("розкладає сиру вагу пропорційно порціям, коли готова вага — їхня сума", () => {
    const r = calcFood(input({ raw: 800, portions: [320, 240, 260] }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.estimated).toBe(false);
    expect(r.cookedTotal).toBe(820);
    expect(r.portions.map((p) => Math.round(p.raw))).toEqual([312, 234, 254]);
    expect(r.portionsRaw).toBeCloseTo(800);
    expect(r.leftoverCooked).toBe(0);
  });

  it("враховує залишок у каструлі та віднімає посуд", () => {
    // 100 г сухого рису → 300 г готового (420 з каструлею 120)
    const r = calcFood(input({ raw: 100, cookedTotal: 420, tare: 120, portions: [150] }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.ratio).toBeCloseTo(3);
    expect(r.portions[0].raw).toBeCloseTo(50);
    expect(r.leftoverCooked).toBe(150);
    expect(r.leftoverRaw).toBeCloseTo(50);
  });

  it("пропускає порожні порції, але зберігає індекси полів", () => {
    const r = calcFood(input({ raw: 200, portions: [null, 100, 0, 100] }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.portions.map((p) => p.index)).toEqual([1, 3]);
    expect(r.portions.map((p) => p.raw)).toEqual([100, 100]);
  });

  it("без сирої ваги рахує орієнтовно за типовим коефіцієнтом", () => {
    const r = calcFood(input({ portions: [140], presetRatio: 0.7 }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.estimated).toBe(true);
    expect(r.portions[0].raw).toBeCloseTo(200);
  });

  it("порожньо, якщо нема ні сирої ваги, ні коефіцієнта", () => {
    expect(calcFood(input({ portions: [140] })).status).toBe("empty");
    expect(calcFood(input({ raw: 500 })).status).toBe("empty");
  });

  it("показує коефіцієнт без порцій, якщо є сира і готова вага", () => {
    const r = calcFood(input({ raw: 500, cookedTotal: 350 }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.ratio).toBeCloseTo(0.7);
    expect(r.leftoverRaw).toBeCloseTo(500);
  });

  it("помилка, якщо порції важчі за всю готову страву", () => {
    expect(calcFood(input({ raw: 500, cookedTotal: 300, portions: [200, 200] })).status).toBe(
      "error",
    );
  });

  it("помилка, якщо посуд важчий за готову вагу", () => {
    expect(calcFood(input({ raw: 500, cookedTotal: 300, tare: 400, portions: [] })).status).toBe(
      "error",
    );
  });
});
