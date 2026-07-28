import { describe, expect, it } from "vitest";
import {
  buildCareColorMap,
  buildCareMatrix,
  careKey,
  CARE_COLORS,
  CARE_FALLBACK_COLOR,
  CARE_PRESETS,
  type CareHistoryRow,
} from "./care";

const h = (date: string, care: string | null): CareHistoryRow => ({ date, care });

describe("careKey", () => {
  it("нормалізує регістр і пробіли", () => {
    expect(careKey(" Крем ")).toBe("крем");
    expect(careKey("КРЕМ")).toBe("крем");
  });
});

describe("buildCareColorMap", () => {
  it("пресети закріплені за слотами 1-4, навіть без жодного запису", () => {
    const map = buildCareColorMap([]);
    CARE_PRESETS.forEach((preset, i) => {
      expect(map.get(careKey(preset))?.color).toBe(CARE_COLORS[i]);
    });
  });

  it("власні теги отримують слоти за порядком першої появи", () => {
    const map = buildCareColorMap([h("2026-01-02", "Міуінг"), h("2026-01-03", "Масаж")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });

  it("порядок визначає дата, а не позиція в масиві", () => {
    const map = buildCareColorMap([h("2026-03-01", "Масаж"), h("2026-01-01", "Міуінг")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });

  it("тег той самий незалежно від регістру й пробілів", () => {
    const map = buildCareColorMap([h("2026-01-01", " міуінг "), h("2026-01-02", "МІУІНГ")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("міуінг")?.label).toBe("міуінг");
    expect([...map.keys()].filter((k) => k === "міуінг")).toHaveLength(1);
  });

  it("новий тег не перефарбовує наявні", () => {
    const before = buildCareColorMap([h("2026-01-01", "Міуінг")]);
    const after = buildCareColorMap([h("2026-01-01", "Міуінг"), h("2026-02-01", "Масаж")]);
    expect(after.get("міуінг")?.color).toBe(before.get("міуінг")?.color);
  });

  it("девʼятий тег отримує нейтральний сірий", () => {
    const history = ["a", "b", "c", "d", "e"].map((t, i) => h(`2026-01-0${i + 1}`, t));
    const map = buildCareColorMap(history);
    expect(map.get("d")?.color).toBe(CARE_COLORS[7]);
    expect(map.get("e")?.color).toBe(CARE_FALLBACK_COLOR);
  });

  it("null та порожній care ігноруються", () => {
    const map = buildCareColorMap([h("2026-01-01", null), h("2026-01-02", " , ")]);
    expect(map.size).toBe(CARE_PRESETS.length);
  });

  it("кілька тегів в одному дні беруться в порядку рядка", () => {
    const map = buildCareColorMap([h("2026-01-01", "Міуінг, Масаж")]);
    expect(map.get("міуінг")?.color).toBe(CARE_COLORS[4]);
    expect(map.get("масаж")?.color).toBe(CARE_COLORS[5]);
  });
});

describe("buildCareMatrix", () => {
  const colors = buildCareColorMap([]);
  const week = (logs: CareHistoryRow[]) => buildCareMatrix(logs, "2026-07-27", 7, colors);

  it("позначає правильні дні й рахує кількість", () => {
    const rows = week([h("2026-07-27", "Крем"), h("2026-07-29", "Крем")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].days).toEqual([true, false, true, false, false, false, false]);
  });

  it("кілька доглядів в один день дають окремі рядки", () => {
    const rows = week([h("2026-07-27", "Крем, Скраб")]);
    expect(rows.map((r) => r.key).sort()).toEqual(["крем", "скраб"]);
    expect(rows.every((r) => r.days[0])).toBe(true);
  });

  it("сортує за кількістю спадання", () => {
    const rows = week([
      h("2026-07-27", "Скраб, Крем"),
      h("2026-07-28", "Крем"),
      h("2026-07-29", "Крем"),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["крем", "скраб"]);
    expect(rows.map((r) => r.count)).toEqual([3, 1]);
  });

  it("при рівній кількості порядок беруть з мапи кольорів", () => {
    const rows = week([h("2026-07-27", "Маска, Скраб")]);
    expect(rows.map((r) => r.key)).toEqual(["скраб", "маска"]);
  });

  it("теги, яких не було в періоді, у рядки не потрапляють", () => {
    const rows = week([h("2026-07-27", "Крем")]);
    expect(rows.map((r) => r.key)).toEqual(["крем"]);
  });

  it("дні поза періодом ігноруються", () => {
    const rows = week([h("2026-07-20", "Крем"), h("2026-08-10", "Крем")]);
    expect(rows).toHaveLength(0);
  });

  it("дубль тега в один день рахується один раз", () => {
    const rows = week([h("2026-07-27", "Крем, крем")]);
    expect(rows[0].count).toBe(1);
  });

  it("null і порожній care не ламають підрахунок", () => {
    const rows = week([h("2026-07-27", null), h("2026-07-28", " , "), h("2026-07-29", "Крем")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
  });

  it("тег, якого немає в мапі кольорів, отримує запасний сірий", () => {
    const rows = week([h("2026-07-27", "Невідомий")]);
    expect(rows[0].color).toBe(CARE_FALLBACK_COLOR);
    expect(rows[0].label).toBe("Невідомий");
  });

  it("бере колір і написання з мапи", () => {
    const rows = week([h("2026-07-27", "крем")]);
    expect(rows[0].color).toBe(CARE_COLORS[1]);
    expect(rows[0].label).toBe("Крем");
  });
});
