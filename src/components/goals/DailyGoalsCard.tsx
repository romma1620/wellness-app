"use client";

import { Icon } from "@/components/icons";
import { NumberField } from "@/components/inputs";
import { Button, Card, ErrorBanner, SectionLabel } from "@/components/ui";
import { useUid } from "@/components/UserProvider";
import { KCAL_GOAL_MAX, STEPS_GOAL_MAX, WATER_MAX } from "@/lib/goals";
import { useProfile } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

interface GoalsForm {
  kcal: number | null;
  steps: number | null;
  water: number | null;
}

const EMPTY: GoalsForm = { kcal: null, steps: null, water: null };

/** Ціль пишеться цілим числом; порожнє поле лишається порожнім (null), а не нулем. */
function toGoal(v: number | null): number | null {
  if (v === null || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}

/**
 * Щоденні цілі: калорії, кроки, вода. Живуть у профілі поряд із цільовою
 * вагою, читаються тим самим спільним запитом, тож картка не додає власного.
 *
 * Кнопка «Зберегти», а не автозбереження: на відміну від щоденника, ціль
 * задають раз і надовго, і півнабране число не має по дорозі ставати ціллю.
 */
export function DailyGoalsCard() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const profileQ = useProfile();

  const [form, setForm] = useState<GoalsForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Засіваємо один раз: фонова ревалідація кешу не має переписувати те,
  // що користувач уже редагує.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || profileQ.data === undefined) return;
    seeded.current = true;
    const p = profileQ.data;
    setForm({
      kcal: p?.kcal_goal ?? null,
      steps: p?.steps_goal ?? null,
      water: p?.water_goal ?? null,
    });
  }, [profileQ.data]);

  const set = <K extends keyof GoalsForm>(key: K, value: GoalsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const { error: err } = await supabase
        .from("profiles")
        .update({
          kcal_goal: toGoal(form.kcal),
          steps_goal: toGoal(form.steps),
          water_goal: toGoal(form.water),
        })
        .eq("id", uid);
      if (err) throw err;
      // цілі читають плитки «Сьогодні» — вони під ключем профілю
      void queryClient.invalidateQueries({ queryKey: ["profile", uid] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      setError("Не вдалося зберегти цілі.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionLabel icon="target">Щоденні цілі</SectionLabel>

      {error && (
        <div className="mb-3">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      <div className="grid grid-cols-2 gap-[10px]">
        <NumberField
          label="Калорії"
          suffix="ккал"
          inputMode="numeric"
          min={1}
          max={KCAL_GOAL_MAX}
          value={form.kcal}
          onChange={(v) => set("kcal", v)}
        />
        <NumberField
          label="Кроки"
          suffix="кроків"
          inputMode="numeric"
          min={1}
          max={STEPS_GOAL_MAX}
          value={form.steps}
          onChange={(v) => set("steps", v)}
        />
      </div>
      <div className="mt-3">
        <NumberField
          label="Вода"
          suffix="склянок на день"
          inputMode="numeric"
          min={1}
          max={WATER_MAX}
          value={form.water}
          onChange={(v) => set("water", v)}
        />
      </div>

      <Button type="button" onClick={save} loading={saving} className="mt-[14px] text-[14.5px]">
        {savedMsg ? (
          <>
            <Icon name="check" size={15} strokeWidth={2.2} />
            Збережено
          </>
        ) : (
          "Зберегти"
        )}
      </Button>

      <p className="mt-[10px] text-[11px] font-normal leading-[1.5] text-muted">
        Порожнє поле — кільце на «Сьогодні» лишається без цілі, але показник пишеться далі.
      </p>
    </Card>
  );
}
