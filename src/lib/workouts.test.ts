import { describe, expect, it } from "vitest";
import {
  bestSet,
  compareLastTwo,
  epley1rm,
  exerciseSeries,
  exerciseTonnage,
  routineSeries,
  setTonnage,
  workoutTonnage,
  type LoadedWorkout,
} from "./workouts";

describe("setTonnage", () => {
  it("weight × reps when weight present", () => {
    expect(setTonnage({ weight: 50, reps: 10 })).toBe(500);
  });
  it("equals reps when weight is null (bodyweight)", () => {
    expect(setTonnage({ weight: null, reps: 12 })).toBe(12);
  });
  it("zero when reps missing", () => {
    expect(setTonnage({ weight: 50, reps: null })).toBe(0);
  });
});

describe("exerciseTonnage", () => {
  it("sums sets", () => {
    expect(
      exerciseTonnage([
        { weight: 50, reps: 10 },
        { weight: 55, reps: 8 },
      ]),
    ).toBe(500 + 440);
  });
});

describe("epley1rm", () => {
  it("Epley formula", () => {
    expect(epley1rm(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });
  it("null when weight is null", () => {
    expect(epley1rm(null, 5)).toBeNull();
  });
  it("null when reps <= 0", () => {
    expect(epley1rm(100, 0)).toBeNull();
  });
});

describe("bestSet", () => {
  it("picks max working weight", () => {
    const best = bestSet([
      { weight: 50, reps: 10, exercise_id: "e1" },
      { weight: 60, reps: 6, exercise_id: "e1" },
    ]);
    expect(best?.weight).toBe(60);
  });
  it("tie on weight → more reps", () => {
    const best = bestSet([
      { weight: 60, reps: 6, exercise_id: "e1" },
      { weight: 60, reps: 8, exercise_id: "e1" },
    ]);
    expect(best?.reps).toBe(8);
  });
  it("null for empty", () => {
    expect(bestSet([])).toBeNull();
  });
});

const W: LoadedWorkout[] = [
  {
    id: "w1",
    date: "2026-07-01",
    name: "Ноги",
    routine_id: "r1",
    sets: [
      { weight: 50, reps: 10, exercise_id: "sq" },
      { weight: 60, reps: 8, exercise_id: "sq" },
      { weight: null, reps: 15, exercise_id: "abs" },
    ],
  },
  {
    id: "w2",
    date: "2026-07-08",
    name: "Ноги",
    routine_id: "r1",
    sets: [
      { weight: 55, reps: 10, exercise_id: "sq" },
      { weight: 65, reps: 8, exercise_id: "sq" },
    ],
  },
];

describe("workoutTonnage", () => {
  it("sums all sets incl. bodyweight", () => {
    expect(workoutTonnage(W[0])).toBe(500 + 480 + 15);
  });
});

describe("exerciseSeries", () => {
  it("weight metric = best working weight per session", () => {
    const s = exerciseSeries(W, "sq", "weight");
    expect(s.map((p) => p.value)).toEqual([60, 65]);
  });
  it("tonnage metric = exercise tonnage per session", () => {
    const s = exerciseSeries(W, "sq", "tonnage");
    expect(s.map((p) => p.value)).toEqual([500 + 480, 550 + 520]);
  });
  it("orm metric = Epley of best set", () => {
    const s = exerciseSeries(W, "sq", "orm");
    expect(s[0].value).toBeCloseTo(60 * (1 + 8 / 30), 5);
  });
  it("bodyweight exercise → weight metric is null point", () => {
    const s = exerciseSeries(W, "abs", "weight");
    expect(s[0].value).toBeNull();
  });
  it("skips sessions without that exercise", () => {
    expect(exerciseSeries(W, "abs", "tonnage")).toHaveLength(1);
  });
});

describe("routineSeries", () => {
  it("total session tonnage per date for a routine", () => {
    const s = routineSeries(W, "r1");
    expect(s.map((p) => p.value)).toEqual([995, 1070]);
  });
});

describe("compareLastTwo", () => {
  it("returns last vs previous max weight + tonnage", () => {
    const c = compareLastTwo(W, "sq");
    expect(c?.current.maxWeight).toBe(65);
    expect(c?.previous?.maxWeight).toBe(60);
    expect(c?.current.tonnage).toBe(1070);
    expect(c?.previous?.tonnage).toBe(980);
  });
  it("null when exercise never used", () => {
    expect(compareLastTwo(W, "nope")).toBeNull();
  });
});
