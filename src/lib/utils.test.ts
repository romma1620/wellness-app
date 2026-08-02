import { describe, expect, it } from "vitest";
import { monthEnd, monthLabel, plural, splitTags, weekdayShort } from "./utils";

describe("splitTags", () => {
  it("розбиває рядок по комах і обрізає пробіли", () => {
    expect(splitTags(" Скраб , Крем ")).toEqual(["Скраб", "Крем"]);
  });

  it("порожні значення дають порожній масив", () => {
    expect(splitTags(null)).toEqual([]);
    expect(splitTags(undefined)).toEqual([]);
    expect(splitTags("")).toEqual([]);
    expect(splitTags(" , ")).toEqual([]);
  });
});

describe("monthLabel", () => {
  it("ISO-місяць → назва в називному + рік", () => {
    expect(monthLabel("2026-08-01")).toBe("Серпень 2026");
  });
  it("працює для будь-якого дня місяця", () => {
    expect(monthLabel("2026-01-31")).toBe("Січень 2026");
  });
});

describe("monthEnd", () => {
  it("останній день 31-денного місяця", () => {
    expect(monthEnd("2026-08-01")).toBe("2026-08-31");
  });
  it("останній день лютого невисокосного року", () => {
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
  });
  it("високосний лютий", () => {
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("weekdayShort", () => {
  it("неділя", () => {
    expect(weekdayShort("2026-08-02")).toBe("нд");
  });
  it("пʼятниця", () => {
    expect(weekdayShort("2026-07-31")).toBe("пт");
  });
});

describe("plural", () => {
  const f = (n: number) => plural(n, "сесія", "сесії", "сесій");
  it("одна", () => expect(f(1)).toBe("сесія"));
  it("дві-чотири", () => {
    expect(f(2)).toBe("сесії");
    expect(f(4)).toBe("сесії");
  });
  it("пʼять і більше", () => expect(f(5)).toBe("сесій"));
  it("11–14 — виняток", () => {
    expect(f(11)).toBe("сесій");
    expect(f(12)).toBe("сесій");
    expect(f(14)).toBe("сесій");
  });
  it("складені числа беруть останню цифру", () => {
    expect(f(21)).toBe("сесія");
    expect(f(22)).toBe("сесії");
    expect(f(25)).toBe("сесій");
  });
  it("нуль", () => expect(f(0)).toBe("сесій"));
});
