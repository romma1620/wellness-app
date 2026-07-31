import type { SupabaseClient } from "@supabase/supabase-js";
import {
  flattenWorkouts,
  type DailyRow,
  type ExportData,
  type ExportRange,
  type MeasurementRow,
  type RawWorkout,
} from "@/lib/csv";
import { periodRange } from "@/lib/utils";

type SB = SupabaseClient;

/** Межі діапазону; null — «за весь час», без фільтра дат. */
function rangeBounds(range: ExportRange): { start: string; end: string } | null {
  if (range === "all") return null;
  const { start, end } = periodRange(range, 0);
  return { start, end };
}

/**
 * Три запити паралельно. Якщо падає будь-який — не віддаємо нічого:
 * файл, який мовчки не містить тренувань, гірший за відсутній.
 */
export async function loadExportData(
  sb: SB,
  uid: string,
  range: ExportRange,
): Promise<ExportData> {
  const bounds = rangeBounds(range);

  let dailyQ = sb
    .from("daily_logs")
    .select("date, weight, kcal, protein, fat, carbs, water, steps, sport, care, comment")
    .eq("user_id", uid);

  let measQ = sb
    .from("measurements")
    .select("date, waist, hips, chest, leg, arm")
    .eq("user_id", uid);

  let workQ = sb
    .from("workouts")
    .select("date, name, workout_sets(set_number, weight, reps, exercises(name))")
    .eq("user_id", uid);

  if (bounds) {
    dailyQ = dailyQ.gte("date", bounds.start).lte("date", bounds.end);
    measQ = measQ.gte("date", bounds.start).lte("date", bounds.end);
    workQ = workQ.gte("date", bounds.start).lte("date", bounds.end);
  }

  const [daily, meas, work] = await Promise.all([
    dailyQ.order("date", { ascending: true }),
    measQ.order("date", { ascending: true }),
    workQ.order("date", { ascending: true }),
  ]);

  if (daily.error) throw daily.error;
  if (meas.error) throw meas.error;
  if (work.error) throw work.error;

  return {
    daily: (daily.data ?? []) as DailyRow[],
    measurements: (meas.data ?? []) as MeasurementRow[],
    // PostgREST не гарантує порядок вкладених підходів — сортує flattenWorkouts
    workouts: flattenWorkouts((work.data ?? []) as unknown as RawWorkout[]),
  };
}
