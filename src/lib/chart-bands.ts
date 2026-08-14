import type { Phase } from "@/lib/cycle/types";

/** Смуга фази у категоріях осі X (мітки точок), включно з обома краями. */
export interface PhaseBand {
  phase: Phase;
  x1: string;
  x2: string;
}

/**
 * Готує смуги до точкової шкали: rect «центр—центр» лишав би щілину в один
 * день між суміжними фазами, тому x2 кожної смуги розтягується до x1
 * наступної. Розтяжки нема, якщо наступна смуга починається НЕ наступного
 * дня — день без фази мусить лишитись видимим розривом.
 */
export function tileBands(bands: PhaseBand[], labels: string[]): PhaseBand[] {
  const index = new Map(labels.map((label, i) => [label, i]));
  return bands.map((band, i) => {
    const next = bands[i + 1];
    if (!next) return band;
    const end = index.get(band.x2);
    const nextStart = index.get(next.x1);
    return end != null && nextStart === end + 1 ? { ...band, x2: next.x1 } : band;
  });
}
