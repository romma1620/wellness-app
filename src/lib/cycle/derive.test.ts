import { describe, expect, it } from "vitest";
import { completedCycles, currentCycle, cycleDayFor, deriveCycles } from "@/lib/cycle/derive";
import type { FlowDay } from "@/lib/cycle/derive";
import type { Flow } from "@/lib/cycle/types";

/** Компактний конструктор днів: run("2026-08-01", "medium", 3). */
function run(start: string, flow: Flow, days: number): FlowDay[] {
  const out: FlowDay[] = [];
  const [y, m, d] = start.split("-").map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(y, m - 1, d + i);
    out.push({
      date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`,
      flow,
    });
  }
  return out;
}

describe("deriveCycles", () => {
  it("групує дні кровотечі з розривом 1 день в одну менструацію", () => {
    const cycles = deriveCycles([
      { date: "2026-08-01", flow: "medium" },
      // 2 серпня пропущено
      { date: "2026-08-03", flow: "light" },
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].start).toBe("2026-08-01");
    expect(cycles[0].periodLength).toBe(3);
  });

  it("розрив 5 днів розділяє на дві менструації", () => {
    const cycles = deriveCycles([
      { date: "2026-08-01", flow: "medium" },
      { date: "2026-08-07", flow: "medium" },
    ]);
    expect(cycles).toHaveLength(2);
    expect(cycles.map((c) => c.start)).toEqual(["2026-08-01", "2026-08-07"]);
  });

  it("ізольовані сліди посеред циклу не створюють новий цикл", () => {
    const cycles = deriveCycles([
      ...run("2026-08-01", "medium", 4),
      { date: "2026-08-14", flow: "spotting" },
      ...run("2026-08-29", "medium", 4),
    ]);
    expect(cycles.map((c) => c.start)).toEqual(["2026-08-01", "2026-08-29"]);
    expect(cycles[0].length).toBe(28);
  });

  it("сліди, що прилягають до менструації, входять у неї і можуть бути днем 1", () => {
    const cycles = deriveCycles([
      { date: "2026-08-01", flow: "spotting" },
      ...run("2026-08-02", "medium", 3),
      { date: "2026-08-05", flow: "spotting" },
    ]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].start).toBe("2026-08-01");
    expect(cycles[0].periodLength).toBe(5);
  });

  it("рахує довжину циклу як відстань між сусідніми стартами", () => {
    const cycles = deriveCycles([
      ...run("2026-06-01", "medium", 5),
      ...run("2026-06-28", "medium", 5),
      ...run("2026-07-27", "medium", 5),
    ]);
    expect(cycles.map((c) => c.length)).toEqual([27, 29, null]);
    expect(cycles[0].end).toBe("2026-06-27");
    expect(cycles[2].end).toBeNull();
  });

  it("ігнорує записи без кровотечі й неупорядкований вхід", () => {
    const cycles = deriveCycles([
      { date: "2026-08-20", flow: null },
      ...run("2026-08-29", "medium", 3),
      { date: "2026-08-05", flow: null },
      ...run("2026-08-01", "heavy", 3),
    ]);
    expect(cycles.map((c) => c.start)).toEqual(["2026-08-01", "2026-08-29"]);
  });

  it("редагування заднім числом перебудовує цикли з тих самих записів", () => {
    const base = [...run("2026-06-01", "medium", 5), ...run("2026-07-01", "medium", 5)];
    expect(deriveCycles(base).map((c) => c.start)).toEqual(["2026-06-01", "2026-07-01"]);

    // юзерка згадала, що менструація почалась на 2 дні раніше
    const fixed = [...run("2026-06-29", "light", 2), ...base];
    const cycles = deriveCycles(fixed);
    expect(cycles.map((c) => c.start)).toEqual(["2026-06-01", "2026-06-29"]);
    expect(cycles[0].length).toBe(28);
    expect(cycles[1].periodLength).toBe(7);
  });

  it("порожній вхід дає порожній результат", () => {
    expect(deriveCycles([])).toEqual([]);
    expect(deriveCycles([{ date: "2026-08-01", flow: "spotting" }])).toEqual([]);
  });
});

describe("completedCycles / currentCycle / cycleDayFor", () => {
  const cycles = deriveCycles([
    ...run("2026-06-01", "medium", 5),
    ...run("2026-06-29", "medium", 5),
  ]);

  it("завершені й поточний розділяються за наявністю length", () => {
    expect(completedCycles(cycles).map((c) => c.start)).toEqual(["2026-06-01"]);
    expect(currentCycle(cycles)?.start).toBe("2026-06-29");
  });

  it("день циклу рахується від старту, 1-based", () => {
    expect(cycleDayFor("2026-06-01", cycles)).toBe(1);
    expect(cycleDayFor("2026-06-28", cycles)).toBe(28);
    expect(cycleDayFor("2026-07-06", cycles)).toBe(8);
    expect(cycleDayFor("2026-05-31", cycles)).toBeNull();
  });
});
