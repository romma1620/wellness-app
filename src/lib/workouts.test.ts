import { describe, expect, it } from "vitest";
import {
  bestSet,
  compareLastTwo,
  epley1rm,
  exerciseCount,
  exerciseSeries,
  exerciseTonnage,
  groupByMonth,
  pickMonthPage,
  remainingSessions,
  routineSeries,
  setTonnage,
  workoutTonnage,
  type ExerciseSet,
  type LoadedWorkout,
  type MonthTotal,
  type WorkoutListItem,
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

describe("exerciseCount", () => {
  it("рахує різні вправи, а не підходи", () => {
    expect(
      exerciseCount([
        { exercise_id: "sq" },
        { exercise_id: "sq" },
        { exercise_id: "abs" },
      ]),
    ).toBe(2);
  });
  it("нуль для порожнього списку", () => {
    expect(exerciseCount([])).toBe(0);
  });
});

const SQ: ExerciseSet[] = [
  { date: "2026-07-01", weight: 50, reps: 10 },
  { date: "2026-07-01", weight: 60, reps: 8 },
  { date: "2026-07-08", weight: 55, reps: 10 },
  { date: "2026-07-08", weight: 65, reps: 8 },
];

const ABS: ExerciseSet[] = [{ date: "2026-07-01", weight: null, reps: 15 }];

describe("exerciseSeries", () => {
  it("weight metric = best working weight per session", () => {
    expect(exerciseSeries(SQ, "weight").map((p) => p.value)).toEqual([60, 65]);
  });
  it("tonnage metric = exercise tonnage per session", () => {
    expect(exerciseSeries(SQ, "tonnage").map((p) => p.value)).toEqual([500 + 480, 550 + 520]);
  });
  it("orm metric = Epley of best set", () => {
    expect(exerciseSeries(SQ, "orm")[0].value).toBeCloseTo(60 * (1 + 8 / 30), 5);
  });
  it("bodyweight exercise → weight metric is null point", () => {
    expect(exerciseSeries(ABS, "weight")[0].value).toBeNull();
  });
  it("one point per session date", () => {
    expect(exerciseSeries(SQ, "weight")).toHaveLength(2);
  });
  it("сортує сесії за датою незалежно від порядку сетів", () => {
    const shuffled = [SQ[2], SQ[0], SQ[3], SQ[1]];
    expect(exerciseSeries(shuffled, "weight").map((p) => p.date)).toEqual([
      "2026-07-01",
      "2026-07-08",
    ]);
  });
  it("порожній вхід → порожня серія", () => {
    expect(exerciseSeries([], "weight")).toEqual([]);
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
    const c = compareLastTwo(SQ);
    expect(c?.current.maxWeight).toBe(65);
    expect(c?.previous?.maxWeight).toBe(60);
    expect(c?.current.tonnage).toBe(1070);
    expect(c?.previous?.tonnage).toBe(980);
  });
  it("перша сесія → previous є null", () => {
    expect(compareLastTwo(ABS)?.previous).toBeNull();
  });
  it("null when there are no sets", () => {
    expect(compareLastTwo([])).toBeNull();
  });
});

const ITEMS: WorkoutListItem[] = [
  { id: "w1", date: "2026-08-02", name: "Сідниці", exerciseCount: 6 },
  { id: "w2", date: "2026-07-31", name: "Верх", exerciseCount: 5 },
  { id: "w3", date: "2026-07-28", name: "Ноги", exerciseCount: 5 },
];

const TOTALS: MonthTotal[] = [
  { month: "2026-08-01", sessions: 8, tonnage: 62000 },
  { month: "2026-07-01", sessions: 12, tonnage: 91000 },
  { month: "2026-06-01", sessions: 10, tonnage: 78000 },
];

describe("groupByMonth", () => {
  it("розбиває на календарні місяці, зберігаючи порядок", () => {
    const g = groupByMonth(ITEMS);
    expect(g.map((x) => x.month)).toEqual(["2026-08-01", "2026-07-01"]);
    expect(g[0].items.map((i) => i.id)).toEqual(["w1"]);
    expect(g[1].items.map((i) => i.id)).toEqual(["w2", "w3"]);
  });
  it("порожній вхід → порожній вихід", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("pickMonthPage", () => {
  it("бере місяці, доки не набереться мінімум сесій", () => {
    // 8 замало, тож додається липень: 8 + 12 = 20
    expect(pickMonthPage(TOTALS, 0)).toEqual({
      months: 2,
      from: "2026-07-01",
      to: "2026-08-31",
    });
  });
  it("остання сторінка коротша за мінімум", () => {
    expect(pickMonthPage(TOTALS, 2)).toEqual({
      months: 1,
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });
  it("null, коли місяці вичерпано", () => {
    expect(pickMonthPage(TOTALS, 3)).toBeNull();
  });
  it("порожній архів → null", () => {
    expect(pickMonthPage([], 0)).toBeNull();
  });
  it("один місяць покриває мінімум сам по собі", () => {
    expect(pickMonthPage(TOTALS, 1)?.months).toBe(1);
  });
});

describe("remainingSessions", () => {
  it("сума сесій у ще не завантажених місяцях", () => {
    expect(remainingSessions(TOTALS, 2)).toBe(10);
  });
  it("нуль, коли все завантажено", () => {
    expect(remainingSessions(TOTALS, 3)).toBe(0);
  });
});
