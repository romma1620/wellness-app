import { describe, expect, it } from "vitest";
import { LUTEAL_DAYS, predict } from "@/lib/cycle/predict";
import type { Cycle } from "@/lib/cycle/types";
import { addDays } from "@/lib/utils";

const SETTINGS = { typical_cycle_length: 28, typical_period_length: 5 };

/** Цикли з заданими довжинами, що йдуть один за одним від startISO. */
function chain(startISO: string, lengths: number[]): Cycle[] {
  const out: Cycle[] = [];
  let start = startISO;
  for (const len of lengths) {
    const nextStart = addDays(start, len);
    out.push({ start, end: addDays(nextStart, -1), periodLength: 5, length: len });
    start = nextStart;
  }
  // останній — поточний, ще без кінця
  out.push({ start, end: null, periodLength: 5, length: null });
  return out;
}

describe("predict", () => {
  it("без стартів менструації прогнозу немає", () => {
    expect(predict([], SETTINGS, "2026-08-08")).toBeNull();
  });

  it("менше двох завершених циклів — бере typical_cycle_length і low confidence", () => {
    const cycles = chain("2026-08-01", []); // лише поточний
    const p = predict(cycles, SETTINGS, "2026-08-08")!;
    expect(p.avgLength).toBe(28);
    expect(p.basedOn).toBe(0);
    expect(p.confidence).toBe("low");
    expect(p.nextStart).toBe("2026-08-29");
    // вікно ніколи не вужче за ±2 дні
    expect(p.windowStart).toBe("2026-08-27");
    expect(p.windowEnd).toBe("2026-08-31");
  });

  it("регулярні цикли дають high confidence і вузьке вікно", () => {
    const p = predict(chain("2026-05-01", [28, 28, 27, 29]), SETTINGS, "2026-08-01")!;
    expect(p.basedOn).toBe(4);
    expect(p.avgLength).toBe(28);
    expect(p.sd).toBeLessThanOrEqual(2);
    expect(p.confidence).toBe("high");
    expect(p.rangeOnly).toBe(false);
  });

  it("великий розкид дає low confidence, широке вікно і заборону на одну дату", () => {
    const p = predict(chain("2026-01-01", [24, 38, 26, 40]), SETTINGS, "2026-06-01")!;
    expect(p.sd).toBeGreaterThan(4);
    expect(p.confidence).toBe("low");
    expect(p.rangeOnly).toBe(true);
    // ±round(sd) днів, тобто помітно ширше за мінімальні ±2
    expect(p.windowStart < addDays(p.nextStart, -4)).toBe(true);
    expect(p.windowEnd > addDays(p.nextStart, 4)).toBe(true);
  });

  it("середній розкид — medium", () => {
    const p = predict(chain("2026-01-01", [26, 30, 27, 31]), SETTINGS, "2026-06-01")!;
    expect(p.sd).toBeGreaterThan(2);
    expect(p.sd).toBeLessThanOrEqual(4);
    expect(p.confidence).toBe("medium");
  });

  it("бере лише останні 6 завершених циклів", () => {
    // вісім циклів: перші два — аномальні, і не мають потрапити в середнє
    const p = predict(chain("2025-01-01", [45, 45, 28, 28, 28, 28, 28, 28]), SETTINGS, "2026-06-01")!;
    expect(p.basedOn).toBe(6);
    expect(p.avgLength).toBe(28);
  });

  it("овуляція = прогнозований старт наступного циклу − 14", () => {
    const p = predict(chain("2026-05-01", [33, 33, 33]), SETTINGS, "2026-08-01")!;
    expect(p.avgLength).toBe(33);
    expect(p.ovulation).toBe(addDays(p.nextStart, -LUTEAL_DAYS));
    // а не «14-й день від початку» — при циклі 33 дні це різні дати
    const lastStart = "2026-07-09";
    expect(p.ovulation).not.toBe(addDays(lastStart, 13));
  });

  it("фертильне вікно — від овуляції −5 до +1", () => {
    const p = predict(chain("2026-05-01", [28, 28]), SETTINGS, "2026-07-01")!;
    expect(p.fertileStart).toBe(addDays(p.ovulation, -5));
    expect(p.fertileEnd).toBe(addDays(p.ovulation, 1));
  });

  it("тривалість менструації беремо з власних даних, коли вони є", () => {
    const cycles = chain("2026-05-01", [28, 28]);
    cycles[0].periodLength = 6;
    cycles[1].periodLength = 4;
    const p = predict(cycles, { ...SETTINGS, typical_period_length: 9 }, "2026-07-01")!;
    expect(p.avgPeriodLength).toBe(5);
  });

  it("затримка помічається лише за межами avg + 2sd", () => {
    const cycles = chain("2026-05-01", [28, 28, 28]);
    const lastStart = cycles[cycles.length - 1].start;
    expect(predict(cycles, SETTINGS, addDays(lastStart, 29))!.overdue).toBe(false);
    expect(predict(cycles, SETTINGS, addDays(lastStart, 40))!.overdue).toBe(true);
  });
});
