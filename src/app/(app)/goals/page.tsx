"use client";

import { ForecastCard } from "@/components/ForecastCard";
import { RewardLadder } from "@/components/goals/RewardLadder";
import { Icon } from "@/components/icons";
import { NumberField } from "@/components/inputs";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  FieldLabel,
  FullLoader,
  Input,
  PageTitle,
  SectionLabel,
  Sheet,
} from "@/components/ui";
import { useProfile, useRecentWeights, useRewards } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, fmt, todayISO } from "@/lib/utils";
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
      // База прогресу — найнижча вже досягнута сходинка (або поточна вага, якщо таких нема).
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

  function closeEditor() {
    setEditor(null);
    setActionError(null);
  }

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
      <div className="flex flex-col gap-[14px]">
        <PageTitle>Цілі</PageTitle>
        <FullLoader />
      </div>
    );
  }

  const { sorted, isAchieved, next, remaining, progress } = computed;
  const target = profile?.target_weight ?? null;

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle>Цілі</PageTitle>

      {/* Поточна vs ціль */}
      <Card className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            Поточна вага
          </div>
          <div className="mt-2 text-[34px] font-normal leading-[1.1] tracking-[-.01em] text-ink">
            {latestWeight != null ? (
              <>
                {fmt(latestWeight, 1)}{" "}
                <span className="text-[14px] font-medium text-muted">кг</span>
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-[6px] text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            <span className="flex text-accent">
              <Icon name="target" size={13} />
            </span>
            Ціль
          </div>
          {target != null ? (
            <div className="mt-2 text-[20px] font-medium text-accent">{fmt(target, 1)} кг</div>
          ) : (
            <>
              <div className="mt-2 text-[20px] font-medium text-muted">—</div>
              <div className="mt-[2px] text-[11px] font-normal text-muted">
                Задай ціль у профілі
              </div>
            </>
          )}
        </div>
      </Card>

      <ForecastCard />

      {error && !editor && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex items-center justify-between px-[2px]">
        <SectionLabel className="mb-0">Драбинка винагород</SectionLabel>
        <button
          type="button"
          onClick={() => setEditor({ id: null, weight: null, gift: "" })}
          className="flex items-center gap-1 text-[12.5px] font-semibold text-accent"
        >
          <Icon name="plus" size={13} strokeWidth={2} />
          Додати
        </button>
      </div>

      {/* Порожній стан */}
      {sorted.length === 0 && (
        <EmptyState
          icon="target"
          title="Додай першу винагороду"
          hint="Признач собі подарунок за досягнення певної ваги — це мотивує."
        />
      )}

      {/* Драбинка */}
      {sorted.length > 0 && (
        <RewardLadder
          steps={sorted}
          isAchieved={isAchieved}
          nextId={next?.id ?? null}
          latestWeight={latestWeight}
          remaining={remaining}
          progress={progress}
          onSelect={(r) => setEditor({ id: r.id, weight: r.weight, gift: r.gift })}
        />
      )}

      {min7 == null && sorted.length > 0 && (
        <p className="px-2 text-center text-[12px] font-normal leading-[1.5] text-muted">
          Додай вагу у щоденнику — і сходинки почнуть відмічатися автоматично.
        </p>
      )}

      {/* Редактор сходинки */}
      {editor && (
        <Sheet
          open
          onClose={closeEditor}
          title={editor.id ? "Редагувати сходинку" : "Нова сходинка"}
          subtitle="Вага, за досягнення якої чекає подарунок"
        >
          {error && (
            <div className="mb-3">
              <ErrorBanner>{error}</ErrorBanner>
            </div>
          )}
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
                placeholder="Напр., Купальник"
                value={editor.gift}
                onChange={(e) => setEditor((s) => (s ? { ...s, gift: e.target.value } : s))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            <Button type="button" onClick={saveEditor} loading={saving}>
              Зберегти
            </Button>
            <Button type="button" variant="outline" onClick={closeEditor}>
              Скасувати
            </Button>
            {editor.id && (
              <Button
                type="button"
                variant="danger"
                loading={saving}
                onClick={() => remove(editor.id as string)}
              >
                <Icon name="trash" size={14} />
                Видалити сходинку
              </Button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
