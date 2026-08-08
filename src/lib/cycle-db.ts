import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  isEmptyDraft,
  type CycleEntry,
  type CycleSettings,
  type EntryDraft,
} from "@/lib/cycle/types";

type SB = SupabaseClient;

export interface LoadedCycleSettings {
  settings: CycleSettings;
  /**
   * Чи існує рядок у БД. Це різниця між «ніколи не вмикала» і «вимкнула»:
   * у першому випадку треба онбординг, у другому — лише перемикач, бо
   * онбординг пише дату останньої менструації й дописав би фантомний
   * перший день до вже наявних записів.
   */
  onboarded: boolean;
}

/**
 * Налаштування циклу. Відсутність рядка — не помилка; тоді віддаємо
 * дефолти з enabled=false і onboarded=false.
 */
export async function loadCycleSettings(sb: SB, uid: string): Promise<LoadedCycleSettings> {
  const { data, error } = await sb
    .from("cycle_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  const row = data as CycleSettings | null;
  return {
    settings: row ?? { user_id: uid, ...DEFAULT_SETTINGS },
    onboarded: row !== null,
  };
}

export async function saveCycleSettings(
  sb: SB,
  uid: string,
  patch: Partial<Omit<CycleSettings, "user_id">>,
): Promise<void> {
  const { error } = await sb
    .from("cycle_settings")
    .upsert(
      { user_id: uid, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function loadCycleEntries(
  sb: SB,
  uid: string,
  from: string,
  to: string,
): Promise<CycleEntry[]> {
  const { data, error } = await sb
    .from("cycle_entries")
    .select("*")
    .eq("user_id", uid)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CycleEntry[];
}

/**
 * Записує день цілком.
 *
 * DaySheet — маленька форма, яку весь час тримає одна людина на одному
 * екрані, тож патчити окремі колонки (як у daily_logs) тут нема від чого
 * захищатися. Натомість важливе інше: день, з якого все познімали,
 * видаляється, а не лишається порожнім рядком — інакше календар малював
 * би крапку «є запис» там, де записувати вже нічого.
 */
export async function saveCycleEntry(
  sb: SB,
  uid: string,
  date: string,
  draft: EntryDraft,
): Promise<void> {
  if (isEmptyDraft(draft)) {
    const { error } = await sb.from("cycle_entries").delete().eq("user_id", uid).eq("date", date);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from("cycle_entries").upsert(
    {
      user_id: uid,
      date,
      flow: draft.flow,
      symptoms: draft.symptoms,
      mood: draft.mood,
      energy: draft.energy,
      notes: draft.notes?.trim() ? draft.notes.trim() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}

/**
 * Видаляє всі дані циклу назавжди. Налаштування йдуть разом із записами:
 * лишити їх означало б лишити слід фічі там, де юзерка просила чистого аркуша.
 */
export async function deleteAllCycleData(sb: SB, uid: string): Promise<void> {
  const { error: entriesErr } = await sb.from("cycle_entries").delete().eq("user_id", uid);
  if (entriesErr) throw entriesErr;
  const { error: settingsErr } = await sb.from("cycle_settings").delete().eq("user_id", uid);
  if (settingsErr) throw settingsErr;
}
