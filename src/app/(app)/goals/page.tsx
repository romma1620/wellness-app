"use client";

import { ForecastCard } from "@/components/ForecastCard";
import { NumberField } from "@/components/inputs";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  FieldLabel,
  FullLoader,
  Input,
  SectionLabel,
} from "@/components/ui";
import { useProfile, useRecentWeights, useRewards } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, cn, fmt, todayISO } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

interface Editor {
  id: string | null; // null = нова
  weight: number | null;
  gift: string;
}

export default function GoalsPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  // Спільні запити з прогнозом і «Профілем» — на сторінці нуль власних.
  const profileQ = useProfile();
  const rewardsQ = useRewards();
  const weightsQ = useRecentWeights();

  const rewards = useMemo(() => rewardsQ.data ?? [], [rewardsQ.data]);
  const profile = profileQ.data ?? null;
  const { latestWeight, min7 } = useMemo(() => {
    // Семантика як раніше: остання вага й мінімум тижня — в межах 30 днів.
    const rows = (weightsQ.data ?? []).filter((r) => r.date >= addDays(todayISO(), -30));
    const last7 = rows.filter((r) => r.date >= addDays(todayISO(), -6));
    return {
      latestWeight: rows.length ? rows[rows.length - 1].weight : null,
      min7: last7.length ? Math.min(...last7.map((r) => r.weight)) : null,
    };
  }, [weightsQ.data]);
  const loading = profileQ.isPending || rewardsQ.isPending || weightsQ.isPending;
  const error =
    actionError ??
    (profileQ.isError || rewardsQ.isError || weightsQ.isError
      ? "Не вдалося завантажити цілі."
      : null);

  // Обчислення статусів сходинок.
  const computed = useMemo(() => {
    const isAchieved = (w: number) => min7 != null && min7 <= w;
    const sorted = [...rewards].sort((a, b) => a.weight - b.weight);
    const achievedWeights = sorted.filter((r) => isAchieved(r.weight)).map((r) => r.weight);
    // "наступна" — найбільша вага серед недосягнутих (найближча зверху до поточної)
    const unachieved = sorted.filter((r) => !isAchieved(r.weight));
    const next = unachieved.length ? unachieved[unachieved.length - 1] : null;

    let remaining: number | null = null;
    let progress: number | null = null;
    if (next && latestWeight != null) {
      remaining = latestWeight - next.weight;
      const baseline = achievedWeights.length ? Math.min(...achievedWeights) : latestWeight;
      const total = baseline - next.weight;
      progress = total > 0 ? Math.min(Math.max((baseline - latestWeight) / total, 0), 1) : remaining <= 0 ? 1 : 0;
    }
    return { sorted, isAchieved, next, remaining, progress };
  }, [rewards, min7, latestWeight]);

  // Синхронізуємо збережений прапорець achieved (best-effort).
  useEffect(() => {
    if (!rewardsQ.data || !weightsQ.data) return;
    rewards.forEach((r) => {
      const a = computed.isAchieved(r.weight);
      if (a !== r.achieved) {
        supabase.from("rewards").update({ achieved: a }).eq("id", r.id).then(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardsQ.data, weightsQ.data]);

  async function saveEditor() {
    if (!editor) return;
    if (editor.weight == null || !editor.gift.trim()) {
      setActionError("Вкажи вагу та назву подарунка.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      if (editor.id) {
        const { error } = await supabase
          .from("rewards")
          .update({ weight: editor.weight, gift: editor.gift.trim() })
          .eq("id", editor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rewards")
          .insert({ user_id: uid, weight: editor.weight, gift: editor.gift.trim() });
        if (error) throw error;
      }
      setEditor(null);
      // сходинки читає й прогноз — інвалідовуємо весь щоденниковий кеш
      await queryClient.invalidateQueries({ queryKey: ["diary", uid] });
    } catch {
      setActionError("Не вдалося зберегти сходинку.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
      setEditor(null);
      await queryClient.invalidateQueries({ queryKey: ["diary", uid] });
    } catch {
      setActionError("Не вдалося видалити сходинку.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цілі</h1>
        <FullLoader />
      </div>
    );
  }

  const { sorted, isAchieved, next, remaining, progress } = computed;
  const firstAchievedIdx = sorted.findIndex((r) => isAchieved(r.weight));

  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цілі</h1>

      {/* Поточна vs ціль */}
      <Card className="flex items-center justify-between">
        <div>
          <div className="text-[12.5px] font-bold text-muted">Поточна вага</div>
          <div className="mt-0.5 text-[32px] font-extrabold leading-tight">
            {latestWeight != null ? `${fmt(latestWeight, 1)} кг` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] font-bold text-muted">Ціль</div>
          <div className="mt-1 text-[20px] font-extrabold text-primary">
            {profile?.target_weight != null ? `${fmt(profile.target_weight, 1)} кг` : "—"}
          </div>
        </div>
      </Card>

      <ForecastCard />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex items-center justify-between px-1">
        <SectionLabel className="mb-0">Драбинка винагород</SectionLabel>
        {!editor && (
          <button
            type="button"
            onClick={() => setEditor({ id: null, weight: null, gift: "" })}
            className="text-[13px] font-extrabold text-primary"
          >
            + Додати
          </button>
        )}
      </div>

      {/* Редактор */}
      {editor && (
        <Card>
          <SectionLabel>{editor.id ? "Редагувати сходинку" : "Нова сходинка"}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Вага"
              suffix="кг"
              min={30}
              max={200}
              value={editor.weight}
              onChange={(v) => setEditor((e) => (e ? { ...e, weight: v } : e))}
            />
            <div>
              <FieldLabel>Подарунок</FieldLabel>
              <Input
                placeholder="Напр., Купальник 👙"
                value={editor.gift}
                onChange={(e) => setEditor((s) => (s ? { ...s, gift: e.target.value } : s))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={saveEditor} loading={saving}>
              Зберегти
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditor(null);
                setActionError(null);
              }}
            >
              Скасувати
            </Button>
          </div>
          {editor.id && (
            <button
              type="button"
              onClick={() => remove(editor.id!)}
              className="mt-3 w-full text-center text-[13px] font-extrabold text-neg"
            >
              Видалити сходинку
            </button>
          )}
        </Card>
      )}

      {/* Порожній стан */}
      {sorted.length === 0 && !editor && (
        <EmptyState
          emoji="🎁"
          title="Додай першу винагороду"
          hint="Признач собі подарунок за досягнення певної ваги — це мотивує."
        />
      )}

      {/* Драбинка */}
      {sorted.length > 0 && (
        <div className="flex flex-col">
          {sorted.map((r, idx) => {
            const achieved = isAchieved(r.weight);
            const isNext = next?.id === r.id;
            const showYouAreHere = idx === firstAchievedIdx && firstAchievedIdx > 0 && latestWeight != null;
            return (
              <div key={r.id}>
                {showYouAreHere && (
                  <div className="flex items-center gap-[14px] pb-1">
                    <div className="flex w-[30px] justify-center">
                      <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_0_4px_var(--surface),0_0_0_6px_var(--primary)]" />
                    </div>
                    <div className="py-1 text-[12px] font-extrabold text-primary">
                      Ти тут — {fmt(latestWeight, 1)} кг
                    </div>
                  </div>
                )}
                <div className="flex items-stretch gap-[14px]">
                  {/* Ліва вісь із вузлом */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[16px] font-extrabold",
                        achieved
                          ? "bg-primary text-white"
                          : isNext
                            ? "border-[3px] border-primary bg-surface shadow-[0_0_0_4px_var(--primary-light)]"
                            : "border-[2.5px] border-primary-light bg-surface",
                      )}
                    >
                      {achieved ? "✓" : ""}
                    </div>
                    {idx < sorted.length - 1 && (
                      <div
                        className={cn(
                          "w-[2.5px] flex-1",
                          achieved ? "bg-primary" : "bg-primary-light",
                        )}
                      />
                    )}
                  </div>

                  {/* Картка */}
                  <button
                    type="button"
                    onClick={() => setEditor({ id: r.id, weight: r.weight, gift: r.gift })}
                    className={cn(
                      "mb-2 flex-1 rounded-2xl bg-surface p-[14px] text-left shadow-card transition active:scale-[.99]",
                      isNext && "border-[1.5px] border-primary",
                      !achieved && !isNext && "opacity-70",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[15px] font-extrabold">
                          {fmt(r.weight, 1)} кг
                          {isNext && (
                            <span className="ml-1.5 text-[11px] font-extrabold text-primary">· наступна</span>
                          )}
                        </div>
                        <div className="text-[12.5px] font-semibold text-muted">{r.gift}</div>
                      </div>
                      <span
                        className={cn(
                          "text-[12px] font-extrabold",
                          achieved ? "text-pos" : "text-muted",
                        )}
                      >
                        {achieved ? "отримано" : "🔒"}
                      </span>
                    </div>
                    {isNext && remaining != null && progress != null && (
                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-bg">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1.5 text-[11px] font-bold text-muted">
                          {remaining > 0
                            ? `ще ${fmt(remaining, 1)} кг · ${Math.round(progress * 100)}%`
                            : "майже досягнуто!"}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {min7 == null && sorted.length > 0 && (
        <p className="px-2 text-center text-[12px] font-semibold text-muted">
          Додай вагу у щоденнику — і сходинки почнуть відмічатися автоматично.
        </p>
      )}
    </div>
  );
}
