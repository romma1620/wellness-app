import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_ORDER,
  isWidgetId,
  normalizeOrder,
  reorder,
  sameOrder,
  type WidgetId,
} from "./home-widgets";

describe("normalizeOrder", () => {
  it("порожній вхід — дефолтний порядок", () => {
    expect(normalizeOrder(null)).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(normalizeOrder(undefined)).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(normalizeOrder([])).toEqual([...DEFAULT_WIDGET_ORDER]);
  });

  it("не масив — дефолтний порядок", () => {
    expect(normalizeOrder("water")).toEqual([...DEFAULT_WIDGET_ORDER]);
    expect(normalizeOrder({ 0: "water" })).toEqual([...DEFAULT_WIDGET_ORDER]);
  });

  it("зберігає порядок користувача", () => {
    const saved: WidgetId[] = ["water", "note", "weight", "steps", "nutrition", "activity"];
    expect(normalizeOrder(saved)).toEqual(saved);
  });

  it("дописує відсутні віджети в кінець у дефолтному порядку", () => {
    // так виглядає збережений порядок після появи нового віджета в коді
    expect(normalizeOrder(["note", "water"])).toEqual([
      "note",
      "water",
      ...DEFAULT_WIDGET_ORDER.filter((id) => id !== "note" && id !== "water"),
    ]);
  });

  it("викидає невідомі id та не-рядки", () => {
    expect(normalizeOrder(["kcal-tile", 7, null, "water"])[0]).toBe("water");
    expect(normalizeOrder(["kcal-tile", 7, null, "water"])).toHaveLength(
      DEFAULT_WIDGET_ORDER.length,
    );
  });

  it("знімає дублікати, лишаючи першу появу", () => {
    const out = normalizeOrder(["water", "water", "note"]);
    expect(out).toEqual([
      "water",
      "note",
      ...DEFAULT_WIDGET_ORDER.filter((id) => id !== "water" && id !== "note"),
    ]);
  });

  it("результат завжди повний і без повторів", () => {
    const out = normalizeOrder(["note", "note", "xxx"]);
    expect(new Set(out).size).toBe(DEFAULT_WIDGET_ORDER.length);
  });
});

describe("isWidgetId", () => {
  it("пропускає лише відомі id", () => {
    expect(isWidgetId("water")).toBe(true);
    expect(isWidgetId("kcal")).toBe(false);
    expect(isWidgetId(42)).toBe(false);
  });
});

describe("reorder", () => {
  const base: WidgetId[] = ["weight", "steps", "water", "nutrition", "activity", "note"];

  it("переносить елемент згори вниз", () => {
    expect(reorder(base, "weight", "water")).toEqual([
      "steps",
      "water",
      "weight",
      "nutrition",
      "activity",
      "note",
    ]);
  });

  it("переносить елемент знизу вгору", () => {
    expect(reorder(base, "note", "steps")).toEqual([
      "weight",
      "note",
      "steps",
      "water",
      "nutrition",
      "activity",
    ]);
  });

  it("той самий id — порядок без змін", () => {
    expect(reorder(base, "water", "water")).toEqual(base);
  });

  it("невідомий id — порядок без змін", () => {
    expect(reorder(base, "water", "kcal")).toEqual(base);
    expect(reorder(base, "kcal", "water")).toEqual(base);
  });
});

describe("sameOrder", () => {
  it("порівнює поелементно", () => {
    expect(sameOrder(["water", "note"], ["water", "note"])).toBe(true);
    expect(sameOrder(["water", "note"], ["note", "water"])).toBe(false);
    expect(sameOrder(["water"], ["water", "note"])).toBe(false);
  });
});
