import { describe, expect, it } from "vitest";
import type { DailyLog } from "./types";
import {
  applySaved,
  diffDay,
  EMPTY_DAY,
  formFromRow,
  hasChanges,
  type DailyForm,
} from "./daily-log";

function row(over: Partial<DailyLog> = {}): DailyLog {
  return {
    id: "1",
    user_id: "u",
    date: "2026-07-27",
    weight: 60,
    kcal: 1800,
    protein: 90,
    fat: 60,
    carbs: 180,
    water: 5,
    steps: 8000,
    sport: "зал",
    care: "Крем",
    comment: "ок",
    updated_at: "2026-07-27T10:00:00Z",
    ...over,
  };
}

describe("formFromRow", () => {
  it("порожній день, коли рядка немає", () => {
    expect(formFromRow(null)).toEqual(EMPTY_DAY);
  });

  it("текстові null стають порожніми рядками", () => {
    const f = formFromRow(row({ sport: null, care: null, comment: null }));
    expect(f.sport).toBe("");
    expect(f.care).toBe("");
    expect(f.comment).toBe("");
  });

  it("числа переносяться як є, включно з null", () => {
    const f = formFromRow(row({ weight: null }));
    expect(f.weight).toBeNull();
    expect(f.kcal).toBe(1800);
    expect(f.water).toBe(5);
  });
});

describe("diffDay", () => {
  it("немає змін — порожній патч", () => {
    const f = formFromRow(row());
    expect(diffDay(f, f)).toEqual({});
    expect(hasChanges(diffDay(f, f))).toBe(false);
  });

  it("свіжозавантажений день не вважається зміненим (null ↔ \"\")", () => {
    // саме тут раніше народжувався зайвий запис усього рядка після load
    const f = formFromRow(row({ sport: null, care: null, comment: null }));
    expect(diffDay(f, f)).toEqual({});
  });

  it("тільки змінене поле потрапляє в патч", () => {
    const loaded = formFromRow(row());
    const current: DailyForm = { ...loaded, water: 7 };
    expect(diffDay(loaded, current)).toEqual({ water: 7 });
  });

  it("порожній текст зберігається як null", () => {
    const loaded = formFromRow(row({ sport: "зал" }));
    const current: DailyForm = { ...loaded, sport: "" };
    expect(diffDay(loaded, current)).toEqual({ sport: null });
  });

  it("очищене число потрапляє в патч як null, а не зникає", () => {
    const loaded = formFromRow(row({ weight: 60 }));
    const current: DailyForm = { ...loaded, weight: null };
    const patch = diffDay(loaded, current);
    expect(patch).toEqual({ weight: null });
    expect(hasChanges(patch)).toBe(true);
  });

  it("повернення значення назад скасовує зміну", () => {
    const loaded = formFromRow(row({ kcal: 1800 }));
    const current: DailyForm = { ...loaded, kcal: 1800 };
    expect(hasChanges(diffDay(loaded, current))).toBe(false);
  });

  it("кілька полів одночасно", () => {
    const loaded = formFromRow(row());
    const current: DailyForm = { ...loaded, steps: 12000, comment: "довгий день" };
    expect(diffDay(loaded, current)).toEqual({ steps: 12000, comment: "довгий день" });
  });
});

describe("applySaved", () => {
  it("збережений патч стає новою базою", () => {
    const loaded = formFromRow(row({ water: 5 }));
    const next = applySaved(loaded, { water: 7 });
    expect(next.water).toBe(7);
    expect(hasChanges(diffDay(next, { ...loaded, water: 7 }))).toBe(false);
  });

  it("null у текстовому полі повертається як порожній рядок", () => {
    const loaded = formFromRow(row({ sport: "зал" }));
    const next = applySaved(loaded, { sport: null });
    expect(next.sport).toBe("");
  });

  it("не мутує вихідну форму", () => {
    const loaded = formFromRow(row({ water: 5 }));
    applySaved(loaded, { water: 7 });
    expect(loaded.water).toBe(5);
  });
});
