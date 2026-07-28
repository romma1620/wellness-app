import { describe, expect, it } from "vitest";
import { splitTags } from "./utils";

describe("splitTags", () => {
  it("розбиває рядок по комах і обрізає пробіли", () => {
    expect(splitTags(" Скраб , Крем ")).toEqual(["Скраб", "Крем"]);
  });

  it("порожні значення дають порожній масив", () => {
    expect(splitTags(null)).toEqual([]);
    expect(splitTags(undefined)).toEqual([]);
    expect(splitTags("")).toEqual([]);
    expect(splitTags(" , ")).toEqual([]);
  });
});
