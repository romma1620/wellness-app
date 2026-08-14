import { describe, expect, it } from "vitest";
import { tileBands, type PhaseBand } from "./chart-bands";

const labels = ["01", "02", "03", "04", "05", "06", "07"];

describe("tileBands", () => {
  it("розтягує суміжні смуги до спільної межі", () => {
    const bands: PhaseBand[] = [
      { phase: "menstrual", x1: "01", x2: "02" },
      { phase: "follicular", x1: "03", x2: "05" },
    ];
    expect(tileBands(bands, labels)).toEqual([
      { phase: "menstrual", x1: "01", x2: "03" },
      { phase: "follicular", x1: "03", x2: "05" },
    ]);
  });

  it("не тягне смугу через день без фази", () => {
    const bands: PhaseBand[] = [
      { phase: "luteal", x1: "01", x2: "02" },
      // День "03" без фази: наступна смуга починається з "04".
      { phase: "menstrual", x1: "04", x2: "06" },
    ];
    expect(tileBands(bands, labels)).toEqual(bands);
  });

  it("остання смуга і порожній список лишаються як є", () => {
    expect(tileBands([], labels)).toEqual([]);
    const single: PhaseBand[] = [{ phase: "ovulation", x1: "02", x2: "02" }];
    expect(tileBands(single, labels)).toEqual(single);
  });

  it("не мутує вхідні смуги", () => {
    const bands: PhaseBand[] = [
      { phase: "menstrual", x1: "01", x2: "02" },
      { phase: "follicular", x1: "03", x2: "04" },
    ];
    tileBands(bands, labels);
    expect(bands[0].x2).toBe("02");
  });
});
