import { splitTags } from "@/lib/utils";

/** Пресети догляду на головній. Порядок задає перші чотири кольори. */
export const CARE_PRESETS = ["Скраб", "Крем", "Гуаша", "Маска"];

/**
 * Вісім слотів категорійної палітри, однакові на всіх темах.
 * Перевірені валідатором на розділення при дальтонізмі — порядок міняти не можна.
 */
export const CARE_COLORS = [
  "#2E9155", // зелений
  "#E4749F", // рожевий
  "#C9A84A", // золотий
  "#7B4FB8", // лаванда
  "#50B7FE", // блакитний
  "#A9246E", // малиновий
  "#8B5A00", // бронза
  "#1980E8", // синій
];

/** Девʼятий і далі тег: більше кольорів надійно не розрізнити. */
export const CARE_FALLBACK_COLOR = "#8A8A8A";

export interface CareTag {
  key: string;
  label: string;
  color: string;
}

export interface CareHistoryRow {
  date: string; // YYYY-MM-DD
  care: string | null;
}

/** Теги порівнюються без урахування регістру й країв. */
export function careKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Мапа «ключ тега → колір» за порядком першої появи за всю історію.
 * Минуле не змінюється, тому новий тег ніколи не перефарбовує наявні.
 */
export function buildCareColorMap(history: CareHistoryRow[]): Map<string, CareTag> {
  const map = new Map<string, CareTag>();

  CARE_PRESETS.forEach((label, i) => {
    map.set(careKey(label), { key: careKey(label), label, color: CARE_COLORS[i] });
  });

  let slot = CARE_PRESETS.length;
  const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date));

  for (const row of chronological) {
    for (const tag of splitTags(row.care)) {
      const key = careKey(tag);
      if (!key || map.has(key)) continue;
      map.set(key, {
        key,
        label: tag.trim(),
        color: slot < CARE_COLORS.length ? CARE_COLORS[slot] : CARE_FALLBACK_COLOR,
      });
      slot++;
    }
  }

  return map;
}
