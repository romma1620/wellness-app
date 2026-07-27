import type { DailyLog } from "@/lib/types";

/**
 * Поля дня в тому вигляді, в якому їх тримають інпути:
 * текстові — завжди рядок ("" замість null), щоб інпути лишались контрольованими.
 */
export interface DailyForm {
  weight: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  water: number | null;
  steps: number | null; // фактичні кроки
  sport: string;
  care: string;
  comment: string;
}

/** Набір колонок daily_logs для часткового запису. */
export type DailyPatch = {
  [K in keyof DailyForm]?: DailyForm[K] extends string ? string | null : number | null;
};

export const EMPTY_DAY: DailyForm = {
  weight: null,
  kcal: null,
  protein: null,
  fat: null,
  carbs: null,
  water: null,
  steps: null,
  sport: "",
  care: "",
  comment: "",
};

const TEXT_KEYS = ["sport", "care", "comment"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

const FORM_KEYS = Object.keys(EMPTY_DAY) as (keyof DailyForm)[];

function isTextKey(key: keyof DailyForm): key is TextKey {
  return (TEXT_KEYS as readonly string[]).includes(key);
}

export function formFromRow(row: DailyLog | null | undefined): DailyForm {
  if (!row) return EMPTY_DAY;
  return {
    weight: row.weight,
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    water: row.water,
    steps: row.steps,
    sport: row.sport ?? "",
    care: row.care ?? "",
    comment: row.comment ?? "",
  };
}

/**
 * Лише поля, що відрізняються від завантаженого з сервера знімка.
 * Порожній текст нормалізується в null — інакше свіжозавантажений день,
 * де sport був null, одразу виглядав би зміненим.
 */
export function diffDay(loaded: DailyForm, current: DailyForm): DailyPatch {
  const patch: DailyPatch = {};
  for (const key of FORM_KEYS) {
    if (isTextKey(key)) {
      const before = loaded[key] || null;
      const after = current[key] || null;
      if (before !== after) patch[key] = after;
    } else {
      const before = loaded[key];
      const after = current[key];
      if (before !== after) patch[key] = after;
    }
  }
  return patch;
}

/** Очищене поле теж є зміною, тому рахуємо ключі, а не значення. */
export function hasChanges(patch: DailyPatch): boolean {
  return Object.keys(patch).length > 0;
}

/** Успішно збережений патч стає новою базою для наступних diff-ів. */
export function applySaved(loaded: DailyForm, patch: DailyPatch): DailyForm {
  const next: DailyForm = { ...loaded };
  for (const key of FORM_KEYS) {
    if (!(key in patch)) continue;
    if (isTextKey(key)) {
      next[key] = (patch[key] as string | null) ?? "";
    } else {
      next[key] = patch[key] as number | null;
    }
  }
  return next;
}
