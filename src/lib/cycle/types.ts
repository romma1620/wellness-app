// ----------------------- Денний запис -----------------------

/** Сила виділень. Порядок масиву — порядок зростання, ним же йдуть кнопки в DaySheet. */
export const FLOWS = ["spotting", "light", "medium", "heavy"] as const;
export type Flow = (typeof FLOWS)[number];

/**
 * Підписи шкали. Це те, що юзерка бачить щодня про власне тіло, тож слова
 * тут описують інтенсивність і нічого більше — без побутової лексики,
 * яка звучить як оцінка.
 *
 * Ключі в БД лишаються англійськими ('spotting'), тому підпис можна
 * переписати будь-коли без міграції даних.
 */
export const FLOW_LABELS: Record<Flow, string> = {
  spotting: "сліди",
  light: "слабко",
  medium: "середньо",
  heavy: "сильно",
};

export const MOODS = ["great", "good", "neutral", "low", "bad"] as const;
export type Mood = (typeof MOODS)[number];

/** Словами — для експорту й скрінрідера, де емодзі нічого не пояснює. */
export const MOOD_LABELS: Record<Mood, string> = {
  great: "чудовий",
  good: "добрий",
  neutral: "нейтральний",
  low: "знижений",
  bad: "поганий",
};

export const MOOD_EMOJI: Record<Mood, string> = {
  great: "😄",
  good: "🙂",
  neutral: "😐",
  low: "🙁",
  bad: "😞",
};

/** Ключі симптомів. Зберігаються в БД, тому перейменовувати не можна — лише додавати. */
export const SYMPTOMS = [
  { key: "cramps", label: "Судоми" },
  { key: "headache", label: "Головний біль" },
  { key: "bloating", label: "Здуття" },
  { key: "breast_tenderness", label: "Чутливість грудей" },
  { key: "back_pain", label: "Біль у спині" },
  { key: "acne", label: "Акне" },
  { key: "fatigue", label: "Втома" },
  { key: "nausea", label: "Нудота" },
] as const;

export type SymptomKey = (typeof SYMPTOMS)[number]["key"];

export function symptomLabel(key: string): string {
  return SYMPTOMS.find((s) => s.key === key)?.label ?? key;
}

export interface CycleEntry {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  flow: Flow | null;
  symptoms: string[];
  mood: Mood | null;
  energy: number | null; // 1..5
  notes: string | null;
  updated_at: string;
}

/** Те, що DaySheet реально редагує. */
export type EntryDraft = Pick<CycleEntry, "flow" | "symptoms" | "mood" | "energy" | "notes">;

export const EMPTY_DRAFT: EntryDraft = {
  flow: null,
  symptoms: [],
  mood: null,
  energy: null,
  notes: null,
};

export function draftFromEntry(entry: CycleEntry | null): EntryDraft {
  if (!entry) return EMPTY_DRAFT;
  return {
    flow: entry.flow,
    symptoms: entry.symptoms ?? [],
    mood: entry.mood,
    energy: entry.energy,
    notes: entry.notes,
  };
}

/**
 * Порожній чернетка = день, який нічим не відрізняється від невідмаченого.
 * Такі записи не тримаємо в БД: інакше «є запис» у календарі показувало б
 * крапку там, де юзерка все познімала.
 */
export function isEmptyDraft(d: EntryDraft): boolean {
  return (
    d.flow === null &&
    d.symptoms.length === 0 &&
    d.mood === null &&
    d.energy === null &&
    (d.notes === null || d.notes.trim() === "")
  );
}

// ----------------------- Налаштування -----------------------

export interface CycleSettings {
  user_id: string;
  enabled: boolean;
  typical_cycle_length: number;
  typical_period_length: number;
  show_fertile_window: boolean;
  phase_bands_in_charts: boolean;
}

export const DEFAULT_SETTINGS: Omit<CycleSettings, "user_id"> = {
  enabled: false,
  typical_cycle_length: 28,
  typical_period_length: 5,
  show_fertile_window: true,
  phase_bands_in_charts: false,
};

/**
 * Межі типової довжини циклу з онбордингу й налаштувань.
 *
 * Верхня межа навмисно з запасом: 60 днів — це вже олігоменорея, але
 * застосунок не має підстав казати юзерці, що її цикл «неправильний»,
 * і тим паче не має ламати їй прогноз округленням до 40.
 *
 * Мусить збігатися з CHECK-обмеженням cycle_settings.typical_cycle_length
 * у supabase/schema.sql — інакше слайдер дозволить значення, яке БД
 * відкине вже на збереженні.
 */
export const CYCLE_LENGTH_MIN = 21;
export const CYCLE_LENGTH_MAX = 60;

// ----------------------- Фази -----------------------

export const PHASES = ["menstrual", "follicular", "ovulation", "luteal", "late_luteal"] as const;
export type Phase = (typeof PHASES)[number];

/**
 * Палітра фаз узята з дизайну і НЕ залежить від теми застосунку: фаза —
 * це значення даних, а не акцент інтерфейсу, тож вона мусить читатись
 * однаково на всіх чотирьох темах (як CARE_COLORS).
 */
export const PHASE_COLORS: Record<Phase, string> = {
  menstrual: "#D4677E",
  follicular: "#7FB59B",
  ovulation: "#5FA8B8",
  luteal: "#A28BC4",
  late_luteal: "#D9A05B",
};

/**
 * Тінт тієї ж фази — для фонів карток і плашок. Це CSS-токени з globals.css,
 * а не hex: у темному режимі пастель стає темним тінтом того самого відтінку,
 * і кожен споживач отримує це безкоштовно.
 */
export const PHASE_TINTS: Record<Phase, string> = {
  menstrual: "var(--tint-rose-soft)",
  follicular: "var(--tint-green)",
  ovulation: "var(--tint-teal)",
  luteal: "var(--tint-lavender)",
  late_luteal: "var(--tint-amber)",
};

export const PHASE_LABELS: Record<Phase, string> = {
  menstrual: "Менструація",
  follicular: "Фолікулярна фаза",
  ovulation: "Овуляція",
  luteal: "Лютеїнова фаза",
  late_luteal: "Пізня лютеїнова",
};

/** Компактні підписи для легенди графіка, де місця на повні назви немає. */
export const PHASE_SHORT: Record<Phase, string> = {
  menstrual: "менстр.",
  follicular: "фолікул.",
  ovulation: "ов.",
  luteal: "лютеїнова",
  late_luteal: "ПМС",
};

// ----------------------- Цикл -----------------------

export interface Cycle {
  /** Перший день менструації — день 1 циклу. */
  start: string;
  /** День перед стартом наступного циклу. null = цикл ще триває. */
  end: string | null;
  /** Днів кровотечі, від start до останнього дня цієї менструації включно. */
  periodLength: number;
  /** Довжина завершеного циклу в днях. null = цикл ще триває. */
  length: number | null;
}

export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Високий",
  medium: "Середній",
  low: "Низький",
};
