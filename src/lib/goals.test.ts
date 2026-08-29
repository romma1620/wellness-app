import { describe, expect, it } from "vitest";
import { dailyGoals, goalFraction, goalSub, stepWater, WATER_MAX } from "./goals";
import type { Profile } from "./types";

function profile(patch: Partial<Profile>): Profile {
  return {
    id: "u",
    name: null,
    avatar_url: null,
    height: null,
    target_weight: null,
    kcal_goal: null,
    steps_goal: null,
    water_goal: null,
    theme: "peach",
    created_at: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("dailyGoals", () => {
  it("читає цілі з профілю", () => {
    const g = dailyGoals(profile({ kcal_goal: 1900, steps_goal: 12000, water_goal: 10 }));
    expect(g).toEqual({ kcal: 1900, steps: 12000, water: 10 });
  });

  it("порожній профіль — усі цілі не задані", () => {
    expect(dailyGoals(null)).toEqual({ kcal: null, steps: null, water: null });
  });

  it("нуль і відʼємні — це «не задано», а не ціль", () => {
    const g = dailyGoals(profile({ kcal_goal: 0, steps_goal: -5, water_goal: 8 }));
    expect(g).toEqual({ kcal: null, steps: null, water: 8 });
  });

  it("дробове округлюється", () => {
    expect(dailyGoals(profile({ steps_goal: 9999.6 })).steps).toBe(10000);
  });
});

describe("goalFraction", () => {
  it("частка виконання", () => {
    expect(goalFraction(5, 8)).toBeCloseTo(0.625, 5);
  });

  it("без цілі або без показника — нуль", () => {
    expect(goalFraction(1640, null)).toBe(0);
    expect(goalFraction(null, 1900)).toBe(0);
  });

  it("понад ціль не обрізається — обрізає кільце", () => {
    expect(goalFraction(11, 8)).toBeCloseTo(1.375, 5);
  });
});

describe("goalSub", () => {
  it("ціль форматується як число", () => {
    expect(goalSub(10000)).toBe(`ціль ${(10000).toLocaleString("uk-UA")}`);
  });

  it("без цілі — запрошення її задати", () => {
    expect(goalSub(null)).toBe("задай ціль");
  });
});

describe("stepWater", () => {
  it("додає і віднімає склянку", () => {
    expect(stepWater(5, 1)).toBe(6);
    expect(stepWater(5, -1)).toBe(4);
  });

  it("порожній день рахується за нуль", () => {
    expect(stepWater(null, 1)).toBe(1);
    expect(stepWater(null, -1)).toBe(0);
  });

  it("нижче нуля не йде — саме тут ламався старий цикл по колу", () => {
    expect(stepWater(0, -1)).toBe(0);
  });

  it("вище стелі не йде, але ціль перевищувати можна", () => {
    expect(stepWater(WATER_MAX, 1)).toBe(WATER_MAX);
    expect(stepWater(8, 1)).toBe(9);
  });
});
