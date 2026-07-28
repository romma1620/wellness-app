import { describe, expect, it } from "vitest";
import {
  buildCareColorMap,
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
