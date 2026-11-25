import { describe, expect, it } from "vitest";
import { ringSegments } from "@/lib/cycle/ring";

describe("ringSegments", () => {
  it("covers the whole cycle without gaps and splits at today", () => {
    const { span, segments } = ringSegments(10, 28, 5);
    expect(span).toBe(28);
    expect(segments[0]).toMatchObject({ phase: "menstrual", from: 0, to: 5, past: true });
    for (let i = 1; i < segments.length; i++) expect(segments[i].from).toBe(segments[i - 1].to);
    expect(segments.at(-1)!.to).toBe(28);
    expect(segments.filter((s) => s.past).at(-1)!.to).toBe(10);
  });

  it("extends an overdue cycle with late luteal days, all lived", () => {
    const { span, segments } = ringSegments(40, 28, 5);
    expect(span).toBe(40);
    expect(segments.every((s) => s.past)).toBe(true);
    expect(segments.at(-1)).toMatchObject({ phase: "late_luteal", from: 28, to: 40 });
  });
});
