import { describe, expect, it } from "vitest";
import type { UsedExercise } from "./workouts";
import { muscleBalance, staleGroups, type MuscleSetRow } from "./muscle-balance";

const row = (
  muscleGroup: MuscleSetRow["muscleGroup"],
  weight: number | null,
  reps: number,
): MuscleSetRow => ({ muscleGroup, weight, reps });

describe("muscleBalance", () => {
  it("порожній період → порожньо", () => {
    expect(muscleBalance([])).toEqual([]);
  });

  it("рахує підходи, тоннаж і частку по групах у порядку MUSCLE_GROUPS", () => {
    const stats = muscleBalance([
      row("спина", 40, 10), // 400
      row("ноги", 60, 10), // 600
      row("ноги", 60, 8), // 480
      row("спина", null, 12), // власна вага → тоннаж = повтори
    ]);
    expect(stats.map((s) => s.group)).toEqual(["ноги", "спина"]);
    expect(stats[0]).toMatchObject({ sets: 2, tonnage: 1080, share: 0.5 });
    expect(stats[1]).toMatchObject({ sets: 2, tonnage: 412, share: 0.5 });
  });

  it("підходи без групи йдуть у «інше» разом із групою «інше»", () => {
    const stats = muscleBalance([row(null, 20, 10), row("інше", 20, 5), row("кор", null, 30)]);
    expect(stats.map((s) => s.group)).toEqual(["кор", "інше"]);
    expect(stats[1].sets).toBe(2);
  });
});

const used = (
  muscleGroup: UsedExercise["muscleGroup"],
  lastUsed: string,
  id = lastUsed + String(muscleGroup),
): UsedExercise => ({ id, name: "x", muscleGroup, lastUsed });

describe("staleGroups", () => {
  const TODAY = "2026-08-15";

  it("повертає групи, що не тренувались довше за поріг, найзанедбаніші перші", () => {
    const stale = staleGroups(
      [used("ноги", "2026-07-20"), used("спина", "2026-08-01"), used("груди", "2026-08-14")],
      TODAY,
    );
    expect(stale).toEqual([
      { group: "ноги", daysAgo: 26 },
      { group: "спина", daysAgo: 14 },
    ]);
  });

  it("групу представляє найсвіжіша її вправа", () => {
    const stale = staleGroups([used("ноги", "2026-06-01", "a"), used("ноги", "2026-08-14", "b")], TODAY);
    expect(stale).toEqual([]);
  });

  it("«інше» і вправи без групи не смикають", () => {
    expect(staleGroups([used("інше", "2026-01-01"), used(null, "2026-01-01")], TODAY)).toEqual([]);
  });
});
