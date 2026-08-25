import { describe, expect, it } from "vitest";
import { parseThemeMode, resolveMode, THEME_MODES } from "./theme-mode";

describe("parseThemeMode", () => {
  it("повертає кожне відоме значення як є", () => {
    for (const m of THEME_MODES) {
      expect(parseThemeMode(m)).toBe(m);
    }
  });

  it("незнайоме значення чи відсутній запис → light", () => {
    // localStorage повертає null, коли ключа нема, і будь-який рядок,
    // якщо туди щось писала стара версія — обидва не мають ламати завантаження.
    expect(parseThemeMode(null)).toBe("light");
    expect(parseThemeMode("")).toBe("light");
    expect(parseThemeMode("dark-ish")).toBe("light");
  });
});

describe("resolveMode", () => {
  it("явний вибір не залежить від системного налаштування", () => {
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("light", false)).toBe("light");
    expect(resolveMode("dark", true)).toBe("dark");
    expect(resolveMode("dark", false)).toBe("dark");
  });

  it("system наслідує prefers-color-scheme", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
  });
});
