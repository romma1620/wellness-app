import type { Phase } from "@/lib/cycle/types";

/** Смуга фази у категоріях осі X (мітки точок), включно з обома краями. */
export interface PhaseBand {
  phase: Phase;
  x1: string;
  x2: string;
}

/**
 * Дні смуги: всі мітки від x1 до x2 включно.
 * Точкова шкала не має «ширини категорії», тому смугу малює bandX
 * по-денно — кожен день фази фарбується на повний крок шкали.
 */
export function bandDays(band: PhaseBand, labels: string[]): string[] {
  const from = labels.indexOf(band.x1);
  const to = labels.indexOf(band.x2);
  if (from === -1 || to === -1 || to < from) return [];
  return labels.slice(from, to + 1);
}
