import { describe, expect, it } from "vitest";
import { insightSummary } from "./insight-summary";

describe("insightSummary", () => {
  it("є звʼязки — Орі радіє і рахує їх з правильним відмінком", () => {
    expect(insightSummary(["link", "no-link", "collecting"])).toMatchObject({
      pose: "happy",
      title: "Знайшли 1 звʼязок",
    });
    expect(insightSummary(["link", "link", "no-link"]).title).toBe("Знайшли 2 звʼязки");
  });

  it("усі пари ще збирають дані", () => {
    const s = insightSummary(["collecting", "collecting", "collecting"]);
    expect(s.pose).toBe("idle");
    expect(s.title).toBe("Ще збираємо дані");
  });

  it("дані є, а звʼязків нема — спокійна чесна відповідь", () => {
    const s = insightSummary(["no-link", "no-contrast", "collecting"]);
    expect(s.pose).toBe("idle");
    expect(s.title).toBe("Явних звʼязків поки не видно");
  });
});
