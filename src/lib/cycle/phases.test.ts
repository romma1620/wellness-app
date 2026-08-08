import { describe, expect, it } from "vitest";
import {
  bandsForSeries,
  buildPhaseRanges,
  clampRanges,
  phaseAt,
  phaseRangesFor,
} from "@/lib/cycle/phases";
import { predict } from "@/lib/cycle/predict";
import { buildMonth, cycleMarks, monthGrid } from "@/lib/cycle/calendar";
import type { Cycle, CycleEntry } from "@/lib/cycle/types";
import { addDays } from "@/lib/utils";

describe("phaseRangesFor", () => {
  const ranges = phaseRangesFor("2026-08-01", 5, "2026-08-29"); // цикл 28 днів

  it("покриває цикл без дірок і перетинів", () => {
    expect(ranges[0].start).toBe("2026-08-01");
    expect(ranges[ranges.length - 1].end).toBe("2026-08-28");
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start > ranges[i - 1].end).toBe(true);
    }
  });

  it("менструація — перші periodLength днів", () => {
    expect(ranges[0]).toEqual({ phase: "menstrual", start: "2026-08-01", end: "2026-08-05" });
  });

  it("овуляція центрована на старті наступного циклу − 14", () => {
    const ovu = ranges.find((r) => r.phase === "ovulation")!;
    expect(ovu).toEqual({ phase: "ovulation", start: "2026-08-14", end: "2026-08-16" });
  });

  it("ПМС — останні 5 днів циклу", () => {
    const pms = ranges.find((r) => r.phase === "late_luteal")!;
    expect(pms).toEqual({ phase: "late_luteal", start: "2026-08-24", end: "2026-08-28" });
  });

  it("короткий цикл зʼїдає середні фази, а не дає перевернуті діапазони", () => {
    const short = phaseRangesFor("2026-08-01", 6, "2026-08-11"); // цикл 10 днів
    for (const r of short) expect(r.start <= r.end).toBe(true);
    expect(short.some((r) => r.phase === "menstrual")).toBe(true);
    expect(short.find((r) => r.phase === "menstrual")!.end).toBe("2026-08-06");
  });

  it("цикл нульової довжини не дає діапазонів", () => {
    expect(phaseRangesFor("2026-08-01", 5, "2026-08-01")).toEqual([]);
  });
});

describe("buildPhaseRanges", () => {
  const cycles: Cycle[] = [
    { start: "2026-06-01", end: "2026-06-28", periodLength: 5, length: 28 },
    { start: "2026-06-29", end: "2026-07-26", periodLength: 5, length: 28 },
    { start: "2026-07-27", end: null, periodLength: 5, length: null },
  ];

  it("для поточного циклу межею служить прогноз", () => {
    const p = predict(cycles, { typical_cycle_length: 28, typical_period_length: 5 }, "2026-08-08")!;
    const ranges = buildPhaseRanges(cycles, p, "2026-08-08");
    expect(phaseAt("2026-08-08", ranges)).toBe("follicular"); // день 13
    expect(phaseAt("2026-07-27", ranges)).toBe("menstrual");
    expect(phaseAt("2026-08-20", ranges)).toBe("late_luteal");
  });

  it("при затримці сьогодні все одно має фазу", () => {
    const late = "2026-09-15"; // далеко за прогнозованим стартом 2026-08-24
    const p = predict(cycles, { typical_cycle_length: 28, typical_period_length: 5 }, late)!;
    expect(p.overdue).toBe(true);
    const ranges = buildPhaseRanges(cycles, p, late);
    expect(phaseAt(late, ranges)).not.toBeNull();
  });

  it("без прогнозу поточний цикл фаз не отримує", () => {
    const ranges = buildPhaseRanges(cycles, null, "2026-08-08");
    expect(phaseAt("2026-08-08", ranges)).toBeNull();
    expect(phaseAt("2026-06-02", ranges)).toBe("menstrual");
  });

  it("clampRanges обрізає по вікну і викидає порожні перетини", () => {
    const p = predict(cycles, { typical_cycle_length: 28, typical_period_length: 5 }, "2026-08-08")!;
    const clamped = clampRanges(buildPhaseRanges(cycles, p, "2026-08-08"), "2026-08-01", "2026-08-10");
    expect(clamped.every((r) => r.start >= "2026-08-01" && r.end <= "2026-08-10")).toBe(true);
    expect(clamped.length).toBeGreaterThan(0);
  });
});

describe("календар", () => {
  it("сітка починається з понеділка і має 42 дні", () => {
    const grid = monthGrid("2026-08-01"); // 1 серпня 2026 — субота
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-07-27"); // понеділок
    expect(grid).toContain("2026-08-01");
    expect(grid[41]).toBe("2026-09-06");
  });

  it("позначки: овуляція один день на цикл, фертильних 7", () => {
    const cycles: Cycle[] = [{ start: "2026-08-01", end: "2026-08-28", periodLength: 5, length: 28 }];
    const marks = cycleMarks(cycles, null);
    expect([...marks.ovulation]).toEqual(["2026-08-15"]);
    expect(marks.fertile.size).toBe(7);
    expect(marks.fertile.has("2026-08-10")).toBe(true);
    expect(marks.fertile.has("2026-08-16")).toBe(true);
    expect(marks.predictedPeriod.size).toBe(0);
  });

  it("факт кровотечі перекриває прогноз", () => {
    const cycles: Cycle[] = [{ start: "2026-08-01", end: null, periodLength: 3, length: null }];
    const p = predict(cycles, { typical_cycle_length: 28, typical_period_length: 5 }, "2026-08-29")!;
    expect(p.nextStart).toBe("2026-08-29");

    const entries = new Map<string, CycleEntry>([
      ["2026-08-29", { flow: "medium" } as CycleEntry],
    ]);
    const days = buildMonth("2026-08-01", entries, cycleMarks(cycles, p), "2026-08-29", true);
    const d29 = days.find((d) => d.date === "2026-08-29")!;
    expect(d29.mark).toBe("flow");
    expect(d29.today).toBe(true);

    const d30 = days.find((d) => d.date === "2026-08-30")!;
    expect(d30.mark).toBe("predicted");
    expect(d30.future).toBe(true);
  });

  it("фертильний тінт можна вимкнути в налаштуваннях", () => {
    const cycles: Cycle[] = [{ start: "2026-08-01", end: "2026-08-28", periodLength: 5, length: 28 }];
    const marks = cycleMarks(cycles, null);
    const on = buildMonth("2026-08-01", new Map(), marks, "2026-08-20", true);
    const off = buildMonth("2026-08-01", new Map(), marks, "2026-08-20", false);
    expect(on.filter((d) => d.mark === "fertile").length).toBeGreaterThan(0);
    expect(off.filter((d) => d.mark === "fertile").length).toBe(0);
    // овуляція — не фертильний тінт, її вимикач не чіпає
    expect(off.filter((d) => d.mark === "ovulation").length).toBe(1);
  });

  it("дні сусідніх місяців позначені outside", () => {
    const days = buildMonth("2026-08-01", new Map(), cycleMarks([], null), "2026-08-08", true);
    expect(days.find((d) => d.date === "2026-07-27")!.outside).toBe(true);
    expect(days.find((d) => d.date === "2026-08-01")!.outside).toBe(false);
  });
});

describe("bandsForSeries", () => {
  const ranges = phaseRangesFor("2026-08-01", 5, "2026-08-29");

  function series(from: string, count: number) {
    return Array.from({ length: count }, (_, i) => {
      const date = addDays(from, i);
      return { date, label: String(Number(date.slice(8))) };
    });
  }

  it("склеює сусідні точки однієї фази в одну смугу", () => {
    const bands = bandsForSeries(series("2026-08-01", 10), ranges);
    expect(bands).toEqual([
      { phase: "menstrual", x1: "1", x2: "5" },
      { phase: "follicular", x1: "6", x2: "10" },
    ]);
  });

  it("точки без фази не потрапляють у смуги", () => {
    const bands = bandsForSeries(
      [{ date: "2025-01-01", label: "поза" }, ...series("2026-08-01", 3)],
      ranges,
    );
    expect(bands).toEqual([{ phase: "menstrual", x1: "1", x2: "3" }]);
    expect(bands[0].x1).not.toBe("поза");
  });

  it("менструації двох циклів — дві смуги, а не одна", () => {
    const twoCycles = [
      ...phaseRangesFor("2026-08-01", 5, "2026-08-29"),
      ...phaseRangesFor("2026-08-29", 5, "2026-09-26"),
    ];
    const bands = bandsForSeries(
      [
        { date: "2026-08-02", label: "a" },
        { date: "2026-08-30", label: "b" },
      ],
      twoCycles,
    );
    expect(bands).toEqual([
      { phase: "menstrual", x1: "a", x2: "a" },
      { phase: "menstrual", x1: "b", x2: "b" },
    ]);
  });

  it("порожня серія дає порожні смуги", () => {
    expect(bandsForSeries([], ranges)).toEqual([]);
  });
});
