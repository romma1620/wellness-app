import { describe, expect, it } from "vitest";
import {
  activeRoutines,
  avgSessionTonnage,
  durationLabel,
  exerciseProgress,
  isActiveRoutine,
  periodEnd,
  progressDelta,
  routineTonnageSeries,
  sessionsPerWeek,
  spanLabel,
  statFromWorkouts,
  type RoutineStat,
} from "./routine-stats";
import type { LoadedWorkout } from "./workouts";

const TODAY = "2026-09-28";

function stat(p: Partial<RoutineStat>): RoutineStat {
  return {
    routineId: "r",
    name: "Ноги",
    archived: false,
    firstDate: "2026-08-01",
    lastDate: "2026-09-25",
    sessions: 10,
    ...p,
  };
}

describe("isActiveRoutine", () => {
  it("активний, якщо остання сесія в межах трьох тижнів", () => {
    expect(isActiveRoutine(stat({ lastDate: "2026-09-07" }), TODAY)).toBe(true);
  });
  it("неактивний після трьох тижнів без сесій", () => {
    expect(isActiveRoutine(stat({ lastDate: "2026-09-06" }), TODAY)).toBe(false);
  });
  it("архівний шаблон не активний навіть зі свіжою сесією", () => {
    expect(isActiveRoutine(stat({ archived: true, lastDate: TODAY }), TODAY)).toBe(false);
  });
});

describe("activeRoutines", () => {
  it("паралельні шаблони, найсвіжіше розпочаті спершу", () => {
    const list = activeRoutines(
      [
        stat({ routineId: "legs1", firstDate: "2026-03-01", lastDate: "2026-08-01" }),
        stat({ routineId: "legs2", firstDate: "2026-08-05", lastDate: "2026-09-26" }),
        stat({ routineId: "arms2", firstDate: "2026-09-01", lastDate: "2026-09-27" }),
      ],
      TODAY,
    );
    expect(list.map((s) => s.routineId)).toEqual(["arms2", "legs2"]);
  });
});

describe("periodEnd / spanLabel", () => {
  it("активний шаблон триває до сьогодні", () => {
    const s = stat({ firstDate: "2026-09-16" });
    expect(periodEnd(s, TODAY)).toBe(TODAY);
    expect(spanLabel(s, TODAY)).toBe("з 16 вересня");
  });
  it("завершений — від першої до останньої сесії", () => {
    const s = stat({ firstDate: "2026-03-01", lastDate: "2026-05-15" });
    expect(periodEnd(s, TODAY)).toBe("2026-05-15");
    expect(spanLabel(s, TODAY)).toBe("1 бер – 15 тра");
  });
  it("одна давня сесія — одна дата", () => {
    const s = stat({ firstDate: "2026-03-01", lastDate: "2026-03-01" });
    expect(spanLabel(s, TODAY)).toBe("1 березня");
  });
});

describe("durationLabel", () => {
  it("до двох тижнів — у днях, обидві межі включно", () => {
    expect(durationLabel("2026-09-28", "2026-09-28")).toBe("1 день");
    expect(durationLabel("2026-09-24", "2026-09-28")).toBe("5 днів");
  });
  it("далі — у повних тижнях", () => {
    expect(durationLabel("2026-08-17", "2026-09-28")).toBe("6 тижнів");
    expect(durationLabel("2026-09-14", "2026-09-28")).toBe("2 тижні");
  });
});

describe("sessionsPerWeek", () => {
  it("сесії на тиждень за період", () => {
    expect(sessionsPerWeek(12, "2026-08-03", "2026-09-13")).toBe(2);
  });
  it("період коротший за тиждень рахується як тиждень", () => {
    expect(sessionsPerWeek(2, "2026-09-27", "2026-09-28")).toBe(2);
  });
});

const W: LoadedWorkout[] = [
  {
    id: "w2",
    date: "2026-09-10",
    name: "Ноги",
    routine_id: "r",
    sets: [
      { exercise_id: "squat", weight: 85, reps: 5 },
      { exercise_id: "squat", weight: 90, reps: 3 },
      { exercise_id: "pullup", weight: null, reps: 10 },
    ],
  },
  {
    id: "w1",
    date: "2026-09-01",
    name: "Ноги",
    routine_id: "r",
    sets: [
      { exercise_id: "squat", weight: 80, reps: 5 },
      { exercise_id: "pullup", weight: null, reps: 8 },
      { exercise_id: "lunge", weight: 20, reps: 10 },
    ],
  },
  {
    id: "w3",
    date: "2026-09-10",
    name: "Ноги",
    routine_id: "r",
    sets: [{ exercise_id: "lunge", weight: 24, reps: 10 }],
  },
];

describe("statFromWorkouts", () => {
  it("перша/остання дата і кількість сесій", () => {
    const s = statFromWorkouts({ id: "r", name: "Ноги", archived_at: null }, W);
    expect(s).toMatchObject({ firstDate: "2026-09-01", lastDate: "2026-09-10", sessions: 3, archived: false });
  });
  it("без сесій — null", () => {
    expect(statFromWorkouts({ id: "r", name: "Ноги", archived_at: null }, [])).toBeNull();
  });
});

describe("routineTonnageSeries", () => {
  it("сесії одного дня зливаються, найстаріші спершу", () => {
    const s = routineTonnageSeries(W);
    expect(s.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-10"]);
    expect(s.map((p) => p.value)).toEqual([400 + 8 + 200, 425 + 270 + 10 + 240]);
  });
});

describe("avgSessionTonnage", () => {
  it("середній тоннаж сесії", () => {
    expect(avgSessionTonnage(W)).toBeCloseTo((608 + 705 + 240) / 3);
  });
  it("null без сесій", () => {
    expect(avgSessionTonnage([])).toBeNull();
  });
});

describe("exerciseProgress / progressDelta", () => {
  const p = exerciseProgress(W);
  const by = (id: string) => p.find((x) => x.exerciseId === id)!;

  it("порядок першої появи", () => {
    expect(p.map((x) => x.exerciseId)).toEqual(["squat", "pullup", "lunge"]);
  });
  it("найкращий підхід першої й останньої сесії", () => {
    expect(by("squat").first).toEqual({ date: "2026-09-01", weight: 80, reps: 5 });
    expect(by("squat").last).toEqual({ date: "2026-09-10", weight: 90, reps: 3 });
    expect(progressDelta(by("squat"))).toEqual({ unit: "кг", value: 10 });
  });
  it("власна вага — прогрес у повторах", () => {
    expect(progressDelta(by("pullup"))).toEqual({ unit: "повт", value: 2 });
  });
  it("одна сесія — дельти немає", () => {
    const single = exerciseProgress([W[1]]);
    expect(progressDelta(single[0])).toBeNull();
  });
  it("вага то є, то ні — дельти немає", () => {
    const mixed = exerciseProgress([
      { ...W[1], sets: [{ exercise_id: "x", weight: null, reps: 10 }] },
      { ...W[0], sets: [{ exercise_id: "x", weight: 10, reps: 10 }] },
    ]);
    expect(progressDelta(mixed[0])).toBeNull();
  });
});
