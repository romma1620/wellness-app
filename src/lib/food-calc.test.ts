import { describe, expect, it } from "vitest";
import { calcFood, type FoodCalcInput } from "./food-calc";

function input(patch: Partial<FoodCalcInput>): FoodCalcInput {
  return { raw: null, portions: [], presetRatio: null, ...patch };
}

describe("calcFood", () => {
  it("розкладає сиру вагу пропорційно готовим порціям", () => {
    const r = calcFood(input({ raw: 800, portions: [320, 240, 260] }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.estimated).toBe(false);
    expect(r.portionsCooked).toBe(820);
    expect(r.portions.map((p) => Math.round(p.raw))).toEqual([312, 234, 254]);
    expect(r.portionsRaw).toBeCloseTo(800);
  });

  it("рахує коефіцієнт готове / сире", () => {
    // 100 г сухого рису → 300 г готового
    const r = calcFood(input({ raw: 100, portions: [150, 150] }));
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.ratio).toBeCloseTo(3);
    expect(r.portions.map((p) => p.raw)).toEqual([50, 50]);
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

  it("порожньо без порцій або без сирої ваги й коефіцієнта", () => {
    expect(calcFood(input({ portions: [140] })).status).toBe("empty");
    expect(calcFood(input({ raw: 500 })).status).toBe("empty");
    expect(calcFood(input({ raw: 500, portions: [null, null] })).status).toBe("empty");
  });
});
