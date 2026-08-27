import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPatch } from "@/lib/daily-log";
import type { DailyLog } from "@/lib/types";
import { addDays } from "@/lib/utils";

type SB = SupabaseClient;

/** Колонки, з яких збирається форма дня; службові (id, updated_at) не потрібні. */
export type DayRow = Pick<
  DailyLog,
  | "date"
  | "weight"
  | "kcal"
  | "protein"
  | "fat"
  | "carbs"
  | "water"
  | "steps"
  | "sport"
  | "care"
  | "comment"
>;
const DAY_COLUMNS = "date, weight, kcal, protein, fat, carbs, water, steps, sport, care, comment";

export interface DayWindow {
  current: DayRow | null;
  /** Найраніша вага за попередні 7 днів — база для тижневої дельти. */
  baselineWeight: number | null;
}

export async function loadDayWindow(sb: SB, uid: string, date: string): Promise<DayWindow> {
  // Два вузькі запити паралельно замість восьми повних рядків: базовій вазі
  // потрібне одне число, а не тексти коментарів за весь тиждень.
  const [cur, base] = await Promise.all([
    sb.from("daily_logs").select(DAY_COLUMNS).eq("user_id", uid).eq("date", date).maybeSingle(),
    sb
      .from("daily_logs")
      .select("weight")
      .eq("user_id", uid)
      .gte("date", addDays(date, -7))
      .lt("date", date)
      .not("weight", "is", null)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (cur.error) throw cur.error;
  if (base.error) throw base.error;

  return {
    current: (cur.data ?? null) as DayRow | null,
    baselineWeight: (base.data?.weight ?? null) as number | null,
  };
}

/**
 * Пише лише змінені колонки, тому помилковий або запізнілий запис фізично
 * не може стерти решту дня (повний upsert раніше саме це й робив).
 * Дата приходить аргументом і завжди належить формі, з якої зроблено патч.
 */
export async function saveDayPatch(
  sb: SB,
  uid: string,
  date: string,
  patch: DailyPatch,
): Promise<void> {
  // updated_at не має тригера в схемі — оновлюємо явно
  const withStamp = { ...patch, updated_at: new Date().toISOString() };

  const { data, error } = await sb
    .from("daily_logs")
    .update(withStamp)
    .eq("user_id", uid)
    .eq("date", date)
    .select("id");
  if (error) throw error;
  if ((data ?? []).length > 0) return;

  const { error: insErr } = await sb.from("daily_logs").insert({ user_id: uid, date, ...patch });
  if (!insErr) return;
  // рядок міг зʼявитися між update і insert — доганяємо update-ом
  if (insErr.code !== "23505") throw insErr;

  const { error: retryErr } = await sb
    .from("daily_logs")
    .update(withStamp)
    .eq("user_id", uid)
    .eq("date", date);
  if (retryErr) throw retryErr;
}
