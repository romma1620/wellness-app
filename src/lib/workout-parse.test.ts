import { describe, expect, it } from "vitest";
import type { Exercise } from "./types";
import {
  parsedNotes,
  parsedSummary,
  parsedToDrafts,
  parseWorkoutLine,
  parseWorkoutText,
  splitExercises,
} from "./workout-parse";

const SAMPLE = `Румунська тяга 60  кг 4 х 10
Випади 7 кг 3 х 12
Жим штанги лежачи 45 кг 4 х 10
Підтягування 3 х 6 ( максимально швидко догори )
Тяга горизонтального блоку 60 кг 4 х 6
Жим гантелей сидячи 10 кг 3 х 12
Згинання на біцепс молотки 10 кг 3 х 12`;

const rep = (n: number, r: number) => Array.from({ length: n }, () => r);

describe("parseWorkoutText — приклад тренування", () => {
  const { exercises, skipped } = parseWorkoutText(SAMPLE);

  it("розпізнає всі сім вправ", () => {
    expect(skipped).toEqual([]);
    expect(exercises).toHaveLength(7);
  });

  it("назва, вага, підходи і повтори", () => {
    expect(exercises).toEqual([
      { name: "Румунська тяга", weight: 60, reps: rep(4, 10), note: null },
      { name: "Випади", weight: 7, reps: rep(3, 12), note: null },
      { name: "Жим штанги лежачи", weight: 45, reps: rep(4, 10), note: null },
      { name: "Підтягування", weight: null, reps: rep(3, 6), note: "максимально швидко догори" },
      { name: "Тяга горизонтального блоку", weight: 60, reps: rep(4, 6), note: null },
      { name: "Жим гантелей сидячи", weight: 10, reps: rep(3, 12), note: null },
      { name: "Згинання на біцепс молотки", weight: 10, reps: rep(3, 12), note: null },
    ]);
  });
});

describe("parseWorkoutLine — варіації запису", () => {
  it.each([
    ["Присідання 80кг 5x5", "Присідання", 80, rep(5, 5)],
    ["Присідання 80 kg 5 × 5", "Присідання", 80, rep(5, 5)],
    ["Присідання 80 5*5", "Присідання", 80, rep(5, 5)],
    ["Присідання 80 кг. 5х5", "Присідання", 80, rep(5, 5)],
    ["Присідання 5 х 5 по 80 кг", "Присідання", 80, rep(5, 5)],
    ["Присідання 5х5 80кг", "Присідання", 80, rep(5, 5)],
    ["Присідання: 80 кг — 5 х 5", "Присідання", 80, rep(5, 5)],
    ["Присідання 3 х 5, 80 кг", "Присідання", 80, rep(3, 5)],
    ["1. Присідання 80 кг 5 х 5", "Присідання", 80, rep(5, 5)],
    ["- Присідання 80 кг 5 х 5", "Присідання", 80, rep(5, 5)],
    ["• Присідання 80 кг 5 х 5", "Присідання", 80, rep(5, 5)],
  ])("%s", (line, name, weight, reps) => {
    expect(parseWorkoutLine(line)).toMatchObject({ name, weight, reps });
  });

  it("дробова вага з комою чи крапкою", () => {
    expect(parseWorkoutLine("Махи 7,5 кг 3 х 15")?.weight).toBe(7.5);
    expect(parseWorkoutLine("Махи 7.5кг 3 х 15")?.weight).toBe(7.5);
  });

  it("повтори по підходах через слеш", () => {
    expect(parseWorkoutLine("Жим 50 кг 3 х 12/10/8")?.reps).toEqual([12, 10, 8]);
  });

  it("список повторів коротший за підходи — добиває останнім", () => {
    expect(parseWorkoutLine("Жим 50 кг 4 х 12/10")?.reps).toEqual([12, 10, 10, 10]);
  });

  it("без ваги — власна вага", () => {
    expect(parseWorkoutLine("Віджимання 3 х 20")).toEqual({
      name: "Віджимання",
      weight: null,
      reps: rep(3, 20),
      note: null,
    });
  });

  it("нуль кілограмів — власна вага", () => {
    expect(parseWorkoutLine("Віджимання 0 кг 3 х 20")?.weight).toBeNull();
  });

  it("хвіст після повторів іде в коментар разом із дужками", () => {
    expect(parseWorkoutLine("Випади 7 кг 3 х 12 на кожну ногу (повільно)")?.note).toBe(
      "на кожну ногу; повільно",
    );
  });

  it("числа в дужках не плутають розбір", () => {
    expect(parseWorkoutLine("Жим 40 кг 3 х 10 (минулого разу 35 кг 3 х 8)")).toMatchObject({
      weight: 40,
      reps: rep(3, 10),
      note: "минулого разу 35 кг 3 х 8",
    });
  });

  it("незакрита дужка — коментар до кінця рядка", () => {
    expect(parseWorkoutLine("Планка 3 х 1 (по хвилині")?.note).toBe("по хвилині");
  });

  it("цифри в назві перед вагою лишаються в назві", () => {
    expect(parseWorkoutLine("Жим під кутом 30 градусів 20 кг 3 х 10")).toMatchObject({
      name: "Жим під кутом 30 градусів",
      weight: 20,
    });
  });

  it.each([
    ["без підходів", "Румунська тяга 60 кг"],
    ["без назви", "60 кг 4 х 10"],
    ["лише числа", "4 х 10"],
    ["забагато підходів", "Жим 40 кг 50 х 10"],
    ["нуль повторів", "Жим 40 кг 3 х 0"],
    ["заголовок", "Тренування ніг"],
  ])("не розпізнає: %s", (_, line) => {
    expect(parseWorkoutLine(line)).toBeNull();
  });
});

describe("parseWorkoutText", () => {
  it("порожні рядки ігнорує, нерозпізнані повертає як є", () => {
    const r = parseWorkoutText("Понеділок\n\n  Жим 40 кг 3 х 10  \r\nРозминка 10 хв\n");
    expect(r.exercises.map((e) => e.name)).toEqual(["Жим"]);
    expect(r.skipped).toEqual(["Понеділок", "Розминка 10 хв"]);
  });

  it("порожній текст", () => {
    expect(parseWorkoutText("  \n ")).toEqual({ exercises: [], skipped: [] });
  });
});

describe("parsedToDrafts", () => {
  const known: Exercise[] = [
    { id: "ex-1", user_id: "u", name: "Румунська тяга", muscle_group: "ноги", created_at: "" },
  ];

  it("прив'язує відому назву без урахування регістру і розгортає підходи", () => {
    const [d] = parsedToDrafts(
      [{ name: "румунська ТЯГА", weight: 60, reps: [10, 8], note: null }],
      known,
    );
    expect(d).toMatchObject({
      exerciseId: "ex-1",
      name: "Румунська тяга",
      muscleGroup: "ноги",
      sets: [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 8 },
      ],
    });
  });

  it("нова назва — без id, створиться при збереженні", () => {
    const [d] = parsedToDrafts([{ name: "Випади", weight: null, reps: [12], note: null }], known);
    expect(d).toMatchObject({ exerciseId: null, name: "Випади", muscleGroup: null });
    expect(d.sets).toEqual([{ weight: null, reps: 12 }]);
  });

  it("ключі унікальні", () => {
    const ds = parsedToDrafts(
      [
        { name: "А", weight: null, reps: [1], note: null },
        { name: "Б", weight: null, reps: [1], note: null },
      ],
      [],
    );
    expect(ds[0].key).not.toBe(ds[1].key);
  });
});

describe("parsedNotes / parsedSummary", () => {
  it("нотатка — лише з коментарів", () => {
    const { exercises } = parseWorkoutText(SAMPLE);
    expect(parsedNotes(exercises)).toBe("Підтягування — максимально швидко догори");
  });

  it("підсумок", () => {
    expect(parsedSummary({ name: "", weight: 60, reps: rep(4, 10), note: null })).toBe("60 кг · 4 × 10");
    expect(parsedSummary({ name: "", weight: 7.5, reps: [12, 10, 8], note: null })).toBe(
      "7,5 кг · 3 × 12/10/8",
    );
    expect(parsedSummary({ name: "", weight: null, reps: rep(3, 6), note: null })).toBe("3 × 6");
  });
});

describe("тренування одним рядком", () => {
  it("приклад без переносів розбирається на ті самі сім вправ", () => {
    const oneLine = SAMPLE.replace(/\s*\n\s*/g, " ");
    expect(parseWorkoutText(oneLine)).toEqual(parseWorkoutText(SAMPLE));
  });

  it("роздільники між вправами не потрапляють у назви", () => {
    const r = parseWorkoutText("Жим 40 кг 3 х 10; Випади 7 кг 3х12, Планка 3 х 1");
    expect(r.exercises.map((e) => e.name)).toEqual(["Жим", "Випади", "Планка"]);
  });

  it("числа в дужках не ділять рядок", () => {
    expect(splitExercises("Жим 40 кг 3 х 10 (минулого разу 35 кг 3 х 8)")).toHaveLength(1);
  });

  it("одна вправа — рядок як є", () => {
    expect(splitExercises("Жим 40 кг 3 х 10 по 60 кг")).toEqual(["Жим 40 кг 3 х 10 по 60 кг"]);
  });
});
