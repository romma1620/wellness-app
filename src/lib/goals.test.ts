import { describe, expect, it } from "vitest";
import {
  dailyGoals,
  goalFraction,
  goalSub,
  WATER_DROPS_DEFAULT,
  WATER_MAX,
  waterRow,
} from "./goals";
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

describe("waterRow", () => {
  it("крапель стільки, скільки склянок у цілі", () => {
    expect(waterRow(6, 8)).toEqual({ slots: 8, filled: 6, over: 0 });
    expect(waterRow(6, 10)).toEqual({ slots: 10, filled: 6, over: 0 });
  });

  it("без цілі — вісім крапель за замовчуванням", () => {
    expect(waterRow(3, null)).toEqual({ slots: WATER_DROPS_DEFAULT, filled: 3, over: 0 });
  });

  it("порожній день — жодної налитої", () => {
    expect(waterRow(null, 8)).toEqual({ slots: 8, filled: 0, over: 0 });
  });

  it("понад ціль ряд не подовжує — надлишок іде в over", () => {
    expect(waterRow(10, 8)).toEqual({ slots: 8, filled: 8, over: 2 });
  });

  it("стеля склянок та сама, що в БД", () => {
    expect(waterRow(999, 8)).toEqual({ slots: 8, filled: 8, over: WATER_MAX - 8 });
    expect(waterRow(5, 999).slots).toBe(WATER_MAX);
  });

  it("ряд ніколи не порожній, навіть на нульовій цілі", () => {
    expect(waterRow(0, 0).slots).toBe(1);
  });
});
