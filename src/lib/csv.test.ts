import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

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
