"use client";

import {
  NumberField,
  PresetChips,
  SaveIndicator,
  TagInput,
  WaterDrops,
  type SaveState,
} from "@/components/inputs";
import { Card, ErrorBanner, SectionLabel, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { DailyLog } from "@/lib/types";
import { addDays, cn, fmt, humanDate, isToday, todayISO } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CARE_PRESETS = ["Скраб", "Крем", "Гуаша", "Маска", "Тонік", "Сироватка", "SPF"];

type Form = {
  weight: number | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  water: number | null;
  steps: number | null; // фактичні кроки
  sport: string;
  care: string;
  comment: string;
};

const EMPTY: Form = {
  weight: null,
  kcal: null,
  protein: null,
  fat: null,
  carbs: null,
  water: null,
  steps: null,
  sport: "",
  care: "",
  comment: "",
};

export default function TodayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState<Form>(EMPTY);
  const [baselineWeight, setBaselineWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true); // не зберігати одразу після завантаження

  const load = useCallback(
    async (d: string) => {
      setLoading(true);
      setLoadError(null);
      skipSave.current = true;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("no-user");

        const { data, error } = await supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", uid)
          .gte("date", addDays(d, -7))
          .lte("date", d)
          .order("date", { ascending: true });
        if (error) throw error;

        const rows = (data ?? []) as DailyLog[];
        const current = rows.find((r) => r.date === d) ?? null;
        const baseline = rows.find((r) => r.date !== d && r.weight != null)?.weight ?? null;
        setBaselineWeight(baseline);

        setForm(
          current
            ? {
                weight: current.weight,
                kcal: current.kcal,
                protein: current.protein,
                fat: current.fat,
                carbs: current.carbs,
                water: current.water,
                steps: current.steps,
                sport: current.sport ?? "",
                care: current.care ?? "",
                comment: current.comment ?? "",
              }
            : EMPTY,
        );
      } catch (err) {
        setLoadError(
          err instanceof Error && err.message === "no-user"
            ? "Сесія завершилась. Онови сторінку."
            : "Не вдалося завантажити день. Перевір зʼєднання.",
        );
        setForm(EMPTY);
      } finally {
        setLoading(false);
        // дозволяємо збереження після наступного тіку
        setTimeout(() => (skipSave.current = false), 0);
      }
    },
    [supabase],
  );

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Автозбереження (debounce).
  useEffect(() => {
    if (skipSave.current || loading) return;
    if (timer.current) clearTimeout(timer.current);
    setSave("saving");
    timer.current = setTimeout(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("no-user");
        const payload = {
          user_id: uid,
          date,
          ...form,
          sport: form.sport || null,
          care: form.care || null,
          comment: form.comment || null,
        };
        const { error } = await supabase
          .from("daily_logs")
          .upsert(payload, { onConflict: "user_id,date" });
        if (error) throw error;
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const weekDelta =
    form.weight != null && baselineWeight != null ? form.weight - baselineWeight : null;

  return (
    <div className="flex flex-col gap-[15px]">
      {/* Хедер з датою */}
      <div className="flex items-center justify-between px-1 pt-1">
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, -1))}
          aria-label="Попередній день"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[13px] bg-surface text-[20px] font-bold text-muted shadow-soft active:scale-95"
        >
          ‹
        </button>
        <div className="relative text-center">
          <div className="text-[18px] font-extrabold">
            {isToday(date) ? "Сьогодні" : "День"}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-1 text-[12.5px] font-semibold text-muted">
            {humanDate(date)}
            <span aria-hidden>📅</span>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => !isToday(date) && setDate((d) => addDays(d, 1))}
          aria-label="Наступний день"
          disabled={isToday(date)}
          className={cn(
            "flex h-[38px] w-[38px] items-center justify-center rounded-[13px] text-[20px] font-bold active:scale-95",
            isToday(date)
              ? "bg-surface text-muted opacity-40"
              : "bg-primary-light text-primary",
          )}
        >
          ›
        </button>
      </div>

      <div className="flex justify-end px-1">
        <SaveIndicator state={save} />
      </div>

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {/* Вага */}
      <Card className="flex items-end justify-between">
        <div className="w-full">
          <div className="text-[12.5px] font-bold text-muted">Вага</div>
          <div className="mt-1">
            <input
              inputMode="decimal"
              placeholder="—"
              value={form.weight === null ? "" : String(form.weight).replace(".", ",")}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (raw === "") return set("weight", null);
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 30 && n <= 200) set("weight", n);
                else if (raw.match(/^\d*[.,]?\d*$/)) set("weight", Number.isFinite(n) ? n : null);
              }}
              className="w-full bg-transparent text-[40px] font-extrabold leading-none text-ink outline-none placeholder:text-primary-light"
            />
          </div>
          <div className="mt-1 text-[12px] font-bold text-muted">кг · допустимо 30–200</div>
        </div>
        {weekDelta != null && Math.abs(weekDelta) >= 0.05 && (
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "text-[13px] font-extrabold",
                weekDelta < 0 ? "text-pos" : "text-warn",
              )}
            >
              {weekDelta < 0 ? "↓" : "↑"} {fmt(Math.abs(weekDelta), 1)} кг
            </div>
            <div className="text-[11px] font-semibold text-muted">за тиждень</div>
          </div>
        )}
      </Card>

      {/* Харчування */}
      <Card>
        <SectionLabel>Харчування</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Калорії"
            suffix="ккал"
            value={form.kcal}
            onChange={(v) => set("kcal", v)}
          />
          <NumberField
            label="Білки"
            suffix="г"
            value={form.protein}
            onChange={(v) => set("protein", v)}
          />
          <NumberField label="Жири" suffix="г" value={form.fat} onChange={(v) => set("fat", v)} />
          <NumberField
            label="Вуглеводи"
            suffix="г"
            value={form.carbs}
            onChange={(v) => set("carbs", v)}
          />
        </div>
      </Card>

      {/* Вода */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel className="mb-0">Вода</SectionLabel>
          <div className="text-[13px] font-extrabold text-primary">
            {form.water ?? 0} / 8 склянок
          </div>
        </div>
        <WaterDrops value={form.water} onChange={(v) => set("water", v)} />
      </Card>

      {/* Кроки + спорт */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <NumberField
            label="Кроки"
            suffix="тис."
            placeholder="0"
            min={0}
            max={50}
            value={form.steps == null ? null : form.steps / 1000}
            onChange={(v) => set("steps", v == null ? null : Math.round(v * 1000))}
          />
        </Card>
        <Card>
          <SectionLabel>Спорт</SectionLabel>
          <TagInput
            value={form.sport}
            onChange={(v) => set("sport", v)}
            placeholder="зал, пілатес…"
          />
        </Card>
      </div>

      {/* Догляд */}
      <Card>
        <SectionLabel>Догляд за шкірою</SectionLabel>
        <PresetChips presets={CARE_PRESETS} value={form.care} onChange={(v) => set("care", v)} />
      </Card>

      {/* Коментар */}
      <Card>
        <SectionLabel>Коментар дня</SectionLabel>
        <Textarea
          rows={3}
          placeholder="Як минув день, самопочуття, настрій…"
          value={form.comment}
          onChange={(e) => set("comment", e.target.value)}
        />
      </Card>

      <p className="px-2 pt-1 text-center text-[12px] font-semibold text-muted">
        Зміни зберігаються автоматично
      </p>
    </div>
  );
}
