export type ThemeName = "peach" | "mint" | "lavender";

export const THEMES: ThemeName[] = ["peach", "mint", "lavender"];

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  height: number | null;
  target_weight: number | null;
  theme: ThemeName;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  water: number | null; // 0-8
  steps: number | null;
  sport: string | null;
  care: string | null;
  comment: string | null;
  updated_at: string;
}

export interface Measurement {
  id: string;
  user_id: string;
  date: string;
  waist: number | null;
  hips: number | null;
  chest: number | null;
  leg: number | null;
  arm: number | null;
  created_at: string;
}

export interface Reward {
  id: string;
  user_id: string;
  weight: number;
  gift: string;
  achieved: boolean;
  created_at: string;
}

export type MeasurementKey = "waist" | "hips" | "chest" | "leg" | "arm";

export const MEASUREMENT_META: { key: MeasurementKey; label: string }[] = [
  { key: "waist", label: "Талія" },
  { key: "hips", label: "Стегна" },
  { key: "chest", label: "Груди" },
  { key: "leg", label: "Обхват ноги" },
  { key: "arm", label: "Обхват руки" },
];

// ----------------------- Тренування -----------------------

export type MuscleGroup = "ноги" | "спина" | "груди" | "плечі" | "руки" | "кор" | "інше";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "ноги", "спина", "груди", "плечі", "руки", "кор", "інше",
];

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  muscle_group: MuscleGroup | null;
  created_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
}

export interface Workout {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  routine_id: string | null;
  name: string | null;
  note: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number;
  created_at: string;
}
