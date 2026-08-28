import type { ThemeName } from "@/lib/types";

/**
 * Чотири акценти редизайну. Ключі — це значення enum `theme_name` у БД
 * (перейменовувати їх означало б міграцію заради підпису), тож тут живе
 * лише те, що бачить користувач: назва й колір свотча. Самі кольори
 * застосовує globals.css через [data-theme].
 */
export const ACCENTS: { value: ThemeName; label: string; hex: string }[] = [
  { value: "peach", label: "Gold", hex: "#C9A254" },
  { value: "mint", label: "Sage", hex: "#8FAE9B" },
  { value: "lavender", label: "Mauve", hex: "#A08BC0" },
  { value: "pink", label: "Copper", hex: "#C98963" },
];

/** Колір теми для <meta name="theme-color"> та браузерного хрому. */
export const BG_DARK = "#131110";
export const BG_LIGHT = "#F4F1EB";
