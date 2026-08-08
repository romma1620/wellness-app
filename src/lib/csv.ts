/**
 * Збірка CSV для експорту даних. Чиста логіка: без React і без Supabase.
 *
 * Діалект підібраний під локалі з десятковою комою (uk-UA): роздільник полів
 * `;`, десятковий роздільник — кома. Тому кома всередині значення
 * ("Скраб, Крем") не потребує екранування.
 */

const DELIMITER = ";";
const EOL = "\r\n";

export type CsvValue = string | number | null | undefined;

/** Повне значення з комою: не fmt() — той округлює й ставить розділювач тисяч. */
function numToCsv(n: number): string {
  return String(n).replace(".", ",");
}

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "number" ? (Number.isFinite(value) ? numToCsv(value) : "") : value;
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvField).join(DELIMITER)).join(EOL);
}

/** Excel читає UTF-8 без BOM як кракозябри — префікс обовʼязковий. */
const BOM = "\uFEFF";

export type ExportRange = "week" | "month" | "all";

export interface DailyRow {
  date: string;
  weight: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  water: number | null;
  steps: number | null;
  sport: string | null;
  care: string | null;
  comment: string | null;
}

export interface MeasurementRow {
  date: string;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  leg: number | null;
  arm: number | null;
}

/** Тренування як його віддає PostgREST: вкладені підходи без гарантованого порядку. */
export interface RawWorkout {
  date: string;
  name: string | null;
  workout_sets:
    | {
        set_number: number;
        weight: number | null;
        reps: number;
        exercises: { name: string } | null;
      }[]
    | null;
}

/** Один рядок CSV = один підхід; дата й назва тренування денормалізовані. */
export interface WorkoutSetRow {
  date: string;
  workout: string | null;
  exercise: string | null;
  setNumber: number;
  weight: number | null;
  reps: number;
}

export interface ExportData {
  daily: DailyRow[];
  measurements: MeasurementRow[];
  workouts: WorkoutSetRow[];
}

const DAILY_HEADER = [
  "Дата", "Вага", "Ккал", "Білки", "Жири", "Вуглеводи",
  "Вода", "Кроки", "Спорт", "Догляд", "Коментар",
];
const MEASUREMENT_HEADER = ["Дата", "Талія", "Стегна", "Груди", "Нога", "Рука"];
const WORKOUT_HEADER = ["Дата", "Тренування", "Вправа", "Підхід", "Вага", "Повтори"];

export function flattenWorkouts(workouts: RawWorkout[]): WorkoutSetRow[] {
  return workouts.flatMap((w) =>
    // копія перед sort: мутувати вхідні дані не можна
    [...(w.workout_sets ?? [])]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({
        date: w.date,
        workout: w.name,
        exercise: s.exercises?.name ?? null,
        setNumber: s.set_number,
        weight: s.weight,
        reps: s.reps,
      })),
  );
}

/**
 * Повний файл: BOM + три секції через порожній рядок.
 * Заголовки колонок пишуться завжди — структура файлу не залежить від даних.
 */
export function buildExportCsv(data: ExportData): string {
  const sections = [
    toCsv([
      ["# Щоденник"],
      DAILY_HEADER,
      ...data.daily.map((r) => [
        r.date, r.weight, r.kcal, r.protein, r.fat, r.carbs,
        r.water, r.steps, r.sport, r.care, r.comment,
      ]),
    ]),
    toCsv([
      ["# Заміри"],
      MEASUREMENT_HEADER,
      ...data.measurements.map((r) => [r.date, r.waist, r.hips, r.chest, r.leg, r.arm]),
    ]),
    toCsv([
      ["# Тренування"],
      WORKOUT_HEADER,
      ...data.workouts.map((r) => [
        r.date, r.workout, r.exercise, r.setNumber, r.weight, r.reps,
      ]),
    ]),
  ];
  return BOM + sections.join(EOL + EOL) + EOL;
}

export function exportFileName(range: ExportRange, todayIso: string): string {
  return `aura-${range}-${todayIso}.csv`;
}

/**
 * Дані циклу експортуються окремим файлом, а не секцією загального:
 * вивантажити щоденник, не вивантаживши разом із ним цикл, мусить бути
 * можливо — це різні за чутливістю дані.
 */
export interface CycleCsvRow {
  date: string;
  cycleDay: number | null;
  /** Підписи, а не ключі БД: файл читає людина, а не застосунок. */
  flow: string | null;
  symptoms: string;
  mood: string | null;
  energy: number | null;
  notes: string | null;
}

const CYCLE_HEADER = [
  "Дата", "День циклу", "Виділення", "Симптоми", "Настрій", "Енергія", "Нотатка",
];

export function buildCycleCsv(rows: CycleCsvRow[]): string {
  return (
    BOM +
    toCsv([
      ["# Цикл"],
      CYCLE_HEADER,
      ...rows.map((r) => [
        r.date, r.cycleDay, r.flow, r.symptoms, r.mood, r.energy, r.notes,
      ]),
    ]) +
    EOL
  );
}

export function cycleExportFileName(todayIso: string): string {
  return `aura-cycle-${todayIso}.csv`;
}

export function isExportEmpty(data: ExportData): boolean {
  return (
    data.daily.length === 0 && data.measurements.length === 0 && data.workouts.length === 0
  );
}
