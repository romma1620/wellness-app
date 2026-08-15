import { describe, expect, it } from "vitest";
import type { ExerciseMax, UsedExercise } from "./workouts";
import { buildRecordRows, recordsInRange } from "./records";

const ex = (id: string, name: string, muscleGroup: UsedExercise["muscleGroup"]): UsedExercise => ({
  id,
  name,
  muscleGroup,
  lastUsed: "2026-08-01",
});

const max = (weight: number, reps: number, date: string): ExerciseMax => ({ weight, reps, date });

describe("buildRecordRows", () => {
  it("зʼєднує вправи з рекордами і пропускає вправи без рекорду", () => {
    const maxes = new Map([["a", max(60, 8, "2026-07-01")]]);
    const rows = buildRecordRows([ex("a", "Присід", "ноги"), ex("b", "Планка", "кор")], maxes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exerciseId: "a", name: "Присід", weight: 60, reps: 8 });
  });

  it("сортує за порядком мʼязових груп, у межах групи — за вагою спадно", () => {
    const maxes = new Map([
      ["squat", max(80, 5, "2026-07-01")],
      ["press", max(40, 8, "2026-07-02")],
      ["lunge", max(50, 10, "2026-07-03")],
    ]);
    const rows = buildRecordRows(
      [ex("press", "Жим", "груди"), ex("lunge", "Випади", "ноги"), ex("squat", "Присід", "ноги")],
      maxes,
    );
    expect(rows.map((r) => r.name)).toEqual(["Присід", "Випади", "Жим"]);
  });

  it("вправи без групи йдуть останніми", () => {
    const maxes = new Map([
      ["x", max(30, 10, "2026-07-01")],
      ["y", max(90, 3, "2026-07-01")],
    ]);
    const rows = buildRecordRows([ex("y", "Щось", null), ex("x", "Тяга", "спина")], maxes);
    expect(rows.map((r) => r.name)).toEqual(["Тяга", "Щось"]);
  });
});

describe("recordsInRange", () => {
  const rows = buildRecordRows(
    [ex("a", "Присід", "ноги"), ex("b", "Тяга", "спина")],
    new Map([
      ["a", max(80, 5, "2026-08-12")],
      ["b", max(70, 6, "2026-07-20")],
    ]),
  );

  it("лишає рекорди в межах діапазону включно, найсвіжіші перші", () => {
    expect(recordsInRange(rows, "2026-08-10", "2026-08-16").map((r) => r.name)).toEqual([
      "Присід",
    ]);
    expect(recordsInRange(rows, "2026-07-20", "2026-08-12")).toHaveLength(2);
  });

  it("порожній діапазон → порожньо", () => {
    expect(recordsInRange(rows, "2026-01-01", "2026-01-07")).toEqual([]);
  });
});
