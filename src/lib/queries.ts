"use client";

import { useUid } from "@/components/UserProvider";
import { TREND_WINDOW_DAYS } from "@/lib/forecast";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Reward } from "@/lib/types";
import { addDays, todayISO } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Спільні запити, які потрібні кільком екранам одночасно. Один ключ — один
 * мережевий запит на всіх: профіль читають «Профіль», «Цілі» і прогноз;
 * винагороди — «Цілі» і прогноз; вікно ваг — прогноз і «Цілі».
 */

export function useProfile() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  return useQuery({
    queryKey: ["profile", uid],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Profile | null;
    },
  });
}

export function useRewards() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  return useQuery({
    queryKey: ["diary", uid, "rewards"],
    queryFn: async (): Promise<Reward[]> => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", uid)
        .order("weight", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });
}

export interface DatedWeight {
  date: string;
  weight: number;
}

/** Вікно спільної вибірки ваг: покриває і тренд прогнозу, і «Цілі» (30 днів). */
export const RECENT_WEIGHTS_DAYS = Math.max(TREND_WINDOW_DAYS, 30);

export function useRecentWeights() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const today = todayISO();
  return useQuery({
    // today у ключі: відкрита через північ вкладка отримає свіже вікно
    queryKey: ["diary", uid, "recent-weights", today],
    queryFn: async (): Promise<DatedWeight[]> => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("date, weight")
        .eq("user_id", uid)
        .gte("date", addDays(today, -RECENT_WEIGHTS_DAYS))
        .not("weight", "is", null)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DatedWeight[];
    },
  });
}

export interface DatedSteps {
  date: string;
  steps: number;
}

/**
 * Хвіст кроків для міні-графіка в картці «Кроки» — окремий запит, а не
 * колонка в `useRecentWeights`: там серверний фільтр викидає дні без ваги,
 * а кроки в такі дні є, і графік вийшов би діряним.
 */
export function useRecentSteps() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const today = todayISO();
  return useQuery({
    queryKey: ["diary", uid, "recent-steps", today],
    queryFn: async (): Promise<DatedSteps[]> => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("date, steps")
        .eq("user_id", uid)
        .gte("date", addDays(today, -RECENT_WEIGHTS_DAYS))
        .not("steps", "is", null)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DatedSteps[];
    },
  });
}
