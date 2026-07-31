"use client";

import {
  NumberField,
  PresetChips,
  SaveIndicator,
  TagInput,
  useDecimalBuffer,
  WaterDrops,
  type SaveState,
} from "@/components/inputs";
import { Card, ErrorBanner, SectionLabel, Textarea } from "@/components/ui";
import { DaySkeleton } from "@/components/DaySkeleton";
import { CARE_PRESETS } from "@/lib/care";
import {
  applySaved,
  diffDay,
  EMPTY_DAY,
  formFromRow,
  hasChanges,
  type DailyForm,
  type DailyPatch,
} from "@/lib/daily-log";
import { loadDayWindow, saveDayPatch } from "@/lib/daily-log-db";
import { createClient } from "@/lib/supabase/client";
import { addDays, cn, fmt, humanDate, isToday, todayISO } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 700;

/**
 * Форма зберігається разом із датою, якій вона належить: збереження бере дату
 * звідси, а не з поточного рендера, тож дані одного дня не можуть потрапити в інший.
 * `loaded` — знімок із сервера, база для обчислення того, що реально змінилось.
 */
type DayState = {
  date: string;
  loaded: DailyForm;
  form: DailyForm;
};

export default function TodayPage() {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState<DayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [baselineWeight, setBaselineWeight] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");

  // Кожне завантаження має свій номер: відповідь, яку встиг обігнати
  // пізніший запит, ігнорується — інакше форма одного дня лишалась би
  // на екрані під датою іншого.
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ date: string; patch: DailyPatch } | null>(null);

  const commit = useCallback(
    async (target: string, patch: DailyPatch) => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("no-user");
        await saveDayPatch(supabase, uid, target, patch);
        // збережене стає новою базою, щоб не потрапити в наступний патч
        setDay((d) => (d && d.date === target ? { ...d, loaded: applySaved(d.loaded, patch) } : d));
        setSave("saved");
      } catch {
        setSave("error");
      }
    },
    [supabase],
  );

  /** Негайно відправити відкладене збереження: зміна дня, згортання застосунку, unmount. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    void commit(p.date, p.patch);
  }, [commit]);

  const load = useCallback(
    async (d: string) => {
      const my = ++reqId.current;
      setLoadError(null);
      setLoading(true);
      // Стан попереднього дня не має лишатись під новою датою: ефект
      // автозбереження рахує дифф саме з нього.
      setDay(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("no-user");

        const { current, baselineWeight: baseline } = await loadDayWindow(supabase, uid, d);
        if (my !== reqId.current) return; // застаріла відповідь

        const form = formFromRow(current);
        setBaselineWeight(baseline);
        setDay({ date: d, loaded: form, form });
        setLoading(false);
      } catch (err) {
        if (my !== reqId.current) return;
        setLoadError(
          err instanceof Error && err.message === "no-user"
            ? "Сесія завершилась. Онови сторінку."
            : "Не вдалося завантажити день. Перевір зʼєднання.",
        );
        // без знімка з сервера редагувати нічого — інакше писали б наосліп
        setDay(null);
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    flush(); // незбережене з попереднього дня йде в базу, а не в смітник
    load(date);
  }, [date, load, flush]);

  // Автозбереження (debounce). Таймер ніколи не скасовується завантаженням —
  // тільки замінюється новим патчем того самого дня.
  useEffect(() => {
    if (!day) return;
    const patch = diffDay(day.loaded, day.form);
    if (!hasChanges(patch)) return; // load або повернення значення назад

    if (pending.current && pending.current.date !== day.date) flush();
    pending.current = { date: day.date, patch };

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
  }, [day, flush]);

  // Згортання застосунку чи вихід зі сторінки не мають зʼїдати останні 700 мс.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const form = day?.form ?? EMPTY_DAY;
  // Індикатор рахується з реального стану форми, а не з окремого прапорця,
  // тому не може зависнути в «Збереження…» після перемикання дня.
  const dirty = day ? hasChanges(diffDay(day.loaded, day.form)) : false;

  const set = <K extends keyof DailyForm>(key: K, value: DailyForm[K]) =>
    setDay((d) => (d ? { ...d, form: { ...d.form, [key]: value } } : d));

  const weekDelta =
    form.weight != null && baselineWeight != null ? form.weight - baselineWeight : null;

  const weightInput = useDecimalBuffer(form.weight, (v) => set("weight", v), {
    min: 30,
    max: 200,
  });

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
        <SaveIndicator state={dirty ? "saving" : save} />
      </div>

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {loading ? (
        <DaySkeleton />
      ) : (
        <>
          {/* Вага */}
          <Card className="flex items-end justify-between">
            <div className="w-full">
              <div className="text-[12.5px] font-bold text-muted">Вага</div>
              <div className="mt-1">
                <input
                  {...weightInput.inputProps}
                  placeholder="—"
                  className="w-full bg-transparent text-[40px] font-extrabold leading-none text-ink outline-none placeholder:text-primary-light"
                />
              </div>
              <div
                className={cn(
                  "mt-1 text-[12px] font-bold",
                  weightInput.outOfRange ? "text-neg" : "text-muted",
                )}
              >
                кг · допустимо 30–200
              </div>
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
          <div className="flex flex-col gap-3">
            <Card>
              <NumberField
                label="Кроки"
                suffix="кроків"
                placeholder="0"
                min={0}
                max={100000}
                value={form.steps}
                onChange={(v) => set("steps", v == null ? null : Math.round(v))}
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
        </>
      )}

      <p className="px-2 pt-1 text-center text-[12px] font-semibold text-muted">
        Зміни зберігаються автоматично
      </p>
    </div>
  );
}
