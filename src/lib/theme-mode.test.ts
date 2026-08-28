import { describe, expect, it } from "vitest";
import { DEFAULT_MODE, parseThemeMode, resolveMode, THEME_MODES } from "./theme-mode";

describe("parseThemeMode", () => {
  it("повертає кожне відоме значення як є", () => {
    for (const m of THEME_MODES) {
      expect(parseThemeMode(m)).toBe(m);
    }
  });

  it("незнайоме значення чи відсутній запис → режим за замовчуванням (dark)", () => {
    // localStorage повертає null, коли ключа нема, і будь-який рядок,
    // якщо туди щось писала стара версія — обидва не мають ламати завантаження.
    expect(DEFAULT_MODE).toBe("dark");
    expect(parseThemeMode(null)).toBe(DEFAULT_MODE);
    expect(parseThemeMode("")).toBe(DEFAULT_MODE);
    expect(parseThemeMode("dark-ish")).toBe(DEFAULT_MODE);
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
