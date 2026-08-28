import { PHASE_COLORS, type Phase } from "@/lib/cycle/types";

/**
 * Тінт кольору даних поверх поверхні картки — ідіома редизайну:
 * `color-mix(in oklab, <hex> 16%, var(--surface))`. Один і той самий hex
 * дає світлу пастель у світлому режимі й темний тінт у темному, тож
 * окремих токенів на кожну фазу не потрібно.
 */
export function mixOnSurface(hex: string, pct: number): string {
  return `color-mix(in oklab, ${hex} ${pct}%, var(--surface))`;
}

/** Тінт фази для плиток іконок і фонів (16%, як у дизайні). */
export function phaseTint(phase: Phase, pct = 16): string {
  return mixOnSurface(PHASE_COLORS[phase], pct);
}
