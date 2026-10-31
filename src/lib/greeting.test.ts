import { describe, expect, it } from "vitest";
import { dayPeriod, greetingFor, GREETINGS } from "./greeting";

describe("dayPeriod", () => {
  it("ранок з 5:00 до 11:59", () => {
    expect(dayPeriod(5)).toBe("morning");
    expect(dayPeriod(11)).toBe("morning");
  });

  it("день з 12:00 до 17:59", () => {
    expect(dayPeriod(12)).toBe("day");
    expect(dayPeriod(17)).toBe("day");
  });

  it("вечір з 18:00 до 22:59", () => {
    expect(dayPeriod(18)).toBe("evening");
    expect(dayPeriod(22)).toBe("evening");
  });

  it("ніч з 23:00 до 4:59", () => {
    expect(dayPeriod(23)).toBe("night");
    expect(dayPeriod(0)).toBe("night");
    expect(dayPeriod(4)).toBe("night");
  });
});

describe("greetingFor", () => {
  it("бере заголовок і позу Орі з періоду", () => {
    const g = greetingFor(8, 1);
    expect(g.title).toBe(GREETINGS.morning.title);
    expect(g.pose).toBe(GREETINGS.morning.pose);
  });

  it("підзаголовок стабільний протягом дня", () => {
    expect(greetingFor(19, 14).line).toBe(greetingFor(22, 14).line);
  });

  it("підзаголовок змінюється від дня до дня", () => {
    const lines = new Set(
      Array.from({ length: GREETINGS.day.lines.length }, (_, i) => greetingFor(13, i + 1).line),
    );
    expect(lines.size).toBe(GREETINGS.day.lines.length);
  });

  it("кожен період має хоча б один підзаголовок", () => {
    for (const p of Object.values(GREETINGS)) expect(p.lines.length).toBeGreaterThan(0);
  });
});
