import { addDays, splitTags } from "@/lib/utils";

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

export interface CareRow extends CareTag {
  /** Скільки днів у періоді цей догляд був. */
  count: number;
  /** Довжина = кількість днів періоду; true = того дня догляд був. */
  days: boolean[];
}

/**
 * Рядки графіка за період [startISO, startISO + days).
 * Сортування: за кількістю спадання, при рівності — за порядком у мапі кольорів.
 */
export function buildCareMatrix(
  logs: CareHistoryRow[],
  startISO: string,
  days: number,
  colors: Map<string, CareTag>,
): CareRow[] {
  const column = new Map<string, number>();
  for (let i = 0; i < days; i++) column.set(addDays(startISO, i), i);

  const rows = new Map<string, CareRow>();

  for (const log of logs) {
    const col = column.get(log.date);
    if (col === undefined) continue;
    for (const tag of splitTags(log.care)) {
      const key = careKey(tag);
      if (!key) continue;
      let row = rows.get(key);
      if (!row) {
        const known = colors.get(key);
        row = {
          key,
          label: known?.label ?? tag.trim(),
          color: known?.color ?? CARE_FALLBACK_COLOR,
          count: 0,
          days: Array<boolean>(days).fill(false),
        };
        rows.set(key, row);
      }
      if (!row.days[col]) {
        row.days[col] = true;
        row.count++;
      }
    }
  }

  const order = [...colors.keys()];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  return [...rows.values()].sort((a, b) => b.count - a.count || rank(a.key) - rank(b.key));
}
