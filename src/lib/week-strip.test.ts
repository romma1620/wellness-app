import { describe, expect, it } from "vitest";
import {
  stripWeeks,
  weekSpanLabel,
  weeksBetween,
  weeksToCover,
  weekStartOf,
  WEEKS_CHUNK,
} from "./week-strip";

describe("weekStartOf", () => {
  it("понеділок лишається собою", () => {
    expect(weekStartOf("2026-11-02")).toBe("2026-11-02");
  });

  it("неділя належить тижню, що почався в понеділок перед нею", () => {
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-01")).toBe("2026-10-26");
  });
});

describe("weeksBetween", () => {
  it("той самий тиждень — 0", () => {
    expect(weeksBetween("2026-11-02", "2026-11-08")).toBe(0);
  });

  it("рахує тижні, а не дні", () => {
    expect(weeksBetween("2026-11-01", "2026-11-02")).toBe(1);
    expect(weeksBetween("2026-10-01", "2026-11-02")).toBe(5);
  });

  it("переживає перехід на зимовий час", () => {
    // 25.10.2026 у Європі годинник іде назад — доба довша за 24 год
    expect(weeksBetween("2026-10-19", "2026-11-02")).toBe(2);
  });
});

describe("stripWeeks", () => {
  it("від найстаршого до поточного тижня, без майбутніх", () => {
    expect(stripWeeks("2026-11-04", 3)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
  });

  it("щонайменше один тиждень", () => {
    expect(stripWeeks("2026-11-04", 0)).toEqual(["2026-11-02"]);
  });
});

describe("weeksToCover", () => {
  it("не чіпає кількість, якщо дата вже в стрічці", () => {
    expect(weeksToCover(12, "2026-10-01", "2026-11-02")).toBe(12);
  });

  it("добудовує цілими шматками до тижня вибраної дати", () => {
    const n = weeksToCover(12, "2026-01-01", "2026-11-02");
    expect(n % WEEKS_CHUNK).toBe(0);
    expect(stripWeeks("2026-11-02", n)[0] <= weekStartOf("2026-01-01")).toBe(true);
  });

  it("ніколи не зменшує", () => {
    expect(weeksToCover(48, "2026-11-02", "2026-11-02")).toBe(48);
  });
});

describe("weekSpanLabel", () => {
  it("один місяць", () => {
    expect(weekSpanLabel("2026-11-02")).toBe("Листопад 2026");
  });

  it("тиждень на стику місяців", () => {
    expect(weekSpanLabel("2026-10-26")).toBe("Жовтень – Листопад 2026");
  });

  it("тиждень на стику років", () => {
    expect(weekSpanLabel("2026-12-28")).toBe("Грудень 2026 – Січень 2027");
  });
});
