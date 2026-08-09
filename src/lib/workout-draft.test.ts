import { describe, expect, it } from "vitest";
import {
  draftSummary,
  isDraftMeaningful,
  parseDraft,
  serializeDraft,
  type StoredDraft,
} from "./workout-draft";
import type { DraftWorkout } from "./workouts";

const UID = "user-1";
const AT = new Date("2026-08-12T12:00:00.000Z");

function emptyDraft(): DraftWorkout {
  return {
    date: "2026-08-12",
    routineId: null,
    name: "",
    note: "",
    exercises: [
      { key: "d1", exerciseId: null, name: "", muscleGroup: null, sets: [{ weight: null, reps: null }] },
    ],
  };
}

describe("isDraftMeaningful", () => {
  it("порожня форма — ні", () => {
    expect(isDraftMeaningful(emptyDraft())).toBe(false);
  });
  it("змінена лише дата — ні", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), date: "2026-08-01" })).toBe(false);
  });
  it("обраний шаблон — так", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), routineId: "rt-1" })).toBe(true);
  });
  it("назва вправи — так", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("назва з самих пробілів — ні", () => {
    const d = emptyDraft();
    d.exercises[0].name = "   ";
    expect(isDraftMeaningful(d)).toBe(false);
  });
  it("вага без повторів — так", () => {
    const d = emptyDraft();
    d.exercises[0].sets[0].weight = 60;
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("повтори без ваги — так", () => {
    const d = emptyDraft();
    d.exercises[0].sets[0].reps = 8;
    expect(isDraftMeaningful(d)).toBe(true);
  });
  it("нотатка — так", () => {
    expect(isDraftMeaningful({ ...emptyDraft(), note: "спина боліла" })).toBe(true);
  });
});

describe("parseDraft", () => {
  const raw = () => serializeDraft({ ...emptyDraft(), routineId: "rt-1", note: "ок" }, UID, AT);

  it("валідний payload повертає ті самі дані", () => {
    const stored = parseDraft(raw(), UID);
    expect(stored?.draft.routineId).toBe("rt-1");
    expect(stored?.draft.note).toBe("ок");
    expect(stored?.draft.date).toBe("2026-08-12");
    expect(stored?.savedAt).toBe("2026-08-12T12:00:00.000Z");
  });
  it("null на вході — null", () => {
    expect(parseDraft(null, UID)).toBeNull();
  });
  it("невалідний JSON — null", () => {
    expect(parseDraft("{нє json", UID)).toBeNull();
  });
  it("інша версія формату — null", () => {
    expect(parseDraft(JSON.stringify({ v: 0, userId: UID, savedAt: "x", draft: emptyDraft() }), UID)).toBeNull();
  });
  it("чужий userId — null", () => {
    expect(parseDraft(raw(), "user-2")).toBeNull();
  });
  it("exercises не масив — null", () => {
    const bad = JSON.stringify({ v: 1, userId: UID, savedAt: "x", draft: { ...emptyDraft(), exercises: "нє" } });
    expect(parseDraft(bad, UID)).toBeNull();
  });
  it("немає дати — null", () => {
    const bad = JSON.stringify({ v: 1, userId: UID, savedAt: "x", draft: { ...emptyDraft(), date: "" } });
    expect(parseDraft(bad, UID)).toBeNull();
  });
  it("ключі вправ перегенеровано й унікальні", () => {
    const d = emptyDraft();
    d.exercises = [
      { key: "dup", exerciseId: null, name: "A", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "dup", exerciseId: null, name: "B", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
    ];
    const keys = parseDraft(serializeDraft(d, UID, AT), UID)!.draft.exercises.map((e) => e.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys).not.toContain("dup");
  });
  it("сміття в підході стає null, а не NaN", () => {
    const bad = JSON.stringify({
      v: 1,
      userId: UID,
      savedAt: "x",
      draft: {
        ...emptyDraft(),
        exercises: [{ key: "k", exerciseId: null, name: "A", muscleGroup: null, sets: [{ weight: "важко", reps: null }] }],
      },
    });
    expect(parseDraft(bad, UID)!.draft.exercises[0].sets[0].weight).toBeNull();
  });
  it("вправа без підходів отримує один порожній", () => {
    const bad = JSON.stringify({
      v: 1,
      userId: UID,
      savedAt: "x",
      draft: {
        ...emptyDraft(),
        exercises: [{ key: "k", exerciseId: null, name: "A", muscleGroup: null, sets: [] }],
      },
    });
    expect(parseDraft(bad, UID)!.draft.exercises[0].sets).toEqual([{ weight: null, reps: null }]);
  });
});

describe("draftSummary", () => {
  const stored = (draft: DraftWorkout): StoredDraft => ({
    v: 1,
    userId: UID,
    savedAt: AT.toISOString(),
    draft,
  });

  it("рахує лише названі вправи і додає дату", () => {
    const d = emptyDraft();
    d.exercises = [
      { key: "a", exerciseId: null, name: "Присідання", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "b", exerciseId: null, name: "Жим", muscleGroup: null, sets: [{ weight: null, reps: 5 }] },
      { key: "c", exerciseId: null, name: "", muscleGroup: null, sets: [{ weight: null, reps: null }] },
    ];
    expect(draftSummary(stored(d))).toBe("2 вправи · 12 серпня");
  });
  it("одна вправа — однина", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(draftSummary(stored(d))).toBe("1 вправа · 12 серпня");
  });
  it("пʼять вправ — множина", () => {
    const d = emptyDraft();
    d.exercises = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      exerciseId: null,
      name: `Вправа ${i}`,
      muscleGroup: null,
      sets: [{ weight: null, reps: 5 }],
    }));
    expect(draftSummary(stored(d))).toBe("5 вправ · 12 серпня");
  });
  it("назва шаблону йде першою, коли відома", () => {
    const d = emptyDraft();
    d.exercises[0].name = "Присідання";
    expect(draftSummary(stored(d), "Ноги")).toBe("Ноги · 1 вправа · 12 серпня");
  });
});
