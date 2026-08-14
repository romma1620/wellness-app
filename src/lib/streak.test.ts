import { describe, expect, it } from "vitest";
import { currentStreak } from "./streak";

const TODAY = "2026-08-15";

describe("currentStreak", () => {
  it("порожня історія → 0", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it("рахує послідовні дні, що закінчуються сьогодні", () => {
    expect(currentStreak(["2026-08-13", "2026-08-14", "2026-08-15"], TODAY)).toBe(3);
  });

  it("сьогодні ще не заповнено — стрік від учора не згорає", () => {
    expect(currentStreak(["2026-08-12", "2026-08-13", "2026-08-14"], TODAY)).toBe(3);
  });

  it("останній запис позавчора → стрік обірвався", () => {
    expect(currentStreak(["2026-08-12", "2026-08-13"], TODAY)).toBe(0);
  });

  it("розрив усередині зупиняє лічбу", () => {
    expect(currentStreak(["2026-08-10", "2026-08-11", "2026-08-13", "2026-08-14", "2026-08-15"], TODAY)).toBe(3);
  });

  it("порядок і дублікати дат не мають значення", () => {
    expect(currentStreak(["2026-08-15", "2026-08-14", "2026-08-14"], TODAY)).toBe(2);
  });

  it("єдиний запис сьогодні → 1", () => {
    expect(currentStreak(["2026-08-15"], TODAY)).toBe(1);
  });
});
