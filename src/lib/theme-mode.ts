/**
 * Режим відображення: світлий, темний або «як у системи».
 *
 * Зберігається в localStorage, а не в профілі: «Система» за означенням
 * прив'язана до пристрою, тож і явний вибір логічно тримати поруч —
 * телефон може бути темним, а ноутбук світлим.
 */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODES: ThemeMode[] = ["light", "system", "dark"];

export const MODE_STORAGE_KEY = "aura-mode";

/** Режим за замовчуванням — темний: редизайн намальований dark-first. */
export const DEFAULT_MODE: ThemeMode = "dark";

/** Значення з localStorage: усе, крім відомих режимів, — це DEFAULT_MODE. */
export function parseThemeMode(raw: string | null): ThemeMode {
  return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : DEFAULT_MODE;
}

/** Що реально малюємо: "system" розгортається за prefers-color-scheme. */
export function resolveMode(mode: ThemeMode, systemDark: boolean): "light" | "dark" {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}
