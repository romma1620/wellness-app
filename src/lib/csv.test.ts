import { describe, expect, it } from "vitest";
import {
  buildExportCsv,
  csvField,
  exportFileName,
  flattenWorkouts,
  isExportEmpty,
  toCsv,
  buildCycleCsv,
  cycleExportFileName,
  type CycleCsvRow,
  type ExportData,
  type RawWorkout,
} from "./csv";

describe("csvField", () => {
  it("null і undefined дають порожнє поле", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("десяткові з комою, цілі без розділювача тисяч", () => {
    expect(csvField(62.4)).toBe("62,4");
    expect(csvField(8432)).toBe("8432");
  });

  it("нескінченність і NaN дають порожнє поле", () => {
    expect(csvField(NaN)).toBe("");
    expect(csvField(Infinity)).toBe("");
  });

  it("кома не вимагає лапок — роздільник полів ;", () => {
    expect(csvField("Скраб, Крем")).toBe("Скраб, Крем");
  });

  it("крапка з комою, лапки й переноси беруться в лапки", () => {
    expect(csvField("зал; басейн")).toBe('"зал; басейн"');
    expect(csvField('казав "ок"')).toBe('"казав ""ок"""');
    expect(csvField("два\nрядки")).toBe('"два\nрядки"');
    expect(csvField("два\r\nрядки")).toBe('"два\r\nрядки"');
  });

  it("порожній рядок лишається порожнім полем без лапок", () => {
    expect(csvField("")).toBe("");
  });
});

describe("toCsv", () => {
  it("поля через ;, рядки через CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, null],
      ]),
    ).toBe("a;b\r\n1;");
  });

  it("порожня матриця дає порожній рядок", () => {
    expect(toCsv([])).toBe("");
  });

  it("рядок з одного поля не отримує роздільника", () => {
    expect(toCsv([["# Щоденник"]])).toBe("# Щоденник");
  });
});

const EMPTY: ExportData = { daily: [], measurements: [], workouts: [] };

describe("flattenWorkouts", () => {
  const raw: RawWorkout[] = [
    {
      date: "2026-07-30",
      name: "Ноги",
      workout_sets: [
        { set_number: 2, weight: 42.5, reps: 8, exercises: { name: "Присідання" } },
        { set_number: 1, weight: 40, reps: 10, exercises: { name: "Присідання" } },
      ],
    },
  ];

  it("сортує підходи за номером незалежно від порядку на вході", () => {
    expect(flattenWorkouts(raw).map((r) => r.setNumber)).toEqual([1, 2]);
  });

  it("дата й назва тренування повторюються в кожному рядку-підході", () => {
    const rows = flattenWorkouts(raw);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date === "2026-07-30" && r.workout === "Ноги")).toBe(true);
  });

  it("не мутує вхідний масив підходів", () => {
    flattenWorkouts(raw);
    expect(raw[0].workout_sets?.map((s) => s.set_number)).toEqual([2, 1]);
  });

  it("тренування без підходів не дає жодного рядка", () => {
    expect(flattenWorkouts([{ date: "2026-07-30", name: null, workout_sets: [] }])).toEqual([]);
    expect(flattenWorkouts([{ date: "2026-07-30", name: null, workout_sets: null }])).toEqual([]);
  });

  it("відсутня вправа дає null, а не падіння", () => {
    const rows = flattenWorkouts([
      {
        date: "2026-07-30",
        name: null,
        workout_sets: [{ set_number: 1, weight: null, reps: 12, exercises: null }],
      },
    ]);
    expect(rows[0].exercise).toBeNull();
  });
});

describe("buildExportCsv", () => {
  it("починається з BOM", () => {
    expect(buildExportCsv(EMPTY).startsWith("\uFEFF")).toBe(true);
  });

  it("три секції в правильному порядку, розділені порожнім рядком", () => {
    const lines = buildExportCsv(EMPTY).replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("# Щоденник");
    expect(lines[1]).toBe(
      "Дата;Вага;Ккал;Білки;Жири;Вуглеводи;Вода;Кроки;Спорт;Догляд;Коментар",
    );
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("# Заміри");
    expect(lines[4]).toBe("Дата;Талія;Стегна;Груди;Нога;Рука");
    expect(lines[5]).toBe("");
    expect(lines[6]).toBe("# Тренування");
    expect(lines[7]).toBe("Дата;Тренування;Вправа;Підхід;Вага;Повтори");
  });

  it("рядок щоденника йде в порядку колонок заголовка", () => {
    const csv = buildExportCsv({
      ...EMPTY,
      daily: [
        {
          date: "2026-07-29",
          weight: 62.4,
          kcal: 1840,
          protein: 110,
          fat: 60,
          carbs: 180,
          water: 6,
          steps: 8432,
          sport: "зал",
          care: "Скраб, Крем",
          comment: "гарний день",
        },
      ],
    });
    expect(csv).toContain(
      "2026-07-29;62,4;1840;110;60;180;6;8432;зал;Скраб, Крем;гарний день",
    );
  });

  it("порожні поля лишаються порожніми, не «—»", () => {
    const csv = buildExportCsv({
      ...EMPTY,
      measurements: [
        { date: "2026-07-01", waist: 68, hips: null, chest: null, leg: null, arm: 28 },
      ],
    });
    expect(csv).toContain("2026-07-01;68;;;;28");
  });
});

describe("exportFileName", () => {
  it("суфікс відповідає діапазону", () => {
    expect(exportFileName("week", "2026-07-31")).toBe("aura-week-2026-07-31.csv");
    expect(exportFileName("month", "2026-07-31")).toBe("aura-month-2026-07-31.csv");
    expect(exportFileName("all", "2026-07-31")).toBe("aura-all-2026-07-31.csv");
  });
});

describe("isExportEmpty", () => {
  it("true лише коли порожні всі три секції", () => {
    expect(isExportEmpty(EMPTY)).toBe(true);
    expect(
      isExportEmpty({
        ...EMPTY,
        measurements: [
          { date: "2026-07-01", waist: 68, hips: null, chest: null, leg: null, arm: null },
        ],
      }),
    ).toBe(false);
  });
});

describe("buildCycleCsv", () => {
  const ROWS: CycleCsvRow[] = [
    {
      date: "2026-08-01",
      cycleDay: 1,
      flow: "середньо",
      symptoms: "Судоми, Здуття",
      mood: "знижений",
      energy: 2,
      notes: null,
    },
    {
      date: "2026-08-08",
      cycleDay: 8,
      flow: null,
      symptoms: "",
      mood: null,
      energy: null,
      notes: "довга прогулянка",
    },
  ];

  it("окрема секція з власним заголовком і BOM", () => {
    const csv = buildCycleCsv(ROWS);
    expect(csv.startsWith("﻿# Цикл")).toBe(true);
    expect(csv).toContain("Дата;День циклу;Виділення;Симптоми;Настрій;Енергія;Нотатка");
  });

  it("порожні поля лишаються порожніми, а не «—»", () => {
    const csv = buildCycleCsv(ROWS);
    expect(csv).toContain("2026-08-08;8;;;;;довга прогулянка");
  });

  it("кома в симптомах не потребує лапок — роздільник крапка з комою", () => {
    expect(buildCycleCsv(ROWS)).toContain("2026-08-01;1;середньо;Судоми, Здуття;знижений;2;");
  });

  it("без записів лишається лише структура файлу", () => {
    const csv = buildCycleCsv([]);
    expect(csv).toContain("# Цикл");
    expect(csv).toContain("Дата;День циклу");
  });
});

describe("cycleExportFileName", () => {
  it("окреме імʼя, щоб файл циклу не змішувався з загальним експортом", () => {
    expect(cycleExportFileName("2026-08-08")).toBe("aura-cycle-2026-08-08.csv");
    expect(cycleExportFileName("2026-08-08")).not.toBe(exportFileName("all", "2026-08-08"));
  });
});
