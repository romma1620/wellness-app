import { describe, expect, it } from "vitest";
import { bandDays, type PhaseBand } from "./chart-bands";

const labels = ["01", "02", "03", "04", "05", "06", "07"];

describe("bandDays", () => {
  it("багатоденна смуга повертає весь діапазон міток включно", () => {
    const band: PhaseBand = { phase: "follicular", x1: "02", x2: "05" };
    expect(bandDays(band, labels)).toEqual(["02", "03", "04", "05"]);
  });

  it("одноденна смуга повертає одну мітку", () => {
    const band: PhaseBand = { phase: "ovulation", x1: "03", x2: "03" };
    expect(bandDays(band, labels)).toEqual(["03"]);
  });

  it("x1 немає серед міток → порожньо", () => {
    const band: PhaseBand = { phase: "menstrual", x1: "99", x2: "03" };
    expect(bandDays(band, labels)).toEqual([]);
  });

  it("x2 немає серед міток → порожньо", () => {
    const band: PhaseBand = { phase: "menstrual", x1: "01", x2: "99" };
    expect(bandDays(band, labels)).toEqual([]);
  });

  it("перевернуті індекси (x2 перед x1) → порожньо", () => {
    const band: PhaseBand = { phase: "luteal", x1: "05", x2: "02" };
    expect(bandDays(band, labels)).toEqual([]);
  });
});
