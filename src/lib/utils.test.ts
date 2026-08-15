import { describe, expect, it } from "vitest";
import {
  addMonths,
  monthEnd,
  monthLabel,
  monthStartOf,
  periodLabel,
  periodRange,
  plural,
  precedingRange,
  rangeLabel,
  shortDateAbbr,
  splitTags,
  weekBuckets,
  weekdayShort,
} from "./utils";

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
  it("грудень: день 0 наступного місяця коректно переносить рік", () => {
    expect(monthEnd("2026-12-01")).toBe("2026-12-31");
  });
});

describe("shortDateAbbr", () => {
  it("скорочення місяця відрізняється від повної форми", () => {
    expect(shortDateAbbr("2026-11-12")).toBe("12 лис");
  });
  it("однозначний день без нуля попереду", () => {
    expect(shortDateAbbr("2026-07-05")).toBe("5 лип");
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

describe("monthStartOf / addMonths", () => {
  it("monthStartOf зводить будь-який день до першого числа", () => {
    expect(monthStartOf("2026-08-19")).toBe("2026-08-01");
    expect(monthStartOf("2026-08-01")).toBe("2026-08-01");
  });

  it("addMonths зсуває місяць, лишаючи день", () => {
    expect(addMonths("2026-08-01", 1)).toBe("2026-09-01");
    expect(addMonths("2026-08-15", -2)).toBe("2026-06-15");
  });

  it("день затискається по довжині цільового місяця", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("перехід через рік", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});

describe("periodRange: рік", () => {
  const now = new Date(2026, 7, 15); // 15 серпня 2026

  it("останні 12 місяців, включно з сьогодні", () => {
    const r = periodRange("year", 0, now);
    expect(r.end).toBe("2026-08-15");
    expect(r.start).toBe("2025-08-16");
    expect(r.days).toBe(365);
  });

  it("offset зсуває вікно на 12 місяців назад", () => {
    const r = periodRange("year", 1, now);
    expect(r.end).toBe("2025-08-15");
    expect(r.start).toBe("2024-08-16");
  });
});

describe("periodLabel: рік", () => {
  it("місяці з роками по краях вікна", () => {
    const now = new Date(2026, 7, 15);
    expect(periodLabel("year", 0, now)).toBe("сер 2025 – сер 2026");
  });
});

describe("precedingRange", () => {
  it("попередній відрізок тієї ж довжини впритул до початку", () => {
    const r = precedingRange("2026-08-01", "2026-08-15");
    expect(r).toEqual({ start: "2026-07-17", end: "2026-07-31", days: 15 });
  });

  it("одноденний період", () => {
    const r = precedingRange("2026-08-15", "2026-08-15");
    expect(r).toEqual({ start: "2026-08-14", end: "2026-08-14", days: 1 });
  });
});

describe("rangeLabel", () => {
  it("той самий місяць", () => {
    expect(rangeLabel("2026-07-20", "2026-07-26")).toBe("20–26 лип");
  });

  it("різні місяці одного року", () => {
    expect(rangeLabel("2026-07-28", "2026-08-03")).toBe("28 лип – 3 сер");
  });

  it("різні роки — з роками", () => {
    expect(rangeLabel("2025-12-20", "2026-01-10")).toBe("20 гру 2025 – 10 січ 2026");
  });
});

describe("weekBuckets", () => {
  it("тижні Пн–Нд, краї обрізані по діапазону", () => {
    // 2026-08-05 — середа, 2026-08-18 — вівторок
    const buckets = weekBuckets("2026-08-05", "2026-08-18");
    expect(buckets.map((b) => [b.start, b.end])).toEqual([
      ["2026-08-05", "2026-08-09"],
      ["2026-08-10", "2026-08-16"],
      ["2026-08-17", "2026-08-18"],
    ]);
  });

  it("dates містить усі дні кошика", () => {
    const buckets = weekBuckets("2026-08-05", "2026-08-09");
    expect(buckets).toHaveLength(1);
    expect(buckets[0].dates).toEqual([
      "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09",
    ]);
  });

  it("рік розкладається приблизно на 52–53 кошики", () => {
    const buckets = weekBuckets("2025-08-16", "2026-08-15");
    expect(buckets.length).toBeGreaterThanOrEqual(52);
    expect(buckets.length).toBeLessThanOrEqual(54);
    // без дір і перекриттів: кінець кошика + 1 день = початок наступного
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].start > buckets[i - 1].end).toBe(true);
    }
  });
});
