import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyPatch } from "@/lib/daily-log";
import type { DailyLog } from "@/lib/types";
import { addDays } from "@/lib/utils";

type SB = SupabaseClient;

export interface DayWindow {
  current: DailyLog | null;
  /** Найраніша вага за попередні 7 днів — база для тижневої дельти. */
  baselineWeight: number | null;
}

export async function loadDayWindow(sb: SB, uid: string, date: string): Promise<DayWindow> {
  const { data, error } = await sb
    .from("daily_logs")
    .select("*")
    .eq("user_id", uid)
    .gte("date", addDays(date, -7))
    .lte("date", date)
    .order("date", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as DailyLog[];
  return {
    current: rows.find((r) => r.date === date) ?? null,
    baselineWeight: rows.find((r) => r.date !== date && r.weight != null)?.weight ?? null,
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
